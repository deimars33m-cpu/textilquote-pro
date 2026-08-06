import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/lib/formatters'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysLeft(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return diff
}

function calcContractProgress(contract) {
  const purchases = contract.contract_material_purchases || []
  const cuts = contract.contract_cutting_progress || []
  const production = contract.contract_production_progress || []
  const embellishment = contract.contract_embellishment_progress || []

  const purchasePct = purchases.length === 0 ? 0
    : Math.min(100, purchases.reduce((s, p) => s + (p.qty_required > 0 ? Math.min(100, (p.qty_purchased / p.qty_required) * 100) : 0), 0) / purchases.length)

  const cutPct = cuts.length === 0 ? 0
    : Math.min(100, cuts.reduce((s, c) => s + (c.pieces_planned > 0 ? Math.min(100, (c.pieces_cut / c.pieces_planned) * 100) : 0), 0) / cuts.length)

  const prodPct = production.length === 0 ? 0
    : Math.min(100, production.reduce((s, p) => s + (p.units_planned > 0 ? Math.min(100, (p.units_completed / p.units_planned) * 100) : 0), 0) / production.length)

  const embPct = embellishment.length === 0 ? 0
    : Math.min(100, embellishment.reduce((s, e) => s + (e.units_total > 0 ? Math.min(100, (e.units_approved / e.units_total) * 100) : 0), 0) / embellishment.length)

  const phases = [purchases.length > 0 ? purchasePct : null, cuts.length > 0 ? cutPct : null, production.length > 0 ? prodPct : null, embellishment.length > 0 ? embPct : null].filter(v => v !== null)
  const overall = phases.length === 0 ? 0 : phases.reduce((a, b) => a + b, 0) / phases.length

  return { purchasePct, cutPct, prodPct, embPct, overall }
}

const STATUS_LABELS = { en_proceso: 'En Proceso', pausado: 'Pausado', completado: 'Completado', entregado: 'Entregado' }
const STATUS_COLORS = {
  en_proceso: 'text-primary border-primary/30 bg-primary/10',
  pausado: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  completado: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  entregado: 'text-on-surface-variant border-outline-variant bg-surface-container',
}

const PROCESS_TYPE_ICONS = { bordado: '🪡', sublimado: '🎨', vinil: '✂️', serigrafia: '🖨️', otro: '⚙️' }

// ── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'from-primary to-secondary', label }) {
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between items-center">
        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">{label}</span>
        <span className="text-[10px] font-mono font-bold text-on-surface">{Math.round(value)}%</span>
      </div>}
      <div className="h-2 bg-surface-container-high/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="neu-surface p-4 space-y-1 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-xl font-mono font-extrabold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-on-surface-variant">{sub}</span>}
    </div>
  )
}

// ── Modal: Nuevo Contrato ────────────────────────────────────────────────────

