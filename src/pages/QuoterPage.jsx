import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/hooks/useCompanySettings'
import { calculateQuote, calcTotalMonthlyExpenses, roundUpPrice, formatProductionTime, parseContractDurationToMonths, VOLUME_TIERS, getVolumeTierMargin, calculatePricingTiers } from '@/lib/calculations'
import { formatCurrency, formatPercent, processCategories } from '@/lib/formatters'
import { Card, Input, Select, Textarea, Button, AlertBanner, LoadingSpinner, Modal } from '@/components/ui/index.jsx'


// ─── Cost Breakdown Panel (right sidebar) ──────────────────────────────────
function CostBreakdownPanel({
  calc,
  quantity,
  marginPct,
  onRoundUp,
  negotiatedPrice,
  contractDuration,
  totalMonthlyExpenses,
  parseContractDurationToMonths,
  discountPct,
  applyTax,
  settings,
}) {
  // Negotiated results (Real results)
  const isNegotiated = negotiatedPrice && parseFloat(negotiatedPrice) > 0
  const finalPrice = isNegotiated ? (parseFloat(negotiatedPrice) * quantity) : calc.totalPrice

  // Venta bruta / neta
  const subtotal = finalPrice
  const discountAmount = subtotal * (discountPct || 0) / 100
  const taxPct = applyTax ? (settings?.tax_percentage || 0) : 0
  const taxAmount = (subtotal - discountAmount) * taxPct / 100
  const netSales = subtotal - discountAmount

  // Costo total
  const totalCost = calc.totalCost

  // Utilidad Bruta
  const grossProfit = netSales - totalCost

  // Gastos fijos prorrateados
  const months = parseContractDurationToMonths(contractDuration)
  const proratedFixedExpenses = totalMonthlyExpenses * months

  // Utilidad Neta Real
  const netProfit = grossProfit - proratedFixedExpenses
  const netMargin = finalPrice > 0 ? (netProfit / finalPrice) * 100 : 0

  const marginColor = netMargin < 0
    ? 'text-error'
    : netMargin < (settings?.min_margin || 15)
      ? 'text-primary'
      : 'text-tertiary'

  return (
    <Card className="p-0 sticky top-24 border border-primary/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-high/40">
        <h3 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">equalizer</span>
          Estado de Resultados Real
        </h3>
        <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider mt-1">
          {isNegotiated ? 'Basado en Precio Negociado' : 'Basado en Precio Sugerido'}
        </p>
      </div>
      
      <div className="p-5 space-y-4">
        {/* Income statement breakdown */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant/80 border-b border-outline-variant/30 pb-1">Ingresos</h4>
          <CostRow label="Ventas Totales" value={formatCurrency(finalPrice)} />
          {discountAmount > 0 && (
            <CostRow label={`Descuento (${discountPct}%)`} value={`-${formatCurrency(discountAmount)}`} className="text-error" />
          )}
          {taxAmount > 0 && (
            <CostRow label={`Impuestos (${taxPct}%)`} value={`+${formatCurrency(taxAmount)}`} />
          )}
          <div className="flex justify-between items-center py-1 border-t border-outline-variant/10 text-sm font-semibold">
            <span className="text-on-surface">Ventas Netas</span>
            <span className="font-mono text-on-surface">{formatCurrency(netSales)}</span>
          </div>
        </div>



        <div className="space-y-2.5 border-t border-outline-variant/30 pt-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant/80 border-b border-outline-variant/30 pb-1">Costos de Operación</h4>
          <CostRow label="Costo de Materiales" value={formatCurrency(calc.materialsCost)} />
          <CostRow label="Merma de Materiales" value={formatCurrency(calc.wasteCost)} />
          <CostRow label="Costo de Procesos" value={formatCurrency(calc.processesCost)} />
          <CostRow label="Costo de Personalización" value={formatCurrency(calc.embellishmentsCost)} />
          <div className="flex justify-between items-center py-1 border-t border-outline-variant/10 text-sm font-semibold">
            <span className="text-on-surface">Costo Total de Producción</span>
            <span className="font-mono text-on-surface">{formatCurrency(totalCost)}</span>
          </div>
        </div>

        <div className="space-y-2.5 border-t border-outline-variant/30 pt-3">
          <div className="flex justify-between items-center py-1.5 bg-surface-container-high/60 rounded px-2.5">
            <span className="text-sm font-bold text-on-surface">UTILIDAD BRUTA</span>
            <span className="font-mono text-sm font-bold text-on-surface">{formatCurrency(grossProfit)}</span>
          </div>
        </div>

        <div className="space-y-2.5 border-t border-outline-variant/30 pt-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant/80 border-b border-outline-variant/30 pb-1">Costos Administrativos</h4>
          <CostRow
            label="Gastos Fijos Prorrateados"
            value={formatCurrency(proratedFixedExpenses)}
            sub={`Por: ${contractDuration || '0 meses'} (${formatCurrency(totalMonthlyExpenses)}/mes)`}
          />
        </div>

        {/* Real bottom line */}
        <div className="border-t border-outline-variant pt-4">
          <div className="bg-primary-container/10 border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">UTILIDAD NETA REAL</span>
              <span className="font-mono text-headline-sm font-bold text-primary">{formatCurrency(netProfit)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-primary/10 pt-2 text-sm">
              <span className="text-on-surface-variant">Margen Neto Real</span>
              <span className={`font-mono font-bold ${marginColor}`}>{formatPercent(netMargin)}</span>
            </div>
          </div>
        </div>

        {/* Suggested price actions */}
        {!isNegotiated && calc.unitPrice > 0 && calc.unitPrice !== roundUpPrice(calc.unitPrice) && (
          <button
            onClick={onRoundUp}
            className="w-full mt-2 py-2 px-4 rounded-lg border border-outline-variant text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            Redondear precio a Bs {roundUpPrice(calc.unitPrice)}
          </button>
        )}

        {/* Alerts */}
        {calc.alerts.length > 0 && (
          <div className="border-t border-outline-variant pt-3 space-y-2">
            {calc.alerts.map((alert, idx) => (
              <AlertBanner key={idx} type={alert.type}>
                {alert.message}
              </AlertBanner>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function CostRow({ label, value, sub, className = '' }) {
  return (
    <div className={`flex items-center justify-between px-1 ${className}`}>
      <div>
        <span className="text-body-md text-on-surface-variant">{label}</span>
        {sub && <p className="text-xs text-on-surface-variant/60">{sub}</p>}
      </div>
      <span className="font-mono text-data-mono-md text-on-surface">{value}</span>
    </div>
  )
}

// ─── Pricing Intelligence Panel ─────────────────────────────────────────────
function PricingIntelligencePanel({
  calc,
  quantity,
  settings,
  totalMonthlyExpenses,
  contractDuration,
  discountPct,
  applyTax,
  onApplyMargin,
}) {
  const currentTierMargin = getVolumeTierMargin(quantity)
  const taxPct = applyTax ? (settings?.tax_percentage || 0) : 0
  const minMarginPct = settings?.min_margin || 15

  // Calculate pricing tiers (minimum, suggested, premium)
  const pricingTiers = useMemo(() => calculatePricingTiers({
    unitCost: calc.unitCost,
    quantity,
    minMarginPct,
    totalMonthlyExpenses,
    contractDuration,
    discountPct,
    applyTax,
    taxPct,
    totalCost: calc.totalCost,
  }), [calc.unitCost, calc.totalCost, quantity, minMarginPct, totalMonthlyExpenses, contractDuration, discountPct, applyTax, taxPct])

  // Calculate volume tiers table
  const volumeRows = useMemo(() => {
    const months = parseContractDurationToMonths(contractDuration)
    const proratedFixed = totalMonthlyExpenses * months

    return VOLUME_TIERS.map(tier => {
      const margin = tier.marginPct
      const unitPrice = margin >= 100 ? calc.unitCost : (calc.unitCost / (1 - margin / 100))
      const subtotal = unitPrice * quantity
      const discount = subtotal * (discountPct || 0) / 100
      const afterDiscount = subtotal - discount
      const tax = applyTax ? afterDiscount * taxPct / 100 : 0
      const totalSales = afterDiscount + tax
      const grossProfit = totalSales - calc.totalCost
      const netProfit = grossProfit - proratedFixed
      const netMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0
      const isActive = quantity >= tier.min && (tier.max === null ? true : quantity <= tier.max)

      return { ...tier, unitPrice, totalSales, netProfit, netMargin, isActive }
    })
  }, [calc.unitCost, calc.totalCost, quantity, discountPct, applyTax, taxPct, totalMonthlyExpenses, contractDuration])

  const tierColorMap = {
    error: {
      bg: 'bg-error-container/10',
      border: 'border-error/30',
      text: 'text-error',
      icon: 'bg-error/10',
    },
    primary: {
      bg: 'bg-primary-container/10',
      border: 'border-primary/30',
      text: 'text-primary',
      icon: 'bg-primary/10',
    },
    tertiary: {
      bg: 'bg-tertiary-container/10',
      border: 'border-tertiary/30',
      text: 'text-tertiary',
      icon: 'bg-tertiary/10',
    },
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Volume Pricing Table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary text-[20px]">stacked_bar_chart</span>
          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider font-mono">Precios por Volumen</h4>
          <span className="text-[10px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ml-auto">
            Automático
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mb-3">
          El margen se ajusta según la cantidad del pedido. La fila resaltada corresponde a tu pedido actual de <strong className="text-on-surface font-mono">{quantity}</strong> unidad{quantity !== 1 ? 'es' : ''}.
        </p>

        <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-high/60 text-xs font-mono uppercase text-on-surface-variant">
                <th className="px-3 py-2.5 text-left tracking-wider">Rango</th>
                <th className="px-3 py-2.5 text-center tracking-wider">Margen</th>
                <th className="px-3 py-2.5 text-right tracking-wider">Precio Unit.</th>
                <th className="px-3 py-2.5 text-right tracking-wider">Total Venta</th>
                <th className="px-3 py-2.5 text-right tracking-wider">Utilidad Neta</th>
                <th className="px-3 py-2.5 text-center tracking-wider w-20">Acción</th>
              </tr>
            </thead>
            <tbody>
              {volumeRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-t border-outline-variant/20 transition-all duration-300 ${
                    row.isActive
                      ? 'bg-primary-container/15 ring-1 ring-inset ring-primary/30'
                      : 'hover:bg-surface-container-high/30'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {row.isActive && (
                        <span className="material-symbols-outlined text-primary text-[14px] animate-pulse">arrow_right</span>
                      )}
                      <span className={`font-medium ${row.isActive ? 'text-primary font-bold' : 'text-on-surface'}`}>
                        {row.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-xs ${
                      row.isActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {row.marginPct}%
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${row.isActive ? 'text-primary font-bold' : 'text-on-surface'}`}>
                    {formatCurrency(row.unitPrice)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${row.isActive ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
                    {formatCurrency(row.totalSales)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-mono font-semibold ${
                      row.netProfit < 0 ? 'text-error' : row.isActive ? 'text-tertiary' : 'text-on-surface-variant'
                    }`}>
                      {formatCurrency(row.netProfit)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => onApplyMargin(row.marginPct)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all active:scale-95 ${
                        row.isActive
                          ? 'bg-primary text-on-primary hover:brightness-110'
                          : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                      title={`Aplicar margen de ${row.marginPct}%`}
                    >
                      {row.isActive ? '✓ Aplicar' : 'Usar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-outline-variant/30" />

      {/* Section 2: Service-Type Pricing Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-tertiary text-[20px]">auto_awesome</span>
          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider font-mono">Tipo de Precio</h4>
          <span className="text-[10px] bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ml-auto">
            Guía de decisión
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mb-4">
          Tres escenarios automáticos según el tipo de cliente o urgencia. Haz clic en cualquiera para aplicarlo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pricingTiers.map(tier => {
            const colors = tierColorMap[tier.color] || tierColorMap.primary
            const isNegative = tier.netProfit < 0

            return (
              <button
                key={tier.key}
                onClick={() => onApplyMargin(tier.marginPct)}
                className={`text-left p-4 rounded-xl border-2 ${colors.border} ${colors.bg} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] group cursor-pointer`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-[18px] ${colors.text}`}>{tier.icon}</span>
                  </div>
                  <div>
                    <h5 className={`text-xs font-bold uppercase tracking-wider font-mono ${colors.text}`}>
                      {tier.label}
                    </h5>
                    <p className="text-[10px] text-on-surface-variant leading-tight">{tier.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-2">
                  <span className="text-[10px] text-on-surface-variant uppercase font-mono">Precio unitario</span>
                  <p className={`font-mono text-xl font-bold ${colors.text}`}>
                    {formatCurrency(tier.unitPrice)}
                  </p>
                </div>

                {/* Stats */}
                <div className="space-y-1 border-t border-outline-variant/20 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Margen</span>
                    <span className={`font-mono font-bold ${colors.text}`}>{tier.marginPct}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Venta total</span>
                    <span className="font-mono text-on-surface">{formatCurrency(tier.totalSales)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Utilidad neta</span>
                    <span className={`font-mono font-bold ${isNegative ? 'text-error' : 'text-tertiary'}`}>
                      {formatCurrency(tier.netProfit)}
                    </span>
                  </div>
                </div>

                {/* Apply hint */}
                <div className={`mt-3 text-center text-[10px] font-bold uppercase tracking-widest ${colors.text} opacity-60 group-hover:opacity-100 transition-opacity`}>
                  Clic para aplicar →
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}


export default function QuoterPage() {
  const { user } = useAuth()
  const { settings, loading: settingsLoading } = useCompanySettings()
  const navigate = useNavigate()

  // Data sources
  const [clients, setClients] = useState([])
  const [templates, setTemplates] = useState([])
  const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)

  // Form state
  const [clientId, setClientId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [marginPct, setMarginPct] = useState(30)
  const [discountPct, setDiscountPct] = useState(0)
  const [applyTax, setApplyTax] = useState(false)
  const [negotiatedPrice, setNegotiatedPrice] = useState('')
  const [contractDuration, setContractDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [materials, setMaterials] = useState([])
  const [processes, setProcesses] = useState([])
  const [embellishments, setEmbellishments] = useState([])
  const [saving, setSaving] = useState(false)

  // Tabs state
  const [activeTab, setActiveTab] = useState('pricing') // 'pricing' | 'materials'



  // Load initial data function
  async function loadInitialData() {
    setInitialLoading(true)
    try {
      const [clientsRes, templatesRes, expensesRes] = await Promise.all([
        supabase.from('clients').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('product_templates').select('id, name, suggested_margin').eq('user_id', user.id).order('name'),
        supabase.from('fixed_expenses').select('*').eq('user_id', user.id),
      ])

      setClients(clientsRes.data || [])
      setTemplates(templatesRes.data || [])

      const expenses = expensesRes.data || []
      setTotalMonthlyExpenses(calcTotalMonthlyExpenses(expenses))
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setInitialLoading(false)
    }
  }

  // Load initial data on mount/user change
  useEffect(() => {
    if (!user) return
    loadInitialData()
  }, [user])

  // Apply defaults from settings
  useEffect(() => {
    if (!settingsLoading && settings) {
      setMarginPct(settings.default_margin || 30)
    }
  }, [settings, settingsLoading])

  // Load template data when selected
  const loadTemplate = useCallback(async (tmplId) => {
    if (!tmplId) {
      setMaterials([])
      setProcesses([])
      setEmbellishments([])
      return
    }

    try {
      const [matRes, procRes, embRes] = await Promise.all([
        supabase
          .from('product_template_materials')
          .select('*, materials(name, unit_price, usage_unit, price_updated_at, default_waste_pct, purchase_quantity, purchase_unit)')
          .eq('template_id', tmplId),
        supabase
          .from('product_template_processes')
          .select('*, processes(name, cost_type, cost)')
          .eq('template_id', tmplId),
        supabase
          .from('product_template_embellishments')
          .select('*')
          .eq('template_id', tmplId),
      ])



      const tmplMaterials = (matRes.data || []).map(tm => ({
        id: crypto.randomUUID(),
        material_id: tm.material_id,
        material_name: tm.materials?.name || 'Material',
        quantity_per_unit: tm.quantity_per_unit || 0,
        unit_price: tm.materials?.unit_price || 0,
        waste_pct: tm.waste_pct_override != null ? tm.waste_pct_override : (tm.materials?.default_waste_pct || 0),
        usage_unit: tm.materials?.usage_unit || 'unidad',
        price_updated_at: tm.materials?.price_updated_at,
        purchase_quantity: tm.materials?.purchase_quantity || 1,
        purchase_unit: tm.materials?.purchase_unit || 'unidad',
      }))

      const tmplProcesses = (procRes.data || []).map(tp => ({
        id: crypto.randomUUID(),
        process_id: tp.process_id,
        process_name: tp.processes?.name || 'Proceso',
        cost_type: tp.processes?.cost_type || 'por_unidad',
        cost: tp.processes?.cost || 0,
        time_minutes: tp.time_minutes_per_unit || 0,
      }))

      const tmplEmbellishments = (embRes.data || []).map(te => ({
        id: crypto.randomUUID(),
        type: te.type,
        name: te.name,
        cost: te.cost || 0,
        quantity: te.quantity || 1,
      }))

      setMaterials(tmplMaterials)
      setProcesses(tmplProcesses)
      setEmbellishments(tmplEmbellishments)

      // Apply template default margin if available
      const tmpl = templates.find(t => t.id === tmplId)
      if (tmpl?.suggested_margin) {
        setMarginPct(tmpl.suggested_margin)
      }
    } catch (err) {
      console.error('Error loading template:', err)
    }
  }, [templates])

  function handleTemplateChange(e) {
    const val = e.target.value
    setTemplateId(val)
    loadTemplate(val)
  }

  // ─── Material editor helpers ────────────────────────────────────────
  function updateMaterial(id, field, value) {
    setMaterials(prev => prev.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ))
  }

  function removeMaterial(id) {
    setMaterials(prev => prev.filter(m => m.id !== id))
  }

  function addMaterial() {
    setMaterials(prev => [...prev, {
      id: crypto.randomUUID(),
      material_id: null,
      material_name: 'Nuevo material',
      quantity_per_unit: 0,
      unit_price: 0,
      waste_pct: 0,
      usage_unit: 'unidad',
    }])
  }

  // ─── Process editor helpers ─────────────────────────────────────────
  function updateProcess(id, field, value) {
    setProcesses(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ))
  }

  function removeProcess(id) {
    setProcesses(prev => prev.filter(p => p.id !== id))
  }

  function addProcess() {
    setProcesses(prev => [...prev, {
      id: crypto.randomUUID(),
      process_id: null,
      process_name: 'Nuevo proceso',
      cost_type: 'por_unidad',
      cost: 0,
      time_minutes: 0,
    }])
  }

  // ─── Embellishments editor helpers ──────────────────────────────────
  function updateEmbellishment(id, field, value) {
    setEmbellishments(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ))
  }

  function removeEmbellishment(id) {
    setEmbellishments(prev => prev.filter(e => e.id !== id))
  }

  function addEmbellishment() {
    setEmbellishments(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'bordado',
      name: 'Nueva personalización',
      cost: 0,
      quantity: 1,
    }])
  }

  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === templateId)
  }, [templates, templateId])

  // ─── Calculate quote (memoized) ─────────────────────────────────────
  const calc = useMemo(() => {
    return calculateQuote({
      materials,
      processes,
      embellishments,
      quantity,
      marginPct,
      discountPct,
      taxPct: applyTax ? (settings?.tax_percentage || 0) : 0,
      totalMonthlyExpenses,
      monthlyCapacity: settings?.monthly_capacity_units || 1000,
      minMargin: settings?.min_margin || 15,
      negotiatedPrice: negotiatedPrice ? (parseFloat(negotiatedPrice) * quantity) : null,
    })
  }, [materials, processes, embellishments, quantity, marginPct, discountPct, applyTax, totalMonthlyExpenses, settings, negotiatedPrice])

  function handleRoundUp() {
    const roundedUnitPrice = roundUpPrice(calc.unitPrice)
    if (roundedUnitPrice > 0 && calc.unitCost > 0) {
      // Reverse-engineer margin: unitPrice = unitCost / (1 - margin/100) => margin = (1 - unitCost/unitPrice)*100
      const newMargin = Math.round((1 - calc.unitCost / roundedUnitPrice) * 10000) / 100
      setMarginPct(Math.max(0, newMargin))
    }
  }

  // ─── Save Quote ─────────────────────────────────────────────────────
  async function handleSave() {
    if (calc.hasErrors || !clientId || saving) return

    setSaving(true)
    try {
      // Get next quote number
      const { data: lastQuote } = await supabase
        .from('quotes')
        .select('quote_number')
        .eq('user_id', user.id)
        .order('quote_number', { ascending: false })
        .limit(1)
        .single()

      const nextNumber = (lastQuote?.quote_number || 0) + 1

      // Determine validity date
      const validityDays = settings?.quote_validity_days || 15
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + validityDays)

      const finalQuotePrice = (parseFloat(negotiatedPrice) * quantity) || calc.totalPrice
      const finalQuoteProfit = finalQuotePrice - calc.totalCost
      const finalQuoteMargin = finalQuotePrice > 0 ? (finalQuoteProfit / finalQuotePrice) * 100 : 0

      // Append production time and contract duration to notes
      const formattedProdTime = formatProductionTime(calc.totalProductionTimeMinutes)
      let finalNotes = `[Tiempo total de producción: ${formattedProdTime}]`.trim()
      if (contractDuration?.trim()) {
        finalNotes = `[Duración del contrato: ${contractDuration.trim()}]\n${finalNotes}`
      }
      finalNotes = `${finalNotes}\n${notes || ''}`.trim()

      // 1) Create quote record
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          client_id: clientId,
          quote_number: nextNumber,
          status: 'borrador',
          discount_pct: discountPct,
          tax_pct: applyTax ? (settings?.tax_percentage || 0) : 0,
          notes: finalNotes,
          valid_until: validUntil.toISOString(),
          total_cost: calc.totalCost,
          total_price: finalQuotePrice,
          total_profit: finalQuoteProfit,
          real_margin: finalQuoteMargin,
        })
        .select()
        .single()

      if (quoteError) throw quoteError

      // 2) Create quote_items record
      const selectedTemplate = templates.find(t => t.id === templateId)
      const { data: quoteItem, error: itemError } = await supabase
        .from('quote_items')
        .insert({
          quote_id: quote.id,
          template_id: templateId || null,
          product_name: selectedTemplate?.name || 'Producto personalizado',
          quantity,
          margin_pct: marginPct,
          fixed_expense_per_unit: 0,
          unit_cost: calc.unitCost,
          unit_price: finalQuotePrice / quantity,
          total_cost: calc.totalCost,
          total_price: finalQuotePrice,
          profit: finalQuoteProfit,
          real_margin: finalQuoteMargin,
        })
        .select()
        .single()

      if (itemError) throw itemError

      // 3) Create quote_materials
      if (materials.length > 0) {
        const quoteMaterials = materials.map(m => {
          const qty = parseFloat(m.quantity_per_unit) || 0
          const price = parseFloat(m.unit_price) || 0
          const waste = parseFloat(m.waste_pct) || 0
          const materialUnitCost = qty * price * (1 + waste / 100)
          const materialTotalCost = materialUnitCost * quantity
          return {
            quote_item_id: quoteItem.id,
            material_id: m.material_id,
            material_name: m.material_name,
            quantity_per_unit: qty,
            unit_price: price,
            waste_pct: waste,
            total_cost: materialTotalCost,
          }
        })

        const { error: matError } = await supabase
          .from('quote_materials')
          .insert(quoteMaterials)

        if (matError) throw matError
      }

      // 4) Create quote_processes
      if (processes.length > 0) {
        const quoteProcesses = processes.map(p => {
          const cost = parseFloat(p.cost) || 0
          const time = parseFloat(p.time_minutes) || 0
          let processTotalCost = 0
          if (p.cost_type === 'por_hora') {
            processTotalCost = (time / 60) * cost * quantity
          } else if (p.cost_type === 'por_unidad') {
            processTotalCost = cost * quantity
          } else {
            processTotalCost = cost // fijo_por_pedido
          }
          return {
            quote_item_id: quoteItem.id,
            process_id: p.process_id,
            process_name: p.process_name,
            cost_type: p.cost_type,
            cost: cost,
            time_minutes: time,
            total_cost: processTotalCost,
          }
        })

        const { error: procError } = await supabase
          .from('quote_processes')
          .insert(quoteProcesses)

        if (procError) throw procError
      }

      // 5) Create quote_embellishments
      if (embellishments.length > 0) {
        const quoteEmbellishments = embellishments.map(e => ({
          quote_item_id: quoteItem.id,
          type: e.type,
          name: e.name,
          cost: parseFloat(e.cost) || 0,
          quantity: parseFloat(e.quantity) || 1,
          total_cost: (parseFloat(e.cost) || 0) * (parseFloat(e.quantity) || 1) * quantity,
        }))

        const { error: embError } = await supabase
          .from('quote_embellishments')
          .insert(quoteEmbellishments)

        if (embError) throw embError
      }

      // Navigate to quote detail
      navigate(`/quotes/${quote.id}`)
    } catch (err) {
      console.error('Error saving quote:', err)
      alert('Error al guardar la cotización: ' + (err.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  if (initialLoading || settingsLoading) {
    return <LoadingSpinner />
  }

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const templateOptions = templates.map(t => ({ value: t.id, label: t.name }))

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-headline-md font-semibold text-on-surface">Nueva Cotización</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Calcula costos y precios para tu producto textil
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── Left Column: Form ─── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Client & Template */}
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Cliente"
                options={clientOptions}
                placeholder="Seleccionar cliente..."
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              />
              <Select
                label="Plantilla de Producto"
                options={templateOptions}
                placeholder="Seleccionar plantilla..."
                value={templateId}
                onChange={handleTemplateChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-outline-variant/30 pt-3">
              <div>
                <Input
                  label="Cantidad"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  suffix="uds"
                />
              </div>
              <Input
                label="Precio Negociado"
                type="number"
                min="0"
                step="1"
                value={negotiatedPrice}
                onChange={e => setNegotiatedPrice(e.target.value)}
                placeholder="Ej: 500"
                suffix="Bs"
              />
              <Input
                label="Duración del Contrato"
                type="text"
                value={contractDuration}
                onChange={e => setContractDuration(e.target.value)}
                placeholder="Ej: 3 meses / 15 días"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center border-t border-outline-variant/30 pt-3">
              <Input
                label="Descuento %"
                type="number"
                step="1"
                min="0"
                max="100"
                value={discountPct}
                onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)}
                suffix="%"
              />
              <div className="flex flex-col pt-3">
                <span className="text-xs text-on-surface-variant font-medium mb-2 font-mono uppercase tracking-wider">Impuestos</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyTax}
                    onChange={e => setApplyTax(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface-variant after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-on-primary"></div>
                  <span className="ml-3 text-sm font-semibold text-on-surface">
                    Tomar en cuenta impuestos ({settings?.tax_percentage || 0}%)
                  </span>
                </label>
              </div>
            </div>
          </Card>

          {/* Materials editor */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                Materiales
              </h3>
              <Button variant="ghost" size="sm" onClick={addMaterial}>
                <span className="material-symbols-outlined text-[16px]">add</span>
                Agregar
              </Button>
            </div>
            {materials.length === 0 ? (
              <div className="px-5 py-8 text-center text-on-surface-variant text-body-md">
                Selecciona una plantilla o agrega materiales manualmente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Material</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-24">Cant/Ud</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-28">Precio Unit.</th>

                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-20">Merma %</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-28">Subtotal</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map(m => {
                      const subQty = parseFloat(m.quantity_per_unit) || 0
                      const subPrice = parseFloat(m.unit_price) || 0
                      const wastePct = parseFloat(m.waste_pct) || 0
                      const matCost = subQty * subPrice * quantity
                      const waste = matCost * wastePct / 100
                      const subTotal = matCost + waste
                      const hasNoPrice = !m.unit_price || subPrice <= 0

                      return (
                        <tr key={m.id} className={hasNoPrice ? 'bg-error-container/10' : ''}>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={m.material_name}
                              onChange={e => updateMaterial(m.id, 'material_name', e.target.value)}
                              className="w-full bg-transparent border-none text-body-md text-on-surface outline-none focus:text-primary"
                            />
                            {hasNoPrice && (
                              <p className="text-xs text-error flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[12px]">error</span>
                                Sin precio
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={m.quantity_per_unit}
                              onChange={e => updateMaterial(m.id, 'quantity_per_unit', e.target.value)}
                              className="w-full text-right bg-transparent border border-outline-variant rounded px-2 py-1 text-sm font-mono text-on-surface outline-none focus:border-primary"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={m.unit_price}
                              onChange={e => updateMaterial(m.id, 'unit_price', e.target.value)}
                              className="w-full text-right bg-transparent border border-outline-variant rounded px-2 py-1 text-sm font-mono text-on-surface outline-none focus:border-primary"
                            />
                          </td>

                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={m.waste_pct}
                              onChange={e => updateMaterial(m.id, 'waste_pct', e.target.value)}
                              className="w-full text-right bg-transparent border border-outline-variant rounded px-2 py-1 text-sm font-mono text-on-surface outline-none focus:border-primary"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-data-mono-md text-on-surface">
                            {formatCurrency(subTotal)}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => removeMaterial(m.id)}
                              className="p-1 rounded hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Processes editor */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">precision_manufacturing</span>
                Procesos
              </h3>
              <Button variant="ghost" size="sm" onClick={addProcess}>
                <span className="material-symbols-outlined text-[16px]">add</span>
                Agregar
              </Button>
            </div>
            {processes.length === 0 ? (
              <div className="px-5 py-8 text-center text-on-surface-variant text-body-md">
                Selecciona una plantilla o agrega procesos manualmente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Proceso</th>
                      <th className="text-left px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-32">Tipo Costo</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-24">Costo</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-24">Tiempo</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-28">Subtotal</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map(p => {
                      const cost = parseFloat(p.cost) || 0
                      const timeMin = parseFloat(p.time_minutes) || 0
                      let subTotal = 0
                      if (p.cost_type === 'por_hora') {
                        subTotal = (timeMin / 60) * cost * quantity
                      } else if (p.cost_type === 'por_unidad') {
                        subTotal = cost * quantity
                      } else if (p.cost_type === 'fijo_por_pedido') {
                        subTotal = cost
                      }

                      return (
                        <tr key={p.id}>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={p.process_name}
                              onChange={e => updateProcess(p.id, 'process_name', e.target.value)}
                              className="w-full bg-transparent border-none text-body-md text-on-surface outline-none focus:text-primary"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={p.cost_type}
                              onChange={e => updateProcess(p.id, 'cost_type', e.target.value)}
                              className="w-full bg-transparent border border-outline-variant rounded px-2 py-1 text-sm text-on-surface outline-none focus:border-primary cursor-pointer"
                            >
                              {Object.entries(processCategories).map(([val, lbl]) => (
                                <option key={val} value={val} className="bg-surface-container-high">{lbl}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={p.cost}
                              onChange={e => updateProcess(p.id, 'cost', e.target.value)}
                              className="w-full text-right bg-transparent border border-outline-variant rounded px-2 py-1 text-sm font-mono text-on-surface outline-none focus:border-primary"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={p.time_minutes}
                              onChange={e => updateProcess(p.id, 'time_minutes', e.target.value)}
                              disabled={p.cost_type !== 'por_hora'}
                              className="w-full text-right bg-transparent border border-outline-variant rounded px-2 py-1 text-sm font-mono text-on-surface outline-none focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                              placeholder={p.cost_type !== 'por_hora' ? '—' : '0'}
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-data-mono-md text-on-surface">
                            {formatCurrency(subTotal)}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => removeProcess(p.id)}
                              className="p-1 rounded hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Embellishments editor */}
          <Card className="p-0 border border-tertiary/20">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-[20px]">palette</span>
                Personalización y Embellecimiento
              </h3>
              <Button variant="ghost" size="sm" onClick={addEmbellishment} className="text-tertiary hover:bg-tertiary/10">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Agregar
              </Button>
            </div>
            {embellishments.length === 0 ? (
              <div className="px-5 py-8 text-center text-on-surface-variant text-body-md">
                Registra bordados, sublimados, vinilos u otros logos personalizados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-40">Tipo</th>
                      <th className="text-left px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant">Descripción/Nombre</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-28">Costo Unit.</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-20">Cant.</th>
                      <th className="text-right px-4 py-3 text-label-caps font-mono uppercase tracking-wider text-on-surface-variant w-28">Subtotal</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {embellishments.map(e => {
                      const cost = parseFloat(e.cost) || 0
                      const qty = parseFloat(e.quantity) || 1
                      const subTotal = cost * qty * quantity

                      return (
                        <tr key={e.id}>
                          <td className="px-4 py-2">
                            <select
                              value={e.type}
                              onChange={evt => updateEmbellishment(e.id, 'type', evt.target.value)}
                              className="w-full bg-transparent border border-outline-variant rounded px-2 py-1 text-sm text-on-surface outline-none focus:border-primary cursor-pointer font-medium"
                            >
                              <option value="bordado" className="bg-surface-container-high text-on-surface">Bordado</option>
                              <option value="sublimado" className="bg-surface-container-high text-on-surface">Sublimado</option>
                              <option value="vinil" className="bg-surface-container-high text-on-surface">Vinil</option>
                              <option value="otro" className="bg-surface-container-high text-on-surface">Otro</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={e.name}
                              onChange={evt => updateEmbellishment(e.id, 'name', evt.target.value)}
                              className="w-full bg-transparent border-none text-body-md text-on-surface outline-none focus:text-primary"
                              placeholder="Nombre/Descripción del logo..."
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={e.cost}
                              onChange={evt => updateEmbellishment(e.id, 'cost', evt.target.value)}
                              className="w-full text-right bg-transparent border border-outline-variant rounded px-2 py-1 text-sm font-mono text-on-surface outline-none focus:border-primary"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={e.quantity}
                              onChange={evt => updateEmbellishment(e.id, 'quantity', evt.target.value)}
                              className="w-full text-right bg-transparent border border-outline-variant rounded px-2 py-1 text-sm font-mono text-on-surface outline-none focus:border-primary"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-data-mono-md text-on-surface">
                            {formatCurrency(subTotal)}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => removeEmbellishment(e.id)}
                              className="p-1 rounded hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Notes Card */}
          <Card className="p-5">
            <Textarea
              label="Notas / Observaciones"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Agregar notas opcionales para esta cotización..."
            />
          </Card>

          {/* Two Tabs Component for Pricing Intelligence and Materials Purchase */}
          <div className="border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-low">
            <div className="flex border-b border-outline-variant/30 bg-surface-container-high/50">
              <button
                type="button"
                onClick={() => setActiveTab('pricing')}
                className={`flex-1 py-3 px-4 text-center font-bold text-sm flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeTab === 'pricing'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">insights</span>
                Inteligencia de Precios
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('materials')}
                className={`flex-1 py-3 px-4 text-center font-bold text-sm flex items-center justify-center gap-2 border-b-2 transition-all ${
                  activeTab === 'materials'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                Resumen de Compra de Materiales
              </button>
            </div>

            <div className="p-5">
              {activeTab === 'pricing' ? (
                <PricingIntelligencePanel
                  calc={calc}
                  quantity={quantity}
                  settings={settings}
                  totalMonthlyExpenses={totalMonthlyExpenses}
                  contractDuration={contractDuration}
                  discountPct={discountPct}
                  applyTax={applyTax}
                  onApplyMargin={(margin) => setMarginPct(margin)}
                />
              ) : (
                <div className="overflow-x-auto">
                  {materials.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-4">No hay materiales agregados.</p>
                  ) : (
                    <table className="w-full zebra-table text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant/30 font-mono text-xs uppercase text-on-surface-variant">
                          <th className="px-3 py-2 text-left">Material</th>
                          <th className="px-3 py-2 text-right">Requerido (c/Merma)</th>
                          <th className="px-3 py-2 text-right">Capacidad Paquete</th>
                          <th className="px-3 py-2 text-right font-medium">Cantidad a Comprar</th>
                          <th className="px-3 py-2 text-right">Costo Estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materials.map(m => {
                          const qtyReq = parseFloat(m.quantity_per_unit) || 0
                          const price = parseFloat(m.unit_price) || 0
                          const waste = parseFloat(m.waste_pct) || 0
                          const baseTotal = qtyReq * quantity
                          const totalRequired = baseTotal + (baseTotal * waste / 100)
                          
                          const packQty = parseFloat(m.purchase_quantity) || 1
                          const packUnit = m.purchase_unit || 'unidad'
                          const toBuy = Math.ceil(totalRequired / packQty)
                          const totalCost = toBuy * packQty * price

                          return (
                            <tr key={m.id} className="border-t border-outline-variant/20">
                              <td className="px-3 py-2 font-medium text-on-surface">{m.material_name}</td>
                              <td className="px-3 py-2 text-right font-mono">{totalRequired.toFixed(2)} {m.usage_unit}</td>
                              <td className="px-3 py-2 text-right font-mono">{packQty} {m.usage_unit} ({packUnit})</td>
                              <td className="px-3 py-2 text-right font-mono text-primary font-bold">{toBuy} {packUnit}{toBuy > 1 ? 's' : ''}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-on-surface">{formatCurrency(totalCost)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={handleSave}
              disabled={calc.hasErrors || !clientId || saving}
              className="min-w-[200px]"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Guardar Cotización
                </>
              )}
            </Button>
            {!clientId && (
              <span className="text-body-md text-on-surface-variant">
                Selecciona un cliente para guardar
              </span>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <CostBreakdownPanel
            calc={calc}
            quantity={quantity}
            marginPct={marginPct}
            onRoundUp={handleRoundUp}
            negotiatedPrice={negotiatedPrice}
            contractDuration={contractDuration}
            totalMonthlyExpenses={totalMonthlyExpenses}
            parseContractDurationToMonths={parseContractDurationToMonths}
            discountPct={discountPct}
            applyTax={applyTax}
            settings={settings}
          />
        </div>
      </div>


    </div>
  )
}
