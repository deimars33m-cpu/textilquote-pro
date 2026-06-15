import { useState, useMemo } from 'react'
import { useCRUD } from '@/hooks/useCRUD'
import { useCategories } from '@/context/CategoryContext'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, SearchInput, LoadingSpinner, EmptyState, Toggle,
} from '@/components/ui/index.jsx'
import MaterialCategoriesModal from '@/components/materials/MaterialCategoriesModal'
import {
  formatCurrency, formatDate, isPriceOutdated,
  usageUnits, purchaseUnits, getCategoryColor,
} from '@/lib/formatters'

const EMPTY_FORM = {
  name: '',
  category: '',
  usage_unit: '',
  unit_price: '',
  purchase_quantity: '',
  purchase_unit: '',
  purchase_price: '',
  price_updated_at: new Date().toISOString().split('T')[0],
  default_waste_pct: '',
  current_stock: '',
  min_stock: '',
  notes: '',
}

const usageUnitOptions = Object.entries(usageUnits).map(([value, label]) => ({ value, label }))
const purchaseUnitOptions = Object.entries(purchaseUnits).map(([value, label]) => ({ value, label }))

export default function MaterialsPage() {
  const { data: materials, loading: loadingMaterials, create, update, remove } = useCRUD('materials', {
    orderBy: 'name',
    orderAsc: true,
  })
  const { categories, categoryMap, loading: loadingCategories } = useCategories()

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})

  const categoryOptions = useMemo(() => {
    return categories.map(cat => ({ value: cat.code, label: cat.name }))
  }, [categories])

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch = !search || m.name?.toLowerCase().includes(search.toLowerCase())
      const matchCategory = !filterCategory || m.category === filterCategory
      return matchSearch && matchCategory
    })
  }, [materials, search, filterCategory])

  const groupedMaterials = useMemo(() => {
    const groups = {}
    for (const m of filtered) {
      const cat = m.category || 'otro'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(m)
    }

    const sortedCats = Object.keys(groups).sort((a, b) => {
      const nameA = categoryMap[a] || a
      const nameB = categoryMap[b] || b
      return nameA.localeCompare(nameB)
    })

    return sortedCats.map(cat => ({
      category: cat,
      categoryName: categoryMap[cat] || cat,
      items: groups[cat]
    }))
  }, [filtered, categoryMap])

  const openCreate = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (item) => {
    const unitPrice = parseFloat(item.unit_price) || 0
    const purchaseQty = parseFloat(item.purchase_quantity) || 0
    const purchasePrice = (unitPrice && purchaseQty) ? (unitPrice * purchaseQty).toFixed(2) : ''

    setEditingItem(item)
    setForm({
      name: item.name || '',
      category: item.category || '',
      usage_unit: item.usage_unit || '',
      unit_price: item.unit_price ?? '',
      purchase_quantity: item.purchase_quantity ?? '',
      purchase_unit: item.purchase_unit || '',
      purchase_price: purchasePrice,
      price_updated_at: item.price_updated_at ? item.price_updated_at.split('T')[0] : '',
      default_waste_pct: item.default_waste_pct ?? '',
      current_stock: item.current_stock ?? '',
      min_stock: item.min_stock ?? '',
      notes: item.notes || '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Requerido'
    if (!form.category) errs.category = 'Requerido'
    if (!form.usage_unit) errs.usage_unit = 'Requerido'
    if (!form.unit_price || parseFloat(form.unit_price) <= 0) errs.unit_price = 'Debe ser mayor a 0'
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
        usage_unit: form.usage_unit,
        unit_price: parseFloat(form.unit_price) || 0,
        purchase_quantity: form.purchase_quantity ? parseFloat(form.purchase_quantity) : null,
        purchase_unit: form.purchase_unit || null,
        price_updated_at: form.price_updated_at || new Date().toISOString().split('T')[0],
        default_waste_pct: form.default_waste_pct ? parseFloat(form.default_waste_pct) : 0,
        current_stock: form.current_stock ? parseFloat(form.current_stock) : null,
        min_stock: form.min_stock ? parseFloat(form.min_stock) : null,
        notes: form.notes.trim() || null,
      }

      if (editingItem) {
        await update(editingItem.id, payload)
      } else {
        await create(payload)
      }
      setModalOpen(false)
    } catch (err) {
      console.error('Error saving material:', err)
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
      console.error('Error deleting material:', err)
    }
    setDeleteTarget(null)
  }

  const updateField = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }

      // Bi-directional calculations:
      if (field === 'purchase_price') {
        const pPrice = parseFloat(value) || 0
        const pQty = parseFloat(prev.purchase_quantity) || 0
        if (pQty > 0) {
          updated.unit_price = (pPrice / pQty).toFixed(4)
        }
      } else if (field === 'purchase_quantity') {
        const pQty = parseFloat(value) || 0
        const pPrice = parseFloat(prev.purchase_price) || 0
        const uPrice = parseFloat(prev.unit_price) || 0
        if (pQty > 0) {
          if (pPrice > 0) {
            updated.unit_price = (pPrice / pQty).toFixed(4)
          } else if (uPrice > 0) {
            updated.purchase_price = (uPrice * pQty).toFixed(2)
          }
        }
      } else if (field === 'unit_price') {
        const uPrice = parseFloat(value) || 0
        const pQty = parseFloat(prev.purchase_quantity) || 0
        if (pQty > 0) {
          updated.purchase_price = (uPrice * pQty).toFixed(2)
        }
      }

      return updated
    })
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (loadingMaterials || loadingCategories) return <LoadingSpinner />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">Materiales</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Gestiona los materiales e insumos de tu taller
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setCategoriesModalOpen(true)}>
            <span className="material-symbols-outlined text-[18px]">category</span>
            Gestionar Categorías
          </Button>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nuevo Material
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre..."
        />
        <Select
          options={categoryOptions}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          placeholder="Todas las categorías"
          className="w-full sm:w-48"
        />
      </div>

      {/* Grouped Tables by Category */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="Sin materiales"
          message={search || filterCategory ? 'No se encontraron materiales con esos filtros.' : 'Agrega tu primer material para comenzar.'}
          action={!search && !filterCategory && (
            <Button onClick={openCreate}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Agregar Material
            </Button>
          )}
        />
      ) : (
        <div className="space-y-6">
          {groupedMaterials.map((group) => {
            const color = getCategoryColor(group.categoryName)
            return (
              <Card key={group.category} className="p-0 overflow-hidden border border-outline-variant/30">
                <div className={`px-4 py-2.5 rounded-t-xl font-bold flex items-center justify-between border-b ${color.bg} ${color.border}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.hex }}></span>
                    <span className="text-sm uppercase tracking-wider font-mono font-bold">{group.categoryName}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${color.badge}`}>
                    {group.items.length} material{group.items.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full zebra-table">
                    <thead>
                      <tr className="bg-surface-container-high/40">
                        <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Nombre</th>
                        <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Unidad</th>
                        <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Precio Unit.</th>
                        <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Merma %</th>
                        <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Última Actualización</th>
                        <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((m) => {
                        const outdated = isPriceOutdated(m.price_updated_at)
                        return (
                          <tr key={m.id} className="border-t border-outline-variant/30">
                            <td className="px-4 py-3 text-sm text-on-surface font-medium">
                              <div className="flex items-center gap-2">
                                {m.name}
                                {outdated && (
                                  <span className="material-symbols-outlined text-primary text-[16px]" title="Precio desactualizado (>30 días)">
                                    warning
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-on-surface-variant">
                              {usageUnits[m.usage_unit] || m.usage_unit}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-on-surface font-bold">
                              {formatCurrency(m.unit_price)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-on-surface-variant">
                              {m.default_waste_pct ?? 0}%
                            </td>
                            <td className={`px-4 py-3 text-sm ${outdated ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                              {formatDate(m.price_updated_at)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEdit(m)}
                                  className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                                  title="Editar"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(m)}
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
              </Card>
            )
          })}
          <div className="text-right text-xs text-on-surface-variant font-mono mt-2 pr-2">
            Total filtrados: {filtered.length} material{filtered.length !== 1 ? 'es' : ''}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Editar Material' : 'Nuevo Material'}
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
              label="Nombre"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Ej: Tela Dry-Fit"
              error={errors.name}
              className="sm:col-span-2"
            />

            <Select
              label="Categoría"
              options={categoryOptions}
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              placeholder="Seleccionar..."
              error={errors.category}
            />

            <Select
              label="Unidad de uso"
              options={usageUnitOptions}
              value={form.usage_unit}
              onChange={(e) => updateField('usage_unit', e.target.value)}
              placeholder="Seleccionar..."
              error={errors.usage_unit}
            />
          </div>

          {/* Calculadora de Compra por Mayor */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <span className="material-symbols-outlined text-[20px]">calculate</span>
                <span className="text-sm font-bold uppercase tracking-wider font-mono">Calculadora de Compra por Mayor</span>
              </div>
              <span className="text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                Opcional
              </span>
            </div>
            
            <p className="text-xs text-on-surface-variant leading-relaxed">
              ¿Compras este material en rollos, paquetes o cajas? Llena estos campos y el sistema calculará automáticamente el precio unitario.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Unidad de compra"
                options={purchaseUnitOptions}
                value={form.purchase_unit}
                onChange={(e) => updateField('purchase_unit', e.target.value)}
                placeholder="Ej: Rollo, Paquete..."
              />

              <Input
                label={
                  form.purchase_unit && form.usage_unit
                    ? `Cant. de ${usageUnits[form.usage_unit]?.toLowerCase() || form.usage_unit}s por ${purchaseUnits[form.purchase_unit]?.toLowerCase() || form.purchase_unit}`
                    : "Cantidad de contenido"
                }
                type="number"
                step="any"
                min="0"
                value={form.purchase_quantity}
                onChange={(e) => updateField('purchase_quantity', e.target.value)}
                placeholder="Ej: 50"
              />

              <Input
                label="Costo total de compra"
                type="number"
                step="any"
                min="0"
                value={form.purchase_price}
                onChange={(e) => updateField('purchase_price', e.target.value)}
                placeholder="Ej: 500"
                suffix="Bs"
              />
            </div>

            {form.purchase_quantity && form.purchase_price && form.purchase_unit && form.usage_unit && (
              <div className="p-3 rounded-lg bg-primary-container/10 border border-primary/20 text-on-surface text-sm flex items-start gap-2.5 animate-fade-in font-sans mt-2">
                <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">info</span>
                <div>
                  <p className="font-semibold text-primary text-xs uppercase tracking-wider font-mono">Resultado del cálculo:</p>
                  <p className="text-on-surface-variant mt-0.5 text-xs">
                    1 {purchaseUnits[form.purchase_unit]?.toLowerCase() || form.purchase_unit} de material contiene{' '}
                    <strong className="text-on-surface font-mono">{form.purchase_quantity}</strong>{' '}
                    {usageUnits[form.usage_unit]?.toLowerCase() || form.usage_unit}(s).
                    Al costar <strong className="text-on-surface font-mono">{formatCurrency(parseFloat(form.purchase_price))}</strong>,
                    el precio unitario es:{' '}
                    <strong className="text-primary font-mono font-bold text-sm bg-primary/10 px-1.5 py-0.5 rounded">
                      {formatCurrency(parseFloat(form.unit_price))}
                    </strong>{' '}
                    por {usageUnits[form.usage_unit]?.toLowerCase() || form.usage_unit}.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Precio unitario final"
              type="number"
              step="any"
              min="0"
              value={form.unit_price}
              onChange={(e) => updateField('unit_price', e.target.value)}
              placeholder="0.00"
              suffix="Bs"
              error={errors.unit_price}
              className="font-bold text-primary"
            />

            <Input
              label="Merma por defecto"
              type="number"
              step="1"
              min="0"
              max="100"
              value={form.default_waste_pct}
              onChange={(e) => updateField('default_waste_pct', e.target.value)}
              placeholder="0"
              suffix="%"
            />

            <Input
              label="Fecha de actualización"
              type="date"
              value={form.price_updated_at}
              onChange={(e) => updateField('price_updated_at', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Stock actual"
                type="number"
                step="1"
                min="0"
                value={form.current_stock}
                onChange={(e) => updateField('current_stock', e.target.value)}
                placeholder="Opcional"
              />

              <Input
                label="Stock mínimo"
                type="number"
                step="1"
                min="0"
                value={form.min_stock}
                onChange={(e) => updateField('min_stock', e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

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
                  {editingItem ? 'Actualizar' : 'Crear Material'}
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
        title="Eliminar Material"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
      />

      {/* Categories Modal */}
      <MaterialCategoriesModal
        isOpen={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        materials={materials}
      />
    </div>
  )
}
