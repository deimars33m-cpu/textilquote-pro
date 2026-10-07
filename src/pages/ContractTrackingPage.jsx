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

function calcContractProgress(contract, laborExpenses = [], quoteProcesses = [], laborBatches = []) {
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

  const budgetedLabor = quoteProcesses.reduce((sum, p) => sum + (Number(p.total_cost) || 0), 0)
  const spentLabor = laborExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const totalDeliveredLabor = laborExpenses.reduce((s, e) => s + (Number(e.quantity) || 0), 0) +
    laborBatches.filter(b => b.is_delivered).reduce((s, b) => s + (Number(b.quantity) || 0), 0)

  const laborPct = contract.total_units > 0 && totalDeliveredLabor > 0
    ? Math.min(100, (totalDeliveredLabor / contract.total_units) * 100)
    : (budgetedLabor > 0 ? Math.min(100, (spentLabor / budgetedLabor) * 100) : (spentLabor > 0 ? 100 : 0))

  const hasLabor = quoteProcesses.length > 0 || laborExpenses.length > 0 || laborBatches.length > 0

  const phases = [
    purchases.length > 0 ? purchasePct : null,
    cuts.length > 0 ? cutPct : null,
    production.length > 0 ? prodPct : null,
    embellishment.length > 0 ? embPct : null,
    hasLabor ? laborPct : null
  ].filter(v => v !== null)

  const overall = phases.length === 0 ? 0 : phases.reduce((a, b) => a + b, 0) / phases.length

  return { purchasePct, cutPct, prodPct, embPct, laborPct, overall }
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
  // Use a second generic chart/stats icon for the background subtle look
  const bgIcon = icon === 'assignment' ? 'analytics' : icon === 'check_circle' ? 'task_alt' : 'bar_chart'
  
  return (
    <div className="glass-card p-4 space-y-2 flex flex-col relative overflow-hidden group">
      {/* Background subtle icon (bottom right) */}
      <span className="material-symbols-outlined absolute -bottom-3 -right-3 text-[70px] text-on-surface-variant/10 group-hover:text-primary/10 transition-colors duration-500 pointer-events-none">
        {bgIcon}
      </span>
      
      {/* Main content */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">{label}</span>
          <span className={`text-2xl font-mono font-extrabold ${color}`}>{value}</span>
          {sub && <span className="text-[10px] text-on-surface-variant mt-1">{sub}</span>}
        </div>
        {/* Main top right icon */}
        <span className={`material-symbols-outlined text-[24px] ${color} drop-shadow-[0_0_5px_currentColor]`}>{icon}</span>
      </div>
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
      // IMPORTANT: include 'id' in quote_items so item.id is available for downstream queries
      .select('id, quote_number, status, total_price, terceros(name), quote_items(id, product_name, quantity)')
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
      const { data: contract, error: createError } = await supabase
        .rpc('create_contract_transactional', {
          p_quote_id: form.quote_id || null,
          p_contract_name: form.contract_name.trim(),
          p_client_name: form.client_name.trim(),
          p_total_units: parseInt(form.total_units) || 1,
          p_delivery_date: form.delivery_date || null,
          p_notes: form.notes.trim() || null,
        })
        .single()
      if (createError) throw createError

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
      <div className="relative neu-surface w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-scale-in shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent z-20" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container/95 backdrop-blur-sm rounded-t-[1.5rem] z-10 shrink-0">
          <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_task</span>
            Nuevo Seguimiento de Contrato
          </h2>
          <button onClick={onClose} className="neu-raised-sm p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-modal-scrollbar">
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
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('compras')
  const [contractData, setContractData] = useState(contract)
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [quoteProcesses, setQuoteProcesses] = useState([])
  const [laborExpenses, setLaborExpenses] = useState([])
  const [laborBatches, setLaborBatches] = useState([])
  const [terceros, setTerceros] = useState([])

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
    
    if (data) {
      setContractData(data)
      
      // Load quote processes
      if (data.quote_id) {
        const { data: quoteItems } = await supabase
          .from('quote_items')
          .select('*, quote_processes(*)')
          .eq('quote_id', data.quote_id)
        if (quoteItems) {
          const procs = quoteItems.flatMap(item => (item.quote_processes || []).map(p => ({ ...p, estimated_cost: Number(p.total_cost) || 0 })))
          setQuoteProcesses(procs)
        }
      } else {
        setQuoteProcesses([])
      }

      // Load labor expenses
      if (data.order_id) {
        const { data: exps } = await supabase
          .from('expenses')
          .select('*')
          .eq('order_id', data.order_id)
          .eq('user_id', user?.id)
          .order('date', { ascending: false })
        if (exps) {
          const labor = exps.filter(e => {
            const subcatLower = (e.subcategory || '').toLowerCase().trim()
            const itemLower = (e.specific_item || e.specificItem || e.description || '').toLowerCase().trim()
            const catLower = (e.category_key || '').toLowerCase().trim()
            return subcatLower.includes('destajo') || 
                   subcatLower.includes('mano de obra') || 
                   subcatLower.includes('confecci') || 
                   subcatLower.includes('costura') || 
                   subcatLower.includes('taller') || 
                   itemLower.includes('destajo') || 
                   itemLower.includes('mano de obra') || 
                   itemLower.includes('confecci') || 
                   itemLower.includes('costura') || 
                   itemLower.includes('taller') || 
                   catLower === 'produccion' || 
                   catLower === 'producción'
          })
          setLaborExpenses(labor)
        }
      } else {
        setLaborExpenses([])
      }

      // Load labor batches
      try {
        const { data: batches } = await supabase
          .from('contract_labor_batches')
          .select('*')
          .eq('contract_id', data.id)
          .order('batch_date', { ascending: false })
        if (batches) setLaborBatches(batches)
      } catch (err) {
        console.warn('contract_labor_batches loading notice:', err)
      }
    }
    setLoading(false)
  }, [contract.id, user?.id])

  useEffect(() => {
    async function loadTerceros() {
      if (!user) return
      const { data } = await supabase
        .from('terceros')
        .select('*')
        .eq('user_id', user.id)
        .in('role', ['proveedor', 'dependiente'])
        .order('name')
      if (data) setTerceros(data)
    }
    loadTerceros()
  }, [user])

  useEffect(() => { reloadContract() }, [reloadContract])

  async function handleDeleteContract() {
    setDeleting(true)
    await supabase.from('contract_material_purchases').delete().eq('contract_id', contractData.id)
    await supabase.from('contract_cutting_progress').delete().eq('contract_id', contractData.id)
    await supabase.from('contract_production_progress').delete().eq('contract_id', contractData.id)
    await supabase.from('contract_embellishment_progress').delete().eq('contract_id', contractData.id)
    try { await supabase.from('contract_labor_batches').delete().eq('contract_id', contractData.id) } catch (e) {}
    await supabase.from('contract_tracking').delete().eq('id', contractData.id)
    onBack()
  }

  const progress = calcContractProgress(contractData, laborExpenses, quoteProcesses, laborBatches)
  const days = daysLeft(contractData.delivery_date)

  const tabs = [
    { id: 'compras', label: 'Compras', icon: 'shopping_cart', pct: progress.purchasePct },
    { id: 'cortes', label: 'Cortes', icon: 'content_cut', pct: progress.cutPct },
    { id: 'produccion', label: 'Producción', icon: 'precision_manufacturing', pct: progress.prodPct },
    { id: 'embellecimiento', label: 'Embellecimiento', icon: 'auto_fix_high', pct: progress.embPct },
    { id: 'mano_de_obra', label: 'Mano de Obra', icon: 'badge', pct: progress.laborPct },
  ]

  return (
    <div className="space-y-5 animate-scale-in">
      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative neu-surface w-full max-w-sm p-6 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-3xl">warning</span>
              <div>
                <h3 className="font-bold text-on-surface">¿Eliminar seguimiento?</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">Esta acción eliminará el contrato y todos sus registros de compras, cortes, producción y embellecimiento. No se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-xl neu-raised-sm text-sm text-on-surface-variant hover:text-on-surface transition-colors">Cancelar</button>
              <button
                 onClick={handleDeleteContract}
                 disabled={deleting}
                 className="px-4 py-2 rounded-xl bg-error text-white text-sm font-bold flex items-center gap-2 hover:bg-error/80 transition-colors"
              >
                {deleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[16px]">delete_forever</span>}
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex items-center gap-2">
          <StatusSelector contractId={contractData.id} current={contractData.status} onChanged={reloadContract} />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-xl neu-raised-sm text-on-surface-variant hover:text-error transition-colors"
            title="Eliminar seguimiento"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon="shopping_cart" label="Compras" value={`${Math.round(progress.purchasePct)}%`} color="text-primary" />
        <KpiCard icon="content_cut" label="Cortes" value={`${Math.round(progress.cutPct)}%`} color="text-secondary" />
        <KpiCard icon="precision_manufacturing" label="Producción" value={`${Math.round(progress.prodPct)}%`} color="text-tertiary" />
        <KpiCard icon="badge" label="Mano de Obra" value={`${Math.round(progress.laborPct)}%`} color="text-emerald-400" />
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
          {activeTab === 'mano_de_obra' && (
            <LaborProgressTab
              contractId={contractData.id}
              orderId={contractData.order_id}
              quoteProcesses={quoteProcesses}
              laborExpenses={laborExpenses}
              laborBatches={laborBatches}
              terceros={terceros}
              totalUnits={contractData.total_units}
              onRefresh={reloadContract}
              user={user}
            />
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
  const { user } = useAuth()
  const [form, setForm] = useState({ material_id: null, material_name: '', unit: 'metro', qty_required: '', qty_purchased: '', supplier_name: '', unit_cost: '', purchase_date: '', receipt_number: '', status: 'pendiente', notes: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  // Catálogo y Estado de Inventario de Almacén
  const [materialsCatalog, setMaterialsCatalog] = useState([])
  const [assignTarget, setAssignTarget] = useState(null)
  const [assignQty, setAssignQty] = useState('')
  const [assignNotes, setAssignNotes] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState(null)

  const fetchCatalog = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('materials').select('*').eq('user_id', user.id).order('name')
    if (data) setMaterialsCatalog(data)
  }, [user])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const STATUS_MAP = { pendiente: { label: 'Pendiente', cls: 'text-amber-400 bg-amber-400/10' }, parcial: { label: 'Parcial', cls: 'text-primary bg-primary/10' }, recibido: { label: 'Cubierto', cls: 'text-emerald-400 bg-emerald-400/10' } }

  function startEdit(row) {
    setEditId(row.id)
    setForm({
      material_id: row.material_id || null,
      material_name: row.material_name,
      unit: row.unit,
      qty_required: row.qty_required,
      qty_purchased: row.qty_purchased,
      supplier_name: row.supplier_name || '',
      unit_cost: row.unit_cost || '',
      purchase_date: row.purchase_date || '',
      receipt_number: row.receipt_number || '',
      status: row.status,
      notes: row.notes || ''
    })
  }

  function cancelEdit() {
    setEditId(null)
    setForm({ material_id: null, material_name: '', unit: 'metro', qty_required: '', qty_purchased: '', supplier_name: '', unit_cost: '', purchase_date: '', receipt_number: '', status: 'pendiente', notes: '' })
  }

  async function handleSave() {
    if (!form.material_name.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      contract_id: contractId,
      qty_required: parseFloat(form.qty_required) || 0,
      qty_purchased: parseFloat(form.qty_purchased) || 0,
      unit_cost: parseFloat(form.unit_cost) || 0,
      purchase_date: form.purchase_date || null,
      material_name: form.material_name.trim(),
      material_id: form.material_id || null
    }

    if (editId && editId !== 'new') {
      await supabase.from('contract_material_purchases').update(payload).eq('id', editId)
    } else {
      await supabase.from('contract_material_purchases').insert(payload)
    }
    cancelEdit()
    onRefresh()
    fetchCatalog()
    setSaving(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('contract_material_purchases').delete().eq('id', id)
    onRefresh()
    fetchCatalog()
    setDeleting(null)
  }

  function openAssignModal(row) {
    const matched = materialsCatalog.find(m => m.id === row.material_id || (m.name && row.material_name && m.name.toLowerCase().trim() === row.material_name.toLowerCase().trim()))
    const faltante = Math.max(0, (row.qty_required || 0) - (row.qty_purchased || 0))
    const stockAvailable = Number(matched?.current_stock) || 0

    setAssignTarget({ ...row, matchedMaterial: matched, stockAvailable, faltante })
    setAssignQty(faltante > 0 ? (stockAvailable > 0 ? Math.min(faltante, stockAvailable).toString() : '') : '')
    setAssignNotes(`Asignado al contrato`)
    setAssignError(null)
  }

  async function handleConfirmAssign() {
    if (!assignTarget || !assignTarget.matchedMaterial) {
      setAssignError('Este material aún no está enlazado a un producto del catálogo de inventario.')
      return
    }
    const qty = parseFloat(assignQty)
    if (isNaN(qty) || qty <= 0) {
      setAssignError('Ingresa una cantidad mayor a 0.')
      return
    }
    if (qty > assignTarget.stockAvailable) {
      setAssignError(`La cantidad excede el stock disponible en almacén (${assignTarget.stockAvailable} ${assignTarget.unit}).`)
      return
    }

    setAssigning(true)
    setAssignError(null)
    try {
      const mat = assignTarget.matchedMaterial
      const unitCost = parseFloat(mat.unit_price) || parseFloat(assignTarget.unit_cost) || 0

      // 1. Insertar movimiento en inventory_movements (tipo: asignacion)
      const { error: errMov } = await supabase.from('inventory_movements').insert({
        user_id: user.id,
        material_id: mat.id,
        contract_id: contractId,
        movement_type: 'asignacion',
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        reference: `Contrato ${contractId.slice(0, 8)}`,
        notes: assignNotes.trim() || `Asignación a contrato`,
        date: new Date().toISOString().split('T')[0]
      })
      if (errMov) throw errMov

      // 2. Actualizar stock en materials (fallback si trigger no está activo)
      const newStock = Math.max(0, (Number(mat.current_stock) || 0) - qty)
      await supabase.from('materials').update({ current_stock: newStock }).eq('id', mat.id)

      // 3. Actualizar contract_material_purchases
      const newPurchased = (Number(assignTarget.qty_purchased) || 0) + qty
      const newStatus = newPurchased >= assignTarget.qty_required ? 'recibido' : 'parcial'
      const { error: errPurch } = await supabase.from('contract_material_purchases').update({
        qty_purchased: newPurchased,
        status: newStatus,
        material_id: mat.id
      }).eq('id', assignTarget.id)
      if (errPurch) throw errPurch

      setAssignTarget(null)
      onRefresh()
      fetchCatalog()
    } catch (e) {
      console.error('Error al asignar material del almacén:', e)
      setAssignError(`Error: ${e.message}`)
    } finally {
      setAssigning(false)
    }
  }

  const totalCost = rows.reduce((s, r) => s + ((r.unit_cost || 0) * (r.qty_purchased || 0)), 0)
  const totalPct = rows.length === 0 ? 0 : rows.reduce((s, r) => s + (r.qty_required > 0 ? Math.min(100, (r.qty_purchased / r.qty_required) * 100) : 0), 0) / rows.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">inventory_2</span>
          <div>
            <h3 className="font-bold text-on-surface">Materiales e Insumos del Contrato</h3>
            <p className="text-[11px] text-on-surface-variant">
              {rows.length} materiales requeridos · Asignado/Invertido: <span className="text-primary font-mono font-bold">{formatCurrency(totalCost)}</span>
            </p>
          </div>
        </div>
        <button onClick={() => { setEditId('new'); setForm({ material_id: null, material_name: '', unit: 'metro', qty_required: '', qty_purchased: '', supplier_name: '', unit_cost: '', purchase_date: '', receipt_number: '', status: 'pendiente', notes: '' }) }} className="neu-button-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">add</span> Agregar Material
        </button>
      </div>

      <ProgressBar value={totalPct} label="Cobertura de Materiales" />

      {/* Formulario Agregar / Editar */}
      {(editId === 'new' || editId) && (
        <div className="neu-surface p-4 space-y-3 border border-primary/20">
          <h4 className="text-sm font-bold text-primary">{editId === 'new' ? 'Agregar Requerimiento de Material' : 'Editar Requerimiento de Material'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                Vincular con Catálogo de Almacén (Opcional)
              </label>
              <select
                className="w-full px-3 py-2 neu-pressed bg-surface-container-high border-none rounded-xl text-sm text-on-surface outline-none"
                value={form.material_id || ''}
                onChange={e => {
                  const mId = e.target.value
                  const found = materialsCatalog.find(m => m.id === mId)
                  if (found) {
                    setForm(f => ({
                      ...f,
                      material_id: found.id,
                      material_name: found.name,
                      unit: found.usage_unit || found.purchase_unit || f.unit,
                      unit_cost: found.unit_price || f.unit_cost
                    }))
                  } else {
                    setForm(f => ({ ...f, material_id: null }))
                  }
                }}
              >
                <option value="">-- Ingresar manualmente o elegir del catálogo --</option>
                {materialsCatalog.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.category}) · Stock Almacén: {m.current_stock ?? 0} {m.usage_unit || ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Nombre del Material *</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Ej: Lona 600D Negra" value={form.material_name} onChange={e => setForm(f => ({ ...f, material_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Unidad de Medida</label>
              <select className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none appearance-none" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {['metro', 'rollo', 'kg', 'unidad', 'caja', 'paquete', 'yarda', 'litro'].map(u => <option key={u} value={u} className="bg-surface">{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Cantidad Requerida</label>
              <input type="number" min="0" step="0.01" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.qty_required} onChange={e => setForm(f => ({ ...f, qty_required: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Cantidad Asignada / Comprada</label>
              <input type="number" min="0" step="0.01" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0" value={form.qty_purchased} onChange={e => setForm(f => ({ ...f, qty_purchased: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Costo Unitario (Bs)</label>
              <input type="number" min="0" step="0.01" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none" placeholder="0.00" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Proveedor / Observaciones</label>
              <input type="text" className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none" placeholder="Proveedor o referencia" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Estado de Cobertura</label>
              <select className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none appearance-none" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pendiente" className="bg-surface">Pendiente</option>
                <option value="parcial" className="bg-surface">Asignación Parcial</option>
                <option value="recibido" className="bg-surface">Cubierto Completo</option>
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

      {/* Lista de Filas de Materiales */}
      {rows.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">inventory_2</span>
          <p className="text-sm">No hay materiales registrados para este contrato</p>
          <p className="text-xs mt-1">Los materiales cotizados se importan automáticamente al crear el contrato.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const pct = row.qty_required > 0 ? Math.min(100, (row.qty_purchased / row.qty_required) * 100) : 0
            const faltante = Math.max(0, (row.qty_required || 0) - (row.qty_purchased || 0))
            const s = STATUS_MAP[row.status] || STATUS_MAP.pendiente

            // Buscar en catálogo de inventario
            const matched = materialsCatalog.find(m => m.id === row.material_id || (m.name && row.material_name && m.name.toLowerCase().trim() === row.material_name.toLowerCase().trim()))
            const stockAvailable = Number(matched?.current_stock) || 0

            return (
              <div key={row.id} className="neu-surface p-4 space-y-3 border border-outline-variant/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-on-surface text-sm">{row.material_name}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    </div>

                    {/* Badge de disponibilidad en Almacén */}
                    {matched ? (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-primary">warehouse</span>
                          Stock en almacén: <strong className={stockAvailable >= faltante && faltante > 0 ? 'text-emerald-400 font-mono' : stockAvailable > 0 ? 'text-amber-400 font-mono' : 'text-error font-mono'}>{stockAvailable} {matched.usage_unit || row.unit}</strong>
                        </span>
                        {stockAvailable >= faltante && faltante > 0 && (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md font-bold">
                            ✓ Cubre faltante
                          </span>
                        )}
                        {stockAvailable < faltante && stockAvailable > 0 && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-bold">
                            ⚠️ Stock parcial
                          </span>
                        )}
                        {stockAvailable <= 0 && faltante > 0 && (
                          <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-md font-bold">
                            Sin stock
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-on-surface-variant/60 italic mt-0.5">
                        Sin vincular al catálogo de almacén (edita para vincular)
                      </p>
                    )}

                    {row.notes && <p className="text-[11px] text-on-surface-variant/80 mt-1">{row.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botón Asignar desde Almacén si hay stock y faltante */}
                    {faltante > 0 && (
                      <button
                        onClick={() => openAssignModal(row)}
                        disabled={!matched || stockAvailable <= 0}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                          matched && stockAvailable > 0
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm cursor-pointer'
                            : 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'
                        }`}
                        title={matched && stockAvailable > 0 ? "Asignar stock desde almacén" : "Sin stock disponible en almacén para asignar"}
                      >
                        <span className="material-symbols-outlined text-[14px]">output</span>
                        Asignar Almacén
                      </button>
                    )}

                    <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button onClick={() => handleDelete(row.id)} disabled={deleting === row.id} className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-error transition-colors">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Métricas de cantidades */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Requerido</p>
                    <p className="font-mono font-bold text-on-surface text-sm">{row.qty_required} {row.unit}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Cubierto/Asignado</p>
                    <p className="font-mono font-bold text-emerald-400 text-sm">{row.qty_purchased} {row.unit}</p>
                  </div>
                  <div className="neu-pressed rounded-xl p-2">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Faltante</p>
                    <p className={`font-mono font-bold text-sm ${faltante > 0 ? 'text-error' : 'text-emerald-400'}`}>
                      {faltante > 0 ? `${faltante} ${row.unit}` : '✓ Completo'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <ProgressBar value={pct} />
                  {row.unit_cost > 0 && (
                    <p className="text-[10px] text-right text-on-surface-variant font-mono">
                      Costo estimado asignado: <span className="text-primary font-bold">{formatCurrency(row.unit_cost * row.qty_purchased)}</span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Asignar Material de Almacén al Contrato */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="neu-surface max-w-md w-full p-6 rounded-2xl space-y-4 border border-outline-variant/40 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">output</span>
                <h3 className="font-bold text-on-surface text-base">Asignar Material desde Almacén</h3>
              </div>
              <button onClick={() => setAssignTarget(null)} className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-3 bg-surface-container-high rounded-xl space-y-1.5 text-xs">
              <p className="font-bold text-on-surface text-sm">{assignTarget.material_name}</p>
              <div className="grid grid-cols-2 gap-2 text-on-surface-variant font-mono pt-1">
                <div>Faltante en contrato: <strong className="text-error">{assignTarget.faltante} {assignTarget.unit}</strong></div>
                <div>Disponible en almacén: <strong className="text-emerald-400">{assignTarget.stockAvailable} {assignTarget.unit}</strong></div>
              </div>
            </div>

            {assignError && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>{assignError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Cantidad a Transferir / Asignar ({assignTarget.unit}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={assignTarget.stockAvailable}
                    value={assignQty}
                    onChange={e => setAssignQty(e.target.value)}
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-base text-on-surface font-mono font-bold outline-none"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => setAssignQty(Math.min(assignTarget.faltante, assignTarget.stockAvailable).toString())}
                    className="absolute right-2 top-2 px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded-lg hover:bg-primary/30"
                  >
                    Máx. sugerido
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Notas de Entrega / Asignación
                </label>
                <input
                  type="text"
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  placeholder="Ej: Entregado a taller de corte / lote 1..."
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-xs text-on-surface outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => setAssignTarget(null)}
                className="px-4 py-2 rounded-xl neu-raised-sm text-xs font-bold text-on-surface-variant hover:text-on-surface"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={assigning}
                className="neu-button-primary px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                {assigning ? 'Asignando...' : 'Confirmar Asignación'}
              </button>
            </div>
          </div>
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

  async function handleDeleteContractFromList(e, contractId) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este seguimiento y todos sus registros? Esta acción no se puede deshacer.')) return
    await supabase.from('contract_material_purchases').delete().eq('contract_id', contractId)
    await supabase.from('contract_cutting_progress').delete().eq('contract_id', contractId)
    await supabase.from('contract_production_progress').delete().eq('contract_id', contractId)
    await supabase.from('contract_embellishment_progress').delete().eq('contract_id', contractId)
    await supabase.from('contract_tracking').delete().eq('id', contractId)
    fetchContracts()
  }

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
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_COLORS[contract.status]}`}>
                      {STATUS_LABELS[contract.status]}
                    </span>
                    <button
                      onClick={(e) => handleDeleteContractFromList(e, contract.id)}
                      className="p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                      title="Eliminar contrato"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
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

// ── Tab: Mano de Obra Directa (Planilla, Deudas y Liquidación por Operario) ──

function LaborProgressTab({ contractId, orderId, quoteProcesses, laborExpenses, laborBatches = [], terceros, totalUnits, onRefresh, user }) {
  const [selectedOperator, setSelectedOperator] = useState('all')

  // Modals state
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [transactionForm, setTransactionForm] = useState({
    operator_name: '',
    operator_id: '',
    concept: '',
    quantity: '',
    unit_price: 8,
    amount: '',
    advance_amount: '',
    date: new Date().toISOString().slice(0, 10),
    payment_method: 'efectivo',
    notes: ''
  })

  const [showAbonoModal, setShowAbonoModal] = useState(false)
  const [abonoTarget, setAbonoTarget] = useState(null)
  const [abonoForm, setAbonoForm] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    payment_method: 'efectivo',
    notes: ''
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Dependientes / Proveedores
  const dependientes = terceros.filter(t => t.role === 'dependiente')
  const providers = terceros.filter(t => t.role === 'proveedor')

  // Find default base cost from quote processes if available
  const defaultBaseCost = quoteProcesses.length > 0 
    ? (Number(quoteProcesses[0].cost) || 8) 
    : 8

  // Autocalculate amount and debt in transaction form
  useEffect(() => {
    const qty = Number(transactionForm.quantity) || 0
    const price = Number(transactionForm.unit_price) || 0
    const total = qty * price
    setTransactionForm(f => ({
      ...f,
      amount: total > 0 ? total.toFixed(2) : f.amount
    }))
  }, [transactionForm.quantity, transactionForm.unit_price])

  // Build unified records primarily from laborExpenses and laborBatches
  const expenseRecords = laborExpenses.map(e => {
    const qty = Number(e.quantity) || 1
    const total = Number(e.amount) || 0
    const unitPrice = Number(e.unit_price) > 0 ? Number(e.unit_price) : (qty > 0 ? total / qty : defaultBaseCost)
    const paid = Number(e.advance_amount) || 0
    const debt = Math.max(0, total - paid)

    return {
      id: e.id,
      type: 'expense',
      date: e.date,
      operator_name: e.provider || 'Sin asignar',
      concept: e.specific_item || e.description || 'Mano de Obra',
      quantity: qty,
      unit_price: unitPrice,
      amount: total,
      paid_amount: paid,
      debt_amount: debt,
      payment_method: e.payment_method || 'efectivo',
      payment_history: e.payment_history || [],
      notes: e.description || '',
      raw: e
    }
  })

  const batchRecords = laborBatches.map(b => {
    const qty = Number(b.quantity) || 0
    const unitPrice = Number(b.unit_cost) || defaultBaseCost
    const total = qty * unitPrice

    return {
      id: b.id,
      type: 'batch',
      date: b.batch_date,
      operator_name: b.operator_name || 'Sin asignar',
      concept: b.notes || 'Lote de Confección',
      quantity: qty,
      unit_price: unitPrice,
      amount: total,
      paid_amount: 0,
      debt_amount: total,
      payment_method: '—',
      payment_history: [],
      notes: b.notes || '',
      is_delivered: b.is_delivered !== false,
      raw: b
    }
  })

  const allRecords = [...expenseRecords, ...batchRecords].sort((a, b) => new Date(b.date) - new Date(a.date))

  // Unique operator names
  const operatorNames = Array.from(new Set([
    ...allRecords.map(r => r.operator_name).filter(Boolean),
    ...dependientes.map(d => d.name).filter(Boolean)
  ]))

  // Filtered records
  const filteredRecords = selectedOperator === 'all'
    ? allRecords
    : allRecords.filter(r => r.operator_name.toLowerCase().trim() === selectedOperator.toLowerCase().trim())

  // Calculations for selection
  const totalQuantity = filteredRecords.reduce((sum, r) => sum + r.quantity, 0)
  const totalDevengado = filteredRecords.reduce((sum, r) => sum + r.amount, 0)
  const totalPagado = filteredRecords.reduce((sum, r) => sum + r.paid_amount, 0)
  const totalAdeudado = filteredRecords.reduce((sum, r) => sum + r.debt_amount, 0)

  const overallDeliveredUnits = allRecords.reduce((sum, r) => sum + r.quantity, 0)
  const physicalLaborPct = totalUnits > 0 ? Math.min(100, (overallDeliveredUnits / totalUnits) * 100) : 0

  // ─── Handlers for New Transaction ───
  function handleOpenNewTransaction(opName = '') {
    setError(null)
    const initialOp = opName || (selectedOperator !== 'all' ? selectedOperator : (operatorNames[0] || ''))
    setTransactionForm({
      operator_name: initialOp,
      operator_id: '',
      concept: quoteProcesses.length > 0 ? (quoteProcesses[0].process_name || quoteProcesses[0].name) : 'Confección-armado',
      quantity: '',
      unit_price: defaultBaseCost,
      amount: '',
      advance_amount: '',
      date: new Date().toISOString().slice(0, 10),
      payment_method: 'efectivo',
      notes: ''
    })
    setShowTransactionModal(true)
  }

  async function handleSaveTransaction() {
    if (!transactionForm.operator_name.trim()) {
      setError('El nombre del operario es requerido.')
      return
    }
    if (!transactionForm.quantity || Number(transactionForm.quantity) <= 0) {
      setError('La cantidad de prendas debe ser mayor a 0.')
      return
    }
    if (!transactionForm.amount || Number(transactionForm.amount) <= 0) {
      setError('El monto total debe ser mayor a 0.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const trimmedOp = transactionForm.operator_name.trim()
      let opId = transactionForm.operator_id || null

      if (!opId) {
        const match = terceros.find(t => t.name.toLowerCase() === trimmedOp.toLowerCase())
        if (match) {
          opId = match.id
        } else {
          const { data: newT } = await supabase
            .from('terceros')
            .insert({ user_id: user.id, name: trimmedOp, role: 'dependiente', client_type: 'dependiente' })
            .select()
            .single()
          if (newT) opId = newT.id
        }
      }

      const totalAmount = Number(transactionForm.amount)
      const paidAmount = transactionForm.advance_amount !== '' ? Number(transactionForm.advance_amount) : totalAmount

      const payload = {
        user_id: user.id,
        date: transactionForm.date,
        category_key: 'PRODUCCION',
        category_label: 'Producción Textil y Confección',
        subcategory: 'Pagos a destajo',
        specific_item: transactionForm.concept.trim() || 'Confección-armado',
        description: transactionForm.notes.trim() || `Entrega de ${transactionForm.quantity} prendas a operario: ${trimmedOp}`,
        provider: trimmedOp,
        provider_id: opId,
        quantity: parseInt(transactionForm.quantity) || 1,
        unit_price: parseFloat(transactionForm.unit_price) || defaultBaseCost,
        amount: totalAmount,
        advance_amount: paidAmount,
        payment_method: transactionForm.payment_method,
        payment_history: paidAmount > 0 ? [{
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          amount: paidAmount,
          method: transactionForm.payment_method,
          note: paidAmount >= totalAmount ? 'Cancelación total' : 'Abono / Adelanto inicial'
        }] : [],
        order_id: orderId || null
      }

      const { error: errSave } = await supabase.from('expenses').insert(payload)
      if (errSave) throw errSave

      setShowTransactionModal(false)
      onRefresh()
    } catch (e) {
      console.error('Error saving transaction:', e)
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Handlers for Abono to Debt ───
  function handleOpenAbono(record) {
    setError(null)
    setAbonoTarget(record)
    setAbonoForm({
      amount: record.debt_amount > 0 ? record.debt_amount : '',
      date: new Date().toISOString().slice(0, 10),
      payment_method: 'efectivo',
      notes: `Abono saldo entrega (${record.concept})`
    })
    setShowAbonoModal(true)
  }

  async function handleSaveAbono() {
    if (!abonoForm.amount || Number(abonoForm.amount) <= 0) {
      setError('El monto a abonar debe ser mayor a 0.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const additionalPaid = Number(abonoForm.amount)
      const currentPaid = Number(abonoTarget.paid_amount) || 0
      const newAdvance = currentPaid + additionalPaid

      const existingHistory = abonoTarget.payment_history || []
      const newHistory = [
        ...existingHistory,
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          amount: additionalPaid,
          method: abonoForm.payment_method,
          note: abonoForm.notes.trim() || 'Abono a deuda de entrega'
        }
      ]

      if (abonoTarget.type === 'expense') {
        const { error: errUpd } = await supabase
          .from('expenses')
          .update({
            advance_amount: newAdvance,
            payment_history: newHistory
          })
          .eq('id', abonoTarget.id)
        if (errUpd) throw errUpd
      } else {
        // If it was a batch, insert a payment record in expenses
        const payload = {
          user_id: user.id,
          date: abonoForm.date,
          category_key: 'PRODUCCION',
          category_label: 'Producción Textil y Confección',
          subcategory: 'Pagos a destajo',
          specific_item: `Abono lote (${abonoTarget.concept})`,
          description: abonoForm.notes.trim() || `Abono a operario: ${abonoTarget.operator_name}`,
          provider: abonoTarget.operator_name,
          quantity: 1,
          unit_price: additionalPaid,
          amount: additionalPaid,
          advance_amount: additionalPaid,
          payment_method: abonoForm.payment_method,
          payment_history: [{
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            amount: additionalPaid,
            method: abonoForm.payment_method,
            note: 'Abono a lote de confección'
          }],
          order_id: orderId || null
        }
        const { error: errIns } = await supabase.from('expenses').insert(payload)
        if (errIns) throw errIns
      }

      setShowAbonoModal(false)
      onRefresh()
    } catch (e) {
      console.error('Error saving abono:', e)
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRecord(record) {
    if (!window.confirm(`¿Eliminar este registro de ${record.operator_name} (${record.concept})?`)) return
    setDeletingId(record.id)
    try {
      if (record.type === 'expense') {
        const { error } = await supabase.from('expenses').delete().eq('id', record.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contract_labor_batches').delete().eq('id', record.id)
        if (error) throw error
      }
      onRefresh()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-scale-in">
      {/* ─── 1. Global KPIs of Direct Labor ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4 space-y-1.5 border border-primary/20">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Avance Confección
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {overallDeliveredUnits} <span className="text-xs font-normal text-on-surface-variant">/ {totalUnits} uds</span>
          </div>
          <ProgressBar value={physicalLaborPct} />
        </div>

        <div className="glass-card p-4 space-y-1.5 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            Total Devengado
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {formatCurrency(totalDevengado)}
          </div>
          <p className="text-[10px] text-on-surface-variant">{totalQuantity} prendas contabilizadas</p>
        </div>

        <div className="glass-card p-4 space-y-1.5 border border-outline-variant/30">
          <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">payments</span>
            Total Pagado
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {formatCurrency(totalPagado)}
          </div>
          <p className="text-[10px] text-on-surface-variant">Abonos y adelantos realizados</p>
        </div>

        <div className={`glass-card p-4 space-y-1.5 border ${totalAdeudado > 0 ? 'border-amber-400/40 bg-amber-400/5' : 'border-outline-variant/30'}`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${totalAdeudado > 0 ? 'text-amber-400' : 'text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            Monto Total Adeudado
          </div>
          <div className={`text-xl font-bold font-mono ${totalAdeudado > 0 ? 'text-amber-400' : 'text-primary'}`}>
            {formatCurrency(totalAdeudado)}
          </div>
          <p className="text-[10px] text-on-surface-variant">Saldo pendiente con operadores</p>
        </div>
      </div>

      {/* ─── 2. Operator Filter Tabs ─── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mr-1">Operador:</span>
        <button
          onClick={() => setSelectedOperator('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedOperator === 'all' ? 'neu-button-primary' : 'neu-raised-sm text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Todos ({allRecords.length})
        </button>
        {operatorNames.map(name => {
          const opRecords = allRecords.filter(r => r.operator_name.toLowerCase().trim() === name.toLowerCase().trim())
          const opQty = opRecords.reduce((s, r) => s + r.quantity, 0)
          const opDebt = opRecords.reduce((s, r) => s + r.debt_amount, 0)

          return (
            <button
              key={name}
              onClick={() => setSelectedOperator(name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedOperator.toLowerCase() === name.toLowerCase() ? 'neu-button-primary' : 'neu-raised-sm text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">person</span>
              {name}
              <span className="text-[10px] opacity-75 font-mono">({opQty} uds)</span>
              {opDebt > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-400 text-[9px] font-mono border border-amber-400/30">
                  Deuda: {formatCurrency(opDebt)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── 3. Kardex Table of Labor Transactions ─── */}
      <div className="neu-surface p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
            <div>
              <h3 className="font-bold text-on-surface text-sm">Registro de Entregas y Control de Mano de Obra</h3>
              <p className="text-[11px] text-on-surface-variant">
                {selectedOperator === 'all' ? 'Todas las transacciones y entregas vinculadas al contrato' : `Entregas y pagos de: ${selectedOperator}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenNewTransaction()}
            className="neu-button-primary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add_task</span>
            Registrar Entrega / Pago
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-outline-variant/30 rounded-2xl">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-2">payments</span>
            <p className="text-xs text-on-surface-variant italic">No se han registrado transacciones de mano de obra para este contrato.</p>
            <button
              onClick={() => handleOpenNewTransaction()}
              className="mt-3 neu-button-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              Registrar primera entrega o pago
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container/60 border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px]">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Operario / Taller</th>
                  <th className="py-2.5 px-3">Concepto / Proceso</th>
                  <th className="py-2.5 px-3 text-right">Cantidad</th>
                  <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                  <th className="py-2.5 px-3 text-right">Monto Total</th>
                  <th className="py-2.5 px-3 text-right">Monto Pagado</th>
                  <th className="py-2.5 px-3 text-right">Monto Adeudado</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-center w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-on-surface font-mono">
                {filteredRecords.map(record => {
                  const isFullyPaid = record.debt_amount <= 0
                  const isPartial = record.paid_amount > 0 && record.debt_amount > 0

                  return (
                    <tr key={record.id} className="hover:bg-surface-container-high/30 transition-colors">
                      <td className="py-3 px-3 font-sans text-on-surface-variant whitespace-nowrap">
                        {new Date(record.date + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3 font-sans font-bold text-white whitespace-nowrap">
                        {record.operator_name}
                      </td>
                      <td className="py-3 px-3 font-sans text-on-surface text-[11px]" title={record.notes}>
                        <div className="font-semibold">{record.concept}</div>
                        {record.notes && record.notes !== record.concept && (
                          <div className="text-[10px] text-on-surface-variant truncate max-w-[180px]">{record.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white">
                        {record.quantity} uds
                      </td>
                      <td className="py-3 px-3 text-right text-on-surface-variant font-bold">
                        {formatCurrency(record.unit_price)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                        {formatCurrency(record.paid_amount)}
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${record.debt_amount > 0 ? 'text-amber-400' : 'text-on-surface-variant'}`}>
                        {formatCurrency(record.debt_amount)}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 border border-primary/30 text-primary whitespace-nowrap">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                            Cancelado
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 border border-amber-400/30 text-amber-400 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[12px]">pending</span>
                            Con Deuda
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-error/10 border border-error/30 text-error whitespace-nowrap">
                            <span className="material-symbols-outlined text-[12px]">error</span>
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1">
                          {record.debt_amount > 0 && (
                            <button
                              onClick={() => handleOpenAbono(record)}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-[10px] font-bold transition-colors"
                              title="Abonar a la deuda de esta entrega"
                            >
                              Abonar
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRecord(record)}
                            disabled={deletingId === record.id}
                            className="p-1 rounded text-on-surface-variant hover:text-error transition-colors"
                            title="Eliminar registro"
                          >
                            {deletingId === record.id ? (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modal 1: Registrar Entrega / Pago de Mano de Obra ─── */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowTransactionModal(false)} />
          <div className="relative neu-surface w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-scale-in shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container/95 backdrop-blur-sm rounded-t-[1.5rem] z-10 shrink-0">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                Registrar Entrega / Pago de Mano de Obra
              </h2>
              <button onClick={() => setShowTransactionModal(false)} className="neu-raised-sm p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-modal-scrollbar">
              {error && <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">{error}</div>}

              {/* Operario */}
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Operario / Taller *</label>
                <div className="space-y-2">
                  <select
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none cursor-pointer"
                    value={transactionForm.operator_id}
                    onChange={e => {
                      const id = e.target.value
                      const match = dependientes.find(d => d.id === id) || providers.find(p => p.id === id)
                      setTransactionForm(f => ({
                        ...f,
                        operator_id: id,
                        operator_name: match ? match.name : ''
                      }))
                    }}
                  >
                    <option value="">— Escribir / Seleccionar Operario —</option>
                    <optgroup label="Empleados / Dependientes" className="bg-surface text-on-surface">
                      {dependientes.map(d => (
                        <option key={d.id} value={d.id} className="bg-surface text-on-surface">{d.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Talleres / Proveedores" className="bg-surface text-on-surface">
                      {providers.map(p => (
                        <option key={p.id} value={p.id} className="bg-surface text-on-surface">{p.name}</option>
                      ))}
                    </optgroup>
                  </select>

                  {!transactionForm.operator_id && (
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none"
                      placeholder="Nombre del operario (ej. Juan Luis - Villa Ingenio)..."
                      value={transactionForm.operator_name}
                      onChange={e => setTransactionForm(f => ({ ...f, operator_name: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              {/* Concepto / Proceso */}
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Concepto / Proceso *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
                  placeholder="Ej. Confección-armado - MOCHILAS B1"
                  value={transactionForm.concept}
                  onChange={e => setTransactionForm(f => ({ ...f, concept: e.target.value }))}
                />
              </div>

              {/* Cantidad & Precio Unitario */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Cantidad (Prendas) *</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none"
                    placeholder="Ej. 280"
                    value={transactionForm.quantity}
                    onChange={e => setTransactionForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Precio Unitario (Bs) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none"
                    placeholder="8.00"
                    value={transactionForm.unit_price}
                    onChange={e => setTransactionForm(f => ({ ...f, unit_price: e.target.value }))}
                  />
                </div>
              </div>

              {/* Monto Total & Monto Pagado */}
              <div className="grid grid-cols-2 gap-3 bg-surface-container/40 p-3.5 rounded-2xl border border-outline-variant/30">
                <div>
                  <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Monto Total (Devengado)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-2 py-1.5 bg-surface-container/80 border border-outline-variant/30 rounded-xl text-sm text-white font-mono font-bold outline-none"
                    value={transactionForm.amount}
                    onChange={e => setTransactionForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Monto Pagado / Adelanto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-white font-mono font-bold outline-none focus:border-emerald-400"
                    placeholder={transactionForm.amount || '0.00'}
                    value={transactionForm.advance_amount}
                    onChange={e => setTransactionForm(f => ({ ...f, advance_amount: e.target.value }))}
                  />
                </div>
              </div>

              {/* Saldo adeudado calculado */}
              {(() => {
                const total = Number(transactionForm.amount) || 0
                const paid = transactionForm.advance_amount !== '' ? Number(transactionForm.advance_amount) : total
                const debt = Math.max(0, total - paid)

                return (
                  <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-surface-container/60 border border-outline-variant/20">
                    <span className="text-xs text-on-surface-variant font-bold uppercase">Monto Adeudado:</span>
                    <span className={`font-mono font-extrabold text-sm ${debt > 0 ? 'text-amber-400' : 'text-primary'}`}>
                      {formatCurrency(debt)}
                    </span>
                  </div>
                )
              })()}

              {/* Método de Pago & Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Método de Pago</label>
                  <select
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none cursor-pointer"
                    value={transactionForm.payment_method}
                    onChange={e => setTransactionForm(f => ({ ...f, payment_method: e.target.value }))}
                  >
                    <option value="efectivo" className="bg-surface text-on-surface">Efectivo</option>
                    <option value="transferencia" className="bg-surface text-on-surface">Transferencia</option>
                    <option value="tarjeta" className="bg-surface text-on-surface">Tarjeta</option>
                    <option value="qr" className="bg-surface text-on-surface">Pago QR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Fecha</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none"
                    value={transactionForm.date}
                    onChange={e => setTransactionForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Notas / Descripción</label>
                <textarea
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none resize-none h-16"
                  placeholder="Detalles sobre la entrega o lote..."
                  value={transactionForm.notes}
                  onChange={e => setTransactionForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-4 py-2.5 rounded-xl neu-raised-sm text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTransaction}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">save</span>
                  )}
                  {saving ? 'Guardando...' : 'Guardar Transacción'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Abonar a Deuda de Entrega ─── */}
      {showAbonoModal && abonoTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAbonoModal(false)} />
          <div className="relative neu-surface w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-scale-in shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container/95 backdrop-blur-sm rounded-t-[1.5rem] z-10 shrink-0">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">payments</span>
                Abonar Saldo a {abonoTarget.operator_name}
              </h2>
              <button onClick={() => setShowAbonoModal(false)} className="neu-raised-sm p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-modal-scrollbar">
              {error && <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">{error}</div>}

              <div className="bg-surface-container/50 p-3.5 rounded-2xl border border-outline-variant/30 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Concepto:</span>
                  <span className="font-bold text-white">{abonoTarget.concept}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Monto Total Entrega:</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(abonoTarget.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Pagado hasta hoy:</span>
                  <span className="font-mono font-bold text-emerald-400">{formatCurrency(abonoTarget.paid_amount)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-outline-variant/20">
                  <span className="text-amber-400 font-bold uppercase">Deuda Actual:</span>
                  <span className="font-mono font-extrabold text-amber-400">{formatCurrency(abonoTarget.debt_amount)}</span>
                </div>
              </div>

              {/* Monto a abonar */}
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Monto a Abonar (Bs) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-white font-mono font-bold outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="0.00"
                  value={abonoForm.amount}
                  onChange={e => setAbonoForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>

              {/* Método & Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Método de Pago</label>
                  <select
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none cursor-pointer"
                    value={abonoForm.payment_method}
                    onChange={e => setAbonoForm(f => ({ ...f, payment_method: e.target.value }))}
                  >
                    <option value="efectivo" className="bg-surface text-on-surface">Efectivo</option>
                    <option value="transferencia" className="bg-surface text-on-surface">Transferencia</option>
                    <option value="tarjeta" className="bg-surface text-on-surface">Tarjeta</option>
                    <option value="qr" className="bg-surface text-on-surface">Pago QR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Fecha del Abono</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none"
                    value={abonoForm.date}
                    onChange={e => setAbonoForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Notas del Abono</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
                  placeholder="Detalles sobre este abono..."
                  value={abonoForm.notes}
                  onChange={e => setAbonoForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAbonoModal(false)}
                  className="px-4 py-2.5 rounded-xl neu-raised-sm text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAbono}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-md"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">save</span>
                  )}
                  {saving ? 'Guardando...' : 'Registrar Abono'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
