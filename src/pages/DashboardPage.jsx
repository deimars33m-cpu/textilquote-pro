import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useGlobalSettings } from '@/context/GlobalSettingsContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Card, Skeleton, StatusBadge } from '@/components/ui/index.jsx'

// --- Helpers de Fechas ---
function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getStartOfWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getStartOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// --- Progress Ring Component (SVG) ---
function ProgressRing({ percent, size = 80, strokeWidth = 7, color = '#10b981', bgColor = 'rgba(255,255,255,0.08)' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const clampedPercent = Math.min(percent, 100)
  const offset = circumference - (clampedPercent / 100) * circumference

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="fill-on-surface text-[13px] font-mono font-bold">
        {percent > 999 ? '999+' : `${Math.round(percent)}%`}
      </text>
    </svg>
  )
}

// --- Budget Progress Bar ---
function BudgetBar({ label, spent, limit, categoryLabel }) {
  const percent = limit > 0 ? (spent / limit) * 100 : 0
  const remaining = limit - spent
  const barColor = percent >= 100 ? '#ef4444' : percent >= 80 ? '#f59e0b' : '#10b981'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">{label}</p>
          <p className="text-[10px] text-on-surface-variant">{categoryLabel}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="font-mono text-xs text-on-surface">{formatCurrency(spent)} / {formatCurrency(limit)}</p>
          <p className={`font-mono text-[10px] font-bold ${remaining < 0 ? 'text-error' : 'text-emerald-500'}`}>
            {remaining < 0 ? `Excedido: ${formatCurrency(Math.abs(remaining))}` : `Restante: ${formatCurrency(remaining)}`}
          </p>
        </div>
      </div>
      <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

function GoalBar({ label, current, target, period }) {
  const percent = target > 0 ? (current / target) * 100 : 0
  const remaining = target - current
  const barColor = percent >= 100 ? '#10b981' : percent >= 80 ? '#34d399' : '#60a5fa'
  const periodLabel = period === 'diario' ? 'Diario' : period === 'semanal' ? 'Semanal' : 'Mensual'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">{label}</p>
          <p className="text-[10px] text-on-surface-variant">Meta {periodLabel}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="font-mono text-xs text-on-surface">{formatCurrency(current)} / {formatCurrency(target)}</p>
          <p className={`font-mono text-[10px] font-bold ${remaining <= 0 ? 'text-emerald-500 font-extrabold animate-pulse' : 'text-on-surface-variant'}`}>
            {remaining <= 0 ? '¡Meta Cumplida!' : `Restan: ${formatCurrency(remaining)}`}
          </p>
        </div>
      </div>
      <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { settings } = useGlobalSettings()
  const navigate = useNavigate()

  const today = getToday()
  const startOfWeek = getStartOfWeek()
  const startOfMonth = getStartOfMonth()

  const budgets = settings?.budgets || []
  const salesGoals = Array.isArray(settings?.salesGoals) ? settings.salesGoals : []
  const expenseStructure = settings?.expenseStructure || {}

  // --- Queries con React Query (cacheados 5 min) ---

  // Gastos del mes actual (para presupuestos)
  const { data: monthExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['dashboard_expenses', user?.id, startOfMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('category_key, subcategory, amount, date')
        .gte('date', startOfMonth)
        .order('date', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  // Pedidos (para metas de ventas) — del mes con items para categorización
  const { data: monthOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['dashboard_orders', user?.id, startOfMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, paid_amount, status, created_at, terceros(name), order_items(name, category, product_category, total_price)')
        .gte('created_at', `${startOfMonth}T00:00:00`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  // Cotizaciones recientes
  const { data: recentQuotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ['dashboard_quotes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, created_at, total_price, terceros(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  const loading = loadingExpenses || loadingOrders || loadingQuotes

  // --- Cálculos de Metas de Ventas ---
  const salesGoalsMetrics = useMemo(() => {
    return salesGoals.map(goal => {
      let currentSales = 0
      const periodStart = goal.period === 'diario'
        ? today
        : goal.period === 'semanal'
          ? startOfWeek
          : startOfMonth

      monthOrders.forEach(o => {
        if (!['pendiente', 'en_proceso', 'listo', 'entregado'].includes(o.status)) return
        const orderDate = o.created_at?.split('T')[0]
        if (orderDate < periodStart) return

        if (goal.categoryId === 'global') {
          // Meta global: suma el total de la orden
          currentSales += parseFloat(o.total_amount) || 0
        } else {
          // Meta por categoría: suma solo el total de los ítems de esa categoría
          const items = o.order_items || []
          items.forEach(item => {
            if (item.category === goal.categoryId) {
              currentSales += parseFloat(item.total_price) || 0
            }
          })
        }
      })

      return {
        ...goal,
        current: currentSales,
        percent: goal.targetAmount > 0 ? (currentSales / goal.targetAmount) * 100 : 0
      }
    })
  }, [salesGoals, monthOrders, today, startOfWeek, startOfMonth])

  // --- Cálculos de Presupuestos ---
  const budgetMetrics = useMemo(() => {
    return budgets.map(budget => {
      let spent = 0

      const periodStart = budget.period === 'semanal' ? startOfWeek : startOfMonth

      monthExpenses.forEach(exp => {
        // Evaluar a nivel de categoría solamente
        if (exp.category_key === budget.categoryKey) {
          if (exp.date >= periodStart) {
            spent += parseFloat(exp.amount) || 0
          }
        }
      })

      return { ...budget, spent }
    })
  }, [budgets, monthExpenses, startOfWeek, startOfMonth])

  // --- KPI Cards Financieros ---
  const financialKPIs = useMemo(() => {
    let totalRevenue = 0
    let totalCollected = 0
    let totalExpensesMonth = 0
    let ordersCount = 0
    let todayRevenue = 0

    monthOrders.forEach(o => {
      if (o.status !== 'cancelado') {
        totalRevenue += parseFloat(o.total_amount) || 0
        totalCollected += parseFloat(o.paid_amount) || 0
        ordersCount++
        if (o.created_at?.split('T')[0] === today) {
          todayRevenue += parseFloat(o.total_amount) || 0
        }
      }
    })

    monthExpenses.forEach(exp => {
      totalExpensesMonth += parseFloat(exp.amount) || 0
    })

    return {
      totalRevenue,
      totalCollected,
      totalExpensesMonth,
      pendingBalance: totalRevenue - totalCollected,
      ordersCount,
      todayRevenue,
      netProfit: totalCollected - totalExpensesMonth
    }
  }, [monthOrders, monthExpenses, today])

  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="text" className="h-4 w-96 opacity-60" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton variant="rectangular" className="h-[96px]" />
          <Skeleton variant="rectangular" className="h-[96px]" />
          <Skeleton variant="rectangular" className="h-[96px]" />
          <Skeleton variant="rectangular" className="h-[96px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton variant="rectangular" className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton variant="rectangular" className="h-80" />
          </div>
        </div>
      </div>
    )
  }

  const metricCards = [
    {
      label: 'Ventas del Mes',
      value: formatCurrency(financialKPIs.totalRevenue),
      icon: 'trending_up',
      effectClass: 'border-l-4 border-l-emerald-500 border-t border-r border-b border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-white/10',
      iconColor: 'text-emerald-500'
    },
    {
      label: 'Cobrado del Mes',
      value: formatCurrency(financialKPIs.totalCollected),
      icon: 'payments',
      effectClass: 'border-l-4 border-l-cyan-500 border-t border-r border-b border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)] bg-white/10',
      iconColor: 'text-cyan-500'
    },
    {
      label: 'Gastos del Mes',
      value: formatCurrency(financialKPIs.totalExpensesMonth),
      icon: 'account_balance_wallet',
      effectClass: 'border-l-4 border-l-error border-t border-r border-b border-error/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] bg-white/10',
      iconColor: 'text-error'
    },
    {
      label: 'Utilidad Neta',
      value: formatCurrency(financialKPIs.netProfit),
      icon: 'savings',
      effectClass: `border-l-4 ${financialKPIs.netProfit >= 0 ? 'border-l-primary border-primary/20 shadow-[0_0_12px_rgba(255,122,0,0.15)]' : 'border-l-error border-error/20 shadow-[0_0_12px_rgba(239,68,68,0.15)]'} border-t border-r border-b bg-white/10`,
      iconColor: financialKPIs.netProfit >= 0 ? 'text-primary' : 'text-error'
    },
  ]

  const globalGoals = salesGoalsMetrics.filter(g => g.categoryId === 'global')
  const categoryGoals = salesGoalsMetrics.filter(g => g.categoryId !== 'global')
  const hasGoals = salesGoalsMetrics.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-headline-md font-semibold text-on-surface">Dashboard</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Resumen financiero del mes en curso
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
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* === METAS DE VENTAS === */}
          {hasGoals && (
            <Card className="p-0">
              <div className="px-5 py-4 border-b border-outline-variant">
                <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-[20px]">flag</span>
                  Metas de Ventas — Logros
                </h2>
              </div>
              <div className="p-5 space-y-6">
                {/* Global Goals (Rings) */}
                {globalGoals.length > 0 && (
                  <div className={`grid grid-cols-1 ${globalGoals.length === 2 ? 'sm:grid-cols-2' : globalGoals.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-6 justify-items-center`}>
                    {globalGoals.map(g => (
                      <div key={g.id} className="flex flex-col items-center gap-3">
                        <ProgressRing
                          percent={g.percent}
                          color={g.percent >= 100 ? '#10b981' : g.period === 'diario' ? '#06b6d4' : g.period === 'semanal' ? '#8b5cf6' : '#ff7a00'}
                          size={90}
                        />
                        <div className="text-center">
                          <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">
                            {g.period === 'diario' ? 'Hoy (Global)' : g.period === 'semanal' ? 'Semana (Global)' : 'Mes (Global)'}
                          </p>
                          <p className="font-mono text-sm text-on-surface">{formatCurrency(g.current)}</p>
                          <p className="font-mono text-[10px] text-on-surface-variant">Meta: {formatCurrency(g.targetAmount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category-Specific Goals (Bars) */}
                {categoryGoals.length > 0 && (
                  <div className={`${globalGoals.length > 0 ? 'pt-5 border-t border-outline-variant' : ''} space-y-4`}>
                    <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">Metas por Categoría</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {categoryGoals.map(g => {
                        const catData = settings?.categories?.find(c => c.id === g.categoryId)
                        return (
                          <GoalBar
                            key={g.id}
                            label={catData?.label || g.categoryId}
                            current={g.current}
                            target={g.targetAmount}
                            period={g.period}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* === PEDIDOS RECIENTES DEL MES === */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">shopping_bag</span>
                Pedidos del Mes ({financialKPIs.ordersCount})
              </h2>
              <button
                onClick={() => navigate('/orders')}
                className="text-body-md text-primary hover:text-primary-container transition-colors font-medium"
              >
                Ver todos →
              </button>
            </div>
            {monthOrders.length === 0 ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-[40px] mb-2 block">inventory_2</span>
                <p className="text-body-md text-on-surface-variant">Sin pedidos este mes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Cliente</th>
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Categoría</th>
                      <th className="text-left px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Estado</th>
                      <th className="text-right px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Monto</th>
                      <th className="text-right px-5 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthOrders.slice(0, 8).map(o => {
                      const firstItem = o.order_items?.[0]
                      return (
                        <tr key={o.id} className="cursor-pointer" onClick={() => navigate('/orders')}>
                          <td className="px-5 py-3 text-body-md text-on-surface">{o.terceros?.name || '—'}</td>
                          <td className="px-5 py-3 text-body-md text-on-surface-variant">{firstItem?.name || firstItem?.category || '—'}</td>
                          <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-5 py-3 text-right font-mono text-data-mono-md text-on-surface">{formatCurrency(o.total_amount)}</td>
                          <td className="px-5 py-3 text-right font-mono text-data-mono-md text-emerald-500">{formatCurrency(o.paid_amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* === CONTROL DE PRESUPUESTOS === */}
          {budgetMetrics.length > 0 && (
            <Card className="p-0">
              <div className="px-5 py-4 border-b border-outline-variant">
                <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">account_balance_wallet</span>
                  Control de Presupuestos
                </h2>
              </div>
              <div className="p-5 space-y-5">
                {budgetMetrics.map(bm => (
                  <BudgetBar
                    key={bm.id}
                    label={expenseStructure[bm.categoryKey]?.label || bm.categoryKey}
                    categoryLabel={bm.period === 'semanal' ? 'Presupuesto Semanal' : 'Presupuesto Mensual'}
                    spent={bm.spent}
                    limit={bm.limitAmount}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* === RESUMEN RÁPIDO === */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant">
              <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-500 text-[20px]">summarize</span>
                Resumen Rápido
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg">
                <span className="text-body-md text-on-surface-variant">Ventas Hoy</span>
                <span className="font-mono text-data-mono-md text-primary font-medium">
                  {formatCurrency(financialKPIs.todayRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg">
                <span className="text-body-md text-on-surface-variant">Saldo Pendiente</span>
                <span className="font-mono text-data-mono-md text-amber-500 font-medium">
                  {formatCurrency(financialKPIs.pendingBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg">
                <span className="text-body-md text-on-surface-variant">Pedidos del Mes</span>
                <span className="font-mono text-data-mono-md text-on-surface font-medium">
                  {financialKPIs.ordersCount}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg">
                <span className="text-body-md text-on-surface-variant">Presupuestos Activos</span>
                <span className="font-mono text-data-mono-md text-on-surface font-medium">
                  {budgets.length}
                </span>
              </div>
            </div>
          </Card>

          {/* === COTIZACIONES RECIENTES === */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-500 text-[20px]">description</span>
                Cotizaciones
              </h2>
              <button
                onClick={() => navigate('/quotes')}
                className="text-body-md text-primary hover:text-primary-container transition-colors font-medium"
              >
                Ver →
              </button>
            </div>
            {recentQuotes.length === 0 ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-[32px] mb-2 block">receipt_long</span>
                <p className="text-body-md text-on-surface-variant">Sin cotizaciones.</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/50">
                {recentQuotes.map(q => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-surface-container-high transition-colors cursor-pointer"
                    onClick={() => navigate(`/quotes/${q.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-on-surface font-medium truncate">{q.terceros?.name || 'Sin cliente'}</p>
                      <p className="text-[10px] text-on-surface-variant">{formatDate(q.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={q.status} />
                      <span className="font-mono text-xs text-on-surface">{formatCurrency(q.total_price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
