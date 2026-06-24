import { useState, useMemo, useEffect } from 'react'
import { useCRUD } from '@/hooks/useCRUD'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, SearchInput, LoadingSpinner, EmptyState, StatusBadge
} from '@/components/ui/index.jsx'
import { clientTypes, terceroTypes, formatCurrency } from '@/lib/formatters'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

function ResumenDashboard({ terceros }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!user) return
      setLoading(true)
      try {
        const [ordersRes, expensesRes] = await Promise.all([
          supabase.from('orders').select('id, total_amount, paid_amount, payment_status, status, created_at, tercero_id').eq('user_id', user.id),
          supabase.from('expenses').select('id, amount, advance_amount, date, created_at, provider_id').eq('user_id', user.id)
        ])
        if (ordersRes.data) setOrders(ordersRes.data)
        if (expensesRes.data) setExpenses(expensesRes.data)
      } catch (e) {
        console.error('Error fetching financial data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const metrics = useMemo(() => {
    let totalBilled = 0
    let totalPaidClients = 0
    let totalClientDebt = 0
    let totalPurchased = 0
    let totalPaidProviders = 0
    let totalProviderDebt = 0

    const clientStats = {}
    const providerStats = {}

    terceros.forEach(t => {
      if (t.role === 'cliente') {
        clientStats[t.id] = { ...t, billed: 0, paid: 0, debt: 0, ordersCount: 0, lastOrder: null }
      } else if (t.role === 'proveedor') {
        providerStats[t.id] = { ...t, purchased: 0, paid: 0, debt: 0, expensesCount: 0, lastExpense: null }
      }
    })

    orders.forEach(o => {
      const amt = Number(o.total_amount) || 0
      const paid = Number(o.paid_amount) || 0
      totalBilled += amt
      totalPaidClients += paid
      totalClientDebt += (amt - paid)

      if (o.tercero_id && clientStats[o.tercero_id]) {
        const stat = clientStats[o.tercero_id]
        stat.billed += amt
        stat.paid += paid
        stat.debt += (amt - paid)
        stat.ordersCount += 1
        if (!stat.lastOrder || new Date(o.created_at) > new Date(stat.lastOrder)) {
          stat.lastOrder = o.created_at
        }
      }
    })

    expenses.forEach(e => {
      const amt = Number(e.amount) || 0
      const paid = Number(e.advance_amount) || 0
      totalPurchased += amt
      totalPaidProviders += paid
      totalProviderDebt += (amt - paid)

      if (e.provider_id && providerStats[e.provider_id]) {
        const stat = providerStats[e.provider_id]
        stat.purchased += amt
        stat.paid += paid
        stat.debt += (amt - paid)
        stat.expensesCount += 1
        const expDate = e.date || e.created_at
        if (!stat.lastExpense || new Date(expDate) > new Date(stat.lastExpense)) {
          stat.lastExpense = expDate
        }
      }
    })

    const clientsList = Object.values(clientStats).filter(c => c.ordersCount > 0 || c.debt > 0)
    const providersList = Object.values(providerStats).filter(p => p.expensesCount > 0 || p.debt > 0)

    clientsList.sort((a, b) => b.billed - a.billed)
    const bestClient = clientsList[0] || null
    
    const clientsByDebt = [...clientsList].sort((a, b) => b.debt - a.debt)
    const worstClient = clientsByDebt[0] && clientsByDebt[0].debt > 0 ? clientsByDebt[0] : null

    providersList.sort((a, b) => b.purchased - a.purchased)
    const bestProvider = providersList[0] || null

    const providersByDebt = [...providersList].sort((a, b) => b.debt - a.debt)
    const worstProvider = providersByDebt[0] && providersByDebt[0].debt > 0 ? providersByDebt[0] : null

    return {
      kpis: { totalBilled, totalPaidClients, totalClientDebt, totalPurchased, totalPaidProviders, totalProviderDebt },
      bestClient, worstClient, bestProvider, worstProvider,
      rankedClients: clientsList.slice(0, 10),
      rankedProviders: providersList.slice(0, 10)
    }
  }, [orders, expenses, terceros])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-primary flex flex-col justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-[20px] text-primary">account_balance_wallet</span>
            <span className="text-xs font-bold uppercase tracking-wider">Facturado Clientes</span>
          </div>
          <p className="text-2xl font-mono font-bold text-white">{formatCurrency(metrics.kpis.totalBilled)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-[20px] text-emerald-500">payments</span>
            <span className="text-xs font-bold uppercase tracking-wider">Cobrado Clientes</span>
          </div>
          <p className="text-2xl font-mono font-bold text-white">{formatCurrency(metrics.kpis.totalPaidClients)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-error flex flex-col justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-[20px] text-error">warning</span>
            <span className="text-xs font-bold uppercase tracking-wider">Deuda Clientes</span>
          </div>
          <p className="text-2xl font-mono font-bold text-error">{formatCurrency(metrics.kpis.totalClientDebt)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-[20px] text-amber-500">local_shipping</span>
            <span className="text-xs font-bold uppercase tracking-wider">Deuda Proveedores</span>
          </div>
          <p className="text-2xl font-mono font-bold text-amber-500">{formatCurrency(metrics.kpis.totalProviderDebt)}</p>
        </Card>
      </div>

      {/* Podiums */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Podio Clientes */}
        <div className="space-y-4">
          <h3 className="text-title-md font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span>
            Análisis de Clientes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-amber-500/10">
                <span className="material-symbols-outlined text-[100px]">emoji_events</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-amber-500">star</span>
                  <span className="text-xs font-bold text-amber-500 uppercase">Mejor Cliente</span>
                </div>
                {metrics.bestClient ? (
                  <>
                    <p className="text-lg font-bold text-white truncate">{metrics.bestClient.name}</p>
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Facturado:</span>
                        <span className="font-mono text-white">{formatCurrency(metrics.bestClient.billed)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Pedidos:</span>
                        <span className="font-mono text-white">{metrics.bestClient.ordersCount}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Sin datos suficientes</p>
                )}
              </div>
            </Card>
            
            <Card className="border border-error/30 bg-error/5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-error/10">
                <span className="material-symbols-outlined text-[100px]">warning</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-error">trending_down</span>
                  <span className="text-xs font-bold text-error uppercase">Más Moroso</span>
                </div>
                {metrics.worstClient ? (
                  <>
                    <p className="text-lg font-bold text-white truncate">{metrics.worstClient.name}</p>
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Deuda:</span>
                        <span className="font-mono text-error font-bold">{formatCurrency(metrics.worstClient.debt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Morosidad:</span>
                        <span className="font-mono text-white">{((metrics.worstClient.debt / metrics.worstClient.billed) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Sin clientes morosos 🎉</p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Podio Proveedores */}
        <div className="space-y-4">
          <h3 className="text-title-md font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">local_shipping</span>
            Análisis de Proveedores
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border border-primary/30 bg-primary/5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-primary/10">
                <span className="material-symbols-outlined text-[100px]">workspace_premium</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary">verified</span>
                  <span className="text-xs font-bold text-primary uppercase">Principal Proveedor</span>
                </div>
                {metrics.bestProvider ? (
                  <>
                    <p className="text-lg font-bold text-white truncate">{metrics.bestProvider.name}</p>
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Comprado:</span>
                        <span className="font-mono text-white">{formatCurrency(metrics.bestProvider.purchased)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Compras:</span>
                        <span className="font-mono text-white">{metrics.bestProvider.expensesCount}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Sin datos suficientes</p>
                )}
              </div>
            </Card>
            
            <Card className="border border-error/30 bg-error/5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-error/10">
                <span className="material-symbols-outlined text-[100px]">money_off</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-error">assignment_late</span>
                  <span className="text-xs font-bold text-error uppercase">Mayor Deuda</span>
                </div>
                {metrics.worstProvider ? (
                  <>
                    <p className="text-lg font-bold text-white truncate">{metrics.worstProvider.name}</p>
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Por Pagar:</span>
                        <span className="font-mono text-error font-bold">{formatCurrency(metrics.worstProvider.debt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Morosidad:</span>
                        <span className="font-mono text-white">{((metrics.worstProvider.debt / metrics.worstProvider.purchased) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Sin deudas a proveedores 🎉</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-surface-container-high">
            <h4 className="font-bold text-white">Top 10 Clientes (Por Facturación)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-on-surface-variant text-xs font-mono uppercase">
                  <th className="p-3">#</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-right">Facturado</th>
                  <th className="p-3 text-right">Deuda</th>
                </tr>
              </thead>
              <tbody>
                {metrics.rankedClients.map((c, i) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-on-surface-variant">{i + 1}</td>
                    <td className="p-3 font-medium text-white truncate max-w-[150px]">{c.name}</td>
                    <td className="p-3 text-right font-mono text-primary">{formatCurrency(c.billed)}</td>
                    <td className="p-3 text-right font-mono">
                      <span className={c.debt > 0 ? 'text-error' : 'text-on-surface-variant'}>
                        {formatCurrency(c.debt)}
                      </span>
                    </td>
                  </tr>
                ))}
                {metrics.rankedClients.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-on-surface-variant">No hay datos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-surface-container-high">
            <h4 className="font-bold text-white">Top 10 Proveedores (Por Compras)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-on-surface-variant text-xs font-mono uppercase">
                  <th className="p-3">#</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Comprado</th>
                  <th className="p-3 text-right">Por Pagar</th>
                </tr>
              </thead>
              <tbody>
                {metrics.rankedProviders.map((p, i) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-on-surface-variant">{i + 1}</td>
                    <td className="p-3 font-medium text-white truncate max-w-[150px]">{p.name}</td>
                    <td className="p-3 text-right font-mono text-amber-500">{formatCurrency(p.purchased)}</td>
                    <td className="p-3 text-right font-mono">
                      <span className={p.debt > 0 ? 'text-error' : 'text-on-surface-variant'}>
                        {formatCurrency(p.debt)}
                      </span>
                    </td>
                  </tr>
                ))}
                {metrics.rankedProviders.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-on-surface-variant">No hay datos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}


const EMPTY_FORM = {
  name: '',
  role: 'cliente',
  client_type: 'otro',
  contact_person: '',
  phone: '',
  email: '',
  city: '',
  notes: '',
}

const clientTypeOptions = Object.entries(clientTypes).map(([value, label]) => ({ value, label }))

const providerTypeOptions = [
  { value: 'proveedor_materia_prima', label: 'Proveedor de Materia Prima' },
  { value: 'proveedor_insumos', label: 'Proveedor de Insumos' },
  { value: 'proveedor_servicios', label: 'Proveedor de Servicios' },
  { value: 'otro', label: 'Otro' }
]

const dependienteTypeOptions = [
  { value: 'dependiente', label: 'Empleado Interno / Dependiente' },
  { value: 'otro', label: 'Otro' }
]

export default function TercerosPage() {
  const { data: terceros, loading, error, create, update, remove } = useCRUD('terceros', {
    orderBy: 'name',
    orderAsc: true,
  })

  const [roleFilter, setRoleFilter] = useState('todos') // 'todos', 'cliente', 'proveedor', 'dependiente'
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})

  const filtered = useMemo(() => {
    let result = terceros
    if (roleFilter !== 'todos') {
      result = result.filter((t) => t.role === roleFilter)
    }
    if (!search) return result
    const q = search.toLowerCase()
    return result.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.contact_person?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    )
  }, [terceros, search, roleFilter])

  const openCreate = () => {
    setEditingItem(null)
    setForm({
      ...EMPTY_FORM,
      role: roleFilter === 'todos' ? 'cliente' : roleFilter,
      client_type: roleFilter === 'dependiente' ? 'dependiente' : 'otro'
    })
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditingItem(item)
    setForm({
      name: item.name || '',
      role: item.role || 'cliente',
      client_type: item.client_type || 'otro',
      contact_person: item.contact_person || '',
      phone: item.phone || '',
      email: item.email || '',
      city: item.city || '',
      notes: item.notes || '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Requerido'
    if (!form.role) errs.role = 'Requerido'
    if (!form.client_type) errs.client_type = 'Requerido'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Correo no válido'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role,
        client_type: form.client_type,
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
      }

      if (editingItem) {
        await update(editingItem.id, payload)
      } else {
        await create(payload)
      }
      setModalOpen(false)
    } catch (err) {
      console.error('Error saving tercero:', err)
      setErrors({ _general: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
    } catch (err) {
      console.error('Error deleting tercero:', err)
    }
    setDeleteTarget(null)
  }

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'role') {
        // Reset client_type depending on role
        next.client_type = value === 'dependiente' ? 'dependiente' : 'otro'
      }
      return next
    })
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="animate-fade-in space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-error-container/10 border border-error text-error text-sm">
          <div className="flex items-center gap-2 font-bold mb-1">
            <span className="material-symbols-outlined text-[20px]">warning</span>
            Error de base de datos
          </div>
          <p className="text-xs text-on-surface-variant font-mono">
            {error}
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Asegúrate de haber ejecutado el script SQL de migración en la consola de Supabase.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">Terceros (Clientes y Proveedores)</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Gestiona la base de datos unificada de clientes y proveedores.
          </p>
        </div>
        <Button onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Registro
        </Button>
      </div>

      {/* Filtros de Rol */}
      <div className="flex flex-wrap gap-2 bg-surface-container/30 p-1 rounded-xl border border-white/5 w-fit">
        {[
          { id: 'resumen', label: 'Resumen', icon: 'analytics' },
          { id: 'todos', label: 'Todos', icon: 'groups' },
          { id: 'cliente', label: 'Clientes', icon: 'person' },
          { id: 'proveedor', label: 'Proveedores', icon: 'local_shipping' },
          { id: 'dependiente', label: 'Dependientes', icon: 'badge' }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setRoleFilter(filter.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              roleFilter === filter.id 
                ? 'bg-primary/10 text-primary border border-primary/20' 
                : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{filter.icon}</span>
            {filter.label}
          </button>
        ))}
      </div>

      {roleFilter === 'resumen' ? (
        <ResumenDashboard terceros={terceros} />
      ) : (
        <>
          {/* Search */}
      <div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, contacto o ciudad..."
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="group"
          title="Sin registros"
          message={search ? 'No se encontraron registros con esa búsqueda.' : 'Agrega tu primer cliente o proveedor para comenzar.'}
          action={!search && (
            <Button onClick={openCreate}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Agregar Registro
            </Button>
          )}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full zebra-table">
              <thead>
                <tr className="bg-surface-container-high">
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Nombre</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Rol</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Tipo</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Contacto</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Teléfono</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Ciudad</th>
                  <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-outline-variant/30">
                    <td className="px-4 py-3 text-sm text-on-surface font-medium">
                      <div>
                        {c.name}
                        {c.email && (
                          <p className="text-xs text-on-surface-variant mt-0.5">{c.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        c.role === 'proveedor' 
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                          : c.role === 'dependiente'
                            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {c.role === 'proveedor' ? 'local_shipping' : c.role === 'dependiente' ? 'badge' : 'person'}
                        </span>
                        {c.role === 'proveedor' ? 'Proveedor' : c.role === 'dependiente' ? 'Dependiente' : 'Cliente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="status-badge bg-surface-container-high text-on-surface-variant">
                        {terceroTypes[c.client_type] || c.client_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">
                      {c.contact_person || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-on-surface-variant">
                      {c.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">
                      {c.city || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="p-1.5 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-outline-variant/30 text-xs text-on-surface-variant font-mono">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </div>
        </Card>
      )}
      </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Editar Registro' : 'Nuevo Registro'}
        size="lg"
      >
        <div className="space-y-4">
          {errors._general && (
            <div className="p-3 rounded-lg bg-error-container/10 border border-error text-error text-sm">
              {errors._general}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre o Razón Social"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Ej: Comercializadora Boliviana S.A. o Juan Pérez"
              error={errors.name}
              className="sm:col-span-2"
            />

             <Select
              label="Rol"
              options={[
                { value: 'cliente', label: 'Cliente' },
                { value: 'proveedor', label: 'Proveedor' },
                { value: 'dependiente', label: 'Dependiente (Empleado)' }
              ]}
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
              error={errors.role}
            />

            <Select
              label="Tipo / Rubro"
              options={
                form.role === 'proveedor' 
                  ? providerTypeOptions 
                  : form.role === 'dependiente'
                    ? dependienteTypeOptions
                    : clientTypeOptions
              }
              value={form.client_type}
              onChange={(e) => updateField('client_type', e.target.value)}
              placeholder="Seleccionar..."
              error={errors.client_type}
            />

            <Input
              label="Persona de contacto"
              value={form.contact_person}
              onChange={(e) => updateField('contact_person', e.target.value)}
              placeholder="Nombre del contacto"
            />

            <Input
              label="Teléfono"
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="Ej: 70012345"
            />

            <Input
              label="Correo electrónico"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="correo@ejemplo.com"
              error={errors.email}
            />

            <Input
              label="Ciudad"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="Ej: Santa Cruz"
            />
          </div>

          <Textarea
            label="Notas"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Observaciones, ID / NIT, datos de facturación..."
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {editingItem ? 'Actualizar' : 'Guardar'}
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Registro"
        message={`¿Estás seguro de que deseas eliminar a "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  )
}
