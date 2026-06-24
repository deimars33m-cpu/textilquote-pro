import { useState, useEffect, useMemo } from 'react'
import { Card, Input, Button, AlertBanner, Modal, SearchInput, Select } from '@/components/ui/index.jsx'
import { formatCurrency, formatDate, expenseStructure as defaultExpenseStructure } from '@/lib/formatters'
import { useAuth } from '@/context/AuthContext'
import { useGlobalSettings } from '@/context/GlobalSettingsContext'
import { supabase } from '@/lib/supabase'
import { useCRUD } from '@/hooks/useCRUD'

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { id: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
  { id: 'qr', label: 'QR', icon: 'qr_code_scanner' },
  { id: 'tarjeta', label: 'Tarjeta', icon: 'credit_card' }
]

const CATEGORY_ICONS = {
  PRODUCCION: 'factory',
  INSUMOS: 'inventory_2',
  GASTOS_FIJOS: 'account_balance',
  INDIRECTOS: 'trending_up',
  PERSONAL: 'person',
  CASA_FAMILIA: 'home'
}

// --- Neural line chart component for futuristic trend ---
function NeuralLineChart({ data, total }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 100)
  const width = 500
  const height = 160
  const padding = 20
  
  const points = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / (data.length - 1)
    const y = height - padding - (d.amount / maxAmount) * (height - 2 * padding)
    return { x, y, ...d }
  })
  
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, '')

  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : ''

  const [hoveredPoint, setHoveredPoint] = useState(null)

  return (
    <div className="bg-surface-container-low/30 backdrop-blur-md p-5 rounded-2xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-auto lg:h-full">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,122,0,0.07),rgba(255,255,255,0))] pointer-events-none" />
      <div className="flex items-center justify-between mb-4 z-10">
        <div>
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary animate-pulse">insights</span>
            Flujo Neural de Gastos (Últimos 15 Días)
          </h3>
          <p className="text-[10px] text-on-surface-variant">Monitoreo continuo de egresos por día</p>
        </div>
        {hoveredPoint ? (
          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 animate-fade-in whitespace-nowrap">
            Día {hoveredPoint.label}: {formatCurrency(hoveredPoint.amount)}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">Promedio: {formatCurrency(total / 15)}/día</span>
        )}
      </div>

      <div className="relative h-[130px] w-full z-10">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="neon-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-secondary)" />
            </linearGradient>
            <linearGradient id="area-glow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + p * (height - 2 * padding)
            return (
              <line 
                key={idx} 
                x1={padding} 
                y1={y} 
                x2={width - padding} 
                y2={y} 
                stroke="var(--color-outline-variant)" 
                strokeWidth="1" 
                opacity="0.06" 
                strokeDasharray="4 4"
              />
            )
          })}

          {/* Area under the line */}
          {areaD && (
            <path d={areaD} fill="url(#area-glow)" />
          )}

          {/* Spark Line */}
          {pathD && (
            <path 
              d={pathD} 
              fill="none" 
              stroke="url(#neon-glow)" 
              strokeWidth="3" 
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow-effect)"
            />
          )}

          {/* Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.date === p.date ? 5.5 : 3}
              fill={hoveredPoint?.date === p.date ? 'var(--color-secondary)' : 'var(--color-primary)'}
              stroke="var(--color-surface)"
              strokeWidth={hoveredPoint?.date === p.date ? 2 : 1}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

// --- Neural donut chart component ---
function NeuralDonut({ data, total }) {
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  
  const radius = 50
  const strokeWidth = 12
  const size = 120
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
    <div className="bg-surface-container-low/30 backdrop-blur-md p-5 rounded-2xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300 flex flex-col justify-between h-auto lg:h-full relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.05),rgba(255,255,255,0))] pointer-events-none" />
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40 mb-3 z-10">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-tertiary animate-spin-slow">donut_large</span>
          Distribución de Egresos
        </h3>
      </div>

      {total === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center py-6 text-center z-10">
          <span className="material-symbols-outlined text-on-surface-variant/20 text-[40px] mb-1 block">payments</span>
          <p className="text-xs text-on-surface-variant italic">Sin datos registrados</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-grow z-10">
          {/* SVG Doughnut */}
          <div className="relative flex items-center justify-center shrink-0 select-none">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform rotate-[-90deg]">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--color-outline-variant)"
                strokeWidth={strokeWidth}
                opacity="0.08"
              />
              {data.map((item, idx) => {
                const percent = item.value / total
                const dashArray = `${percent * circumference} ${circumference}`
                const dashOffset = circumference - (accumulatedPercent * circumference)
                accumulatedPercent += percent

                const isHovered = hoveredIndex === idx
                const color = colors[idx % colors.length]

                return (
                  <circle
                    key={item.key}
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
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(-1)}
                  />
                )
              })}
            </svg>
            
            <div className="absolute flex flex-col items-center justify-center text-center max-w-[75px] pointer-events-none">
              {hoveredIndex === -1 ? (
                <>
                  <span className="text-[8px] uppercase font-bold text-on-surface-variant/80 tracking-tight leading-none mb-0.5">Total</span>
                  <span className="font-mono text-[10px] font-black text-on-surface leading-none truncate w-full">
                    {formatCurrency(total, 0)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[8px] uppercase font-bold text-primary tracking-tight leading-none mb-0.5 truncate w-full">
                    {data[hoveredIndex].name}
                  </span>
                  <span className="font-mono text-[10px] font-black text-on-surface leading-none">
                    {formatCurrency(data[hoveredIndex].value, 0)}
                  </span>
                  <span className="text-[8px] text-on-surface-variant/80 font-mono mt-0.5 font-bold leading-none">
                    {Math.round((data[hoveredIndex].value / total) * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Legend Items */}
          <div className="flex-1 w-full space-y-1 max-h-[120px] overflow-y-auto pr-1">
            {data.slice(0, 5).map((item, idx) => {
              const percent = Math.round((item.value / total) * 100)
              const color = colors[idx % colors.length]
              const isHovered = hoveredIndex === idx

              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between text-[11px] p-1 rounded transition-all duration-200 cursor-pointer ${
                    isHovered
                      ? 'bg-primary/10 border-primary/20 scale-[1.01]'
                      : 'bg-transparent border-transparent hover:bg-surface-container-high/30'
                  }`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-on-surface truncate pr-1">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-1 pl-1 font-mono">
                    <span className="text-on-surface font-semibold">{formatCurrency(item.value, 0)}</span>
                    <span className="text-on-surface-variant/60 text-[9px] text-right font-bold pl-1">{percent}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const getExpenseCategoryStyle = (catKey) => {
  const key = (catKey || '').toUpperCase().trim();
  switch (key) {
    case 'PRODUCCION':
      return 'bg-red-500/15 text-red-400 border border-red-500/30';
    case 'INSUMOS':
      return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    case 'GASTOS_FIJOS':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    case 'INDIRECTOS':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'PERSONAL':
      return 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
    case 'CASA_FAMILIA':
      return 'bg-pink-500/15 text-pink-400 border border-pink-500/30';
    default:
      return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
  }
}

export default function ExpensesAndBudgetsPage() {
  const [activeTab, setActiveTab] = useState('registro') // 'registro', 'dashboard', 'analisis'

  const { user } = useAuth()
  const { settings } = useGlobalSettings()
  const { data: expenses, loading: loadingExpenses, create: createExpense, update: updateExpense, remove: removeExpense } = useCRUD('expenses', {
    orderBy: 'date',
    orderAsc: false
  })

  const [productionAvg, setProductionAvg] = useState(1000)
  const [providers, setProviders] = useState([])
  const [dependientes, setDependientes] = useState([])
  const [terceroType, setTerceroType] = useState('proveedor')
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false) // Control para abrir modal en móvil
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('')
  const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState('')
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [activeActionMenu, setActiveActionMenu] = useState(null)
  const [itemSearch, setItemSearch] = useState('')

  const expenseStructure = settings?.expenseStructure || defaultExpenseStructure

  useEffect(() => {
    async function fetchTerceros() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('terceros')
          .select('*')
          .eq('user_id', user.id)
          .in('role', ['proveedor', 'dependiente'])
          .order('name')
        if (!error && data) {
          setProviders(data.filter(t => t.role === 'proveedor'))
          setDependientes(data.filter(t => t.role === 'dependiente'))
        }
      } catch (err) {
        console.error('Error fetching terceros:', err)
      }
    }
    fetchTerceros()
  }, [user])

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return
      setLoadingOrders(true)
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            created_at,
            total_amount,
            paid_amount,
            status,
            order_items (
              id,
              name,
              category,
              product_category,
              quantity,
              unit_price,
              total_price
            )
          `)
          .eq('user_id', user.id)
        if (!error && data) {
          setOrders(data)
        }
      } catch (err) {
        console.error('Error fetching orders for sublimation:', err)
      } finally {
        setLoadingOrders(false)
      }
    }
    fetchOrders()
  }, [user])

  // --- FORMULARIO WIZARD ---
  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState({
    providerName: '',
    providerNit: '',
    providerPhone: '',
    providerEmail: '',
    categoryKey: '',
    subcategory: '',
    specificItem: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    quantity: 1,
    unitPrice: '',
    amount: '',
    advanceAmount: '',
    paymentMethod: 'efectivo'
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const suggestions = useMemo(() => {
    const q = form.providerName.trim().toLowerCase()
    const genericName = terceroType === 'proveedor' ? 'proveedor genérico' : 'empleado genérico'
    if (!q || q === genericName) return []
    const list = terceroType === 'proveedor' ? providers : dependientes
    return list.filter(p => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q)
  }, [providers, dependientes, form.providerName, terceroType])

  const updateForm = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }

      // Auto-calcular total si cambian cantidad o precio unitario
      if (field === 'quantity' || field === 'unitPrice') {
        const q = Number(next.quantity) || 0
        const p = Number(next.unitPrice) || 0
        if (q > 0 && p > 0) {
          next.amount = (q * p).toFixed(2)
        }
      }
      return next
    })
    setError(null)
    setSuccess(null)
  }

  const validateStep = (step) => {
    if (step === 1) {
      if (!form.providerName) {
        return terceroType === 'proveedor'
          ? 'Ingresa el nombre del proveedor o usa el Genérico'
          : 'Ingresa el nombre del empleado o usa el Genérico'
      }
    }
    if (step === 2) {
      if (!form.categoryKey) return 'Selecciona una categoría principal'
    }
    if (step === 3) {
      if (!form.subcategory) return 'Selecciona una subcategoría'
    }
    if (step === 4) {
      if (!form.specificItem) return 'Selecciona un ítem específico'
    }
    if (step === 5) {
      if (!form.quantity || Number(form.quantity) <= 0) return 'Cantidad inválida'
      if (!form.unitPrice || Number(form.unitPrice) <= 0) return 'Precio unitario inválido'
      if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) return 'Monto total inválido'
      if (form.advanceAmount && isNaN(form.advanceAmount)) return 'Adelanto inválido'
      if (Number(form.advanceAmount) > Number(form.amount)) return 'El adelanto no puede ser mayor al total'
    }
    return null
  }

  const handleNext = () => {
    const err = validateStep(currentStep)
    if (err) {
      setError(err)
      return
    }
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleSaveExpense()
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
      setError(null)
    }
  }

  const handleSaveExpense = async () => {
    if (saving) return;
    const err = validateStep(5)
    if (err) return setError(err)

    setSaving(true)
    setError(null)
    try {
      const defaultGenericName = terceroType === 'proveedor' ? 'Proveedor Genérico' : 'Empleado Genérico'
      const trimmedProvider = form.providerName.trim() || defaultGenericName
      let providerId = null

      const list = terceroType === 'proveedor' ? providers : dependientes
      const existing = list.find(p => p.name.toLowerCase() === trimmedProvider.toLowerCase())
      if (existing) {
        providerId = existing.id
      } else if (trimmedProvider !== 'Proveedor Genérico' && trimmedProvider !== 'Empleado Genérico') {
        try {
          const { data: newProv, error: errProv } = await supabase
            .from('terceros')
            .insert({
              user_id: user.id,
              name: trimmedProvider,
              role: terceroType,
              phone: form.providerPhone.trim() || null,
              email: form.providerEmail.trim() || null,
              notes: form.providerNit ? (terceroType === 'proveedor' ? `NIT: ${form.providerNit}` : `CI: ${form.providerNit}`) : null,
              client_type: terceroType === 'proveedor' ? 'otro' : 'dependiente'
            })
            .select()
            .single()
          if (!errProv && newProv) {
            providerId = newProv.id
            if (terceroType === 'proveedor') {
              setProviders(prev => [...prev, newProv])
            } else {
              setDependientes(prev => [...prev, newProv])
            }
          }
        } catch (e) {
          console.error('Error inserting provider automatically:', e)
        }
      }

      const payload = {
        date: form.date,
        category_key: form.categoryKey,
        category_label: expenseStructure[form.categoryKey].label,
        subcategory: form.subcategory,
        specific_item: form.specificItem,
        description: form.description.trim() || null,
        provider: trimmedProvider,
        provider_id: providerId,
        quantity: Number(form.quantity),
        unit_price: Number(form.unitPrice),
        amount: Number(form.amount),
        advance_amount: form.advanceAmount ? Number(form.advanceAmount) : 0,
        payment_method: form.paymentMethod
      }

      await createExpense(payload)

      // Reset wizard
      setForm({
        providerName: '',
        providerNit: '',
        providerPhone: '',
        providerEmail: '',
        categoryKey: '',
        subcategory: '',
        specificItem: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        quantity: 1,
        unitPrice: '',
        amount: '',
        advanceAmount: '',
        paymentMethod: 'efectivo'
      })
      setTerceroType('proveedor')
      setCurrentStep(1)
      setSuccess('Transacción registrada con éxito')
      setFormOpen(false) // Cerrar modal si está en móvil
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      console.error('Error saving expense:', e)
      setError(`Error al guardar: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar este registro?')) {
      try {
        await removeExpense(id)
      } catch (err) {
        console.error('Error deleting expense:', err)
      }
    }
  }

  const handleUpdateExpensePaymentStatus = async (expenseId, currentAdvance, expenseTotal) => {
    let currentStatus = 'pendiente'
    if (currentAdvance >= expenseTotal) {
      currentStatus = 'pagado'
    } else if (currentAdvance > 0) {
      currentStatus = 'adelanto'
    }

    const statuses = ['pendiente', 'adelanto', 'pagado']
    const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length
    const nextStatus = statuses[nextIdx]

    let nextPaidAmount = 0
    if (nextStatus === 'pagado') {
      nextPaidAmount = expenseTotal
    } else if (nextStatus === 'adelanto') {
      nextPaidAmount = expenseTotal * 0.5 // default to 50%
    }

    try {
      await updateExpense(expenseId, { advance_amount: nextPaidAmount })
    } catch (err) {
      console.error('Error updating expense payment status:', err)
      alert('Error al actualizar el pago del gasto: ' + err.message)
    }
  }

  // --- CÁLCULOS ---
  const currentMonthExpenses = useMemo(() => {
    const now = new Date()
    return expenses.filter(e => {
      const d = new Date(e.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
  }, [expenses])

  const totalsByCategory = useMemo(() => {
    const totals = {}
    
    // Inicializar todas las categorías de la estructura con 0
    Object.keys(expenseStructure).forEach(key => {
      totals[key] = 0
    })

    currentMonthExpenses.forEach(e => {
      let foundKey = e.category_key || e.categoryKey
      
      // Si la key no está en la estructura, buscar por subcategoría
      if (!expenseStructure[foundKey]) {
        const matchedKey = Object.keys(expenseStructure).find(catKey => 
          expenseStructure[catKey]?.subcategories &&
          Object.keys(expenseStructure[catKey].subcategories).includes(e.subcategory)
        )
        if (matchedKey) {
          foundKey = matchedKey
        }
      }

      if (foundKey) {
        if (!totals[foundKey]) totals[foundKey] = 0
        totals[foundKey] += Number(e.amount) || 0
      }
    })
    return totals
  }, [currentMonthExpenses, expenseStructure])

  const overheadCosts = (totalsByCategory['GASTOS_FIJOS'] || 0) + (totalsByCategory['INDIRECTOS'] || 0)
  const unitOverhead = productionAvg > 0 ? overheadCosts / productionAvg : 0

  const budgets = useMemo(() => {
    return settings?.budgets || []
  }, [settings])

  const budgetMetrics = useMemo(() => {
    return budgets.map(budget => {
      const spent = expenses
        .filter(e => {
          const d = new Date(e.date)
          const now = new Date()
          const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          if (!isCurrentMonth) return false
          
          let eCat = e.category_key || e.categoryKey
          if (!eCat) {
            const matchedKey = Object.keys(expenseStructure).find(catKey => 
              expenseStructure[catKey]?.subcategories &&
              Object.keys(expenseStructure[catKey].subcategories).includes(e.subcategory)
            )
            if (matchedKey) {
              eCat = matchedKey
            }
          }

          return budget.categoryKey && eCat === budget.categoryKey
        })
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      
      const pct = budget.limitAmount > 0 ? (spent / budget.limitAmount) * 100 : 0
      
      return {
        ...budget,
        spent,
        pct,
        remaining: Math.max(0, budget.limitAmount - spent),
        isOver: spent > budget.limitAmount
      }
    })
  }, [budgets, expenses, expenseStructure])

  const totalBudget = useMemo(() => {
    return budgets.reduce((sum, b) => sum + (Number(b.limitAmount) || 0), 0)
  }, [budgets])

  const totalSpentMonth = useMemo(() => {
    return currentMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  }, [currentMonthExpenses])

  const dailyTrendData = useMemo(() => {
    const trend = []
    const now = new Date()
    for (let i = 14; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const label = d.getDate().toString()
      const amount = expenses
        .filter(e => e.date === dateStr)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      trend.push({ date: dateStr, label, amount })
    }
    return trend
  }, [expenses])

  const dailyTrendTotal = useMemo(() => {
    return dailyTrendData.reduce((sum, d) => sum + d.amount, 0)
  }, [dailyTrendData])

  const categoryDistribution = useMemo(() => {
    return Object.entries(totalsByCategory)
      .map(([key, value]) => ({
        key,
        name: expenseStructure[key]?.label || key,
        value
      }))
      .filter(item => item.value > 0)
  }, [totalsByCategory, expenseStructure])

  const forecastData = useMemo(() => {
    const now = new Date()
    const currentDay = now.getDate()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = lastDayOfMonth - currentDay
    
    const burnRate = currentDay > 0 ? totalSpentMonth / currentDay : 0
    const projectedSpent = totalSpentMonth + (burnRate * daysRemaining)
    
    let statusColor = 'text-emerald-400'
    let statusBg = 'bg-emerald-500/10'
    let statusBorder = 'border-emerald-500/30'
    let statusText = 'DENTRO DEL LÍMITE'
    let progressPct = 0
    
    if (totalBudget > 0) {
      progressPct = (projectedSpent / totalBudget) * 100
      if (projectedSpent > totalBudget) {
        statusColor = 'text-red-400'
        statusBg = 'bg-red-500/10'
        statusBorder = 'border-red-500/30'
        statusText = 'EXCEDERÁ EL PRESUPUESTO'
      } else if (projectedSpent > totalBudget * 0.8) {
        statusColor = 'text-amber-400'
        statusBg = 'bg-amber-500/10'
        statusBorder = 'border-amber-500/30'
        statusText = 'RIESGO DE EXCESO'
      }
    }
    
    return {
      burnRate,
      projectedSpent,
      daysRemaining,
      statusColor,
      statusBg,
      statusBorder,
      statusText,
      progressPct,
      lastDayOfMonth
    }
  }, [totalSpentMonth, totalBudget])

  const sublimationStats = useMemo(() => {
    const currentYear = new Date().getFullYear()
    
    // Filter expenses for current year that are under category_key 'INSUMOS' and subcategory 'Sublimación'
    const subExpenses = expenses.filter(e => {
      const d = new Date(e.date)
      const isCurrentYear = d.getFullYear() === currentYear
      if (!isCurrentYear) return false
      
      let eCat = e.category_key || e.categoryKey
      if (!eCat) {
        const matchedKey = Object.keys(expenseStructure).find(catKey => 
          expenseStructure[catKey]?.subcategories &&
          Object.keys(expenseStructure[catKey].subcategories).includes(e.subcategory)
        )
        if (matchedKey) eCat = matchedKey
      }
      
      return eCat === 'INSUMOS' && e.subcategory === 'Sublimación'
    })
    
    let inkQuantity = 0
    let inkCost = 0
    let paperQuantity = 0
    let paperCost = 0
    let otherSubCost = 0
    
    subExpenses.forEach(e => {
      const itemLower = (e.specific_item || e.specificItem || '').toLowerCase()
      if (itemLower.includes('tinta')) {
        inkQuantity += Number(e.quantity) || 0
        inkCost += Number(e.amount) || 0
      } else if (itemLower.includes('papel')) {
        paperQuantity += Number(e.quantity) || 0
        paperCost += Number(e.amount) || 0
      } else {
        otherSubCost += Number(e.amount) || 0
      }
    })
    
    const totalSubExpenses = inkCost + paperCost + otherSubCost
    
    let totalPanels = 0
    let panelRevenue = 0
    let totalSubRevenue = 0
    let totalMeters = 0
    let meterRevenue = 0
    
    orders.forEach(o => {
      const d = new Date(o.created_at)
      const isCurrentYear = d.getFullYear() === currentYear
      if (!isCurrentYear) return
      
      if (o.order_items) {
        o.order_items.forEach(item => {
          const catLower = (item.category || '').toLowerCase()
          const prodCatUpper = (item.product_category || '').toUpperCase()
          
          if (catLower.includes('sublimac') || catLower.includes('sublimación')) {
            totalSubRevenue += Number(item.total_price) || 0
            
            if (prodCatUpper.includes('PANEL') || prodCatUpper.includes('PANELES')) {
              totalPanels += Number(item.quantity) || 0
              panelRevenue += Number(item.total_price) || 0
            } else if (prodCatUpper.includes('METRO') || prodCatUpper.includes('METROS')) {
              totalMeters += Number(item.quantity) || 0
              meterRevenue += Number(item.total_price) || 0
            }
          }
        })
      }
    })
    
    const avgInkCostPerPanel = totalPanels > 0 ? inkCost / totalPanels : 0
    const avgPaperCostPerPanel = totalPanels > 0 ? paperCost / totalPanels : 0
    const avgCombinedCostPerPanel = totalPanels > 0 ? (inkCost + paperCost) / totalPanels : 0
    
    const costToRevenueRatio = totalSubRevenue > 0 ? (totalSubExpenses / totalSubRevenue) * 100 : 0
    
    return {
      inkQuantity,
      inkCost,
      paperQuantity,
      paperCost,
      otherSubCost,
      totalSubExpenses,
      totalPanels,
      panelRevenue,
      totalSubRevenue,
      totalMeters,
      meterRevenue,
      avgInkCostPerPanel,
      avgPaperCostPerPanel,
      avgCombinedCostPerPanel,
      costToRevenueRatio,
      currentYear
    }
  }, [expenses, orders, expenseStructure])

  // --- FILTROS DE LISTA ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const catKey = e.category_key || e.categoryKey
      const sub = e.subcategory
      const item = e.specific_item || e.specificItem || ''
      
      if (selectedCategoryFilter) {
        const isMatchedCat = catKey === selectedCategoryFilter || 
          (expenseStructure[selectedCategoryFilter]?.subcategories &&
           Object.keys(expenseStructure[selectedCategoryFilter].subcategories).includes(sub))
        if (!isMatchedCat) return false
      }
      
      if (selectedSubcategoryFilter && sub !== selectedSubcategoryFilter) return false
      if (itemSearch && !item.toLowerCase().includes(itemSearch.toLowerCase())) return false
      return true
    })
  }, [expenses, selectedCategoryFilter, selectedSubcategoryFilter, itemSearch, expenseStructure])

  const allSubcategories = useMemo(() => {
    if (selectedCategoryFilter && expenseStructure[selectedCategoryFilter]) {
      return Object.keys(expenseStructure[selectedCategoryFilter].subcategories || {})
    }
    const subs = new Set()
    Object.values(expenseStructure).forEach(cat => {
      if (cat.subcategories) {
        Object.keys(cat.subcategories).forEach(s => subs.add(s))
      }
    })
    return Array.from(subs)
  }, [selectedCategoryFilter, expenseStructure])

  // --- RENDER WIZARD FORM ---
  const renderWizardForm = () => {
    return (
      <div className="flex flex-col h-full bg-transparent select-none text-on-surface overflow-hidden">
        {/* Header del Wizard */}
        <div className="p-5 border-b border-outline-variant shrink-0 bg-surface-container/50">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#ff5c00]">receipt_long</span>
            <h2 className="text-base font-bold text-on-surface leading-none">Registrar Transacción</h2>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-[#ff5c00] uppercase tracking-wider font-bold">Paso {currentStep} de 5</span>
              <span className="text-on-surface-variant/70">Ingreso Manual</span>
            </div>
            <div className="flex gap-1.5 h-1.5 w-full bg-white/[0.02] rounded-full p-[1px]">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-full rounded-full transition-all duration-300 ${s <= currentStep ? 'bg-[#ff5c00] shadow-[0_0_6px_rgba(255,92,0,0.6)]' : 'bg-white/10'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Contenido del Paso */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {(error || success) && (
            <AlertBanner type={success ? 'success' : 'error'} className="mb-4">{error || success}</AlertBanner>
          )}

          {/* PASO 1: Proveedor */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              {/* Selector de Tipo de Beneficiario */}
              <div className="flex bg-surface-container-high/40 p-0.5 rounded-lg border border-outline-variant/30 select-none w-full mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setTerceroType('proveedor')
                    if (form.providerName === 'Empleado Genérico') {
                      updateForm('providerName', '')
                    }
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                    terceroType === 'proveedor'
                      ? 'bg-[#ff5c00] text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                  Proveedor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTerceroType('dependiente')
                    if (form.providerName === 'Proveedor Genérico') {
                      updateForm('providerName', '')
                    }
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                    terceroType === 'dependiente'
                      ? 'bg-[#ff5c00] text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">badge</span>
                  Dependiente
                </button>
              </div>

              <div className="flex justify-between items-center bg-surface-container-low px-2.5 py-1.5 rounded-lg border border-outline-variant/60">
                <p className="text-[10px] text-on-surface-variant/80">
                  {terceroType === 'proveedor' ? '¿Proveedor rápido?' : '¿Empleado rápido?'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const defaultName = terceroType === 'proveedor' ? 'Proveedor Genérico' : 'Empleado Genérico'
                    updateForm('providerName', defaultName)
                    updateForm('providerNit', '')
                    updateForm('providerPhone', '')
                    updateForm('providerEmail', '')
                    setCurrentStep(2)
                  }}
                  className="btn-3d-raised px-2 py-1 rounded-md text-[9px] font-bold text-[#ff5c00] hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[12px]">bolt</span>
                  Usar Genérico
                </button>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Input
                    label={terceroType === 'proveedor' ? "Nombre o Razón Social" : "Nombre del Empleado"}
                    value={form.providerName}
                    onChange={e => updateForm('providerName', e.target.value)}
                    placeholder={terceroType === 'proveedor' ? "Ej. Comercializadora XYZ S.A." : "Ej. Juan Pérez"}
                    error={error && !form.providerName ? 'Requerido' : null}
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-surface-container border border-outline-variant rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-outline-variant/30">
                      {suggestions.map(prov => (
                        <div
                          key={prov.id}
                          className="p-3 text-xs text-on-surface hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors flex items-center justify-between"
                          onClick={() => {
                            updateForm('providerName', prov.name)
                            updateForm('providerNit', prov.notes?.match(/NIT:\s*([^\s,]+)/)?.[1] || prov.notes?.match(/CI:\s*([^\s,]+)/)?.[1] || '')
                            updateForm('providerPhone', prov.phone || '')
                            updateForm('providerEmail', prov.email || '')
                          }}
                        >
                          <span className="font-semibold text-left">{prov.name}</span>
                          {prov.phone && <span className="text-[10px] text-on-surface-variant font-mono">{prov.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Input
                  label={terceroType === 'proveedor' ? "ID / NIT (Opcional)" : "CI / Documento (Opcional)"}
                  value={form.providerNit}
                  onChange={e => updateForm('providerNit', e.target.value)}
                  placeholder={terceroType === 'proveedor' ? "Ej. 10293847-5" : "Ej. 8765432"}
                  className="font-mono"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Teléfono"
                    value={form.providerPhone}
                    onChange={e => updateForm('providerPhone', e.target.value)}
                    placeholder="Ej. 70012345"
                    className="font-mono"
                  />
                  <Input
                    label="Correo Electrónico"
                    type="email"
                    value={form.providerEmail}
                    onChange={e => updateForm('providerEmail', e.target.value)}
                    placeholder={terceroType === 'proveedor' ? "proveedor@correo.com" : "empleado@correo.com"}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Categoría */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-3">
                <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Selecciona la Categoría</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(expenseStructure).map(([key, data]) => {
                    const isActive = form.categoryKey === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          updateForm('categoryKey', key)
                          updateForm('subcategory', '')
                          updateForm('specificItem', '')
                          setTimeout(() => setCurrentStep(3), 300)
                        }}
                        className={`btn-3d-raised rounded-xl px-3 py-2 flex flex-row items-center justify-start gap-3 min-h-[3.5rem] h-auto text-left cursor-pointer ${isActive ? 'btn-3d-active border-[#ff5c00]/50' : 'hover:bg-white/[0.02]'
                          }`}
                      >
                        <span className={`material-symbols-outlined text-[24px] ${isActive ? 'text-[#ff5c00]' : 'text-on-surface-variant'}`}>
                          {CATEGORY_ICONS[key] || 'label'}
                        </span>
                        <span className="text-[11px] font-bold tracking-wide text-on-surface leading-tight">
                          {data.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Subcategoría */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-3">
                <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Especifica la Subcategoría</label>
                {form.categoryKey && expenseStructure[form.categoryKey] ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(expenseStructure[form.categoryKey].subcategories || {}).map(sub => {
                      const isActive = form.subcategory === sub
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => {
                            updateForm('subcategory', sub)
                            updateForm('specificItem', '')
                            setTimeout(() => setCurrentStep(4), 300)
                          }}
                          className={`btn-3d-raised rounded-lg px-2 py-2 text-center cursor-pointer flex items-center justify-center min-h-[40px] ${isActive ? 'btn-3d-active bg-primary/10 border-primary/50' : 'hover:bg-white/[0.02]'
                            }`}
                        >
                          <span className={`text-[11px] font-semibold tracking-wide leading-tight ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                            {sub}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">Por favor, regresa y selecciona una categoría primero.</p>
                )}
              </div>
            </div>
          )}

          {/* PASO 4: Ítem Específico */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-3">
                <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Ítem Específico</label>
                {form.categoryKey && form.subcategory && expenseStructure[form.categoryKey]?.subcategories[form.subcategory] ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {expenseStructure[form.categoryKey].subcategories[form.subcategory].map(item => {
                        const isActive = form.specificItem === item
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              updateForm('specificItem', item)
                              if (item.toLowerCase() !== 'otro') {
                                setTimeout(() => setCurrentStep(5), 300)
                              }
                            }}
                            className={`btn-3d-raised rounded-lg px-2 py-2 text-center cursor-pointer flex items-center justify-center min-h-[36px] ${isActive ? 'btn-3d-active bg-secondary/10 border-secondary/50' : 'hover:bg-white/[0.02]'
                              }`}
                          >
                            <span className={`text-[10px] font-bold tracking-wide leading-tight ${isActive ? 'text-secondary' : 'text-on-surface-variant'}`}>
                              {item}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="pt-2 border-t border-outline-variant/30">
                      <Input
                        label="Escribir ítem personalizado"
                        value={form.specificItem}
                        onChange={e => updateForm('specificItem', e.target.value)}
                        placeholder="Escribe el nombre del ítem específico..."
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">Por favor, regresa y selecciona categoría/subcategoría primero.</p>
                )}
              </div>
            </div>
          )}

          {/* PASO 5: Detalles y Monetización */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-fade-in">
              <Input
                label="Fecha de la Transacción"
                type="date"
                value={form.date}
                onChange={(e) => updateForm('date', e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant mb-1 ml-1 block">
                    Cantidad
                  </label>
                  <div className="flex gap-1.5 items-center">
                    <button
                      type="button"
                      onClick={() => updateForm('quantity', Math.max(1, Number(form.quantity) - 1))}
                      className="btn-3d-raised w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-white font-bold text-base hover:text-[#ff5c00] cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.quantity}
                      onChange={(e) => updateForm('quantity', e.target.value)}
                      className="w-full min-w-0 neu-pressed bg-transparent border-none rounded-xl py-1.5 font-mono text-sm text-on-surface text-center focus:ring-1 focus:ring-primary/50 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateForm('quantity', Number(form.quantity) + 1)}
                      className="btn-3d-raised w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-white font-bold text-base hover:text-emerald-400 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <Input
                  label="P. Unitario (Bs)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.unitPrice}
                  onChange={(e) => updateForm('unitPrice', e.target.value)}
                  className="font-mono text-lg text-white"
                />
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-4 shadow-inner mt-2">
                <Input
                  label="Monto Total (Bs)"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => updateForm('amount', e.target.value)}
                  className="font-mono text-xl text-[#ff7a00] font-bold h-12 bg-surface border-[#ff7a00]/30 focus:border-[#ff7a00]"
                />

                <div className="pt-3 border-t border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Adelanto / Pago</label>
                    <button
                      type="button"
                      onClick={() => updateForm('advanceAmount', form.amount)}
                      className="btn-3d-raised px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">done_all</span>
                      Pagar 100%
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0.00"
                      value={form.advanceAmount}
                      onChange={(e) => updateForm('advanceAmount', e.target.value)}
                      className={`w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none transition-all duration-200 font-mono ${
                        (!form.advanceAmount || Number(form.advanceAmount) === 0)
                          ? 'ring-2 ring-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.3)] bg-red-500/5'
                          : 'ring-1 ring-emerald-500/50 bg-emerald-500/5 focus:ring-2 focus:ring-emerald-500'
                      }`}
                    />
                  </div>
                  {(!form.advanceAmount || Number(form.advanceAmount) === 0) && (
                    <p className="text-[10px] text-red-400 mt-1.5 ml-1 flex items-center gap-1 animate-pulse">
                      <span className="material-symbols-outlined text-[12px]">warning</span>
                      Alerta: Monto de pago en Bs 0 (Se registrará como pendiente)
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-wider">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(method => {
                    const isActive = form.paymentMethod === method.id
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => updateForm('paymentMethod', method.id)}
                        className={`btn-3d-raised rounded-xl py-2 px-3 flex items-center gap-2 cursor-pointer ${isActive ? 'btn-3d-active border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'hover:bg-white/[0.02] text-on-surface'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{method.icon}</span>
                        <span className="text-[11px] font-bold">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <Input
                label="Observaciones (Opcional)"
                placeholder="Ej: Factura #1234, Marca X..."
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Botones de Navegación del Wizard */}
        <div className="p-5 border-t border-outline-variant bg-surface-container/50 flex gap-3 shrink-0 mt-auto">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 btn-3d-raised py-3 rounded-xl font-bold flex items-center justify-center gap-1 text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Atrás
            </button>
          )}
          {([1, 4, 5].includes(currentStep)) && (
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className={`flex-[2] btn-3d-raised py-3 rounded-xl font-bold flex items-center justify-center gap-1 text-white shadow-lg cursor-pointer ${currentStep === 5
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-emerald-600/20'
                  : 'bg-[#ff5c00] hover:bg-[#ff5c00]/80 border-[#ff5c00] shadow-[#ff5c00]/20'
                }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : currentStep < 5 ? (
                <>
                  Continuar
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Finalizar y Guardar
                </>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-none mx-auto space-y-4 md:space-y-6 h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] flex flex-col w-full">


        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-headline-md font-semibold text-on-surface">Gastos y Presupuestos</h1>
            <p className="text-on-surface-variant text-sm mt-1">Registra, supervisa y analiza los costos indirectos de la empresa.</p>
          </div>
          {/* Botón visible solo en tablets/escritorio (>= md) */}
          <Button
            onClick={() => setFormOpen(true)}
            className="hidden md:flex items-center gap-1.5 neu-button-primary"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            NUEVO GASTO
          </Button>
        </div>

        {/* TABS COMPACTOS */}
        <div className="flex gap-2 border-b border-white/10 pb-px overflow-x-auto whitespace-nowrap scrollbar-none">
          {[
            { id: 'registro', label: 'Transacciones y Registro', icon: 'list_alt' },
            { id: 'dashboard', label: 'Dashboard y Presupuestos', icon: 'donut_large' },
            { id: 'analisis', label: 'Análisis de Costos', icon: 'calculate' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap shrink-0 ${activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                  : 'border-transparent text-on-surface-variant hover:text-white hover:bg-white/5 rounded-t-lg'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4">

          {/* PESTAÑA 1: TRANSACCIONES + FORMULARIO SIDEBAR WIZARD */}
          {activeTab === 'registro' && (
            <div className="flex flex-col lg:flex-row gap-6 h-full items-start">

              {/* IZQUIERDA: LISTA DE TRANSACCIONES */}
              <div className="flex-1 flex flex-col gap-4 h-full w-full">
                
                {/* CUADRO APARTADO DE FILTROS */}
                <Card className="p-4 space-y-4 shrink-0">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <SearchInput
                        value={itemSearch}
                        onChange={setItemSearch}
                        placeholder="Buscar por ítem específico..."
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                      <div className="w-[120px] sm:w-[150px]">
                        <Select
                          options={[
                            { value: '', label: 'Categoría (Todas)' },
                            ...Object.entries(expenseStructure).map(([key, data]) => ({
                              value: key,
                              label: data.label
                            }))
                          ]}
                          value={selectedCategoryFilter || ''}
                          onChange={(e) => {
                            setSelectedCategoryFilter(e.target.value)
                            setSelectedSubcategoryFilter('')
                          }}
                        />
                      </div>
                      <div className="w-[120px] sm:w-[150px]">
                        <Select
                          options={[
                            { value: '', label: 'Subcategoría (Todas)' },
                            ...allSubcategories.map(sub => ({
                              value: sub,
                              label: sub
                            }))
                          ]}
                          value={selectedSubcategoryFilter || ''}
                          onChange={(e) => setSelectedSubcategoryFilter(e.target.value)}
                        />
                      </div>
                      <div className="w-[120px] sm:w-[150px]">
                        <button
                          onClick={() => {
                            setSelectedCategoryFilter('')
                            setSelectedSubcategoryFilter('')
                            setItemSearch('')
                          }}
                          className="w-full h-10 px-3 rounded-xl neu-raised-sm text-xs font-semibold text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                        >
                          TODOS
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* LISTA DE TRANSACCIONES */}
                <Card className="flex-1 overflow-hidden flex flex-col w-full h-full min-h-[300px]">
                  <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead className="sticky top-0 bg-surface-container/95 backdrop-blur z-10">
                        <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider font-mono">
                          <th className="py-3 px-4 font-medium min-w-[120px]">Fecha / Categoría</th>
                          <th className="py-3 px-4 font-medium min-w-[160px]">Proveedor / Detalle</th>
                          <th className="py-3 px-4 font-medium text-right min-w-[140px]">Montos (Total / Adelanto)</th>
                          <th className="py-3 px-4 text-center min-w-[170px]">Pago / Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm animate-fade-in text-on-surface">
                        {loadingExpenses ? (
                          <tr>
                            <td colSpan="4" className="text-center py-20 text-on-surface-variant text-sm">
                              <div className="flex flex-col items-center gap-2 justify-center">
                                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                Cargando transacciones...
                              </div>
                            </td>
                          </tr>
                        ) : filteredExpenses.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-20 text-on-surface-variant text-sm">
                              <div className="flex flex-col items-center gap-2 justify-center">
                                <span className="material-symbols-outlined text-4xl opacity-50">inbox</span>
                                Aún no hay gastos registrados con estos filtros.
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredExpenses.map((e) => {
                            const catLabel = e.category_label || e.categoryLabel
                            const sub = e.subcategory
                            const item = e.specific_item || e.specificItem
                            const price = e.unit_price || e.unitPrice
                            const adv = e.advance_amount || e.advanceAmount
                            const method = e.payment_method || e.paymentMethod

                            // Calcular estado de pago
                            const paymentStatus = adv >= e.amount ? 'pagado' : (adv > 0 ? 'adelanto' : 'pendiente')
                            const paymentLabels = {
                              pendiente: 'Pendiente',
                              adelanto: 'Acuenta',
                              pagado: 'Pagado'
                            }
                            const paymentBadges = {
                              pendiente: 'bg-error-container/20 text-error border border-error/20 hover:bg-error-container/30',
                              adelanto: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
                              pagado: 'bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary/20'
                            }

                            return (
                              <tr key={e.id} className="hover:bg-white/[0.02] transition-colors group">
                                {/* COL 1: Fecha y Categoría */}
                                <td className="py-2.5 px-4 text-sm min-w-[120px]">
                                  <span className="text-on-surface-variant font-mono block">{formatDate(e.date)}</span>
                                  <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1.5 ${getExpenseCategoryStyle(e.category_key || e.categoryKey)}`}>
                                    {catLabel}
                                  </span>
                                  <span className="text-[10px] text-primary/80 font-mono block uppercase mt-1">{sub}</span>
                                </td>

                                {/* COL 2: Proveedor / Detalle */}
                                <td className="py-2.5 px-4 text-sm min-w-[160px]">
                                  <span className="font-bold text-white block">{e.provider || 'Proveedor general'}</span>
                                  <span className="text-xs text-on-surface-variant block mt-0.5 font-medium truncate max-w-[200px]" title={item}>
                                    {item}
                                  </span>
                                  {e.description && (
                                    <span className="text-[10px] text-primary/80 italic block mt-0.5 max-w-[220px] truncate" title={e.description}>
                                      Detalle: {e.description}
                                    </span>
                                  )}
                                </td>

                                {/* COL 3: Montos */}
                                <td className="py-2.5 px-4 text-sm text-right font-mono min-w-[140px]">
                                  <span className="font-bold text-white block text-sm">{formatCurrency(e.amount)}</span>
                                  <span className="text-[10px] text-on-surface-variant block mt-0.5">
                                    {e.quantity} uds × {formatCurrency(price, 0)}
                                  </span>
                                  <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                                    Adelanto: {formatCurrency(adv || 0)}
                                  </span>
                                </td>

                                {/* COL 4: Pago / Acciones */}
                                <td className="py-2.5 px-4 text-center min-w-[170px]">
                                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                    {/* Método de pago */}
                                    <span className="text-[10px] font-semibold text-white/70 uppercase font-mono">{method}</span>

                                    {/* Estado del pago (BOTON) */}
                                    <button
                                      onClick={() => handleUpdateExpensePaymentStatus(e.id, adv, e.amount)}
                                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${paymentBadges[paymentStatus]}`}
                                      title="Click para cambiar estado de pago"
                                    >
                                      {paymentLabels[paymentStatus]}
                                    </button>

                                    {/* Tres puntos Acciones Menu */}
                                    <div className="relative inline-block text-left ml-1">
                                      <button
                                        onClick={() => setActiveActionMenu(activeActionMenu === e.id ? null : e.id)}
                                        className="p-1.5 text-on-surface-variant hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                        title="Más acciones"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                      </button>
                                      
                                      {activeActionMenu === e.id && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-20" 
                                            onClick={() => setActiveActionMenu(null)}
                                          />
                                          <div className="absolute right-0 mt-1 w-32 rounded-xl bg-surface-container-high border border-outline-variant/60 shadow-lg py-1.5 z-30 animate-fade-in text-left">
                                            <button
                                              onClick={() => {
                                                setSelectedExpense(e)
                                                setActiveActionMenu(null)
                                              }}
                                              className="w-full text-left px-3 py-2 text-xs text-on-surface hover:bg-white/5 hover:text-white flex items-center gap-2 cursor-pointer bg-transparent border-none"
                                            >
                                              <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                                              Ver Detalle
                                            </button>
                                            <button
                                              onClick={() => {
                                                handleDelete(e.id)
                                                setActiveActionMenu(null)
                                              }}
                                              className="w-full text-left px-3 py-2 text-xs text-error hover:bg-error/10 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                                            >
                                              <span className="material-symbols-outlined text-[16px]">delete</span>
                                              Eliminar
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* DERECHA: SIDEBAR DE INGRESO (WIZARD CON 3D EFFECTS) */}
              <Card className="hidden lg:flex w-full lg:w-[350px] shrink-0 flex-col h-full max-h-full">
                {renderWizardForm()}
              </Card>
            </div>
          )}

          {/* PESTAÑA 2: DASHBOARD Y PRESUPUESTOS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in w-full pb-8">
              
              {/* HEADING HERO */}
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-surface-container-low/30 backdrop-blur-md p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(0,245,255,0.08),transparent)] pointer-events-none" />
                <div className="z-10 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    <span className="text-[10px] font-mono font-bold tracking-widest text-primary uppercase">Núcleo Neural Operativo</span>
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                    NÚCLEO DE INTELIGENCIA FINANCIERA
                  </h2>
                  <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
                    Análisis predictivo en tiempo real de egresos de capital, control presupuestario y flujos neurales dinámicos.
                  </p>
                </div>
                <div className="z-10 flex items-center gap-2 bg-surface-container/40 border border-outline-variant/30 rounded-xl px-4 py-2 font-mono text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">sync</span>
                  Status: Operativo
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* KPI Card 1: Egresos Consolidados */}
                <div className="bg-surface-container-low/30 backdrop-blur-md p-5 rounded-2xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,245,255,0.04),transparent)] pointer-events-none" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">Egresos Consolidados</span>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[16px]">payments</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-mono text-2xl font-black text-white leading-none block">
                      {formatCurrency(totalSpentMonth)}
                    </span>
                    <p className="text-[10px] text-on-surface-variant mt-1.5">Total de egresos registrados en el ciclo mensual.</p>
                  </div>
                </div>

                {/* KPI Card 2: Límite Presupuestado */}
                <div className="bg-surface-container-low/30 backdrop-blur-md p-5 rounded-2xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(168,85,247,0.04),transparent)] pointer-events-none" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">Límite Presupuestado</span>
                    <div className="w-7 h-7 rounded-lg bg-tertiary/10 border border-tertiary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-tertiary text-[16px]">account_balance_wallet</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-black text-white leading-none">
                        {formatCurrency(totalBudget)}
                      </span>
                      {totalBudget > 0 && (
                        <span className="text-[10px] font-mono font-bold text-on-surface-variant">
                          ({Math.round((totalSpentMonth / totalBudget) * 100)}%)
                        </span>
                      )}
                    </div>
                    {totalBudget > 0 ? (
                      <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden mt-2 p-[1px]">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            totalSpentMonth > totalBudget ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-primary shadow-[0_0_6px_rgba(0,245,255,0.5)]'
                          }`} 
                          style={{ width: `${Math.min(100, (totalSpentMonth / totalBudget) * 100)}%` }} 
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-on-surface-variant mt-1.5">Sin límites establecidos este mes.</p>
                    )}
                  </div>
                </div>

                {/* KPI Card 3: Velocidad Diaria */}
                <div className="bg-surface-container-low/30 backdrop-blur-md p-5 rounded-2xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(57,255,20,0.04),transparent)] pointer-events-none" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">Velocidad Diaria (Burn Rate)</span>
                    <div className="w-7 h-7 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary text-[16px]">speed</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-mono text-2xl font-black text-white leading-none block">
                      {formatCurrency(forecastData.burnRate)} <span className="text-xs text-on-surface-variant">/ día</span>
                    </span>
                    <p className="text-[10px] text-on-surface-variant mt-1.5">Consumo promedio diario durante el mes actual.</p>
                  </div>
                </div>
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left/Center Area (Sparkline & Budgets) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Trend chart */}
                  <NeuralLineChart data={dailyTrendData} total={dailyTrendTotal} />

                  {/* Active budgets progress */}
                  <div className="bg-surface-container-low/30 backdrop-blur-md p-6 rounded-2xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6 pb-3 border-b border-outline-variant/40">
                      <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">pie_chart</span>
                        Control de Presupuestos de Gastos
                      </h3>
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
                        {budgetMetrics.length} Configurados
                      </span>
                    </div>

                    {budgetMetrics.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="material-symbols-outlined text-on-surface-variant/20 text-4xl mb-2">savings</span>
                        <p className="text-xs text-on-surface-variant italic">No hay presupuestos configurados en la pestaña "Metas y Presupuestos" de Configuración Global.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {budgetMetrics.map(b => {
                          const catData = expenseStructure[b.categoryKey]
                          const pct = Math.min(100, b.pct)
                          
                          // Color matching theme
                          let colorClass = 'bg-[#39ff14] shadow-[0_0_8px_rgba(57,255,20,0.5)]'
                          let textClass = 'text-[#39ff14]'
                          let glowBg = 'bg-[#39ff14]/10'
                          if (b.pct > 100) {
                            colorClass = 'bg-[#ff716c] shadow-[0_0_8px_rgba(255,113,108,0.5)] animate-pulse'
                            textClass = 'text-[#ff716c]'
                            glowBg = 'bg-[#ff716c]/10'
                          } else if (b.pct > 80) {
                            colorClass = 'bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                            textClass = 'text-[#f59e0b]'
                            glowBg = 'bg-[#f59e0b]/10'
                          }

                          return (
                            <div key={b.id} className="relative group p-4 rounded-xl bg-surface-container/20 border border-outline-variant/30 hover:border-primary/20 transition-all duration-300">
                              <div className="flex items-start justify-between mb-2">
                                <div className="min-w-0 pr-2">
                                  <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-wider block">Categoría</span>
                                  <span className="text-sm font-bold text-white truncate block">{catData?.label || b.categoryKey}</span>
                                </div>
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-current/25 shrink-0 ${textClass} ${glowBg}`}>
                                  {Math.round(b.pct)}%
                                </span>
                              </div>
                              
                              <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden mb-3 p-[1px] border border-white/[0.02]">
                                <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
                              </div>
                              
                              <div className="flex justify-between items-center text-[10px] font-mono text-on-surface-variant">
                                <span>Gastado: <strong className="text-white">{formatCurrency(b.spent)}</strong></span>
                                <span>Límite: <strong>{formatCurrency(b.limitAmount)}</strong></span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Area (Donut Chart & Forecast) */}
                <div className="space-y-6 flex flex-col lg:h-full">
                  {/* Donut Chart */}
                  <div className="lg:flex-1">
                    <NeuralDonut data={categoryDistribution} total={totalSpentMonth} />
                  </div>

                  {/* AI Prediction Card */}
                  <div className="bg-surface-container-low/30 backdrop-blur-md p-6 rounded-2xl border border-outline-variant/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-auto lg:h-full min-h-[220px]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(168,85,247,0.05),transparent)] pointer-events-none" />
                    <div>
                      <div className="flex items-center justify-between mb-5 pb-3 border-b border-outline-variant/40">
                        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-primary animate-pulse">psychology</span>
                          Asistente Predictivo Neural
                        </h3>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${forecastData.statusColor} ${forecastData.statusBg} ${forecastData.statusBorder} animate-fade-in`}>
                          {forecastData.statusText}
                        </span>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block mb-1">Cierre Proyectado de Mes</span>
                          <span className="font-mono text-2xl font-black text-white leading-none">
                            {formatCurrency(forecastData.projectedSpent)}
                          </span>
                          <p className="text-[10px] text-on-surface-variant mt-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                            Ciclo de {forecastData.lastDayOfMonth} días ({forecastData.daysRemaining} restantes)
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-surface-container/20 border border-outline-variant/30 space-y-2">
                          <span className="text-[10px] font-mono text-primary uppercase tracking-wider font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">settings_suggest</span>
                            Análisis de Tendencia
                          </span>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            {totalBudget > 0 ? (
                              <>
                                El ritmo de gasto actual es de <strong className="text-white">{formatCurrency(forecastData.burnRate)}</strong> por día. A esta velocidad, se proyecta un cierre de mes que representa el <strong className="text-white">{Math.round(forecastData.progressPct)}%</strong> de tu presupuesto total configurado de <strong className="text-white">{formatCurrency(totalBudget)}</strong>.
                              </>
                            ) : (
                              <>
                                El ritmo de gasto actual es de <strong className="text-white">{formatCurrency(forecastData.burnRate)}</strong> por día. Registras un total mensual de <strong className="text-white">{formatCurrency(totalSpentMonth)}</strong>. No tienes presupuestos activos para realizar una comparación predictiva de límites.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a00] animate-ping" />
                        Procesador Neural Operativo
                      </span>
                      <span>v1.2.0</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* PESTAÑA 3: ANALISIS DE COSTOS (PRORRATEO) */}
          {activeTab === 'analisis' && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Overhead unit cost card */}
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="p-8">
                  <div className="flex items-start gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-2xl">functions</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">Cálculo de Costo Indirecto Unitario</h2>
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        El sistema suma exclusivamente los <strong>Gastos Fijos</strong> e <strong>Indirectos</strong> de este mes y los divide entre tu meta de producción. El resultado es el <em>Overhead</em> que debes cargar a cada prenda producida.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-surface-container-low p-6 rounded-2xl border border-outline-variant shadow-inner">
                    <div className="space-y-1">
                      <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Gastos Prorrateables</p>
                      <p className="text-2xl font-mono font-bold text-error">{formatCurrency(overheadCosts)}</p>
                      <p className="text-[10px] text-on-surface-variant">Fijos + Indirectos (Mes actual)</p>
                    </div>

                    <div className="text-center text-on-surface-variant text-2xl font-light">÷</div>

                    <div className="space-y-2">
                      <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Prod. Promedio Mes</p>
                      <Input
                        type="number"
                        min="1"
                        value={productionAvg}
                        onChange={(e) => setProductionAvg(Number(e.target.value))}
                        className="text-xl font-mono text-center font-bold h-12 bg-surface"
                      />
                      <p className="text-[10px] text-on-surface-variant text-center">Unidades a fabricar</p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between bg-primary/10 border border-primary/20 rounded-xl p-6 shadow-lg">
                    <div>
                      <h3 className="text-lg font-bold text-primary">Costo Indirecto a Cargar:</h3>
                      <p className="text-sm text-primary/70">Monto adicional por prenda sobre el costo directo.</p>
                    </div>
                    <div className="text-4xl font-mono font-bold text-primary mt-4 sm:mt-0 bg-surface px-6 py-3 rounded-xl border border-primary/20 shadow-inner">
                      {formatCurrency(unitOverhead)} <span className="text-lg text-primary/50">/ u</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Sublimation Cost Analysis card */}
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#a855f7]" />
                <div className="p-8">
                  <div className="flex items-start gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-[#a855f7]/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#a855f7] text-2xl">texture</span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-white mb-1">Análisis de Costos de Sublimación (Gestión {sublimationStats.currentYear})</h2>
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        Evaluación específica de la categoría de <strong>Sublimación</strong>. Relaciona los paneles estampados y los insumos (papel y tinta) con los ingresos totales del área para determinar costos unitarios estimados.
                      </p>
                    </div>
                  </div>

                  {loadingOrders ? (
                    <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant gap-2">
                      <div className="w-8 h-8 border-2 border-[#a855f7]/20 border-t-[#a855f7] rounded-full animate-spin" />
                      <p className="text-xs">Cargando base de datos de gestión...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Sublimation metrics summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block mb-1">Paneles Producidos</span>
                          <div>
                            <span className="text-xl font-mono font-bold text-white block">{sublimationStats.totalPanels} <span className="text-xs text-on-surface-variant">unidades</span></span>
                            <span className="text-[10px] text-emerald-400 font-semibold block mt-1">Ingreso: {formatCurrency(sublimationStats.panelRevenue)}</span>
                          </div>
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block mb-1">Insumos Consumidos</span>
                          <div>
                            <span className="text-xs text-white block">🧻 Papel: <strong>{sublimationStats.paperQuantity} u</strong> ({formatCurrency(sublimationStats.paperCost)})</span>
                            <span className="text-xs text-white block mt-1">🧪 Tinta: <strong>{sublimationStats.inkQuantity} u</strong> ({formatCurrency(sublimationStats.inkCost)})</span>
                          </div>
                        </div>

                        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
                          <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block mb-1">Ingreso Total Sublimación</span>
                          <div>
                            <span className="text-xl font-mono font-bold text-white block">{formatCurrency(sublimationStats.totalSubRevenue)}</span>
                            <span className="text-[10px] text-on-surface-variant block mt-1">Incluye paneles, metros y calandra</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Calculation result */}
                      <div className="bg-[#a855f7]/5 border border-[#a855f7]/20 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between shadow-lg gap-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-[#a855f7] flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px]">calculate</span>
                            Costo Unitario Estimado por Panel:
                          </h3>
                          <p className="text-xs text-[#a855f7]/70">Calculado como: (Costo Tinta + Costo Papel) ÷ Cantidad de Paneles</p>
                        </div>
                        <div className="text-3xl font-mono font-bold text-[#a855f7] bg-surface px-6 py-3 rounded-xl border border-[#a855f7]/20 shadow-center text-center whitespace-nowrap min-w-[150px]">
                          {sublimationStats.totalPanels > 0 ? (
                            <>
                              {formatCurrency(sublimationStats.avgCombinedCostPerPanel)} <span className="text-xs text-[#a855f7]/50">/ u</span>
                            </>
                          ) : (
                            <span className="text-sm italic text-on-surface-variant/60">Sin paneles</span>
                          )}
                        </div>
                      </div>

                      {/* Performance / Profitability */}
                      <div className="p-4 rounded-xl bg-surface-container/30 border border-outline-variant/30 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-on-surface-variant uppercase tracking-wider font-bold">Relación de Costo Insumos / Ingresos</span>
                          <span className="font-mono font-bold text-white">{sublimationStats.costToRevenueRatio.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden p-[1px] border border-white/[0.02]">
                          <div 
                            className="h-full rounded-full bg-[#a855f7] shadow-[0_0_6px_rgba(168,85,247,0.5)] transition-all duration-500" 
                            style={{ width: `${Math.min(100, sublimationStats.costToRevenueRatio)}%` }} 
                          />
                        </div>
                        <p className="text-[10px] text-on-surface-variant">
                          Los costos totales de insumos en sublimación ({formatCurrency(sublimationStats.totalSubExpenses)}) representan el {sublimationStats.costToRevenueRatio.toFixed(1)}% del total facturado por servicios de sublimación ({formatCurrency(sublimationStats.totalSubRevenue)}).
                        </p>
                      </div>

                      {/* Breakdown table */}
                      <div className="overflow-x-auto rounded-xl border border-outline-variant/50">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-surface-container/60 border-b border-outline-variant text-on-surface-variant uppercase font-semibold">
                              <th className="py-2.5 px-3">Insumo</th>
                              <th className="py-2.5 px-3 text-center">Cantidad</th>
                              <th className="py-2.5 px-3 text-right">Costo Incurrido</th>
                              <th className="py-2.5 px-3 text-right">Costo Unit. Promedio / Panel</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-mono text-on-surface">
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2 px-3 text-white font-sans">🧪 Tintas de Sublimación</td>
                              <td className="py-2 px-3 text-center">{sublimationStats.inkQuantity} u</td>
                              <td className="py-2 px-3 text-right">{formatCurrency(sublimationStats.inkCost)}</td>
                              <td className="py-2 px-3 text-right text-primary">{sublimationStats.totalPanels > 0 ? formatCurrency(sublimationStats.avgInkCostPerPanel) : '—'}</td>
                            </tr>
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2 px-3 text-white font-sans">🧻 Papel Sublimático</td>
                              <td className="py-2 px-3 text-center">{sublimationStats.paperQuantity} u</td>
                              <td className="py-2 px-3 text-right">{formatCurrency(sublimationStats.paperCost)}</td>
                              <td className="py-2 px-3 text-right text-primary">{sublimationStats.totalPanels > 0 ? formatCurrency(sublimationStats.avgPaperCostPerPanel) : '—'}</td>
                            </tr>
                            <tr className="hover:bg-white/[0.02] transition-colors bg-surface-container/20 font-semibold">
                              <td className="py-2 px-3 text-white font-sans">📦 Total Insumos Estimados</td>
                              <td className="py-2 px-3 text-center text-white">—</td>
                              <td className="py-2 px-3 text-right text-white">{formatCurrency(sublimationStats.inkCost + sublimationStats.paperCost)}</td>
                              <td className="py-2 px-3 text-right text-[#a855f7]">{sublimationStats.totalPanels > 0 ? formatCurrency(sublimationStats.avgCombinedCostPerPanel) : '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                    </div>
                  )}

                </div>
              </Card>

            </div>
          )}

        </div>

        {/* MODAL DE REGISTRO PARA MÓVILES */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title=""
          size="lg"
        >
          <div className="bg-surface-container -m-6 p-4 h-[75vh] flex flex-col">
            {renderWizardForm()}
          </div>
        </Modal>
      </div>
      {/* Botón flotante móvil de registro de gastos, fijado fuera del contenedor de scroll/animación */}
      <Button
        onClick={() => setFormOpen(true)}
        className="md:hidden fixed bottom-[80px] right-4 z-40 shadow-lg rounded-full w-12 h-12 flex items-center justify-center p-0 neu-button-primary"
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
      </Button>

      {/* MODAL DE DETALLE DE TRANSACCIÓN */}
      <Modal
        isOpen={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        title="Resumen de Transacción"
        size="md"
      >
        {selectedExpense && (
          <div className="space-y-4 text-on-surface">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div>
                <span className="text-[10px] font-mono text-[#ff5c00] uppercase tracking-wider font-bold">
                  {selectedExpense.category_label || selectedExpense.categoryLabel}
                </span>
                <h3 className="text-lg font-bold text-white leading-tight mt-0.5">
                  {selectedExpense.specific_item || selectedExpense.specificItem}
                </h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  Subcategoría: {selectedExpense.subcategory}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-on-surface-variant block font-mono">
                  {formatDate(selectedExpense.date)}
                </span>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-[#ff5c00]/10 text-[#ff5c00] inline-block mt-1 uppercase font-mono">
                  {selectedExpense.payment_method || selectedExpense.paymentMethod}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant block">Proveedor</span>
                <span className="text-sm font-semibold text-white">{selectedExpense.provider}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant block">Cantidad / Precio Unitario</span>
                <span className="text-sm font-mono text-white">
                  {selectedExpense.quantity} x {formatCurrency(selectedExpense.unit_price || selectedExpense.unitPrice)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2 border-t border-white/5">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant block">Monto Total</span>
                <span className="text-lg font-mono font-bold text-[#ff7a00]">
                  {formatCurrency(selectedExpense.amount)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant block">Monto Pagado / Adelanto</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {formatCurrency(selectedExpense.advance_amount || selectedExpense.advanceAmount || selectedExpense.amount)}
                </span>
              </div>
            </div>

            {selectedExpense.advance_amount && Number(selectedExpense.advance_amount) < Number(selectedExpense.amount) && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold flex items-center justify-between">
                <span>Saldo Pendiente:</span>
                <span className="font-mono text-sm">
                  {formatCurrency(Number(selectedExpense.amount) - Number(selectedExpense.advance_amount))}
                </span>
              </div>
            )}

            {selectedExpense.description && (
              <div className="space-y-1 pt-2 border-t border-white/5">
                <span className="text-[10px] font-mono uppercase text-on-surface-variant block">Observaciones</span>
                <p className="text-sm bg-surface-container-low p-3 rounded-xl border border-outline-variant text-on-surface-variant whitespace-pre-line leading-relaxed">
                  {selectedExpense.description}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-outline-variant">
              <button
                onClick={() => setSelectedExpense(null)}
                className="btn-3d-raised px-5 py-2.5 rounded-xl font-bold text-sm text-on-surface cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
