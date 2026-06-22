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

export default function ExpensesAndBudgetsPage() {
  const [activeTab, setActiveTab] = useState('registro') // 'registro', 'dashboard', 'analisis'

  const { user } = useAuth()
  const { settings } = useGlobalSettings()
  const { data: expenses, loading: loadingExpenses, create: createExpense, remove: removeExpense } = useCRUD('expenses', {
    orderBy: 'date',
    orderAsc: false
  })

  const [productionAvg, setProductionAvg] = useState(1000)
  const [providers, setProviders] = useState([])
  const [dependientes, setDependientes] = useState([])
  const [terceroType, setTerceroType] = useState('proveedor')
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false) // Control para abrir modal en móvil
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('')
  const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState('')
  const [selectedExpense, setSelectedExpense] = useState(null)
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
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0.00"
                    value={form.advanceAmount}
                    onChange={(e) => updateForm('advanceAmount', e.target.value)}
                    className="font-mono"
                  />
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
      <div className="max-w-none mx-auto space-y-4 md:space-y-6 h-[calc(100vh-13rem)] lg:h-[calc(100vh-6rem)] flex flex-col w-full">


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
                <Card className="flex-1 overflow-hidden flex flex-col w-full h-full">
                  <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead className="sticky top-0 bg-surface-container/95 backdrop-blur z-10">
                        <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                          <th className="py-3 px-4 font-medium">Fecha</th>
                          <th className="py-3 px-4 font-medium">Categoría</th>
                          <th className="py-3 px-4 font-medium">Ítem</th>
                          <th className="py-3 px-4 font-medium">Proveedor / Detalle</th>
                          <th className="py-3 px-4 font-medium">Pago</th>
                          <th className="py-3 px-4 font-medium text-right">Total</th>
                          <th className="py-3 px-4 text-center">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm animate-fade-in text-on-surface">
                        {loadingExpenses ? (
                          <tr>
                            <td colSpan="7" className="text-center py-20 text-on-surface-variant text-sm">
                              <div className="flex flex-col items-center gap-2 justify-center">
                                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                Cargando transacciones...
                              </div>
                            </td>
                          </tr>
                        ) : filteredExpenses.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center py-20 text-on-surface-variant text-sm">
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

                            return (
                              <tr key={e.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="py-2.5 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(e.date)}</td>
                                <td className="py-2.5 px-4">
                                  <span className="font-semibold text-white block leading-tight">{catLabel}</span>
                                  <span className="text-[10px] text-primary/80 font-mono block uppercase">{sub}</span>
                                </td>
                                <td className="py-2.5 px-4">
                                  <span className="text-xs text-on-surface font-semibold">{item}</span>
                                </td>
                                <td className="py-2.5 px-4 text-on-surface-variant max-w-[200px]">
                                  <span className="block text-white text-xs truncate">{e.provider}</span>
                                  <span className="block text-[10px] truncate">{e.description || '-'}</span>
                                </td>
                                <td className="py-2.5 px-4">
                                  <span className="block text-xs font-semibold text-white uppercase font-mono">{method}</span>
                                  {adv >= e.amount ? (
                                    <span className="text-[10px] text-emerald-400 font-semibold block">Pagado 100%</span>
                                  ) : adv > 0 ? (
                                    <span className="text-[10px] text-amber-400 font-semibold block">Acuenta (Resta: {formatCurrency(e.amount - adv)})</span>
                                  ) : (
                                    <span className="text-[10px] text-error font-semibold block">Pendiente</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <span className="font-mono text-white font-bold block">{formatCurrency(e.amount)}</span>
                                  <span className="text-on-surface-variant font-mono text-xs block">
                                    {e.quantity} <span className="text-[10px]">x {price}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => setSelectedExpense(e)}
                                      className="text-primary hover:text-primary/80 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                      title="Ver Resumen"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                                    </button>
                                    <button
                                      onClick={() => handleDelete(e.id)}
                                      className="text-error hover:text-error/80 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                      title="Eliminar"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Card className="col-span-full">
                <div className="p-5">
                  <h2 className="text-lg font-bold text-on-surface mb-1">Resumen del Mes Actual</h2>
                  <p className="text-sm text-on-surface-variant mb-6">Totales agrupados por categoría principal.</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Object.entries(expenseStructure).map(([key, data]) => {
                      const total = totalsByCategory[key] || 0
                      return (
                        <div key={key} className="bg-surface-container/60 p-4 rounded-xl border border-outline-variant hover:border-primary/20 transition-colors shadow-sm">
                          <p className="text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{data.label}</p>
                          <p className="text-lg font-mono font-bold text-on-surface">{formatCurrency(total)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>

              <Card className="col-span-full flex items-center justify-center py-20 text-on-surface-variant">
                <div className="text-center">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">data_usage</span>
                  <p>Módulo de Metas de Presupuesto en desarrollo.</p>
                </div>
              </Card>
            </div>
          )}

          {/* PESTAÑA 3: ANALISIS DE COSTOS (PRORRATEO) */}
          {activeTab === 'analisis' && (
            <div className="max-w-3xl mx-auto">
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
