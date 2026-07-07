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

// --- Progress Ring Component (SVG with CSS Variables & Gradients) ---
function ProgressRing({ percent, size = 90, strokeWidth = 8, color = 'url(#grad-primary-secondary)' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const clampedPercent = Math.min(percent, 100)
  const offset = circumference - (clampedPercent / 100) * circumference

  return (
    <div className="relative flex items-center justify-center select-none hover:scale-105 transition-transform duration-300">
      <svg width={size} height={size} className="shrink-0">
        {/* Track */}
        <circle 
          cx={size / 2} 
          cy={size / 2} 
          r={radius} 
          fill="none" 
          stroke="var(--color-outline-variant)" 
          strokeWidth={strokeWidth} 
          opacity="0.15"
        />
        {/* Progress */}
        <circle
          cx={size / 2} 
          cy={size / 2} 
          r={radius}
          fill="none" 
          stroke={color} 
          strokeWidth={strokeWidth}
          strokeDasharray={circumference} 
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ 
            transition: 'stroke-dashoffset 1.3s cubic-bezier(0.4, 0, 0.2, 1)', 
            transform: 'rotate(-90deg)', 
            transformOrigin: '50% 50%' 
          }}
        />
      </svg>
      {/* Inner Label */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-body-md font-mono font-black text-on-surface tracking-tighter">
          {percent > 999 ? '999+' : `${Math.round(percent)}%`}
        </span>
      </div>
    </div>
  )
}

// --- Budget Progress Bar ---
function BudgetBar({ label, spent, limit, categoryLabel }) {
  const percent = limit > 0 ? (spent / limit) * 100 : 0
  const remaining = limit - spent
  const clampedPercent = Math.min(percent, 100)
  
  let barGradientClass = 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]'
  let glowClass = 'shadow-[0_0_10px_rgba(0,245,255,0.25)]'
  
  if (percent >= 100) {
    barGradientClass = 'bg-[var(--color-error)]'
    glowClass = 'shadow-[0_0_10px_rgba(255,113,108,0.4)]'
  } else if (percent >= 80) {
    barGradientClass = 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-tertiary)]'
    glowClass = 'shadow-[0_0_10px_rgba(168,85,247,0.25)]'
  }

  return (
    <div className="space-y-2 p-3.5 bg-surface-container-low/30 backdrop-blur-sm rounded-xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{label}</p>
          <p className="text-[10px] text-on-surface-variant font-medium tracking-wider uppercase">{categoryLabel}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="font-mono text-xs font-bold text-on-surface">{formatCurrency(spent)} <span className="text-on-surface-variant font-normal">/ {formatCurrency(limit)}</span></p>
          <p className={`font-mono text-[10px] font-bold ${remaining < 0 ? 'text-error' : 'text-emerald-500'}`}>
            {remaining < 0 ? `Excedido: ${formatCurrency(Math.abs(remaining))}` : `Restante: ${formatCurrency(remaining)}`}
          </p>
        </div>
      </div>
      <div className="w-full h-3 bg-surface-container-high/40 rounded-full overflow-hidden border border-outline-variant/20">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${barGradientClass} ${glowClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  )
}

