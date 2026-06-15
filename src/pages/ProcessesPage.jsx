import { useState, useMemo } from 'react'
import { useCRUD } from '@/hooks/useCRUD'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, SearchInput, LoadingSpinner, EmptyState,
} from '@/components/ui/index.jsx'
import { formatCurrency, processCategories } from '@/lib/formatters'

const EMPTY_FORM = {
  name: '',
  cost_type: '',
  cost: '',
  avg_time_minutes: '',
  notes: '',
}

const costTypeOptions = Object.entries(processCategories).map(([value, label]) => ({ value, label }))

const COST_SUFFIXES = {
  por_hora: 'Bs/hr',
  por_unidad: 'Bs/u',
  fijo_por_pedido: 'Bs',
}

export default function ProcessesPage() {
  const { data: processes, loading, create, update, remove } = useCRUD('processes', {
    orderBy: 'name',
    orderAsc: true,
  })

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})

  const filtered = useMemo(() => {
    if (!search) return processes
    const q = search.toLowerCase()
    return processes.filter((p) => p.name?.toLowerCase().includes(q))
  }, [processes, search])

  const openCreate = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditingItem(item)
    setForm({
      name: item.name || '',
      cost_type: item.cost_type || '',
      cost: item.cost ?? '',
      avg_time_minutes: item.avg_time_minutes ?? '',
      notes: item.notes || '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Requerido'
    if (!form.cost_type) errs.cost_type = 'Requerido'
    if (!form.cost || parseFloat(form.cost) < 0) errs.cost = 'Debe ser un valor válido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        cost_type: form.cost_type,
        cost: parseFloat(form.cost) || 0,
        avg_time_minutes: form.avg_time_minutes ? parseFloat(form.avg_time_minutes) : null,
        notes: form.notes.trim() || null,
      }

      if (editingItem) {
        await update(editingItem.id, payload)
      } else {
        await create(payload)
      }
      setModalOpen(false)
    } catch (err) {
      console.error('Error saving process:', err)
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
      console.error('Error deleting process:', err)
    }
    setDeleteTarget(null)
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const formatCostDisplay = (cost, costType) => {
    const suffix = COST_SUFFIXES[costType] || 'Bs'
    return `${formatCurrency(cost).replace('Bs ', '')} ${suffix}`
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">Procesos</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Define los procesos de producción y sus costos
          </p>
        </div>
        <Button onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Proceso
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre..."
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="manufacturing"
          title="Sin procesos"
          message={search ? 'No se encontraron procesos con esa búsqueda.' : 'Agrega tu primer proceso de producción.'}
          action={!search && (
            <Button onClick={openCreate}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Agregar Proceso
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
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Tipo de Costo</th>
                  <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Costo</th>
                  <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Tiempo Prom.</th>
                  <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-outline-variant/30">
                    <td className="px-4 py-3 text-sm text-on-surface font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">
                      <span className="status-badge bg-surface-container-high text-on-surface-variant">
                        {processCategories[p.cost_type] || p.cost_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-on-surface">
                      {formatCostDisplay(p.cost, p.cost_type)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-on-surface-variant">
                      {p.avg_time_minutes != null ? `${p.avg_time_minutes} min` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
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
            {filtered.length} proceso{filtered.length !== 1 ? 's' : ''}
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Editar Proceso' : 'Nuevo Proceso'}
      >
        <div className="space-y-4">
          {errors._general && (
            <div className="p-3 rounded-lg bg-error-container/10 border border-error text-error text-sm">
              {errors._general}
            </div>
          )}

          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Ej: Corte láser"
            error={errors.name}
          />

          <Select
            label="Tipo de costo"
            options={costTypeOptions}
            value={form.cost_type}
            onChange={(e) => updateField('cost_type', e.target.value)}
            placeholder="Seleccionar..."
            error={errors.cost_type}
          />

          <Input
            label="Costo"
            type="number"
            step="1"
            min="0"
            value={form.cost}
            onChange={(e) => updateField('cost', e.target.value)}
            placeholder="0.00"
            suffix={COST_SUFFIXES[form.cost_type] || 'Bs'}
            error={errors.cost}
          />

          <Input
            label="Tiempo promedio"
            type="number"
            step="1"
            min="0"
            value={form.avg_time_minutes}
            onChange={(e) => updateField('avg_time_minutes', e.target.value)}
            placeholder="Ej: 15"
            suffix="min"
          />

          <Textarea
            label="Notas"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Observaciones adicionales..."
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
                  {editingItem ? 'Actualizar' : 'Crear Proceso'}
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
        title="Eliminar Proceso"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  )
}
