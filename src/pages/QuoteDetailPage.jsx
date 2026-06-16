import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/hooks/useCompanySettings'
import { calculateQuote, formatProductionTime, calcTotalMonthlyExpenses, parseContractDurationToMonths } from '@/lib/calculations'
import {
  Card, Button, StatusBadge, LoadingSpinner,
  AlertBanner, ConfirmDialog, Select
} from '@/components/ui/index.jsx'
import {
  formatCurrency, formatPercent, formatDate,
  formatQuoteNumber, quoteStatuses, processCategories
} from '@/lib/formatters'

export default function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings } = useCompanySettings()

  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  
  // Toggle between internal breakdown and client-facing invoice view
  const [viewMode, setViewMode] = useState('internal') // 'internal' | 'client'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0)

  useEffect(() => {
    if (user && id) {
      fetchQuote()
      fetchFixedExpenses()
    }
  }, [user, id])

  async function fetchFixedExpenses() {
    try {
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('user_id', user.id)
      if (error) throw error
      setTotalMonthlyExpenses(calcTotalMonthlyExpenses(data || []))
    } catch (err) {
      console.error('Error fetching fixed expenses:', err)
    }
  }

  async function fetchQuote() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          clients (*),
          quote_items (
            *,
            quote_materials (
              *,
              materials (
                purchase_quantity,
                purchase_unit,
                usage_unit
              )
            ),
            quote_processes (*),
            quote_embellishments (*)
          )
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setQuote(data)
    } catch (err) {
      console.error('Error fetching quote detail:', err)
      setError(err.message || 'No se pudo cargar la cotización.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (!quote) return
    setStatusUpdating(true)
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', quote.id)
        .select()
        .single()

      if (error) throw error
      setQuote(prev => ({ ...prev, status: data.status }))
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Error al actualizar el estado')
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleDeleteQuote() {
    if (!quote) return
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quote.id)

      if (error) throw error
      navigate('/quotes')
    } catch (err) {
      console.error('Error deleting quote:', err)
      alert('Error al eliminar la cotización')
    }
  }

  if (loading) return <LoadingSpinner />
  if (error || !quote) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <AlertBanner type="error">{error || 'Cotización no encontrada'}</AlertBanner>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/quotes')}>
          Volver al Historial
        </Button>
      </div>
    )
  }

  const client = quote.clients || {}
  const item = quote.quote_items?.[0] || {}
  const materials = item.quote_materials || []
  const processes = item.quote_processes || []
  const embellishments = item.quote_embellishments || []

  const calc = calculateQuote({
    materials,
    processes,
    embellishments,
    quantity: item.quantity || 1,
    marginPct: item.margin_pct || 30,
    discountPct: quote.discount_pct || 0,
    taxPct: quote.tax_pct || 0,
    totalMonthlyExpenses,
    monthlyCapacity: settings?.monthly_capacity_units || 1000,
    minMargin: settings?.min_margin || 15,
    negotiatedPrice: quote.total_price,
  })

  const getContractDuration = (notesStr) => {
    if (!notesStr) return null
    const match = notesStr.match(/\[Duración del contrato:\s*([^\]]+)\]/)
    return match ? match[1] : null
  }
  const contractDuration = getContractDuration(quote.notes)

  const getCleanNotes = (notesStr) => {
    if (!notesStr) return ''
    return notesStr
      .replace(/\[Duración del contrato:\s*[^\]]+\]/g, '')
      .replace(/\[Tiempo total de producción:\s*[^\]]+\]/g, '')
      .trim()
  }
  const cleanNotes = getCleanNotes(quote.notes)

  const getProductionTimeText = (notesStr) => {
    if (!notesStr) return null
    const match = notesStr.match(/\[Tiempo total de producción:\s*([^\]]+)\]/)
    return match ? match[1] : null
  }
  const productionTimeText = getProductionTimeText(quote.notes)

  const contractMonths = parseContractDurationToMonths(contractDuration)
  const proratedFixedExpenses = totalMonthlyExpenses * contractMonths

  const netProfit = (quote.total_price - quote.total_cost) - proratedFixedExpenses
  const netMargin = quote.total_price > 0 ? (netProfit / quote.total_price) * 100 : 0

  const totalProductionTimeMinutes = processes.reduce((sum, p) => {
    return sum + ((parseFloat(p.time_minutes) || 0) * (item.quantity || 1))
  }, 0)

  // Check margins for warnings
  const isMarginWarning = quote.real_margin < (settings.min_margin || 15)

  if (viewMode === 'client') {
    return (
      <div className="animate-fade-in print:bg-white print:text-black">
        {/* Style injection to hide sidebar and header when printing */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
            }
            /* Hide Sidebar, Header, BottomNav, and Action Bar during printing */
            header, nav, aside, footer, .no-print, button {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
            }
            .print-container {
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              padding: 0 !important;
            }
            .print-text-dark {
              color: #111827 !important;
            }
            .print-border {
              border-color: #d1d5db !important;
            }
          }
        `}} />

        {/* Back and Action Buttons */}
        <div className="flex justify-between items-center mb-6 no-print">
          <Button variant="secondary" onClick={() => setViewMode('internal')}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Volver a Vista Interna
          </Button>
          <Button onClick={() => window.print()}>
            <span className="material-symbols-outlined text-[18px]">print</span>
            Imprimir Cotización
          </Button>
        </div>

        {/* Print-friendly Card */}
        <Card className="p-8 max-w-[800px] mx-auto bg-surface-container-low border border-outline-variant print-container print:bg-white print:text-black">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-outline-variant/50 pb-6 print-border">
            <div>
              <h2 className="text-headline-md font-bold text-on-surface print:text-black">{settings.company_name}</h2>
              <p className="text-body-md text-on-surface-variant print:text-gray-600 mt-1">Producción Textil Deportiva y Corporativa</p>
            </div>
            <div className="text-right">
              <div className="text-headline-sm font-bold text-primary font-mono print:text-black">
                {formatQuoteNumber(quote.quote_number)}
              </div>
              <p className="text-xs text-on-surface-variant print:text-gray-600 mt-1 font-mono">
                Fecha: {formatDate(quote.created_at)}
              </p>
              <p className="text-xs text-on-surface-variant print:text-gray-600 font-mono">
                Validez de Oferta: {settings.quote_validity_days || 15} días ({formatDate(quote.valid_until)})
              </p>
            </div>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-2 gap-8 my-6">
            <div>
              <h3 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant print:text-gray-600 mb-2">Cliente</h3>
              <p className="text-body-lg font-bold text-on-surface print:text-black">{client.name || 'Cliente general'}</p>
              {client.contact_person && <p className="text-sm text-on-surface-variant print:text-gray-700">Atención: {client.contact_person}</p>}
              {client.city && <p className="text-sm text-on-surface-variant print:text-gray-700">Ciudad: {client.city}</p>}
            </div>
            <div className="text-right">
              <h3 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant print:text-gray-600 mb-2">Contacto</h3>
              {client.phone && <p className="text-sm font-mono text-on-surface-variant print:text-gray-700 font-mono">Tel: {client.phone}</p>}
              {client.email && <p className="text-sm font-mono text-on-surface-variant print:text-gray-700 font-mono">{client.email}</p>}
            </div>
          </div>

          {/* Items Table */}
          <div className="my-8">
            <table className="w-full text-left print:text-black">
              <thead>
                <tr className="border-b border-outline-variant print:border-black font-mono text-xs uppercase text-on-surface-variant print:text-gray-700">
                  <th className="py-2">Descripción del Producto</th>
                  <th className="py-2 text-right">Cantidad</th>
                  <th className="py-2 text-right">Precio Unitario</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 print:divide-gray-300">
                <tr className="text-on-surface print:text-black">
                  <td className="py-4 text-sm font-semibold">
                    {item.product_name || 'Prenda textil personalizada'}
                  </td>
                  <td className="py-4 text-sm text-right font-mono">{item.quantity || 0}</td>
                  <td className="py-4 text-sm text-right font-mono">{formatCurrency(quote.total_price / item.quantity)}</td>
                  <td className="py-4 text-sm text-right font-bold font-mono">{formatCurrency(quote.total_price)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-outline-variant/50 print:border-black print:text-black">
            <div className="space-y-4">
              <div>
                <h4 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant print:text-gray-600 mb-1.5 font-bold">Condiciones Comerciales</h4>
                <ul className="space-y-1 text-xs text-on-surface-variant print:text-gray-700">
                  <li><span className="font-semibold text-on-surface print:text-black">Tiempo de producción/entrega:</span> {contractDuration || 'A coordinar'}</li>
                  <li><span className="font-semibold text-on-surface print:text-black">Condiciones de pago:</span> 50% anticipo y 50% contra entrega</li>
                  <li><span className="font-semibold text-on-surface print:text-black">Validez de la oferta:</span> {settings.quote_validity_days || 15} días ({formatDate(quote.valid_until)})</li>
                </ul>
              </div>
              {cleanNotes && (
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant print:text-gray-600 mb-1.5 font-bold">Observaciones Comerciales</h4>
                  <p className="text-xs text-on-surface-variant print:text-gray-700 whitespace-pre-line leading-relaxed">{cleanNotes}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-end space-y-2 text-right">
              {quote.discount_pct > 0 && (
                <div className="flex justify-between text-sm text-on-surface-variant print:text-gray-700">
                  <span>Descuento ({formatPercent(quote.discount_pct)}):</span>
                  <span className="font-mono font-medium">-{formatCurrency((quote.total_price / (1 - quote.discount_pct/100)) * (quote.discount_pct/100))}</span>
                </div>
              )}
              {quote.tax_pct > 0 && (
                <div className="flex justify-between text-sm text-on-surface-variant print:text-gray-700">
                  <span>Impuesto ({formatPercent(quote.tax_pct)}):</span>
                  <span className="font-mono font-medium">+{formatCurrency(quote.total_price * (quote.tax_pct/100))}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-body-lg font-bold text-on-surface print:text-black border-t border-outline-variant/30 print:border-gray-400 pt-2 font-mono">
                <span>Total Cotizado:</span>
                <span className="text-headline-sm text-primary print:text-black font-bold">
                  {formatCurrency(quote.total_price)}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Footer */}
          <div className="mt-12 text-[10px] text-on-surface-variant print:text-gray-500 border-t border-outline-variant/30 print:border-gray-300 pt-4">
            <h4 className="font-semibold uppercase tracking-wider mb-2">Términos y Condiciones</h4>
            <ul className="list-disc pl-4 space-y-1">
              <li>Los precios están expresados en {settings.currency || 'Bs'} y no incluyen IVA a menos que se indique lo contrario.</li>
              <li>El tiempo estimado de entrega inicia tras la recepción del anticipo y la aprobación de los diseños/muestras correspondientes.</li>
              <li>Esta cotización está sujeta a los términos y políticas comerciales vigentes de {settings.company_name}.</li>
            </ul>
          </div>
        </Card>
      </div>
    )
  }

  if (viewMode === 'print-internal') {
    return (
      <div className="animate-fade-in print:bg-white print:text-black">
        {/* Style injection to hide sidebar and header when printing */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
            }
            /* Hide Sidebar, Header, BottomNav, and Action Bar during printing */
            header, nav, aside, footer, .no-print, button {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
            }
            .print-container {
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              padding: 0 !important;
            }
            .print-text-dark {
              color: #111827 !important;
            }
            .print-border {
              border-color: #d1d5db !important;
            }
          }
        `}} />

        {/* Back and Action Buttons */}
        <div className="flex justify-between items-center mb-6 no-print">
          <Button variant="secondary" onClick={() => setViewMode('internal')}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Volver a Vista Interna
          </Button>
          <Button onClick={() => window.print()}>
            <span className="material-symbols-outlined text-[18px]">print</span>
            Imprimir Reporte Interno
          </Button>
        </div>

        {/* Print-friendly Card for Internal Use */}
        <Card className="p-8 max-w-[900px] mx-auto bg-surface-container-low border border-outline-variant print-container print:bg-white print:text-black space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-outline-variant/50 pb-6 print-border">
            <div>
              <h2 className="text-headline-md font-bold text-on-surface print:text-black">{settings.company_name}</h2>
              <p className="text-body-md text-primary font-bold mt-1">REPORTE INTERNO DE COSTOS Y MÁRGENES</p>
            </div>
            <div className="text-right">
              <div className="text-headline-sm font-bold text-primary font-mono">
                {formatQuoteNumber(quote.quote_number)}
              </div>
              <p className="text-xs text-on-surface-variant print:text-gray-600 mt-1 font-mono">
                Fecha: {formatDate(quote.created_at)}
              </p>
            </div>
          </div>

          {/* General Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-surface-container-high/40 p-4 rounded-xl print:border print:border-gray-200">
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase block">Cliente</span>
              <span className="text-sm font-bold text-on-surface print:text-black">{client.name || 'Cliente general'}</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase block">Producto</span>
              <span className="text-sm font-bold text-on-surface print:text-black">{item.product_name}</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase block">Cantidad</span>
              <span className="text-sm font-bold text-on-surface font-mono print:text-black">{item.quantity} u</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase block">Duración del Contrato</span>
              <span className="text-sm font-bold text-on-surface font-mono print:text-black">{contractDuration || '—'}</span>
            </div>
          </div>

          {/* Real Financial Statement & Fixed Expenses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Real Profit Statement */}
            <div className="border border-outline-variant/40 rounded-xl p-5 space-y-3 print:border-gray-200">
              <h3 className="text-sm font-mono uppercase tracking-wider text-primary font-bold border-b border-outline-variant/30 pb-2">
                Estado de Resultados Real
              </h3>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span>Ventas Totales (Cant × Precio Negociado):</span>
                  <span className="font-bold">{formatCurrency(quote.total_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span>(-) Costo de Producción Total:</span>
                  <span className="text-primary font-bold">-{formatCurrency(quote.total_cost)}</span>
                </div>
                <div className="flex justify-between border-t border-outline-variant/20 pt-1.5 font-bold">
                  <span>(=) Utilidad Bruta Real:</span>
                  <span className="text-tertiary">{formatCurrency(quote.total_price - quote.total_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>(-) Gastos Fijos Prorrateados:</span>
                  <span className="text-primary font-bold">-{formatCurrency(proratedFixedExpenses)}</span>
                </div>
                <div className="flex justify-between border-t border-outline-variant/30 pt-1.5 text-sm font-bold">
                  <span>(=) Utilidad Neta Real:</span>
                  <span className="text-tertiary">{formatCurrency(netProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Margen Neto Real:</span>
                  <span className={`font-bold ${netMargin < (settings.min_margin || 15) ? 'text-primary' : 'text-tertiary'}`}>
                    {formatPercent(netMargin)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost and Margin Summary */}
            <div className="border border-outline-variant/40 rounded-xl p-5 space-y-3 print:border-gray-200">
              <h3 className="text-sm font-mono uppercase tracking-wider text-primary font-bold border-b border-outline-variant/30 pb-2">
                Resumen de Costos y Márgenes
              </h3>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span>Costo Unitario de Producción:</span>
                  <span>{formatCurrency(item.unit_cost)} /u</span>
                </div>
                <div className="flex justify-between">
                  <span>Precio de Venta Unitario Real:</span>
                  <span>{formatCurrency(quote.total_price / item.quantity)} /u</span>
                </div>
                <div className="flex justify-between">
                  <span>Margen Original Deseado:</span>
                  <span>{formatPercent(item.margin_pct)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-outline-variant/20 pt-1.5">
                  <span>Margen de Producción Real:</span>
                  <span className={isMarginWarning ? 'text-primary' : 'text-tertiary'}>
                    {formatPercent(quote.real_margin)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Utilidad de Producción Real:</span>
                  <span className="text-tertiary">{formatCurrency(quote.total_profit)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-on-surface-variant mt-2 border-t border-outline-variant/10 pt-1">
                  <span>Gastos Fijos de la Empresa:</span>
                  <span>{formatCurrency(totalMonthlyExpenses)}/mes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Materials Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-on-surface border-b border-outline-variant/30 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span>
              Costo de Materiales Internos
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse print:text-black">
                <thead>
                  <tr className="border-b border-outline-variant/50 font-mono uppercase text-on-surface-variant font-bold">
                    <th className="py-2">Material</th>
                    <th className="py-2 text-right">Cant/Unidad</th>
                    <th className="py-2 text-right">Precio Unitario</th>
                    <th className="py-2 text-right">Merma %</th>
                    <th className="py-2 text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-mono">
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 font-sans font-medium text-on-surface">{m.material_name}</td>
                      <td className="py-2 text-right">{m.quantity_per_unit}</td>
                      <td className="py-2 text-right">{formatCurrency(m.unit_price)}</td>
                      <td className="py-2 text-right">{formatPercent(m.waste_pct)}</td>
                      <td className="py-2 text-right font-bold text-on-surface">{formatCurrency(m.total_cost)}</td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-4 text-center italic text-on-surface-variant">No hay materiales asociados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wholesale Materials Purchase Summary */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-on-surface border-b border-outline-variant/30 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">shopping_cart</span>
              Resumen de Compra de Materiales al Por Mayor
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse print:text-black">
                <thead>
                  <tr className="border-b border-outline-variant/50 font-mono uppercase text-on-surface-variant font-bold">
                    <th className="py-2">Material</th>
                    <th className="py-2 text-right">Requerido (c/Merma)</th>
                    <th className="py-2 text-right">Capacidad Paquete</th>
                    <th className="py-2 text-right">Cantidad a Comprar</th>
                    <th className="py-2 text-right">Costo Estimado Compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-mono">
                  {materials.map((m) => {
                    const qtyReq = parseFloat(m.quantity_per_unit) || 0
                    const price = parseFloat(m.unit_price) || 0
                    const waste = parseFloat(m.waste_pct) || 0
                    const baseTotal = qtyReq * item.quantity
                    const totalRequired = baseTotal + (baseTotal * waste / 100)
                    
                    const packQty = parseFloat(m.materials?.purchase_quantity) || 1
                    const packUnit = m.materials?.purchase_unit || 'unidad'
                    const usageUnit = m.materials?.usage_unit || 'unidad'
                    const toBuy = Math.ceil(totalRequired / packQty)
                    const purchaseCost = toBuy * packQty * price

                    return (
                      <tr key={m.id}>
                        <td className="py-2 font-sans font-medium text-on-surface">{m.material_name}</td>
                        <td className="py-2 text-right">{totalRequired.toFixed(2)} {usageUnit}</td>
                        <td className="py-2 text-right">{packQty} {usageUnit} ({packUnit})</td>
                        <td className="py-2 text-right font-bold text-primary">{toBuy} {packUnit}{toBuy > 1 ? 's' : ''}</td>
                        <td className="py-2 text-right font-bold text-on-surface">{formatCurrency(purchaseCost)}</td>
                      </tr>
                    )
                  })}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-4 text-center italic text-on-surface-variant">No hay materiales asociados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Processes & Embellishments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Processes */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-on-surface border-b border-outline-variant/30 pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">precision_manufacturing</span>
                Procesos Productivos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse print:text-black">
                  <thead>
                    <tr className="border-b border-outline-variant/50 font-mono uppercase text-on-surface-variant font-bold">
                      <th className="py-2">Proceso</th>
                      <th className="py-2 text-right">Tiempo Unit</th>
                      <th className="py-2 text-right">Costo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-mono">
                    {processes.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 font-sans font-medium text-on-surface">{p.process_name}</td>
                        <td className="py-2 text-right">{p.cost_type === 'por_hora' ? `${p.time_minutes} min` : '—'}</td>
                        <td className="py-2 text-right font-bold text-on-surface">{formatCurrency(p.total_cost)}</td>
                      </tr>
                    ))}
                    {processes.length === 0 && (
                      <tr>
                        <td colSpan="3" className="py-2 text-center italic text-on-surface-variant">No hay procesos asociados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Embellishments */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-on-surface border-b border-outline-variant/30 pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-tertiary">palette</span>
                Personalización y Embellecimiento
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse print:text-black">
                  <thead>
                    <tr className="border-b border-outline-variant/50 font-mono uppercase text-on-surface-variant font-bold">
                      <th className="py-2">Detalle</th>
                      <th className="py-2 text-right">Costo Unit</th>
                      <th className="py-2 text-right">Costo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-mono">
                    {embellishments.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 font-sans font-medium text-on-surface">{e.name} ({e.type})</td>
                        <td className="py-2 text-right">{formatCurrency(e.cost)} x {e.quantity}</td>
                        <td className="py-2 text-right font-bold text-on-surface">{formatCurrency(e.total_cost)}</td>
                      </tr>
                    ))}
                    {embellishments.length === 0 && (
                      <tr>
                        <td colSpan="3" className="py-2 text-center italic text-on-surface-variant">No hay detalles de personalización.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span
              onClick={() => navigate('/quotes')}
              className="material-symbols-outlined text-[20px] text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              arrow_back
            </span>
            <h1 className="text-headline-md font-semibold text-on-surface flex items-center gap-2">
              Cotización <span className="font-mono text-primary">{formatQuoteNumber(quote.quote_number)}</span>
            </h1>
          </div>
          <p className="text-body-md text-on-surface-variant mt-1 ml-8">
            Detalles técnicos internos y costos de producción
          </p>
        </div>

        <div className="flex items-center gap-2">
          {quote.status === 'aprobada' && (
            <Button onClick={() => navigate(`/orders?convertQuoteId=${quote.id}`)}>
              <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
              Generar Pedido
            </Button>
          )}
          <Button variant="secondary" onClick={() => setViewMode('client')}>
            <span className="material-symbols-outlined text-[18px]">assignment</span>
            Vista Cliente / Imprimir
          </Button>
          <Button variant="secondary" onClick={() => setViewMode('print-internal')}>
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            Vista Interna / Imprimir
          </Button>
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Eliminar
          </Button>
        </div>
      </div>

      {/* Main Details and Sidebars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Info Card */}
          <Card className="p-6">
            <h2 className="text-body-lg font-bold mb-4 flex items-center gap-2 border-b border-outline-variant/30 pb-3">
              <span className="material-symbols-outlined text-primary text-[20px]">info</span>
              Información de la Cotización
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-on-surface-variant uppercase font-mono mb-1">Cliente</p>
                <p className="text-sm font-semibold text-on-surface">{client.name || 'Cliente general'}</p>
                {client.contact_person && <p className="text-xs text-on-surface-variant mt-0.5">Contacto: {client.contact_person}</p>}
                {client.phone && <p className="text-xs text-on-surface-variant mt-0.5">Cel: {client.phone}</p>}
              </div>

              <div>
                <p className="text-xs text-on-surface-variant uppercase font-mono mb-1">Fechas</p>
                <p className="text-sm text-on-surface">Creada: <span className="font-mono">{formatDate(quote.created_at)}</span></p>
                <p className="text-sm text-on-surface mt-0.5">Vence: <span className="font-mono">{formatDate(quote.valid_until)}</span></p>
              </div>

              <div>
                <p className="text-xs text-on-surface-variant uppercase font-mono mb-1">Duración del Contrato</p>
                <p className="text-sm font-semibold text-tertiary">{contractDuration || '—'}</p>
              </div>

              <div className="sm:col-span-3">
                <p className="text-xs text-on-surface-variant uppercase font-mono mb-1.5">Estado actual</p>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={quote.status} />
                  
                  {/* Status update selector */}
                  <div className="w-44">
                    <Select
                      options={Object.entries(quoteStatuses).map(([value, details]) => ({
                        value,
                        label: details.label
                      }))}
                      value={quote.status}
                      disabled={statusUpdating}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      placeholder="Cambiar estado"
                    />
                  </div>

                  {quote.status === 'aprobada' && (
                    <Button
                      onClick={() => navigate(`/orders?convertQuoteId=${quote.id}`)}
                      size="sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                      Generar Pedido
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Warnings and Notes */}
          {isMarginWarning && (
            <AlertBanner type="warning">
              El margen real estimado ({formatPercent(quote.real_margin)}) está por debajo del margen mínimo rentable configurado ({formatPercent(settings.min_margin)}%).
            </AlertBanner>
          )}

          {/* Product Info & Materials */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-body-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                Desglose de Materiales
              </h2>
              <span className="text-sm font-mono bg-surface-container-high px-3 py-1 rounded text-on-surface">
                {item.product_name} ({item.quantity} unidades)
              </span>
            </div>



            <div className="overflow-x-auto">
              <table className="w-full zebra-table text-sm">
                <thead>
                  <tr className="border-b border-outline-variant font-mono text-xs uppercase text-on-surface-variant">
                    <th className="px-4 py-3 text-left">Material</th>
                    <th className="px-4 py-3 text-right">Cant/Unidad</th>
                    <th className="px-4 py-3 text-right">Precio Unit</th>
                    <th className="px-4 py-3 text-right">Merma %</th>
                    <th className="px-4 py-3 text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {materials.map((m) => (
                    <tr key={m.id} className="text-on-surface-variant hover:text-on-surface">
                      <td className="px-4 py-2.5 font-medium text-on-surface">{m.material_name}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{m.quantity_per_unit}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(m.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatPercent(m.waste_pct)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-on-surface font-semibold">
                        {formatCurrency(m.total_cost)}
                      </td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center text-on-surface-variant italic">
                        No hay materiales asociados a esta cotización.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Processes Info */}
          <Card className="p-0">
            <div className="px-5 py-4 border-b border-outline-variant">
              <h2 className="text-body-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">precision_manufacturing</span>
                Desglose de Procesos Productivos
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full zebra-table text-sm">
                <thead>
                  <tr className="border-b border-outline-variant font-mono text-xs uppercase text-on-surface-variant">
                    <th className="px-4 py-3 text-left">Proceso</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Costo Base</th>
                    <th className="px-4 py-3 text-right">Tiempo/Unidad</th>
                    <th className="px-4 py-3 text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {processes.map((p) => (
                    <tr key={p.id} className="text-on-surface-variant hover:text-on-surface">
                      <td className="px-4 py-2.5 font-medium text-on-surface">{p.process_name}</td>
                      <td className="px-4 py-2.5 text-left text-sm">
                        <span className="status-badge bg-surface-container-high text-on-surface-variant">
                          {processCategories[p.cost_type] || p.cost_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(p.cost)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {p.cost_type === 'por_hora' ? `${p.time_minutes} min` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-on-surface font-semibold">
                        {formatCurrency(p.total_cost)}
                      </td>
                    </tr>
                  ))}
                  {processes.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center text-on-surface-variant italic">
                        No hay procesos asociados a esta cotización.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Personalización y Embellecimiento Info */}
          <Card className="p-0 border border-tertiary/20">
            <div className="px-5 py-4 border-b border-outline-variant">
              <h2 className="text-body-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-[20px]">palette</span>
                Personalización y Embellecimiento
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full zebra-table text-sm">
                <thead>
                  <tr className="border-b border-outline-variant font-mono text-xs uppercase text-on-surface-variant">
                    <th className="px-4 py-3 text-left">Detalle</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Costo Unitario</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Costo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {embellishments.map((e) => (
                    <tr key={e.id} className="text-on-surface-variant hover:text-on-surface">
                      <td className="px-4 py-2.5 font-medium text-on-surface">{e.name}</td>
                      <td className="px-4 py-2.5 text-left text-sm uppercase">
                        <span className="status-badge bg-surface-container-high text-on-surface-variant">
                          {e.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(e.cost)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{e.quantity}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-on-surface font-semibold">
                        {formatCurrency(e.total_cost)}
                      </td>
                    </tr>
                  ))}
                  {embellishments.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center text-on-surface-variant italic">
                        No hay detalles de personalización asociados a esta cotización.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right 1 Column: Cost Breakdown Panel */}
        <div className="lg:col-span-1">
          <Card className="p-0 sticky top-24">
            <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low rounded-t-xl">
              <h3 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">request_quote</span>
                Resumen de Costos y Utilidad
              </h3>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-2 border-b border-outline-variant/30 pb-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Costo Unitario:</span>
                  <span className="font-mono text-on-surface">{formatCurrency(item.unit_cost)}/u</span>
                </div>
                <div className="flex justify-between font-bold border-t border-outline-variant/20 pt-2">
                  <span className="text-on-surface">Costo Total:</span>
                  <span className="font-mono text-on-surface">{formatCurrency(quote.total_cost)}</span>
                </div>
              </div>

              {/* Utility metrics */}
              <div className="space-y-2 border-b border-outline-variant/30 pb-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Margen Deseado:</span>
                  <span className="font-mono text-on-surface">{formatPercent(item.margin_pct)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Margen Real:</span>
                  <span className={`font-mono font-bold ${isMarginWarning ? 'text-primary' : 'text-tertiary'}`}>
                    {formatPercent(quote.real_margin)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-medium">Utilidad Real:</span>
                  <span className="font-mono font-bold text-tertiary">
                    {formatCurrency(quote.total_profit)}
                  </span>
                </div>
              </div>

              {/* Final Pricing */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Precio Unitario Promedio:</span>
                  <span className="font-mono text-on-surface">{formatCurrency(quote.total_price / item.quantity)}/u</span>
                </div>
                <div className="bg-surface-container-high p-4 rounded-xl border border-outline-variant/50">
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-1">Precio Final Negociado</p>
                  <p className="text-headline-md font-bold text-tertiary font-mono">
                    {formatCurrency(quote.total_price)}
                  </p>
                </div>


              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteQuote}
        title="Eliminar Cotización"
        message={`¿Estás seguro de que deseas eliminar la cotización N° ${formatQuoteNumber(quote.quote_number)}? Esta acción eliminará permanentemente todos sus registros.`}
      />
    </div>
  )
}
