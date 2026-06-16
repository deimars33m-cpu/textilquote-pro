import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRUD } from '@/hooks/useCRUD'
import { useCategories } from '@/context/CategoryContext'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, SearchInput, LoadingSpinner, EmptyState, Toggle,
} from '@/components/ui/index.jsx'
import ProductCategoriesModal from '@/components/materials/ProductCategoriesModal'

const EMPTY_FORM = {
  name: '',
  category: '',
  description: '',
  suggested_margin: '',
  is_active: true,
}

export default function ProductTemplatesPage() {
  const navigate = useNavigate()
  const { data: templates, loading: loadingTemplates, create, update, remove } = useCRUD('product_templates', {
    orderBy: 'name',
    orderAsc: true,
  })
  const { productCategories, productCategoryMap, loading: loadingCategories } = useCategories()

  const getCategoryIcon = (categoryCode, name = '') => {
    const code = (categoryCode || '').toLowerCase()
    const n = (name || '').toLowerCase()
    if (code.includes('deport') || n.includes('deport')) return 'sports_soccer'
    if (code.includes('instit') || code.includes('corp') || code.includes('indus') || n.includes('instit') || n.includes('corp') || n.includes('indus')) return 'badge'
    if (code.includes('mochila') || code.includes('bolso') || code.includes('malet') || n.includes('mochila') || n.includes('bolso') || n.includes('malet')) return 'backpack'
    if (code.includes('escolar') || n.includes('escolar') || n.includes('colegio')) return 'school'
    if (code.includes('chamarra') || code.includes('exterior') || code.includes('abrigo') || code.includes('casaca') || n.includes('chamarra') || n.includes('exterior') || n.includes('abrigo') || n.includes('casaca')) return 'dry_cleaning'
    if (code.includes('camisa') || code.includes('polera') || code.includes('polo') || n.includes('camisa') || n.includes('polera') || n.includes('polo')) return 'checkroom'
    return 'category' // Default fallback icon
  }

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [productCategoriesModalOpen, setProductCategoriesModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})

  const categoryOptions = useMemo(() => {
    return productCategories.map(cat => ({ value: cat.code, label: cat.name }))
  }, [productCategories])

  const filtered = useMemo(() => {
    if (!search) return templates
    const q = search.toLowerCase()
    return templates.filter((t) => t.name?.toLowerCase().includes(q))
  }, [templates, search])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category || null,
        description: form.description.trim() || null,
        suggested_margin: form.suggested_margin ? parseFloat(form.suggested_margin) : null,
        is_active: form.is_active,
        is_clothing: false,
        size_multipliers: null,
      }
      await create(payload)
      setModalOpen(false)
    } catch (err) {
      console.error('Error creating template:', err)
      setErrors({ _general: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (template) => {
    try {
      await update(template.id, { is_active: !template.is_active })
    } catch (err) {
      console.error('Error toggling template:', err)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
    } catch (err) {
      console.error('Error deleting template:', err)
    }
    setDeleteTarget(null)
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (loadingTemplates || loadingCategories) return <LoadingSpinner />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">Plantillas de Producto</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Crea plantillas reutilizables para agilizar tus cotizaciones
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setProductCategoriesModalOpen(true)}>
            <span className="material-symbols-outlined text-[18px]">category</span>
            Gestionar Categorías
          </Button>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nueva Plantilla
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre..."
        />
      </div>

      {/* Card Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="dashboard_customize"
          title="Sin plantillas"
          message={search ? 'No se encontraron plantillas con esa búsqueda.' : 'Crea tu primera plantilla de producto para reutilizarla en cotizaciones.'}
          action={!search && (
            <Button onClick={openCreate}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Crear Plantilla
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <Card
              key={t.id}
              className={`p-4 cursor-pointer hover:border-primary hover:bg-surface-container-high transition-all duration-200 group flex flex-col items-center relative ${
                !t.is_active ? 'opacity-50' : ''
              }`}
              onClick={() => navigate(`/templates/${t.id}`)}
            >
              {/* Card Actions Header */}
              <div className="w-full flex justify-end items-center mb-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <Toggle
                    checked={t.is_active}
                    onChange={() => handleToggleActive(t)}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(t) }}
                    className="p-1 rounded hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Square Icon Container (Stitch design, x3 larger) */}
              <div className="w-24 h-24 bg-surface-container-low group-hover:bg-primary/20 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 shadow-inner">
                <span className="material-symbols-outlined text-primary group-hover:scale-105 transition-transform" style={{ fontSize: '80px' }}>
                  {getCategoryIcon(t.category, t.name)}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-body-md font-bold text-on-surface group-hover:text-primary transition-colors text-center mb-1 line-clamp-1 w-full px-1">
                {t.name}
              </h3>

              {/* Category under Title */}
              <div className="mb-3">
                {t.category ? (
                  <span className="status-badge bg-surface-container-high text-[10px] px-2 py-0.5 rounded text-on-surface-variant font-medium">
                    {productCategoryMap[t.category] || t.category}
                  </span>
                ) : (
                  <span className="status-badge bg-surface-container-high/30 text-[10px] px-2 py-0.5 rounded text-on-surface-variant/40">
                    Sin Categoría
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-on-surface-variant line-clamp-2 h-8 w-full mb-3 text-center px-1 font-normal leading-relaxed">
                {t.description || 'Sin descripción.'}
              </p>

              {/* Footer Row */}
              <div className="mt-auto w-full flex justify-between items-center border-t border-outline-variant pt-2.5">
                <div className="flex items-center gap-1 font-mono text-[10px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  <span>
                    {t.suggested_margin != null ? `${t.suggested_margin}%` : '—'} margen
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-[18px] group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva Plantilla"
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
            placeholder="Ej: Polera Sublimada Estándar"
            error={errors.name}
          />

          <Select
            label="Categoría"
            options={categoryOptions}
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
            placeholder="Seleccionar (opcional)..."
          />

          <Input
            label="Margen sugerido"
            type="number"
            step="1"
            min="0"
            max="100"
            value={form.suggested_margin}
            onChange={(e) => updateField('suggested_margin', e.target.value)}
            placeholder="30"
            suffix="%"
          />

          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Descripción del producto..."
          />

          <Toggle
            checked={form.is_active}
            onChange={(val) => updateField('is_active', val)}
            label="Plantilla activa"
          />



          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Crear Plantilla
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
        title="Eliminar Plantilla"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Se eliminarán también sus materiales y procesos asociados.`}
      />

      {/* Product Categories Modal */}
      <ProductCategoriesModal
        isOpen={productCategoriesModalOpen}
        onClose={() => setProductCategoriesModalOpen(false)}
        templates={templates}
      />
    </div>
  )
}