// --- Sales Goal Progress Bar ---
function GoalBar({ label, current, target, period }) {
  const percent = target > 0 ? (current / target) * 100 : 0
  const remaining = target - current
  const clampedPercent = Math.min(percent, 100)
  const periodLabel = period === 'diario' ? 'Diario' : period === 'semanal' ? 'Semanal' : 'Mensual'

  let barGradientClass = 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]'
  let glowClass = 'shadow-[0_0_10px_rgba(0,245,255,0.25)]'
  
  if (percent >= 100) {
    barGradientClass = 'bg-gradient-to-r from-[var(--color-secondary)] to-emerald-500'
    glowClass = 'shadow-[0_0_10px_rgba(57,255,20,0.3)]'
  }

  return (
    <div className="space-y-2 p-3.5 bg-surface-container-low/30 backdrop-blur-sm rounded-xl border border-outline-variant/40 hover:border-emerald-500/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{label}</p>
          <p className="text-[10px] text-on-surface-variant font-medium tracking-wider uppercase">Meta {periodLabel}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="font-mono text-xs font-bold text-on-surface">{formatCurrency(current)} <span className="text-on-surface-variant font-normal">/ {formatCurrency(target)}</span></p>
          <p className={`font-mono text-[10px] font-bold ${remaining <= 0 ? 'text-emerald-500 font-extrabold animate-pulse' : 'text-on-surface-variant'}`}>
            {remaining <= 0 ? '¡Meta Cumplida!' : `Restan: ${formatCurrency(remaining)}`}
          </p>
        </div>
      </div>
      <div className="w-full h-3 bg-surface-container-high/40 rounded-full overflow-hidden border border-outline-variant/20">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${barGradientClass} ${glowClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  )
}

// --- Budget Progress Ring Card ---
function BudgetRingCard({ label, spent, limit, categoryLabel }) {
  const percent = limit > 0 ? (spent / limit) * 100 : 0
  const remaining = limit - spent
  
  let ringColor = 'url(#grad-primary-secondary)'
  if (percent >= 100) {
    ringColor = 'url(#grad-error)'
  } else if (percent >= 80) {
    ringColor = 'url(#grad-primary-tertiary)'
  }

  return (
    <div className="flex flex-col items-center justify-between p-4 bg-surface-container-low/30 backdrop-blur-sm rounded-xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300 text-center space-y-3">
      <div className="min-w-0 w-full">
        <p className="text-sm font-semibold text-on-surface truncate">{label}</p>
        <p className="text-[10px] text-on-surface-variant font-medium tracking-wider uppercase truncate">{categoryLabel}</p>
      </div>
      <ProgressRing 
        percent={percent} 
        size={85} 
        strokeWidth={7} 
        color={ringColor} 
      />
      <div className="w-full">
        <p className="font-mono text-xs font-bold text-on-surface truncate">{formatCurrency(spent)}</p>
        <p className="text-[10px] text-on-surface-variant truncate">Límite: {formatCurrency(limit)}</p>
        <p className={`font-mono text-[10px] font-bold mt-1 truncate ${remaining < 0 ? 'text-error' : 'text-emerald-500'}`}>
          {remaining < 0 ? `Excedido: ${formatCurrency(Math.abs(remaining))}` : `Resta: ${formatCurrency(remaining)}`}
        </p>
      </div>
    </div>
  )
}

// --- Sales Goal Progress Ring Card ---
function GoalRingCard({ label, current, target, period }) {
  const percent = target > 0 ? (current / target) * 100 : 0
  const remaining = target - current
  const periodLabel = period === 'diario' ? 'Diario' : period === 'semanal' ? 'Semanal' : 'Mensual'

  let ringColor = 'url(#grad-primary-secondary)'
  if (percent >= 100) {
    ringColor = 'url(#grad-secondary-emerald)'
  }

  return (
    <div className="flex flex-col items-center justify-between p-4 bg-surface-container-low/30 backdrop-blur-sm rounded-xl border border-outline-variant/40 hover:border-emerald-500/20 transition-all duration-300 text-center space-y-3">
      <div className="min-w-0 w-full">
        <p className="text-sm font-semibold text-on-surface truncate">{label}</p>
        <p className="text-[10px] text-on-surface-variant font-medium tracking-wider uppercase truncate">Meta {periodLabel}</p>
      </div>
      <ProgressRing 
        percent={percent} 
        size={85} 
        strokeWidth={7} 
        color={ringColor} 
      />
      <div className="w-full">
        <p className="font-mono text-xs font-bold text-on-surface truncate">{formatCurrency(current)}</p>
        <p className="text-[10px] text-on-surface-variant truncate">Meta: {formatCurrency(target)}</p>
        <p className={`font-mono text-[10px] font-bold mt-1 truncate ${remaining <= 0 ? 'text-emerald-500 font-extrabold animate-pulse' : 'text-on-surface-variant'}`}>
          {remaining <= 0 ? '¡Meta Cumplida!' : `Resta: ${formatCurrency(remaining)}`}
        </p>
      </div>
    </div>
  )
}

