import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/hooks/useCompanySettings'
import { calcTotalMonthlyExpenses, toMonthlyAmount } from '@/lib/calculations'
import { formatCurrency, formatPercent, formatDate, formatQuoteNumber, daysSince, expenseCategories } from '@/lib/formatters'
import { Card, StatusBadge, Skeleton, AlertBanner, EmptyState } from '@/components/ui/index.jsx'

export default function DashboardPage() {
  const { user } = useAuth()
  const { settings } = useCompanySettings()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalQuotes: 0,
    monthQuotes: 0,
    avgMargin: 0,
    totalProfit: 0,
  })
  const [topProducts, setTopProducts] = useState([])
  const [monthlyExpenses, setMonthlyExpenses] = useState({ total: 0, items: [] })
  const [outdatedMaterials, setOutdatedMaterials] = useState([])
  const [recentQuotes, setRecentQuotes] = useState([])

  useEffect(() => {
    if (!user) return
    fetchDashboardData()
  }, [user])

  async function fetchDashboardData() {
    setLoading(true)
    try {
      await Promise.all([
        fetchMetrics(),
        fetchTopProducts(),
        fetchExpenses(),
        fetchOutdatedMaterials(),
        fetchRecentQuotes(),
      ])
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMetrics() {
    // Fetch all quotes for metrics
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('id, created_at, status, quote_items(total_price, real_margin, profit)')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching quotes:', error)
      return
    }

    const allQuotes = quotes || []
    const totalQuotes = allQuotes.length

    // Quotes this month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthQuotes = allQuotes.filter(q => q.created_at >= startOfMonth).length

    // Average margin and total profit from quote items
    let totalMargin = 0
    let marginCount = 0
    let totalProfit = 0

    allQuotes.forEach(q => {
      if (q.quote_items && q.quote_items.length > 0) {
        q.quote_items.forEach(item => {
          if (item.real_margin != null) {
            totalMargin += parseFloat(item.real_margin) || 0
            marginCount++
          }
          totalProfit += parseFloat(item.profit) || 0
        })
      }
    })

    setMetrics({
      totalQuotes,
      monthQuotes,
      avgMargin: marginCount > 0 ? Math.round((totalMargin / marginCount) * 10) / 10 : 0,
      totalProfit,
    })
  }

  async function fetchTopProducts() {
    const { data, error } = await supabase
      .from('quote_items')
      .select('product_name, quantity, total_price, quotes!inner(user_id)')
      .eq('quotes.user_id', user.id)

    if (error) {
      console.error('Error fetching top products:', error)
      return
    }

    // Group by product_name and aggregate
    const grouped = {}
    ;(data || []).forEach(item => {
      const name = item.product_name || 'Sin nombre'
      if (!grouped[name]) {
        grouped[name] = { name, count: 0, totalQty: 0, totalRevenue: 0 }
      }
      grouped[name].count++
      grouped[name].totalQty += parseInt(item.quantity) || 0
      grouped[name].totalRevenue += parseFloat(item.total_price) || 0
    })

    const sorted = Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    setTopProducts(sorted)
  }

  async function fetchExpenses() {
    const { data, error } = await supabase
      .from('fixed_expenses')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching expenses:', error)
      return
    }

    const expenses = data || []
    const total = calcTotalMonthlyExpenses(expenses)
    const activeExpenses = expenses.filter(e => e.is_active).map(e => ({
      ...e,
      monthlyAmount: toMonthlyAmount(e.amount, e.frequency),
    }))

    setMonthlyExpenses({ total, items: activeExpenses })
  }

  async function fetchOutdatedMaterials() {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, category, unit_price, price_updated_at')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching materials:', error)
      return
    }

    const outdated = (data || []).filter(m => daysSince(m.price_updated_at) > 30)
    setOutdatedMaterials(outdated)
  }

  async function fetchRecentQuotes() {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, status, created_at, clients(name), quote_items(product_name, quantity, total_price, real_margin)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error fetching recent quotes:', error)
      return
    }

    setRecentQuotes(data || [])
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="text" className="h-4 w-96 opacity-60" />
        </div>

        {/* Bento Metrics Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton variant="rectangular" className="h-[96px]" />
          <Skeleton variant="rectangular" className="h-[96px]" />
          <Skeleton variant="rectangular" className="h-[96px]" />
          <Skeleton variant="rectangular" className="h-[96px]" />
        </div>

        {/* Content grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton variant="rectangular" className="h-64" />
            <Skeleton variant="rectangular" className="h-72" />
          </div>
          <div className="space-y-6">
            <Skeleton variant="rectangular" className="h-80" />
            <Skeleton variant="rectangular" className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  const metricCards = [
    {
      label: 'Utilidad Proyectada Total',
      value: formatCurrency(metrics.totalProfit),
      icon: 'precision_manufacturing',
      effectClass: 'border-l-4 border-l-primary border-t border-r border-b border-primary/20 shadow-[0_0_12px_rgba(255,122,0,0.15)] bg-white/10',
      iconColor: 'text-primary'
    },
    {
      label: 'Promedio de Margen',
      value: formatPercent(metrics.avgMargin),
      icon: 'trending_up',
      effectClass: 'border-l-4 border-l-emerald-500 border-t border-r border-b border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-white/10',
      iconColor: 'text-emerald-500'
    },
    {
      label: 'Total Cotizaciones',
      value: metrics.totalQuotes,
      icon: 'description',
      effectClass: 'border-l-4 border-l-cyan-500 border-t border-r border-b border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-white/10',
      iconColor: 'text-cyan-500'
    },
    {
      label: 'Cotizaciones del Mes',
      value: metrics.monthQuotes,
      icon: 'calendar_month',
      effectClass: 'border-l-4 border-l-violet-500 border-t border-r border-b border-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.15)] bg-white/10',
      iconColor: 'text-violet-500'
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-headline-md font-semibold text-on-surface">Dashboard</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Resumen general de tu negocio textil
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <Card
            key={card.label}
            className={`relative overflow-hidden backdrop-blur-md transition-all duration-300 hover:scale-[1.02] ${card.effectClass}`}
          >
            <div className="p-4 relative overflow-hidden h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-on-surface-variant truncate">
                    {card.label}
                  </p>
                  <p className="font-mono font-bold text-headline-sm text-on-surface truncate">
                    {card.value}
                  </p>
                </div>
                
                <div className="w-8 h-8 bg-surface-container-high rounded-lg flex items-center justify-center shrink-0">
                  <span className={`material-symbols-outlined text-[18px] ${card.iconColor}`}>
                    {card.icon}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Top products + Recent quotes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top products */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant">
              <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">star</span>
                Productos Más Cotizados
              </h2>
            </div>
            {topProducts.length === 0 ? (
              <EmptyState
                icon="inventory_2"
                title="Sin productos aún"
                message="Las estadísticas de productos aparecerán al crear cotizaciones."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">#</th>
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Producto</th>
                      <th className="text-right px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Cotizaciones</th>
                      <th className="text-right px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Unidades</th>
                      <th className="text-right px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Ingreso Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, idx) => (
                      <tr key={p.name}>
                        <td className="px-5 py-3 font-mono text-data-mono-md text-on-surface-variant">{idx + 1}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface font-medium">{p.name}</td>
                        <td className="px-5 py-3 text-right font-mono text-data-mono-md text-on-surface">{p.count}</td>
                        <td className="px-5 py-3 text-right font-mono text-data-mono-md text-on-surface">{p.totalQty.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-mono text-data-mono-md text-primary">{formatCurrency(p.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Recent quotes */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">history</span>
                Cotizaciones Recientes
              </h2>
              <button
                onClick={() => navigate('/quotes')}
                className="text-body-md text-primary hover:text-primary-container transition-colors font-medium"
              >
                Ver todas →
              </button>
            </div>
            {recentQuotes.length === 0 ? (
              <EmptyState
                icon="receipt_long"
                title="Sin cotizaciones"
                message="Crea tu primera cotización para comenzar."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant"># Cotización</th>
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Cliente</th>
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Producto</th>
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Estado</th>
                      <th className="text-right px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentQuotes.map(q => {
                      const item = q.quote_items?.[0]
                      return (
                        <tr
                          key={q.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/quotes/${q.id}`)}
                        >
                          <td className="px-5 py-3 font-mono text-data-mono-md text-primary">
                            {formatQuoteNumber(q.quote_number)}
                          </td>
                          <td className="px-5 py-3 text-body-md text-on-surface">
                            {q.clients?.name || '—'}
                          </td>
                          <td className="px-5 py-3 text-body-md text-on-surface-variant">
                            {item?.product_name || '—'}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={q.status} />
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-data-mono-md text-on-surface">
                            {item ? formatCurrency(item.total_price) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Expenses + Alerts */}
        <div className="space-y-6">
          {/* Monthly expenses */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant">
              <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
                Gastos Fijos Mensuales
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg">
                <span className="text-body-md text-on-surface-variant">Total Mensual</span>
                <span className="font-mono text-data-mono-lg text-primary font-medium">
                  {formatCurrency(monthlyExpenses.total)}
                </span>
              </div>

              {monthlyExpenses.items.length > 0 ? (
                <div className="space-y-1">
                  {monthlyExpenses.items.slice(0, 6).map(exp => (
                    <div key={exp.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-body-md text-on-surface-variant truncate">
                        {exp.name || expenseCategories[exp.category] || exp.category}
                      </span>
                      <span className="font-mono text-data-mono-md text-on-surface shrink-0 ml-3">
                        {formatCurrency(exp.monthlyAmount)}
                      </span>
                    </div>
                  ))}
                  {monthlyExpenses.items.length > 6 && (
                    <p className="text-xs text-on-surface-variant px-3 pt-1">
                      +{monthlyExpenses.items.length - 6} más...
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-body-md text-on-surface-variant text-center py-4">
                  No hay gastos fijos registrados.
                </p>
              )}

              <div className="pt-2 border-t border-outline-variant">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-body-md text-on-surface-variant">Costo/Unidad</span>
                  <span className="font-mono text-data-mono-md text-on-surface">
                    {formatCurrency(
                      settings.monthly_capacity_units
                        ? monthlyExpenses.total / settings.monthly_capacity_units
                        : monthlyExpenses.total / 1000
                    )}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant/60 px-3">
                  Capacidad: {settings.monthly_capacity_units?.toLocaleString() || '1,000'} unidades/mes
                </p>
              </div>
            </div>
          </Card>

          {/* Outdated materials alerts */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant">
              <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[20px]">notifications_active</span>
                Alertas de Precios
              </h2>
            </div>
            <div className="p-5">
              {outdatedMaterials.length === 0 ? (
                <div className="text-center py-4">
                  <span className="material-symbols-outlined text-tertiary text-[32px] mb-2 block">check_circle</span>
                  <p className="text-body-md text-on-surface-variant">
                    Todos los precios están actualizados.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AlertBanner type="warning">
                    {outdatedMaterials.length} material(es) con precios desactualizados ({'>'}30 días)
                  </AlertBanner>
                  <div className="mt-3 space-y-1">
                    {outdatedMaterials.slice(0, 8).map(m => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-3 py-2 rounded hover:bg-surface-container-high transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-body-md text-on-surface truncate">{m.name}</p>
                          <p className="text-xs text-on-surface-variant">
                            {formatCurrency(m.unit_price)} · hace {daysSince(m.price_updated_at)} días
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-error text-[18px] shrink-0 ml-2">
                          warning
                        </span>
                      </div>
                    ))}
                    {outdatedMaterials.length > 8 && (
                      <p className="text-xs text-on-surface-variant text-center pt-2">
                        +{outdatedMaterials.length - 8} materiales más...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
