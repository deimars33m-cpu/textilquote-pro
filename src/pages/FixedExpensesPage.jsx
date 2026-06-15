import { useState, useMemo } from 'react'
import { useCRUD } from '@/hooks/useCRUD'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, SearchInput, LoadingSpinner, EmptyState, Toggle,
} from '@/components/ui/index.jsx'
import {
  formatCurrency, expenseCategories, expenseFrequencies,
} from '@/lib/formatters'
import { toMonthlyAmount, calcTotalMonthlyExpenses } from '@/lib/calculations'

const EMPTY_FORM = {
  name: '',
  category: '',
  amount: '',
  frequency: '',
  is_active: true,
  notes: '',
}

const categoryOptions = Object.entries(expenseCategories).map(([value, label]) => ({ value, label }))
const frequencyOptions = Object.entries(expenseFrequencies).map(([value, label]) => ({ value, label }))

export default function FixedExpensesPage() {
  const { data: expenses, loading, create, update, remove } = useCRUD('fixed_expenses', {
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

  const totalMonthly = useMemo(() => calcTotalMonthlyExpenses(expenses), [expenses])

  const filtered = useMemo(() => {
    if (!search) return expenses
    const q = search.toLowerCase()
    return expenses.filter((e) => e.name?.toLowerCase().includes(q))
  }, [expenses, search])

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
      category: item.category || '',
      amount: item.amount ?? '',
      frequency: item.frequency || '',
      is_active: item.is_active ?? true,
      notes: item.notes || '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Requerido'
    if (!form.category) errs.category = 'Requerido'
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = 'Debe ser mayor a 0'
    if (!form.frequency) errs.frequency = 'Requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        frequency: form.frequency,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      }

      if (editingItem) {
        await update(editingItem.id, payload)
      } else {
        await create(payload)
      }
      setModalOpen(false)
    } catch (err) {
      console.error('Error saving expense:', err)
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
      console.error('Error deleting expense:', err)
    }
    setDeleteTarget(null)
  }

  const handleToggleActive = async (item) => {
    try {
      await update(item.id, { is_active: !item.is_active })
    } catch (err) {
      console.error('Error toggling active:', err)
    }
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">Gastos Fijos</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Administra los gastos fijos mensuales de tu negocio
          </p>
        </div>
        <Button onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo Gasto
        </Button>
      </div>

      {/* Total Monthly Card */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[24px]">account_balance</span>
          </div>
          <div>
            <p className="font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">
              Total Mensual
            </p>
            <p className="text-headline-md font-bold font-mono text-primary">
              {formatCurrency(totalMonthly)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-on-surface-variant">
              {expenses.filter((e) => e.is_active).length} gasto{expenses.filter((e) => e.is_active).length !== 1 ? 's' : ''} activo{expenses.filter((e) => e.is_active).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </Card>

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
          icon="receipt_long"
          title="Sin gastos fijos"
          message={search ? 'No se encontraron gastos con esa búsqueda.' : 'Agrega tus gastos fijos mensuales para un cálculo de costos preciso.'}
          action={!search && (
            <Button onClick={openCreate}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Agregar Gasto
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
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Categoría</th>
                  <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Monto</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Frecuencia</th>
                  <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Equiv. Mensual</th>
                  <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Activo</th>
                  <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const monthly = toMonthlyAmount(e.amount, e.frequency)
                  return (
                    <tr key={e.id} className={`border-t border-outline-variant/30 ${!e.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 text-sm text-on-surface font-medium">{e.name}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">
                        {expenseCategories[e.category] || e.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-on-surface">
                        {formatCurrency(e.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">
                        {expenseFrequencies[e.frequency] || e.frequency}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-primary">
                        {formatCurrency(monthly)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Toggle
                            checked={e.is_active}
                            onChange={() => handleToggleActive(e)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(e)}
                            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(e)}
                            className="p-1.5 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            title="Eliminar"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-outline-variant/30 text-xs text-on-surface-variant font-mono">
            {filtered.length} gasto{filtered.length !== 1 ? 's' : ''} fijo{filtered.length !== 1 ? 's' : ''}
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
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
            placeholder="Ej: Alquiler de taller"
            error={errors.name}
          />

          <Select
            label="Categoría"
            options={categoryOptions}
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            placeholder="Seleccionar..."
            error={errors.category}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Monto"
              type="number"
              step="1"
              min="0"
              value={form.amount}
              onChange={(e) => updateField('amount', e.target.value)}
              placeholder="0.00"
              suffix="Bs"
              error={errors.amount}
            />

            <Select
              label="Frecuencia"
              options={frequencyOptions}
              value={form.frequency}
              onChange={(e) => updateField('frequency', e.target.value)}
              placeholder="Seleccionar..."
              error={errors.frequency}
            />
          </div>

          {form.amount && form.frequency && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-on-surface-variant">Equivalente mensual:</p>
              <p className="font-mono font-bold text-primary">
                {formatCurrency(toMonthlyAmount(parseFloat(form.amount) || 0, form.frequency))}
              </p>
            </div>
          )}

          <Toggle
            checked={form.is_active}
            onChange={(val) => updateField('is_active', val)}
            label="Gasto activo"
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
                  {editingItem ? 'Actualizar' : 'Crear Gasto'}
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
        title="Eliminar Gasto Fijo"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  )
}
