import { useState, useEffect, useMemo } from 'react'
import { Card, Input, Button, AlertBanner, Modal } from '@/components/ui/index.jsx'
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
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false) // Control para abrir modal en móvil

  const expenseStructure = settings?.expenseStructure || defaultExpenseStructure

  useEffect(() => {
    async function fetchProviders() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('terceros')
          .select('*')
          .eq('user_id', user.id)
          .eq('role', 'proveedor')
          .order('name')
        if (!error && data) {
          setProviders(data)
        }
      } catch (err) {
        console.error('Error fetching providers:', err)
      }
    }
    fetchProviders()
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

  const providerSuggestions = useMemo(() => {
    const q = form.providerName.trim().toLowerCase()
    if (!q || q === 'proveedor genérico') return []
    return providers.filter(p => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q)
  }, [providers, form.providerName])

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
      if (!form.providerName) return 'Ingresa el nombre del proveedor o usa el Genérico'
    }
    if (step === 2) {
      if (!form.categoryKey) return 'Selecciona una categoría principal'
      if (!form.subcategory) return 'Selecciona una subcategoría'
      if (!form.specificItem) return 'Selecciona un ítem específico'
    }
    if (step === 3) {
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
    if (currentStep < 3) {
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
    const err = validateStep(3)
    if (err) return setError(err)

    setSaving(true)
    setError(null)
    try {
      const trimmedProvider = form.providerName.trim() || 'Proveedor Genérico'
      let providerId = null

      const existing = providers.find(p => p.name.toLowerCase() === trimmedProvider.toLowerCase())
      if (existing) {
        providerId = existing.id
      } else if (trimmedProvider !== 'Proveedor Genérico') {
        try {
          const { data: newProv, error: errProv } = await supabase
            .from('terceros')
            .insert({
              user_id: user.id,
              name: trimmedProvider,
              role: 'proveedor',
              phone: form.providerPhone.trim() || null,
              email: form.providerEmail.trim() || null,
              notes: form.providerNit ? `NIT: ${form.providerNit}` : null,
              client_type: 'otro'
            })
            .select()
            .single()
          if (!errProv && newProv) {
            providerId = newProv.id
            setProviders(prev => [...prev, newProv])
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
    currentMonthExpenses.forEach(e => {
      const key = e.category_key || e.categoryKey
      if (!totals[key]) totals[key] = 0
      totals[key] += Number(e.amount) || 0
    })
    return totals
  }, [currentMonthExpenses])

  const overheadCosts = (totalsByCategory['GASTOS_FIJOS'] || 0) + (totalsByCategory['INDIRECTOS'] || 0)
  const unitOverhead = productionAvg > 0 ? overheadCosts / productionAvg : 0

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
              <span className="font-mono text-[#ff5c00] uppercase tracking-wider font-bold">Paso {currentStep} de 3</span>
              <span className="text-on-surface-variant/70">Ingreso Manual</span>
            </div>
            <div className="flex gap-1.5 h-1.5 w-full bg-white/[0.02] rounded-full p-[1px]">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-full rounded-full transition-all duration-300 ${
                    s <= currentStep ? 'bg-[#ff5c00] shadow-[0_0_6px_rgba(255,92,0,0.6)]' : 'bg-white/10'
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
              <div className="flex justify-between items-center bg-surface-container-low p-2 rounded-lg border border-outline-variant">
                <p className="text-[11px] text-on-surface-variant/80">
                  ¿Es un proveedor rápido?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    updateForm('providerName', 'Proveedor Genérico')
                    updateForm('providerNit', '')
                    updateForm('providerPhone', '')
                    updateForm('providerEmail', '')
                    setCurrentStep(2)
                  }}
                  className="btn-3d-raised px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#ff5c00] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  Usar Proveedor Genérico
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    label="Nombre o Razón Social"
                    value={form.providerName}
                    onChange={e => updateForm('providerName', e.target.value)}
                    placeholder="Ej. Comercializadora XYZ S.A."
                    error={error && !form.providerName ? 'Requerido' : null}
                  />
                  {providerSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-[#161b26] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-white/5">
                      {providerSuggestions.map(prov => (
                        <div 
                          key={prov.id}
                          className="p-3 text-xs text-white hover:bg-[#ff5c00]/10 hover:text-white cursor-pointer transition-colors flex items-center justify-between"
                          onClick={() => {
                            updateForm('providerName', prov.name)
                            updateForm('providerNit', prov.notes?.match(/NIT:\s*([^\s,]+)/)?.[1] || '')
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
                  label="ID / NIT (Opcional)"
                  value={form.providerNit}
                  onChange={e => updateForm('providerNit', e.target.value)}
                  placeholder="Ej. 10293847-5"
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
                    placeholder="proveedor@correo.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Categorización Jerárquica */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-3">
                <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">1. Selecciona la Categoría</label>
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
                        }}
                        className={`btn-3d-raised rounded-xl px-3 py-2 flex flex-row items-center justify-start gap-3 min-h-[3.5rem] h-auto text-left cursor-pointer ${
                          isActive ? 'btn-3d-active border-[#ff5c00]/50' : 'hover:bg-white/[0.02]'
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

              {form.categoryKey && expenseStructure[form.categoryKey] && (
                <div className="space-y-3 animate-in fade-in duration-200 border-t border-white/5 pt-4">
                  <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">2. Especifica la Subcategoría</label>
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
                          }}
                          className={`btn-3d-raised rounded-lg px-2 py-2 text-center cursor-pointer flex items-center justify-center min-h-[40px] ${
                            isActive ? 'btn-3d-active bg-primary/10 border-primary/50' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <span className={`text-[11px] font-semibold tracking-wide leading-tight ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                            {sub}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {form.subcategory && expenseStructure[form.categoryKey]?.subcategories[form.subcategory] && (
                <div className="space-y-3 animate-in fade-in duration-200 border-t border-white/5 pt-4">
                  <label className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">3. Ítem Específico</label>
                  <div className="grid grid-cols-2 gap-2">
                    {expenseStructure[form.categoryKey].subcategories[form.subcategory].map(item => {
                      const isActive = form.specificItem === item
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            updateForm('specificItem', item)
                            setError(null)
                            setTimeout(() => setCurrentStep(3), 300)
                          }}
                          className={`btn-3d-raised rounded-lg px-2 py-2 text-center cursor-pointer flex items-center justify-center min-h-[36px] ${
                            isActive ? 'btn-3d-active bg-secondary/10 border-secondary/50' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <span className={`text-[10px] font-bold tracking-wide leading-tight ${isActive ? 'text-secondary' : 'text-on-surface-variant'}`}>
                            {item}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 3: Detalles y Monetización */}
          {currentStep === 3 && (
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
                      className="w-full min-w-0 bg-[#0a0d14] border border-white/10 rounded-lg py-1.5 font-mono text-sm text-white text-center focus:border-[#ff5c00] outline-none"
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
                        className={`btn-3d-raised rounded-xl py-2 px-3 flex items-center gap-2 cursor-pointer ${
                          isActive ? 'btn-3d-active border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'hover:bg-white/[0.02] text-on-surface'
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
          <button 
            type="button"
            onClick={handleNext}
            disabled={saving}
            className={`flex-[2] btn-3d-raised py-3 rounded-xl font-bold flex items-center justify-center gap-1 text-white shadow-lg cursor-pointer ${
              currentStep === 3 
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-emerald-600/20' 
                : 'bg-[#ff5c00] hover:bg-[#ff5c00]/80 border-[#ff5c00] shadow-[#ff5c00]/20'
            }`}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : currentStep < 3 ? (
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
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 h-[calc(100vh-13rem)] lg:h-[calc(100vh-6rem)] flex flex-col w-full">
      <style dangerouslySetInnerHTML={{__html: `
        .btn-3d-raised {
          background: #f1f5f9;
          box-shadow: 3px 3px 6px rgba(148, 163, 184, 0.25), -3px -3px 6px rgba(255,255,255,0.95);
          border-top: 1px solid rgba(255,255,255,0.8);
          border-left: 1px solid rgba(255,255,255,0.6);
          border-bottom: 1px solid rgba(148, 163, 184, 0.3);
          border-right: 1px solid rgba(148, 163, 184, 0.2);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-3d-raised:hover {
          color: #ff5c00;
        }
        .btn-3d-active {
          background: rgba(255, 92, 0, 0.05) !important;
          box-shadow: inset 3px 3px 6px rgba(148, 163, 184, 0.3), 0 0 8px rgba(255, 92, 0, 0.15) !important;
          border: 1px solid #ff5c00 !important;
          color: #ff5c00 !important;
        }
        .btn-3d-active span {
          color: #ff5c00 !important;
        }
      `}} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Gastos y Presupuestos</h1>
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
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap shrink-0 ${
              activeTab === tab.id 
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
      <div className="flex-1 overflow-y-auto min-h-0">
        
        {/* PESTAÑA 1: TRANSACCIONES + FORMULARIO SIDEBAR WIZARD */}
        {activeTab === 'registro' && (
          <div className="flex flex-col lg:flex-row gap-6 h-full items-start">
            
            {/* IZQUIERDA: LISTA DE TRANSACCIONES */}
            <Card className="flex-1 overflow-hidden flex flex-col h-full w-full">
              <div className="p-4 border-b border-outline-variant bg-surface-container/40">
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">receipt_long</span>
                  Historial de Transacciones
                </h2>
              </div>
              <div className="flex-1 overflow-auto p-0">
                {loadingExpenses ? (
                  <div className="text-center py-20 text-on-surface-variant text-sm flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    Cargando transacciones...
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="text-center py-20 text-on-surface-variant text-sm flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-4xl opacity-50">inbox</span>
                    Aún no hay gastos registrados. Usa el botón superior o el panel derecho.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[650px]">
                    <thead className="sticky top-0 bg-surface-container/95 backdrop-blur z-10">
                      <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                        <th className="py-3 px-4 font-medium">Fecha</th>
                        <th className="py-3 px-4 font-medium">Categoría / Ítem</th>
                        <th className="py-3 px-4 font-medium">Proveedor / Detalle</th>
                        <th className="py-3 px-4 font-medium text-right">Cant.</th>
                        <th className="py-3 px-4 font-medium text-right">Total</th>
                        <th className="py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {expenses.map((e) => {
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
                              <span className="text-[10px] text-on-surface-variant">{item}</span>
                            </td>
                            <td className="py-2.5 px-4 text-on-surface-variant max-w-[200px]">
                              <span className="block text-white text-xs truncate">{e.provider}</span>
                              <span className="block text-[10px] truncate">{e.description || '-'}</span>
                              {adv > 0 && adv < e.amount && (
                                <span className="block text-[10px] text-error">Resta: {formatCurrency(e.amount - adv)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right text-on-surface-variant font-mono">
                              {e.quantity} <span className="text-[10px]">x {price}</span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-right text-white font-bold">
                              {formatCurrency(e.amount)}
                              <span className="block text-[10px] text-emerald-400 font-normal">{method} - Pagado: {formatCurrency(adv || e.amount)}</span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button onClick={() => handleDelete(e.id)} className="text-error/0 group-hover:text-error hover:text-error/80 text-[10px] font-bold uppercase transition-all">
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
 
            {/* DERECHA: SIDEBAR DE INGRESO (WIZARD CON 3D EFFECTS) */}
            <Card className="hidden lg:flex w-full lg:w-[420px] shrink-0 border-outline-variant bg-transparent flex-col h-full max-h-full shadow-lg">
              {renderWizardForm()}
            </Card>
          </div>
        )}

        {/* PESTAÑA 2: DASHBOARD Y PRESUPUESTOS */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Card className="col-span-full bg-surface-container/30 border-outline-variant">
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
            
            <Card className="col-span-full flex items-center justify-center py-20 text-on-surface-variant border-dashed">
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
            <Card className="border-primary/30 relative overflow-hidden shadow-[0_8px_30px_rgba(var(--color-primary),0.15)]">
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
    </>
  )
}