function NewContractModal({ onClose, onCreated, user, initialQuoteId }) {
  const [quotes, setQuotes] = useState([])
  const [form, setForm] = useState({
    quote_id: initialQuoteId || '',
    contract_name: '',
    client_name: '',
    total_units: '',
    delivery_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('quotes')
      .select('id, quote_number, status, total_price, terceros(name), quote_items(product_name, quantity)')
      .eq('user_id', user.id)
      .eq('status', 'aprobada')
      .order('quote_number', { ascending: false })
      .then(({ data }) => {
        const loaded = data || []
        setQuotes(loaded)
        if (initialQuoteId) {
          const q = loaded.find(q => q.id === initialQuoteId)
          if (q) {
            const item = q.quote_items?.[0]
            setForm(f => ({
              ...f,
              quote_id: initialQuoteId,
              contract_name: item?.product_name ? `Contrato: ${item.product_name}` : `Cotización #${q.quote_number}`,
              client_name: q.terceros?.name || '',
              total_units: item?.quantity || '',
            }))
          }
        }
      })
  }, [user, initialQuoteId])

  function handleQuoteSelect(e) {
    const qid = e.target.value
    const q = quotes.find(q => q.id === qid)
    if (q) {
      const item = q.quote_items?.[0]
      setForm(f => ({
        ...f,
        quote_id: qid,
        contract_name: item?.product_name ? `Contrato: ${item.product_name}` : `Cotización #${q.quote_number}`,
        client_name: q.terceros?.name || '',
        total_units: item?.quantity || '',
      }))
    } else {
      setForm(f => ({ ...f, quote_id: '' }))
    }
  }

  async function handleSave() {
    if (!form.contract_name.trim() || !form.client_name.trim() || !form.total_units) {
      setError('Nombre, cliente y unidades totales son requeridos.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: contract, error: err } = await supabase
        .from('contract_tracking')
        .insert({
          user_id: user.id,
          quote_id: form.quote_id || null,
          contract_name: form.contract_name.trim(),
          client_name: form.client_name.trim(),
          total_units: parseInt(form.total_units) || 1,
          delivery_date: form.delivery_date || null,
          notes: form.notes.trim() || null,
          status: 'en_proceso',
        })
        .select()
        .single()
      if (err) throw err

      // If quote selected, pre-load materials (using Wholesale Purchase calculation) and embellishments
      if (form.quote_id) {
        const q = quotes.find(q => q.id === form.quote_id)
        const item = q?.quote_items?.[0]
        if (item) {
          // Load quote_materials with materials catalog metadata for wholesale calculations
          const { data: qmats } = await supabase
            .from('quote_materials')
            .select('*, materials(name, unit_price, usage_unit, purchase_quantity, purchase_unit)')
            .eq('quote_item_id', item.id)

          if (qmats?.length > 0) {
            const totalUnits = parseInt(form.total_units) || 1
            await supabase.from('contract_material_purchases').insert(
              qmats.map(m => {
                const qtyReq = parseFloat(m.quantity_per_unit) || 0
                const price = parseFloat(m.unit_price) || parseFloat(m.materials?.unit_price) || 0
                const waste = parseFloat(m.waste_pct) || 0
                const baseTotal = qtyReq * totalUnits
                const totalRequired = baseTotal + (baseTotal * waste / 100)

                const packQty = parseFloat(m.materials?.purchase_quantity) || 1
                const packUnit = m.materials?.purchase_unit || m.materials?.usage_unit || 'unidad'
                const usageUnit = m.materials?.usage_unit || 'unidad'
                const toBuy = Math.ceil(totalRequired / packQty)
                const unitCost = packQty * price

                return {
                  contract_id: contract.id,
                  material_name: m.material_name,
                  unit: packUnit,
                  qty_required: toBuy,
                  qty_purchased: 0,
                  unit_cost: unitCost,
                  status: 'pendiente',
                  notes: `Resumen al Por Mayor: ${toBuy} ${packUnit}${toBuy > 1 ? 's' : ''} (${packQty} ${usageUnit}/${packUnit}) para cubrir ${totalRequired.toFixed(2)} ${usageUnit}`,
                }
              })
            )
          }

          // Load quote_embellishments
          const { data: qemb } = await supabase
            .from('quote_embellishments')
            .select('*')
            .eq('quote_item_id', item.id)
          if (qemb?.length > 0) {
            const totalUnits = parseInt(form.total_units) || 1
            await supabase.from('contract_embellishment_progress').insert(
              qemb.map(e => ({
                contract_id: contract.id,
                process_type: e.type || 'otro',
                process_name: e.name || 'Embellecimiento',
                units_total: totalUnits,
                units_sent: 0,
                units_returned: 0,
                units_approved: 0,
              }))
            )
          }
          // Add default production phase
          await supabase.from('contract_production_progress').insert([{
            contract_id: contract.id,
            phase_name: 'Producción General',
            units_planned: parseInt(form.total_units) || 1,
            units_completed: 0,
            units_in_progress: 0,
          }])
        }
      }

      onCreated(contract)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative neu-surface w-full max-w-lg animate-scale-in">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container/95 backdrop-blur-sm rounded-t-[1.5rem] z-10">
          <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_task</span>
            Nuevo Seguimiento de Contrato
          </h2>
          <button onClick={onClose} className="neu-raised-sm p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">{error}</div>}

          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
              Vincular a Cotización Aprobada (Opcional)
            </label>
            <select
              className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none appearance-none cursor-pointer"
              value={form.quote_id}
              onChange={handleQuoteSelect}
            >
              <option value="">— Sin cotización (manual) —</option>
              {quotes.map(q => (
                <option key={q.id} value={q.id} className="bg-surface text-on-surface">
                  #{String(q.quote_number).padStart(4, '0')} — {q.terceros?.name} — {q.quote_items?.[0]?.product_name || 'Producto'} ({q.quote_items?.[0]?.quantity} uds)
                </option>
              ))}
            </select>
            {form.quote_id && (
              <p className="text-[10px] text-emerald-400 mt-1 ml-1">✓ Se precargarán materiales y embellecimientos de la cotización</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Nombre del Contrato *</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none"
                placeholder="Ej: Uniformes Empresa XYZ - Lote 1"
                value={form.contract_name}
                onChange={e => setForm(f => ({ ...f, contract_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Cliente *</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none"
                placeholder="Nombre del cliente"
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Total de Unidades *</label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none"
                placeholder="Ej: 500"
                value={form.total_units}
                onChange={e => setForm(f => ({ ...f, total_units: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Fecha de Entrega</label>
              <input
                type="date"
                className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
                value={form.delivery_date}
                onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Notas</label>
              <textarea
                className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none resize-none"
                rows={2}
                placeholder="Instrucciones especiales, observaciones..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl neu-raised-sm text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="neu-button-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              {saving ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">add_task</span>}
              {saving ? 'Creando...' : 'Crear Contrato'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Contract Detail View ─────────────────────────────────────────────────────

function ContractDetail({ contract, onBack, onRefresh }) {
  const [activeTab, setActiveTab] = useState('compras')
  const [contractData, setContractData] = useState(contract)
  const [loading, setLoading] = useState(false)

  const reloadContract = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('contract_tracking')
      .select(`
        *,
        contract_material_purchases(*),
        contract_cutting_progress(*),
        contract_production_progress(*),
        contract_embellishment_progress(*)
      `)
      .eq('id', contract.id)
      .single()
    if (data) setContractData(data)
    setLoading(false)
  }, [contract.id])

  useEffect(() => { reloadContract() }, [reloadContract])

  const progress = calcContractProgress(contractData)
  const days = daysLeft(contractData.delivery_date)

  const tabs = [
    { id: 'compras', label: 'Compras', icon: 'shopping_cart', pct: progress.purchasePct },
    { id: 'cortes', label: 'Cortes', icon: 'content_cut', pct: progress.cutPct },
    { id: 'produccion', label: 'Producción', icon: 'precision_manufacturing', pct: progress.prodPct },
    { id: 'embellecimiento', label: 'Embellecimiento', icon: 'auto_fix_high', pct: progress.embPct },
  ]

  return (
    <div className="space-y-5 animate-scale-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="neu-raised-sm p-2 rounded-xl text-on-surface-variant hover:text-primary transition-colors mt-1">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-on-surface">{contractData.contract_name}</h1>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[contractData.status]}`}>
              {STATUS_LABELS[contractData.status]}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {contractData.client_name} · {contractData.total_units} unidades
            {contractData.delivery_date && ` · Entrega: ${formatDate(contractData.delivery_date)}`}
          </p>
        </div>
        <StatusSelector contractId={contractData.id} current={contractData.status} onChanged={reloadContract} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon="shopping_cart" label="Compras" value={`${Math.round(progress.purchasePct)}%`} color="text-primary" />
        <KpiCard icon="content_cut" label="Cortes" value={`${Math.round(progress.cutPct)}%`} color="text-secondary" />
        <KpiCard icon="precision_manufacturing" label="Producción" value={`${Math.round(progress.prodPct)}%`} color="text-tertiary" />
        <KpiCard
          icon="schedule"
          label="Días Restantes"
          value={days === null ? '—' : days <= 0 ? '¡VENCIDO!' : `${days}d`}
          color={days !== null && days <= 3 ? 'text-error' : days !== null && days <= 7 ? 'text-amber-400' : 'text-on-surface'}
        />
      </div>

      {/* Avance global */}
      <div className="neu-surface p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
          <span className="text-sm font-bold text-on-surface">Avance Global del Contrato</span>
          <span className="ml-auto text-lg font-mono font-extrabold text-primary">{Math.round(progress.overall)}%</span>
        </div>
        <ProgressBar value={progress.overall} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'neu-button-primary' : 'neu-raised-sm text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
            <span className="text-[10px] font-mono opacity-70">{Math.round(tab.pct)}%</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'compras' && (
            <MaterialPurchasesTab contractId={contractData.id} rows={contractData.contract_material_purchases || []} totalUnits={contractData.total_units} onRefresh={reloadContract} />
          )}
          {activeTab === 'cortes' && (
            <CuttingProgressTab contractId={contractData.id} rows={contractData.contract_cutting_progress || []} totalUnits={contractData.total_units} onRefresh={reloadContract} />
          )}
          {activeTab === 'produccion' && (
            <ProductionProgressTab contractId={contractData.id} rows={contractData.contract_production_progress || []} totalUnits={contractData.total_units} onRefresh={reloadContract} />
          )}
          {activeTab === 'embellecimiento' && (
            <EmbellishmentProgressTab contractId={contractData.id} rows={contractData.contract_embellishment_progress || []} totalUnits={contractData.total_units} onRefresh={reloadContract} />
          )}
        </>
      )}
    </div>
  )
}

function StatusSelector({ contractId, current, onChanged }) {
  const [updating, setUpdating] = useState(false)
  async function handleChange(e) {
    setUpdating(true)
    await supabase.from('contract_tracking').update({ status: e.target.value }).eq('id', contractId)
    onChanged()
    setUpdating(false)
  }
  return (
    <div className="neu-raised-sm rounded-xl overflow-hidden">
      <select
        className="px-3 py-2 bg-transparent text-sm text-on-surface outline-none cursor-pointer appearance-none"
        value={current}
        onChange={handleChange}
        disabled={updating}
      >
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k} className="bg-surface text-on-surface">{v}</option>
        ))}
      </select>
    </div>
  )
}

// ── Tab: Compras de Materiales ───────────────────────────────────────────────

function MaterialPurchasesTab({ contractId, rows, totalUnits, onRefresh }) {
  const [form, setForm] = useState({ material_name: '', unit: 'metro', qty_required: '', qty_purchased: '', supplier_name: '', unit_cost: '', purchase_date: '', receipt_number: '', status: 'pendiente', notes: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const STATUS_MAP = { pendiente: { label: 'Pendiente', cls: 'text-amber-400 bg-amber-400/10' }, parcial: { label: 'Parcial', cls: 'text-primary bg-primary/10' }, recibido: { label: 'Recibido', cls: 'text-emerald-400 bg-emerald-400/10' } }

  function startEdit(row) {
    setEditId(row.id)
    setForm({ material_name: row.material_name, unit: row.unit, qty_required: row.qty_required, qty_purchased: row.qty_purchased, supplier_name: row.supplier_name || '', unit_cost: row.unit_cost || '', purchase_date: row.purchase_date || '', receipt_number: row.receipt_number || '', status: row.status, notes: row.notes || '' })
  }
  function cancelEdit() { setEditId(null); setForm({ material_name: '', unit: 'metro', qty_required: '', qty_purchased: '', supplier_name: '', unit_cost: '', purchase_date: '', receipt_number: '', status: 'pendiente', notes: '' }) }

  async function handleSave() {
    if (!form.material_name.trim()) return
    setSaving(true)
    const payload = { ...form, contract_id: contractId, qty_required: parseFloat(form.qty_required) || 0, qty_purchased: parseFloat(form.qty_purchased) || 0, unit_cost: parseFloat(form.unit_cost) || 0, purchase_date: form.purchase_date || null, material_name: form.material_name.trim() }
    if (editId) {
      await supabase.from('contract_material_purchases').update(payload).eq('id', editId)
    } else {
      await supabase.from('contract_material_purchases').insert(payload)
    }
    cancelEdit(); onRefresh(); setSaving(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('contract_material_purchases').delete().eq('id', id)
    onRefresh(); setDeleting(null)
  }

  const totalCost = rows.reduce((s, r) => s + ((r.unit_cost || 0) * (r.qty_purchased || 0)), 0)
  const totalPct = rows.length === 0 ? 0 : rows.reduce((s, r) => s + (r.qty_required > 0 ? Math.min(100, (r.qty_purchased / r.qty_required) * 100) : 0), 0) / rows.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">shopping_cart</span>
          <div>
            <h3 className="font-bold text-on-surface">Compras de Materiales</h3>
            <p className="text-[11px] text-on-surface-variant">{rows.length} materiales · Total invertido: <span className="text-primary font-mono font-bold">{formatCurrency(totalCost)}</span></p>
          </div>
        </div>
        <button onClick={() => setEditId('new')} className="neu-button-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">add</span> Agregar
        </button>
      </div>

      <ProgressBar value={totalPct} label="Progreso de Compras" />

      {/* Form inline */}
      {(editId === 'new' || editId) && (
        <div className="neu-surface p-4 space-y-3">
          <h4 className="text-sm font-bold text-primary">{editId === 'new' ? 'Agregar Material' : 'Editar Material'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Material *</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Ej: Tela algodón 60/40" value={form.material_name} onChange={e => setForm(f => ({ ...f, material_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Unidad</label>
              <select className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none appearance-none" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {['metro', 'kg', 'unidad', 'rollo', 'yarda', 'litro'].map(u => <option key={u} value={u} className="bg-surface">{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Cantidad Requerida</label>
              <input type="number" min="0" step="0.01" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.qty_required} onChange={e => setForm(f => ({ ...f, qty_required: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Cantidad Comprada</label>
              <input type="number" min="0" step="0.01" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.qty_purchased} onChange={e => setForm(f => ({ ...f, qty_purchased: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Costo Unitario (Bs)</label>
              <input type="number" min="0" step="0.01" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0.00" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Proveedor</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Nombre del proveedor" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Fecha de Compra</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Nro. Factura/Recibo</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Opcional" value={form.receipt_number} onChange={e => setForm(f => ({ ...f, receipt_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Estado</label>
              <select className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none appearance-none" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pendiente" className="bg-surface">Pendiente</option>
                <option value="parcial" className="bg-surface">Compra Parcial</option>
                <option value="recibido" className="bg-surface">Recibido Completo</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-xl neu-raised-sm text-sm text-on-surface-variant">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="neu-button-primary px-5 py-2 rounded-xl text-sm font-bold">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">shopping_cart</span>
          <p className="text-sm">No hay materiales registrados</p>
          <p className="text-xs mt-1">Agrega los materiales que necesitas comprar para este contrato</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const pct = row.qty_required > 0 ? Math.min(100, (row.qty_purchased / row.qty_required) * 100) : 0
            const faltante = Math.max(0, row.qty_required - row.qty_purchased)
            const s = STATUS_MAP[row.status] || STATUS_MAP.pendiente
            return (
              <div key={row.id} className="neu-surface p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-on-surface text-sm">{row.material_name}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {row.supplier_name && <>{row.supplier_name} · </>}
                      {row.purchase_date && <>{formatDate(row.purchase_date)} · </>}
                      {row.receipt_number && <>Recibo: {row.receipt_number}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Requerido</p>
                    <p className="font-mono font-bold text-on-surface text-sm">{row.qty_required} {row.unit}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Comprado</p>
                    <p className="font-mono font-bold text-emerald-400 text-sm">{row.qty_purchased} {row.unit}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Faltante</p>
                    <p className={`font-mono font-bold text-sm ${faltante > 0 ? 'text-error' : 'text-emerald-400'}`}>{faltante > 0 ? `${faltante} ${row.unit}` : '✓ Completo'}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <ProgressBar value={pct} />
                  {row.unit_cost > 0 && (
                    <p className="text-[10px] text-right text-on-surface-variant font-mono">
                      Total compra: <span className="text-primary font-bold">{formatCurrency(row.unit_cost * row.qty_purchased)}</span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Avance de Cortes ────────────────────────────────────────────────────

function CuttingProgressTab({ contractId, rows, totalUnits, onRefresh }) {
  const [form, setForm] = useState({ material_name: '', roll_number: '', roll_meters: '', pieces_planned: '', pieces_cut: '', pieces_defective: '', cut_date: '', operator_name: '', notes: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  function startEdit(row) {
    setEditId(row.id)
    setForm({ material_name: row.material_name, roll_number: row.roll_number || '', roll_meters: row.roll_meters || '', pieces_planned: row.pieces_planned, pieces_cut: row.pieces_cut, pieces_defective: row.pieces_defective || 0, cut_date: row.cut_date || '', operator_name: row.operator_name || '', notes: row.notes || '' })
  }
  function cancelEdit() { setEditId(null); setForm({ material_name: '', roll_number: '', roll_meters: '', pieces_planned: '', pieces_cut: '', pieces_defective: '', cut_date: '', operator_name: '', notes: '' }) }

  async function handleSave() {
    if (!form.material_name.trim()) return
    setSaving(true)
    const payload = { ...form, contract_id: contractId, roll_meters: parseFloat(form.roll_meters) || 0, pieces_planned: parseInt(form.pieces_planned) || 0, pieces_cut: parseInt(form.pieces_cut) || 0, pieces_defective: parseInt(form.pieces_defective) || 0, cut_date: form.cut_date || null, material_name: form.material_name.trim() }
    if (editId && editId !== 'new') {
      await supabase.from('contract_cutting_progress').update(payload).eq('id', editId)
    } else {
      await supabase.from('contract_cutting_progress').insert(payload)
    }
    cancelEdit(); onRefresh(); setSaving(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('contract_cutting_progress').delete().eq('id', id)
    onRefresh(); setDeleting(null)
  }

  const totalCut = rows.reduce((s, r) => s + (r.pieces_cut || 0), 0)
  const totalDefective = rows.reduce((s, r) => s + (r.pieces_defective || 0), 0)
  const totalPct = totalUnits > 0 ? Math.min(100, (totalCut / totalUnits) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">content_cut</span>
          <div>
            <h3 className="font-bold text-on-surface">Avance de Cortes</h3>
            <p className="text-[11px] text-on-surface-variant">{totalCut}/{totalUnits} piezas cortadas · {totalDefective} defectuosas</p>
          </div>
        </div>
        <button onClick={() => setEditId('new')} className="neu-button-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">add</span> Agregar
        </button>
      </div>

      <ProgressBar value={totalPct} label="Piezas Cortadas" color="from-secondary to-primary" />

      {(editId === 'new' || (editId && editId !== 'new')) && (
        <div className="neu-surface p-4 space-y-3">
          <h4 className="text-sm font-bold text-secondary">{editId === 'new' ? 'Registrar Corte' : 'Editar Corte'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Material *</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Ej: Tela principal, Forro, Espuma" value={form.material_name} onChange={e => setForm(f => ({ ...f, material_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Nro. de Rollo</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Ej: R-001" value={form.roll_number} onChange={e => setForm(f => ({ ...f, roll_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Metros del Rollo</label>
              <input type="number" min="0" step="0.1" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0.0" value={form.roll_meters} onChange={e => setForm(f => ({ ...f, roll_meters: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Piezas Planificadas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.pieces_planned} onChange={e => setForm(f => ({ ...f, pieces_planned: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Piezas Cortadas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.pieces_cut} onChange={e => setForm(f => ({ ...f, pieces_cut: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Piezas Defectuosas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.pieces_defective} onChange={e => setForm(f => ({ ...f, pieces_defective: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Fecha de Corte</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.cut_date} onChange={e => setForm(f => ({ ...f, cut_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Operario</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Nombre del cortador" value={form.operator_name} onChange={e => setForm(f => ({ ...f, operator_name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Notas</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Observaciones..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-xl neu-raised-sm text-sm text-on-surface-variant">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="neu-button-primary px-5 py-2 rounded-xl text-sm font-bold">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">content_cut</span>
          <p className="text-sm">No hay registros de corte</p>
          <p className="text-xs mt-1">Registra el avance de cortes por rollo de material</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const pct = row.pieces_planned > 0 ? Math.min(100, (row.pieces_cut / row.pieces_planned) * 100) : 0
            return (
              <div key={row.id} className="neu-surface p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-on-surface text-sm">{row.material_name}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {row.roll_number && <span>Rollo {row.roll_number} · </span>}
                      {row.roll_meters > 0 && <span>{row.roll_meters} m · </span>}
                      {row.operator_name && <span>Operario: {row.operator_name} · </span>}
                      {row.cut_date && formatDate(row.cut_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                    <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-error transition-colors"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Planificadas</p>
                    <p className="font-mono font-bold text-on-surface text-sm">{row.pieces_planned}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Cortadas</p>
                    <p className="font-mono font-bold text-secondary text-sm">{row.pieces_cut}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Defectuosas</p>
                    <p className={`font-mono font-bold text-sm ${row.pieces_defective > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{row.pieces_defective}</p>
                  </div>
                </div>
                <ProgressBar value={pct} color="from-secondary to-primary" />
                {row.notes && <p className="text-[11px] text-on-surface-variant italic">"{row.notes}"</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Producción ──────────────────────────────────────────────────────────

function ProductionProgressTab({ contractId, rows, totalUnits, onRefresh }) {
  const [form, setForm] = useState({ phase_name: '', units_planned: '', units_completed: '', units_in_progress: '', units_defective: '', assigned_to: '', start_date: '', end_date_planned: '', end_date_actual: '', notes: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  function startEdit(row) {
    setEditId(row.id)
    setForm({ phase_name: row.phase_name, units_planned: row.units_planned, units_completed: row.units_completed, units_in_progress: row.units_in_progress || 0, units_defective: row.units_defective || 0, assigned_to: row.assigned_to || '', start_date: row.start_date || '', end_date_planned: row.end_date_planned || '', end_date_actual: row.end_date_actual || '', notes: row.notes || '' })
  }
  function cancelEdit() { setEditId(null); setForm({ phase_name: '', units_planned: '', units_completed: '', units_in_progress: '', units_defective: '', assigned_to: '', start_date: '', end_date_planned: '', end_date_actual: '', notes: '' }) }

  async function handleSave() {
    if (!form.phase_name.trim()) return
    setSaving(true)
    const payload = { ...form, contract_id: contractId, units_planned: parseInt(form.units_planned) || 0, units_completed: parseInt(form.units_completed) || 0, units_in_progress: parseInt(form.units_in_progress) || 0, units_defective: parseInt(form.units_defective) || 0, start_date: form.start_date || null, end_date_planned: form.end_date_planned || null, end_date_actual: form.end_date_actual || null, phase_name: form.phase_name.trim() }
    if (editId && editId !== 'new') {
      await supabase.from('contract_production_progress').update(payload).eq('id', editId)
    } else {
      await supabase.from('contract_production_progress').insert(payload)
    }
    cancelEdit(); onRefresh(); setSaving(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('contract_production_progress').delete().eq('id', id)
    onRefresh(); setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary">precision_manufacturing</span>
          <div>
            <h3 className="font-bold text-on-surface">Avance de Producción</h3>
            <p className="text-[11px] text-on-surface-variant">{rows.length} fase(s) de producción</p>
          </div>
        </div>
        <button onClick={() => setEditId('new')} className="neu-button-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">add</span> Agregar Fase
        </button>
      </div>

      {(editId === 'new' || (editId && editId !== 'new')) && (
        <div className="neu-surface p-4 space-y-3">
          <h4 className="text-sm font-bold text-tertiary">{editId === 'new' ? 'Nueva Fase de Producción' : 'Editar Fase'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Nombre de la Fase *</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Ej: Costura de cuerpo, Pegado de cierre, Acabados finales" value={form.phase_name} onChange={e => setForm(f => ({ ...f, phase_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Unidades Planificadas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder={totalUnits} value={form.units_planned} onChange={e => setForm(f => ({ ...f, units_planned: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Unidades Completadas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.units_completed} onChange={e => setForm(f => ({ ...f, units_completed: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">En Proceso</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.units_in_progress} onChange={e => setForm(f => ({ ...f, units_in_progress: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Defectuosas/Rechazadas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.units_defective} onChange={e => setForm(f => ({ ...f, units_defective: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Responsable</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Nombre o equipo" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Fecha Inicio</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Fecha Límite</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.end_date_planned} onChange={e => setForm(f => ({ ...f, end_date_planned: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Fecha Real de Cierre</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.end_date_actual} onChange={e => setForm(f => ({ ...f, end_date_actual: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Notas</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Observaciones, incidencias..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-xl neu-raised-sm text-sm text-on-surface-variant">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="neu-button-primary px-5 py-2 rounded-xl text-sm font-bold">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">precision_manufacturing</span>
          <p className="text-sm">No hay fases de producción</p>
          <p className="text-xs mt-1">Agrega fases de ensamblaje y mano de obra (costura, acabados, etc.)</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const pct = row.units_planned > 0 ? Math.min(100, (row.units_completed / row.units_planned) * 100) : 0
            const phaseDelay = row.end_date_planned && !row.end_date_actual && daysLeft(row.end_date_planned) < 0
            return (
              <div key={row.id} className={`neu-surface p-4 space-y-3 ${phaseDelay ? 'border border-error/30' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-on-surface text-sm">{row.phase_name}</p>
                      {phaseDelay && <span className="text-[9px] font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">RETRASADA</span>}
                      {row.end_date_actual && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">COMPLETADA</span>}
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                      {row.assigned_to && <>{row.assigned_to} · </>}
                      {row.start_date && <>Inicio: {formatDate(row.start_date)} · </>}
                      {row.end_date_planned && <>Límite: {formatDate(row.end_date_planned)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                    <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-error transition-colors"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Planif.</p>
                    <p className="font-mono font-bold text-on-surface text-sm">{row.units_planned}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Listas</p>
                    <p className="font-mono font-bold text-emerald-400 text-sm">{row.units_completed}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Proceso</p>
                    <p className="font-mono font-bold text-primary text-sm">{row.units_in_progress || 0}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Rechaz.</p>
                    <p className={`font-mono font-bold text-sm ${(row.units_defective || 0) > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{row.units_defective || 0}</p>
                  </div>
                </div>
                <ProgressBar value={pct} color="from-tertiary to-primary" />
                {row.notes && <p className="text-[11px] text-on-surface-variant italic">"{row.notes}"</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Embellecimiento ─────────────────────────────────────────────────────

function EmbellishmentProgressTab({ contractId, rows, totalUnits, onRefresh }) {
  const [form, setForm] = useState({ process_type: 'bordado', process_name: '', supplier_name: '', units_total: '', units_sent: '', units_returned: '', units_approved: '', sent_date: '', return_date_planned: '', return_date_actual: '', cost_per_unit: '', notes: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  function startEdit(row) {
    setEditId(row.id)
    setForm({ process_type: row.process_type, process_name: row.process_name, supplier_name: row.supplier_name || '', units_total: row.units_total, units_sent: row.units_sent || 0, units_returned: row.units_returned || 0, units_approved: row.units_approved || 0, sent_date: row.sent_date || '', return_date_planned: row.return_date_planned || '', return_date_actual: row.return_date_actual || '', cost_per_unit: row.cost_per_unit || '', notes: row.notes || '' })
  }
  function cancelEdit() { setEditId(null); setForm({ process_type: 'bordado', process_name: '', supplier_name: '', units_total: '', units_sent: '', units_returned: '', units_approved: '', sent_date: '', return_date_planned: '', return_date_actual: '', cost_per_unit: '', notes: '' }) }

  async function handleSave() {
    if (!form.process_name.trim()) return
    setSaving(true)
    const payload = { ...form, contract_id: contractId, units_total: parseInt(form.units_total) || 0, units_sent: parseInt(form.units_sent) || 0, units_returned: parseInt(form.units_returned) || 0, units_approved: parseInt(form.units_approved) || 0, cost_per_unit: parseFloat(form.cost_per_unit) || 0, sent_date: form.sent_date || null, return_date_planned: form.return_date_planned || null, return_date_actual: form.return_date_actual || null, process_name: form.process_name.trim() }
    if (editId && editId !== 'new') {
      await supabase.from('contract_embellishment_progress').update(payload).eq('id', editId)
    } else {
      await supabase.from('contract_embellishment_progress').insert(payload)
    }
    cancelEdit(); onRefresh(); setSaving(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('contract_embellishment_progress').delete().eq('id', id)
    onRefresh(); setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-400">auto_fix_high</span>
          <div>
            <h3 className="font-bold text-on-surface">Procesos de Embellecimiento</h3>
            <p className="text-[11px] text-on-surface-variant">{rows.length} proceso(s) de personalización</p>
          </div>
        </div>
        <button onClick={() => setEditId('new')} className="neu-button-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">add</span> Agregar
        </button>
      </div>

      {(editId === 'new' || (editId && editId !== 'new')) && (
        <div className="neu-surface p-4 space-y-3">
          <h4 className="text-sm font-bold text-amber-400">{editId === 'new' ? 'Nuevo Proceso' : 'Editar Proceso'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Tipo</label>
              <select className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none appearance-none" value={form.process_type} onChange={e => setForm(f => ({ ...f, process_type: e.target.value }))}>
                {[['bordado', '🪡 Bordado'], ['sublimado', '🎨 Sublimado'], ['vinil', '✂️ Vinil'], ['serigrafia', '🖨️ Serigrafía'], ['otro', '⚙️ Otro']].map(([v, l]) => <option key={v} value={v} className="bg-surface">{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Nombre del Proceso *</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Ej: Logo bordado pecho" value={form.process_name} onChange={e => setForm(f => ({ ...f, process_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Proveedor</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Interno o nombre de taller" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Total Unidades</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder={totalUnits} value={form.units_total} onChange={e => setForm(f => ({ ...f, units_total: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Enviadas al Proceso</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.units_sent} onChange={e => setForm(f => ({ ...f, units_sent: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Retornadas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.units_returned} onChange={e => setForm(f => ({ ...f, units_returned: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Aprobadas / Listas</label>
              <input type="number" min="0" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.units_approved} onChange={e => setForm(f => ({ ...f, units_approved: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Costo por Unidad</label>
              <input type="number" min="0" step="0.01" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0.00" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Fecha de Envío</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.sent_date} onChange={e => setForm(f => ({ ...f, sent_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Retorno Estimado</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.return_date_planned} onChange={e => setForm(f => ({ ...f, return_date_planned: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Retorno Real</label>
              <input type="date" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" value={form.return_date_actual} onChange={e => setForm(f => ({ ...f, return_date_actual: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Notas</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Observaciones..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-xl neu-raised-sm text-sm text-on-surface-variant">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="neu-button-primary px-5 py-2 rounded-xl text-sm font-bold">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">auto_fix_high</span>
          <p className="text-sm">No hay procesos de embellecimiento</p>
          <p className="text-xs mt-1">Registra bordados, sublimados, vinil, serigrafía y otros procesos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const pct = row.units_total > 0 ? Math.min(100, (row.units_approved / row.units_total) * 100) : 0
            const costTotal = (row.cost_per_unit || 0) * (row.units_total || 0)
            return (
              <div key={row.id} className="neu-surface p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{PROCESS_TYPE_ICONS[row.process_type] || '⚙️'}</span>
                      <div>
                        <p className="font-bold text-on-surface text-sm">{row.process_name}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          {row.supplier_name && <>{row.supplier_name} · </>}
                          {row.sent_date && <>Enviado: {formatDate(row.sent_date)} · </>}
                          {row.return_date_planned && <>Retorno: {formatDate(row.return_date_planned)}</>}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                    <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-error transition-colors"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Total</p>
                    <p className="font-mono font-bold text-on-surface text-sm">{row.units_total}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Enviadas</p>
                    <p className="font-mono font-bold text-primary text-sm">{row.units_sent || 0}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Retornadas</p>
                    <p className="font-mono font-bold text-tertiary text-sm">{row.units_returned || 0}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[9px] text-on-surface-variant uppercase">Aprobadas</p>
                    <p className="font-mono font-bold text-emerald-400 text-sm">{row.units_approved || 0}</p>
                  </div>
                </div>
                <ProgressBar value={pct} color="from-amber-400 to-primary" />
                {costTotal > 0 && (
                  <p className="text-[10px] text-right text-on-surface-variant font-mono">
                    Costo estimado: <span className="text-amber-400 font-bold">{formatCurrency(costTotal)}</span>
                  </p>
                )}
                {row.notes && <p className="text-[11px] text-on-surface-variant italic">"{row.notes}"</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ContractTrackingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialQuoteId = searchParams.get('quoteId')
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(!!initialQuoteId)
  const [selectedContract, setSelectedContract] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    if (initialQuoteId) {
      setShowNewModal(true)
    }
  }, [initialQuoteId])

  const fetchContracts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('contract_tracking')
      .select(`
        *,
        contract_material_purchases(id, qty_required, qty_purchased),
        contract_cutting_progress(id, pieces_planned, pieces_cut),
        contract_production_progress(id, units_planned, units_completed),
        contract_embellishment_progress(id, units_total, units_approved)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setContracts(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchContracts() }, [fetchContracts])

  function handleCreated(contract) {
    setShowNewModal(false)
    fetchContracts()
    setSelectedContract({ id: contract.id })
  }

  const filteredContracts = filterStatus === 'all' ? contracts : contracts.filter(c => c.status === filterStatus)

  // Show detail view
  if (selectedContract) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <ContractDetail
          contract={selectedContract}
          onBack={() => { setSelectedContract(null); fetchContracts() }}
          onRefresh={fetchContracts}
        />
      </div>
    )
  }

  // Summary KPIs
  const activeContracts = contracts.filter(c => c.status === 'en_proceso').length
  const overdueContracts = contracts.filter(c => c.delivery_date && daysLeft(c.delivery_date) < 0 && c.status !== 'entregado').length
  const completedContracts = contracts.filter(c => c.status === 'completado' || c.status === 'entregado').length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">assignment</span>
            Contratos Masivos
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Seguimiento de producción y avances por contrato</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="neu-button-primary px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          Nuevo Seguimiento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon="assignment" label="Total Contratos" value={contracts.length} color="text-primary" />
        <KpiCard icon="play_circle" label="En Proceso" value={activeContracts} color="text-tertiary" />
        <KpiCard icon="warning" label="Con Retraso" value={overdueContracts} color={overdueContracts > 0 ? 'text-error' : 'text-on-surface-variant'} />
        <KpiCard icon="check_circle" label="Completados" value={completedContracts} color="text-emerald-400" />
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[['all', 'Todos'], ['en_proceso', 'En Proceso'], ['pausado', 'Pausados'], ['completado', 'Completados'], ['entregado', 'Entregados']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterStatus(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filterStatus === v ? 'neu-button-primary' : 'neu-raised-sm text-on-surface-variant hover:text-on-surface'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Contracts list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant">Cargando contratos...</p>
          </div>
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 block mb-4">assignment</span>
          <h3 className="text-lg font-bold text-on-surface mb-2">
            {contracts.length === 0 ? 'No hay contratos registrados' : 'Sin resultados para este filtro'}
          </h3>
          <p className="text-sm text-on-surface-variant mb-6">
            {contracts.length === 0 ? 'Crea tu primer seguimiento de contrato masivo vinculando una cotización aprobada.' : 'Cambia el filtro para ver otros contratos.'}
          </p>
          {contracts.length === 0 && (
            <button onClick={() => setShowNewModal(true)} className="neu-button-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto">
              <span className="material-symbols-outlined">add_task</span>
              Crear Primer Contrato
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredContracts.map(contract => {
            const progress = calcContractProgress(contract)
            const days = daysLeft(contract.delivery_date)
            const isOverdue = days !== null && days < 0 && contract.status !== 'entregado'
            return (
              <button
                key={contract.id}
                onClick={() => setSelectedContract(contract)}
                className={`neu-surface p-5 text-left space-y-4 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(0,245,255,0.08)] transition-all duration-300 cursor-pointer ${isOverdue ? 'border-l-2 border-l-error' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-on-surface text-base leading-tight">{contract.contract_name}</p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">{contract.client_name} · {contract.total_units} uds</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_COLORS[contract.status]}`}>
                    {STATUS_LABELS[contract.status]}
                  </span>
                </div>

                <div className="space-y-2">
                  <ProgressBar value={progress.overall} label="Avance Global" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <ProgressBar value={progress.purchasePct} label="Compras" />
                    <ProgressBar value={progress.cutPct} label="Cortes" color="from-secondary to-primary" />
                    <ProgressBar value={progress.prodPct} label="Producción" color="from-tertiary to-primary" />
                    <ProgressBar value={progress.embPct} label="Embellec." color="from-amber-400 to-primary" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {contract.delivery_date ? (
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium ${isOverdue ? 'text-error' : days !== null && days <= 5 ? 'text-amber-400' : 'text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined text-[14px]">{isOverdue ? 'warning' : 'schedule'}</span>
                      {isOverdue ? `¡${Math.abs(days)}d de retraso!` : days === 0 ? '¡Entrega hoy!' : `${days}d para entrega`}
                    </div>
                  ) : <span />}
                  <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    Ver detalle
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* New Contract Modal */}
      {showNewModal && (
        <NewContractModal user={user} initialQuoteId={initialQuoteId} onClose={() => setShowNewModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
