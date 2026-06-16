import { useState, useMemo } from 'react'
import { useCRUD } from '@/hooks/useCRUD'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, SearchInput, LoadingSpinner, EmptyState,
} from '@/components/ui/index.jsx'
import { clientTypes, terceroTypes } from '@/lib/formatters'

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

export default function TercerosPage() {
  const { data: terceros, loading, error, create, update, remove } = useCRUD('terceros', {
    orderBy: 'name',
    orderAsc: true,
  })

  const [roleFilter, setRoleFilter] = useState('todos') // 'todos', 'cliente', 'proveedor'
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
      role: roleFilter === 'todos' ? 'cliente' : roleFilter
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
        // Reset client_type to default if changing role
        next.client_type = 'otro'
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
      <div className="flex gap-2 bg-surface-container/30 p-1 rounded-xl border border-white/5 w-fit">
        {[
          { id: 'todos', label: 'Todos', icon: 'groups' },
          { id: 'cliente', label: 'Clientes', icon: 'person' },
          { id: 'proveedor', label: 'Proveedores', icon: 'local_shipping' }
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
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {c.role === 'proveedor' ? 'local_shipping' : 'person'}
                        </span>
                        {c.role === 'proveedor' ? 'Proveedor' : 'Cliente'}
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
                { value: 'proveedor', label: 'Proveedor' }
              ]}
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
              error={errors.role}
            />

            <Select
              label="Tipo / Rubro"
              options={form.role === 'proveedor' ? providerTypeOptions : clientTypeOptions}
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