// --- Doughnut Chart Component (SVG with Hover Interaction) ---
function DoughnutChart({ data, total, title, icon, iconColor }) {
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  
  const radius = 50
  const strokeWidth = 14
  const size = 130
  const circumference = 2 * Math.PI * radius // ~314.16
  
  const colors = [
    'var(--color-primary)',
    'var(--color-secondary)',
    'var(--color-tertiary)',
    '#38bdf8', // Light blue
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#a855f7'  // Purple
  ]

  let accumulatedPercent = 0

  return (
    <Card className="p-5 flex flex-col justify-between h-full bg-surface-container-low/30 backdrop-blur-sm border border-outline-variant/40 hover:border-primary/10 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40 mb-4">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className={`material-symbols-outlined text-[18px] ${iconColor}`}>
            {icon}
          </span>
          {title}
        </h3>
        <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-high/40 px-2 py-0.5 rounded-full">
          Total: {formatCurrency(total)}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center py-6 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/20 text-[48px] mb-2 block">
            payments
          </span>
          <p className="text-xs text-on-surface-variant italic">Sin gastos registrados este mes</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 flex-grow">
          {/* SVG Doughnut */}
          <div className="relative flex items-center justify-center shrink-0 select-none">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform rotate-[-90deg]">
              {/* Background Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--color-outline-variant)"
                strokeWidth={strokeWidth}
                opacity="0.1"
              />
              {/* Slices */}
              {data.map((item, idx) => {
                const percent = item.value / total
                const dashArray = `${percent * circumference} ${circumference}`
                const dashOffset = -(accumulatedPercent * circumference)
                accumulatedPercent += percent

                const isHovered = hoveredIndex === idx
                const color = colors[idx % colors.length]

                return (
                  <circle
                    key={item.name}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    className="cursor-pointer transition-all duration-300 origin-center"
                    style={{
                      transition: 'stroke-width 0.2s ease, stroke-dashoffset 0.8s ease'
                    }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(-1)}
                  />
                )
              })}
            </svg>
            
            {/* Center Info Panel */}
            <div className="absolute flex flex-col items-center justify-center text-center max-w-[85px] pointer-events-none">
              {hoveredIndex === -1 ? (
                <>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant/80 tracking-tight leading-none mb-0.5">Gastos</span>
                  <span className="font-mono text-xs font-black text-on-surface leading-none truncate w-full">
                    {formatCurrency(total)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[9px] uppercase font-bold text-primary tracking-tight leading-none mb-0.5 truncate w-full">
                    {data[hoveredIndex].name}
                  </span>
                  <span className="font-mono text-xs font-black text-on-surface leading-none">
                    {formatCurrency(data[hoveredIndex].value)}
                  </span>
                  <span className="text-[9px] text-on-surface-variant/80 font-mono mt-0.5 font-bold leading-none">
                    {Math.round((data[hoveredIndex].value / total) * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex-1 w-full space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
            {data.map((item, idx) => {
              const percent = Math.round((item.value / total) * 100)
              const color = colors[idx % colors.length]
              const isHovered = hoveredIndex === idx

              return (
                <div
                  key={item.name}
                  className={`flex items-center justify-between text-xs p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isHovered
                      ? 'bg-primary/10 border-primary/20 scale-[1.02]'
                      : 'bg-transparent border-transparent hover:bg-surface-container-high/30'
                  }`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-on-surface truncate pr-1">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-1.5 pl-2 font-mono">
                    <span className="text-on-surface font-semibold">{formatCurrency(item.value)}</span>
                    <span className="text-on-surface-variant/60 text-[10px] w-6 text-right font-bold">{percent}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { settings } = useGlobalSettings()
  const navigate = useNavigate()

  const [budgetViewMode, setBudgetViewMode] = useState('bars') // 'bars' | 'rings'
  const [goalsViewMode, setGoalsViewMode] = useState('rings') // 'rings' | 'bars'

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

  // Préstamos Activos (para deuda de préstamos)
  const { data: loans = [], isLoading: loadingLoans } = useQuery({
    queryKey: ['dashboard_loans', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('loans')
          .select('id, principal_amount, status')
        if (error) {
          if (error.code === '42P01') return []
          throw error
        }
        return data || []
      } catch (err) {
        console.warn("Loans table not ready yet on dashboard:", err)
        return []
      }
    },
    enabled: !!user,
  })

  // Pagos de préstamos
  const { data: loanPayments = [], isLoading: loadingLoanPayments } = useQuery({
    queryKey: ['dashboard_loan_payments', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('loan_payments')
          .select('loan_id, principal_component')
        if (error) {
          if (error.code === '42P01') return []
          throw error
        }
        return data || []
      } catch (err) {
        console.warn("Loan payments table not ready yet on dashboard:", err)
        return []
      }
    },
    enabled: !!user,
  })

  const loading = loadingExpenses || loadingOrders || loadingQuotes || loadingLoans || loadingLoanPayments

  const totalLoanDebt = useMemo(() => {
    let total = 0
    loans.forEach(loan => {
      if (loan.status === 'activo') {
        const paid = loanPayments
          .filter(p => p.loan_id === loan.id)
          .reduce((sum, p) => sum + Number(p.principal_component || 0), 0)
        total += Math.max(0, Number(loan.principal_amount || 0) - paid)
      }
    })
    return total
  }, [loans, loanPayments])

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

        // En las metas, deben tomarse en cuenta todas las ventas
        currentSales += parseFloat(o.total_amount) || 0
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
        // En los presupuestos deben tomarse en cuenta los gastos respectivos de cada sub categoría
        const subcategoriesOfBudgetCategory = expenseStructure[budget.categoryKey]?.subcategories 
          ? Object.keys(expenseStructure[budget.categoryKey].subcategories)
          : []
        const matchesSubcategory = subcategoriesOfBudgetCategory.includes(exp.subcategory)

        if (exp.category_key === budget.categoryKey || matchesSubcategory) {
          if (exp.date >= periodStart) {
            spent += parseFloat(exp.amount) || 0
          }
        }
      })

      return { ...budget, spent }
    })
  }, [budgets, monthExpenses, startOfWeek, startOfMonth, expenseStructure])

  // --- Cálculos de Gastos Personales y de Casa ---
  const personalData = useMemo(() => {
    const subcats = expenseStructure.PERSONAL?.subcategories ? Object.keys(expenseStructure.PERSONAL.subcategories) : []
    const totals = {}
    subcats.forEach(s => { totals[s] = 0 })
    
    let totalAll = 0
    monthExpenses.forEach(exp => {
      const isPersonal = exp.category_key === 'PERSONAL' || subcats.includes(exp.subcategory)
      if (isPersonal) {
        const amt = parseFloat(exp.amount) || 0
        totalAll += amt
        const subName = exp.subcategory || 'Otro'
        totals[subName] = (totals[subName] || 0) + amt
      }
    })
    
    return {
      total: totalAll,
      breakdown: Object.entries(totals)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
    }
  }, [monthExpenses, expenseStructure])

  const casaData = useMemo(() => {
    const subcats = expenseStructure.CASA_FAMILIA?.subcategories ? Object.keys(expenseStructure.CASA_FAMILIA.subcategories) : []
    const totals = {}
    subcats.forEach(s => { totals[s] = 0 })
    
    let totalAll = 0
    monthExpenses.forEach(exp => {
      const isCasa = exp.category_key === 'CASA_FAMILIA' || subcats.includes(exp.subcategory)
      if (isCasa) {
        const amt = parseFloat(exp.amount) || 0
        totalAll += amt
        const subName = exp.subcategory || 'Otro'
        totals[subName] = (totals[subName] || 0) + amt
      }
    })
    
    return {
      total: totalAll,
      breakdown: Object.entries(totals)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
    }
  }, [monthExpenses, expenseStructure])

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Skeleton variant="rectangular" className="h-[96px]" />
          <Skeleton variant="rectangular" className="h-[96px]" />
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
      label: 'Cuentas por Cobrar',
      value: formatCurrency(financialKPIs.pendingBalance),
      icon: 'hourglass_empty',
      effectClass: 'border-l-4 border-l-amber-500 border-t border-r border-b border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] bg-white/10',
      iconColor: 'text-amber-500'
    },
    {
      label: 'Gastos del Mes',
      value: formatCurrency(financialKPIs.totalExpensesMonth),
      icon: 'account_balance_wallet',
      effectClass: 'border-l-4 border-l-error border-t border-r border-b border-error/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] bg-white/10',
      iconColor: 'text-error'
    },
    {
      label: 'Deuda Financiera',
      value: formatCurrency(totalLoanDebt),
      icon: 'account_balance',
      effectClass: 'border-l-4 border-l-pink-500 border-t border-r border-b border-pink-500/20 shadow-[0_0_12px_rgba(236,72,153,0.15)] bg-white/10',
      iconColor: 'text-pink-500'
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
      {/* Global SVG Gradients for Progress Rings */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <linearGradient id="grad-primary-secondary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-secondary)" />
          </linearGradient>
          <linearGradient id="grad-primary-tertiary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-tertiary)" />
          </linearGradient>
          <linearGradient id="grad-secondary-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-secondary)" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="grad-error" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-error)" />
            <stop offset="100%" stopColor="var(--color-error)" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Page header */}
      <div>
        <h1 className="text-headline-md font-semibold text-on-surface">Dashboard</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Resumen financiero del mes en curso
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricCards.map((card) => (
          <Card
            key={card.label}
            className={`relative overflow-hidden backdrop-blur-md transition-all duration-300 hover:scale-[1.02] ${card.effectClass}`}
          >
            <div className="p-4 relative overflow-hidden h-[98px] flex flex-col justify-between">
              {/* Row 1: Label and Icon */}
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[10px] font-bold font-sans uppercase tracking-widest text-on-surface-variant truncate pr-1">
                  {card.label}
                </span>
                <div className="w-7 h-7 bg-surface-container-high rounded-full flex items-center justify-center shrink-0 border border-white/5">
                  <span className={`material-symbols-outlined text-[15px] ${card.iconColor}`}>
                    {card.icon}
                  </span>
                </div>
              </div>
              
              {/* Row 2: Large Value taking full width */}
              <div className="mt-auto">
                <p className="font-mono font-black text-xl text-white tracking-tight leading-none">
                  {card.value}
                </p>
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
              <div className="px-5 py-3 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-[20px]">flag</span>
                  Metas de Ventas
                </h2>
                <div className="flex bg-surface-container-high/40 p-0.5 rounded-lg border border-outline-variant/30 select-none w-fit">
                  <button
                    onClick={() => setGoalsViewMode('bars')}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                      goalsViewMode === 'bars'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">align_horizontal_left</span>
                    Barras
                  </button>
                  <button
                    onClick={() => setGoalsViewMode('rings')}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                      goalsViewMode === 'rings'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">progress_activity</span>
                    Anillos
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-6">
                {goalsViewMode === 'rings' ? (
                  <>
                    {/* Global Goals (Rings) */}
                    {globalGoals.length > 0 && (
                      <div className={`grid grid-cols-1 ${globalGoals.length === 2 ? 'sm:grid-cols-2' : globalGoals.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-6 justify-items-center`}>
                        {globalGoals.map(g => (
                          <div key={g.id} className="flex flex-col items-center gap-3">
                            <ProgressRing
                              percent={g.percent}
                              color={g.percent >= 100 ? 'url(#grad-secondary-emerald)' : g.period === 'diario' ? 'url(#grad-primary-secondary)' : g.period === 'semanal' ? 'url(#grad-primary-tertiary)' : 'var(--color-primary)'}
                              size={95}
                              strokeWidth={8}
                            />
                            <div className="text-center">
                              <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">
                                {g.period === 'diario' ? 'Hoy (Global)' : g.period === 'semanal' ? 'Semana (Global)' : 'Mes (Global)'}
                              </p>
                              <p className="font-mono text-sm text-on-surface mt-0.5">{formatCurrency(g.current)}</p>
                              <p className="font-mono text-[10px] text-on-surface-variant">Meta: {formatCurrency(g.targetAmount)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Category Goals (Rings in Grid) */}
                    {categoryGoals.length > 0 && (
                      <div className={`${globalGoals.length > 0 ? 'pt-5 border-t border-outline-variant' : ''} space-y-3`}>
                        <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">Metas por Categoría</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {categoryGoals.map(g => {
                            const catData = settings?.categories?.find(c => c.id === g.categoryId)
                            return (
                              <GoalRingCard
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
                  </>
                ) : (
                  // BARS VIEW
                  <div className="space-y-6">
                    {/* Global Goals (Bars) */}
                    {globalGoals.length > 0 && (
                      <div className="space-y-4">
                        <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">Metas Globales</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {globalGoals.map(g => (
                            <GoalBar
                              key={g.id}
                              label="Ventas Globales"
                              current={g.current}
                              target={g.targetAmount}
                              period={g.period}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category Goals (Bars) */}
                    {categoryGoals.length > 0 && (
                      <div className={`${globalGoals.length > 0 ? 'pt-5 border-t border-outline-variant' : ''} space-y-4`}>
                        <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">Metas por Categoría</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                )}
              </div>
            </Card>
          )}
          {/* === GRÁFICOS RESUMEN DE GASTOS === */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DoughnutChart
              data={personalData.breakdown}
              total={personalData.total}
              title="Gastos Personales (Mes)"
              icon="person"
              iconColor="text-primary"
            />
            <DoughnutChart
              data={casaData.breakdown}
              total={casaData.total}
              title="Gastos Casa y Familia (Mes)"
              icon="home"
              iconColor="text-cyan-500"
            />
          </div>

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
              <div className="px-5 py-3 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">account_balance_wallet</span>
                  Presupuestos
                </h2>
                <div className="flex bg-surface-container-high/40 p-0.5 rounded-lg border border-outline-variant/30 select-none w-fit">
                  <button
                    onClick={() => setBudgetViewMode('bars')}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                      budgetViewMode === 'bars'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">align_horizontal_left</span>
                    Barras
                  </button>
                  <button
                    onClick={() => setBudgetViewMode('rings')}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                      budgetViewMode === 'rings'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">progress_activity</span>
                    Anillos
                  </button>
                </div>
              </div>
              <div className="p-5">
                {budgetViewMode === 'rings' ? (
                  <div className="grid grid-cols-2 gap-4">
                    {budgetMetrics.map(bm => (
                      <BudgetRingCard
                        key={bm.id}
                        label={expenseStructure[bm.categoryKey]?.label || bm.categoryKey}
                        categoryLabel={bm.period === 'semanal' ? 'Semanal' : 'Mensual'}
                        spent={bm.spent}
                        limit={bm.limitAmount}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
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
                )}
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
