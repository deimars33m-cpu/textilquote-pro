import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useCategories } from '@/context/CategoryContext'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, LoadingSpinner, EmptyState, AlertBanner, Toggle
} from '@/components/ui/index.jsx'
import {
  formatCurrency, usageUnits,
} from '@/lib/formatters'

export default function TemplateDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { productCategories, productCategoryMap, categoryMap } = useCategories()

  // Template state
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editErrors, setEditErrors] = useState({})

  // Materials state
  const [templateMaterials, setTemplateMaterials] = useState([])
  const [allMaterials, setAllMaterials] = useState([])
  const [materialSaving, setMaterialSaving] = useState(false)

  // Processes state
  const [templateProcesses, setTemplateProcesses] = useState([])
  const [allProcesses, setAllProcesses] = useState([])

  const groupedMaterialOptions = useMemo(() => {
    const groups = {}
    for (const m of allMaterials) {
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
      label: categoryMap[cat] || cat,
      options: groups[cat].map(m => ({
        value: m.id,
        label: `${m.name} — ${formatCurrency(m.unit_price)}/${usageUnits[m.usage_unit] || m.usage_unit}`
      }))
    }))
  }, [allMaterials, categoryMap])
  const [processSaving, setProcessSaving] = useState(false)

  // Embellishments state
  const [templateEmbellishments, setTemplateEmbellishments] = useState([])
  const [embellishmentSaving, setEmbellishmentSaving] = useState(false)

  // Unsaved changes state
  const [isDirty, setIsDirty] = useState(false)
  const [savingChanges, setSavingChanges] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)

  const categoryOptions = useMemo(() => {
    return productCategories.map(cat => ({ value: cat.code, label: cat.name }))
  }, [productCategories])

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Fetch template ──
  const fetchTemplate = useCallback(async () => {
    if (!user || !id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setTemplate(data)
    } catch (err) {
      console.error('Error fetching template:', err)
      setTemplate(null)
    } finally {
      setLoading(false)
    }
  }, [id, user])

  // ── Fetch template materials ──
  const fetchTemplateMaterials = useCallback(async () => {
    if (!user || !id) return
    try {
      const { data, error } = await supabase
        .from('product_template_materials')
        .select('*, materials(id, name, unit_price, usage_unit, default_waste_pct)')
        .eq('template_id', id)
        .order('id', { ascending: true })

      if (error) throw error
      setTemplateMaterials(data || [])
    } catch (err) {
      console.error('Error fetching template materials:', err)
      showToast('error', 'Error al cargar materiales: ' + err.message)
    }
  }, [id, user])

  // ── Fetch template processes ──
  const fetchTemplateProcesses = useCallback(async () => {
    if (!user || !id) return
    try {
      const { data, error } = await supabase
        .from('product_template_processes')
        .select('*, processes(id, name, cost_type, cost)')
        .eq('template_id', id)
        .order('id', { ascending: true })

      if (error) throw error
      setTemplateProcesses(data || [])
    } catch (err) {
      console.error('Error fetching template processes:', err)
      showToast('error', 'Error al cargar procesos: ' + err.message)
    }
  }, [id, user])

  // ── Fetch template embellishments ──
  const fetchTemplateEmbellishments = useCallback(async () => {
    if (!user || !id) return
    try {
      const { data, error } = await supabase
        .from('product_template_embellishments')
        .select('*')
        .eq('template_id', id)
        .order('id', { ascending: true })

      if (error) throw error
      setTemplateEmbellishments(data || [])
    } catch (err) {
      console.error('Error fetching template embellishments:', err)
      showToast('error', 'Error al cargar personalizaciones: ' + err.message)
    }
  }, [id, user])

  // ── Fetch all user materials and processes for selects ──
  const fetchUserResources = useCallback(async () => {
    if (!user) return
    try {
      const [matRes, procRes] = await Promise.all([
        supabase.from('materials').select('id, name, unit_price, usage_unit, default_waste_pct, category').eq('user_id', user.id).order('name'),
        supabase.from('processes').select('id, name, cost_type, cost').eq('user_id', user.id).order('name'),
      ])
      setAllMaterials(matRes.data || [])
      setAllProcesses(procRes.data || [])
    } catch (err) {
      console.error('Error fetching resources:', err)
    }
  }, [user])

  useEffect(() => {
    fetchTemplate()
    fetchTemplateMaterials()
    fetchTemplateProcesses()
    fetchTemplateEmbellishments()
    fetchUserResources()
    setIsDirty(false)
  }, [fetchTemplate, fetchTemplateMaterials, fetchTemplateProcesses, fetchTemplateEmbellishments, fetchUserResources])

  // ── Template Edit ──
  const openEditModal = () => {
    setEditForm({
      name: template.name || '',
      category: template.category || '',
      description: template.description || '',
      suggested_margin: template.suggested_margin ?? '',

    })
    setEditErrors({})
    setEditModalOpen(true)
  }

  const handleUpdateTemplate = async () => {
    const errs = {}
    if (!editForm.name?.trim()) errs.name = 'Requerido'
    setEditErrors(errs)
    if (Object.keys(errs).length > 0) return

    setEditSaving(true)
    try {
      const { data, error } = await supabase
        .from('product_templates')
        .update({
          name: editForm.name.trim(),
          category: editForm.category || null,
          description: editForm.description.trim() || null,
          suggested_margin: editForm.suggested_margin ? parseFloat(editForm.suggested_margin) : null,
          is_clothing: false,
          size_multipliers: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setTemplate(data)
      setEditModalOpen(false)
      showToast('success', 'Plantilla actualizada.')
    } catch (err) {
      console.error('Error updating template:', err)
      setEditErrors({ _general: err.message })
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete Template ──
  const handleDeleteTemplate = async () => {
    try {
      // Delete related records first
      await supabase.from('product_template_materials').delete().eq('template_id', id)
      await supabase.from('product_template_processes').delete().eq('template_id', id)
      await supabase.from('product_template_embellishments').delete().eq('template_id', id)
      const { error } = await supabase.from('product_templates').delete().eq('id', id)
      if (error) throw error
      navigate('/templates')
    } catch (err) {
      console.error('Error deleting template:', err)
      showToast('error', 'Error al eliminar la plantilla.')
    }
  }

  // ── Add Material Row ──
  const handleAddMaterial = async (materialId) => {
    if (!materialId) return
    const exists = templateMaterials.some((tm) => tm.material_id === materialId)
    if (exists) {
      showToast('warning', 'Este material ya está agregado.')
      return
    }

    setMaterialSaving(true)
    try {
      const material = allMaterials.find((m) => m.id === materialId)
      const { data, error } = await supabase
        .from('product_template_materials')
        .insert({
          template_id: id,
          material_id: materialId,
          quantity_per_unit: 1,
          waste_pct_override: material?.default_waste_pct || 0,
        })
        .select('*, materials(id, name, unit_price, usage_unit, default_waste_pct)')
        .single()

      if (error) throw error
      setTemplateMaterials((prev) => [...prev, data])
      setIsDirty(true)
    } catch (err) {
      console.error('Error adding material:', err)
      showToast('error', 'Error al agregar material.')
    } finally {
      setMaterialSaving(false)
    }
  }

  // ── Save All Changes ──
  const handleSaveAll = async () => {
    setSavingChanges(true)
    try {
      const materialPromises = templateMaterials.map(tm => 
        supabase
          .from('product_template_materials')
          .update({
            quantity_per_unit: parseFloat(tm.quantity_per_unit) || 0,
            waste_pct_override: parseFloat(tm.waste_pct_override) || 0,
          })
          .eq('id', tm.id)
          .select()
      )

      const processPromises = templateProcesses.map(tp => 
        supabase
          .from('product_template_processes')
          .update({
            time_minutes_per_unit: parseFloat(tp.time_minutes_per_unit) || 0
          })
          .eq('id', tp.id)
          .select()
      )

      const embellishmentPromises = templateEmbellishments.map(te =>
        supabase
          .from('product_template_embellishments')
          .update({
            name: te.name || '',
            type: te.type,
            cost: parseFloat(te.cost) || 0,
            quantity: parseFloat(te.quantity) || 0
          })
          .eq('id', te.id)
          .select()
      )

      const results = await Promise.all([...materialPromises, ...processPromises, ...embellishmentPromises])
      
      const failed = results.find(r => r.error)
      if (failed) throw failed.error

      // Check if any update affected 0 rows (indicating RLS block or invalid ID)
      const emptyResult = results.find(r => !r.data || r.data.length === 0)
      if (emptyResult) {
        throw new Error('La base de datos no autorizó la actualización (RLS) o el ID del registro no coincide.')
      }

      // Refetch to ensure local state matches the DB exactly
      await Promise.all([
        fetchTemplateMaterials(),
        fetchTemplateProcesses(),
        fetchTemplateEmbellishments()
      ])

      setIsDirty(false)
      showToast('success', '¡Plantilla guardada con éxito!')
    } catch (err) {
      console.error('Error saving template:', err)
      showToast('error', 'Error al guardar: ' + err.message)
    } finally {
      setSavingChanges(false)
    }
  }

  // ── Remove Material Row ──
  const handleRemoveMaterial = async (tmId) => {
    try {
      const { error } = await supabase
        .from('product_template_materials')
        .delete()
        .eq('id', tmId)

      if (error) throw error
      setTemplateMaterials((prev) => prev.filter((tm) => tm.id !== tmId))
      setIsDirty(true)
    } catch (err) {
      console.error('Error removing material:', err)
    }
  }

  // ── Add Process Row ──
  const handleAddProcess = async (processId) => {
    if (!processId) return
    const exists = templateProcesses.some((tp) => tp.process_id === processId)
    if (exists) {
      showToast('warning', 'Este proceso ya está agregado.')
      return
    }

    setProcessSaving(true)
    try {
      const { data, error } = await supabase
        .from('product_template_processes')
        .insert({
          template_id: id,
          process_id: processId,
          time_minutes_per_unit: 1,
        })
        .select('*, processes(id, name, cost_type, cost)')
        .single()

      if (error) throw error
      setTemplateProcesses((prev) => [...prev, data])
      setIsDirty(true)
    } catch (err) {
      console.error('Error adding process:', err)
      showToast('error', 'Error al agregar proceso.')
    } finally {
      setProcessSaving(false)
    }
  }

  // ── Remove Process Row ──
  const handleRemoveProcess = async (tpId) => {
    try {
      const { error } = await supabase
        .from('product_template_processes')
        .delete()
        .eq('id', tpId)

      if (error) throw error
      setTemplateProcesses((prev) => prev.filter((tp) => tp.id !== tpId))
      setIsDirty(true)
    } catch (err) {
      console.error('Error removing process:', err)
    }
  }

  // ── Add Embellishment Row ──
  const handleAddEmbellishment = async () => {
    setEmbellishmentSaving(true)
    try {
      const { data, error } = await supabase
        .from('product_template_embellishments')
        .insert({
          template_id: id,
          type: 'bordado',
          name: 'Bordado nuevo',
          cost: 0,
          quantity: 1,
        })
        .select('*')
        .single()

      if (error) throw error
      setTemplateEmbellishments((prev) => [...prev, data])
      setIsDirty(true)
    } catch (err) {
      console.error('Error adding embellishment:', err)
      showToast('error', 'Error al agregar personalización.')
    } finally {
      setEmbellishmentSaving(false)
    }
  }

  // ── Remove Embellishment Row ──
  const handleRemoveEmbellishment = async (teId) => {
    try {
      const { error } = await supabase
        .from('product_template_embellishments')
        .delete()
        .eq('id', teId)

      if (error) throw error
      setTemplateEmbellishments((prev) => prev.filter((te) => te.id !== teId))
      setIsDirty(true)
    } catch (err) {
      console.error('Error removing embellishment:', err)
      showToast('error', 'Error al eliminar personalización.')
    }
  }

  // ── Financial summary calculator ──
  const financialSummary = useMemo(() => {
    const matCost = templateMaterials.reduce((sum, tm) => {
      const qty = parseFloat(tm.quantity_per_unit) || 0
      const price = parseFloat(tm.materials?.unit_price) || 0
      const wastePct = parseFloat(tm.waste_pct_override) || 0
      const base = qty * price
      return sum + base + (base * (wastePct / 100))
    }, 0)

    const procCost = templateProcesses.reduce((sum, tp) => {
      const cost = parseFloat(tp.processes?.cost) || 0
      const timeMin = parseFloat(tp.time_minutes_per_unit) || 0
      const type = tp.processes?.cost_type
      if (type === 'por_hora') {
        return sum + ((timeMin / 60) * cost)
      } else {
        return sum + cost
      }
    }, 0)

    const embCost = templateEmbellishments.reduce((sum, te) => {
      const cost = parseFloat(te.cost) || 0
      const qty = parseFloat(te.quantity) || 0
      return sum + (cost * qty)
    }, 0)

    const totalCost = matCost + procCost + embCost
    const margin = parseFloat(template?.suggested_margin) || 0
    const suggestedPrice = margin >= 100 ? totalCost : (totalCost / (1 - margin / 100))
    const profit = suggestedPrice - totalCost

    return {
      materialCost: matCost,
      processCost: procCost,
      embellishmentCost: embCost,
      totalCost,
      suggestedPrice,
      profit,
      margin
    }
  }, [templateMaterials, templateProcesses, templateEmbellishments, template?.suggested_margin])

  // ── Loading / Not Found ──
  if (loading) return <LoadingSpinner />

  if (!template) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="error"
          title="Plantilla no encontrada"
          message="La plantilla que buscas no existe o no tienes acceso."
          action={
            <Button onClick={() => navigate('/templates')}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Volver a Plantillas
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed top-24 right-6 z-50 animate-slide-in max-w-sm">
          <AlertBanner type={toast.type} onClose={() => setToast(null)}>
            {toast.message}
          </AlertBanner>
        </div>
      )}

      {/* Back + Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/templates')}
            className="p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-headline-md font-semibold text-on-surface">{template.name}</h1>
            {template.category && (
              <span className="status-badge bg-surface-container-high text-on-surface-variant mt-1 inline-block">
                {productCategoryMap[template.category] || template.category}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button onClick={handleSaveAll} disabled={savingChanges} variant="success">
              {savingChanges ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Guardar Cambios
                </>
              )}
            </Button>
          )}
          <Button variant="secondary" onClick={openEditModal} size="sm">
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Editar Datos
          </Button>
          <Button variant="danger" onClick={() => setDeleteConfirm(true)} size="sm">
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Eliminar
          </Button>
        </div>
      </div>

      {/* Layout Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column (Cards & Lists) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Info Card */}
          <Card className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="font-mono text-label-caps uppercase tracking-wider text-on-surface-variant mb-1">Margen Sugerido</p>
                <p className="font-mono text-body-lg text-on-surface font-semibold">
                  {template.suggested_margin != null ? `${template.suggested_margin}%` : '—'}
                </p>
              </div>
              <div>
                <p className="font-mono text-label-caps uppercase tracking-wider text-on-surface-variant mb-1">Estado</p>
                <span className={`status-badge ${template.is_active ? 'bg-tertiary-container/20 text-tertiary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {template.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div>
                <p className="font-mono text-label-caps uppercase tracking-wider text-on-surface-variant mb-1">Descripción</p>
                <p className="text-sm text-on-surface-variant">{template.description || '—'}</p>
              </div>
            </div>
          </Card>

          {/* ── Materials Section ── */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                Materiales Base
              </h2>
              <span className="font-mono text-xs text-on-surface-variant">
                {templateMaterials.length} material{templateMaterials.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {/* Add Material */}
            <div className="p-4 border-b border-outline-variant/30">
              <div className="flex items-end gap-3">
                <Select
                  label="Agregar material"
                  options={groupedMaterialOptions}
                  placeholder="Seleccionar material..."
                  className="flex-1"
                  onChange={(e) => {
                    handleAddMaterial(e.target.value)
                    e.target.value = ''
                  }}
                  disabled={materialSaving}
                />
              </div>
            </div>

            {templateMaterials.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-[24px] mb-2 block opacity-50">inventory_2</span>
                Sin materiales asignados. Agrega materiales usando el selector de arriba.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="bg-surface-container-high/50">
                      <th className="text-left px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Material</th>
                      <th className="text-left px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Unidad</th>
                      <th className="text-right px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Precio Unit.</th>

                      <th className="text-center px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-32">Cantidad/Unidad</th>
                      <th className="text-center px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-28">Merma %</th>
                      <th className="text-center px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateMaterials.map((tm) => (
                      <tr key={tm.id} className="border-t border-outline-variant/30 font-sans">
                        <td className="px-4 py-2 text-sm text-on-surface font-medium">
                          {tm.materials?.name || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-on-surface-variant">
                          {usageUnits[tm.materials?.usage_unit] || tm.materials?.usage_unit || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-mono text-on-surface">
                          {formatCurrency(tm.materials?.unit_price)}
                        </td>

                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={tm.quantity_per_unit}
                            onChange={(e) => {
                              const val = e.target.value
                              setTemplateMaterials(prev => prev.map(item => item.id === tm.id ? { ...item, quantity_per_unit: val } : item))
                              setIsDirty(true)
                            }}
                            className="w-full px-2 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface font-mono text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={tm.waste_pct_override}
                            onChange={(e) => {
                              const val = e.target.value
                              setTemplateMaterials(prev => prev.map(item => item.id === tm.id ? { ...item, waste_pct_override: val } : item))
                              setIsDirty(true)
                            }}
                            className="w-full px-2 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface font-mono text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveMaterial(tm.id)}
                            className="p-1 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            title="Quitar"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Processes Section ── */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">manufacturing</span>
                Procesos Base
              </h2>
              <span className="font-mono text-xs text-on-surface-variant">
                {templateProcesses.length} proceso{templateProcesses.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Add Process */}
            <div className="p-4 border-b border-outline-variant/30">
              <div className="flex items-end gap-3">
                <Select
                  label="Agregar proceso"
                  options={allProcesses.map((p) => ({
                    value: p.id,
                    label: `${p.name} — ${formatCurrency(p.cost)}`,
                  }))}
                  placeholder="Seleccionar proceso..."
                  className="flex-1"
                  onChange={(e) => {
                    handleAddProcess(e.target.value)
                    e.target.value = ''
                  }}
                  disabled={processSaving}
                />
              </div>
            </div>

            {/* Processes Table */}
            {templateProcesses.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-[24px] mb-2 block opacity-50">manufacturing</span>
                Sin procesos asignados. Agrega procesos usando el selector de arriba.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="bg-surface-container-high/50">
                      <th className="text-left px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Proceso</th>
                      <th className="text-left px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Tipo Costo</th>
                      <th className="text-right px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Costo</th>
                      <th className="text-center px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-32">Tiempo (min/u)</th>
                      <th className="text-center px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateProcesses.map((tp) => (
                      <tr key={tp.id} className="border-t border-outline-variant/30">
                        <td className="px-4 py-2 text-sm text-on-surface font-medium">
                          {tp.processes?.name || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-on-surface-variant">
                          <span className="status-badge bg-surface-container-high text-on-surface-variant">
                            {tp.processes?.cost_type === 'por_hora' ? 'Por Hora' :
                             tp.processes?.cost_type === 'por_unidad' ? 'Por Unidad' :
                             tp.processes?.cost_type === 'fijo_por_pedido' ? 'Fijo' : tp.processes?.cost_type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-mono text-on-surface">
                          {formatCurrency(tp.processes?.cost)}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={tp.time_minutes_per_unit}
                            onChange={(e) => {
                              const val = e.target.value
                              setTemplateProcesses(prev => prev.map(item => item.id === tp.id ? { ...item, time_minutes_per_unit: val } : item))
                              setIsDirty(true)
                            }}
                            className="w-full px-2 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface font-mono text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveProcess(tp.id)}
                            className="p-1 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            title="Quitar"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Embellishments Section ── */}
          <Card className="overflow-hidden border border-tertiary/20">
            <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-[20px]">palette</span>
                Personalización y Embellecimiento
              </h2>
              <span className="font-mono text-xs text-on-surface-variant">
                {templateEmbellishments.length} personalizaci{templateEmbellishments.length !== 1 ? 'ones' : 'ón'}
              </span>
            </div>

            {/* Add Embellishment */}
            <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between gap-4">
              <p className="text-sm text-on-surface-variant">Registra bordados, sublimados, vinilos u otros logos.</p>
              <Button onClick={handleAddEmbellishment} disabled={embellishmentSaving} variant="secondary" size="sm">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Agregar Detalle
              </Button>
            </div>

            {/* Embellishments Table */}
            {templateEmbellishments.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-[24px] mb-2 block opacity-50">palette</span>
                Sin detalles de personalización. Haz clic en "Agregar Detalle".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="bg-surface-container-high/50">
                      <th className="text-left px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Tipo</th>
                      <th className="text-left px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Descripción/Nombre</th>
                      <th className="text-right px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-32">Costo Unitario</th>
                      <th className="text-center px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-28">Cant.</th>
                      <th className="text-center px-4 py-2 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateEmbellishments.map((te) => (
                      <tr key={te.id} className="border-t border-outline-variant/30">
                        <td className="px-4 py-2 w-40">
                          <select
                            value={te.type}
                            onChange={(e) => {
                              const val = e.target.value
                              setTemplateEmbellishments(prev => prev.map(item => item.id === te.id ? { ...item, type: val } : item))
                              setIsDirty(true)
                            }}
                            className="w-full px-2 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          >
                            <option value="bordado">Bordado</option>
                            <option value="sublimado">Sublimado</option>
                            <option value="vinil">Vinil</option>
                            <option value="otro">Otro</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={te.name}
                            onChange={(e) => {
                              const val = e.target.value
                              setTemplateEmbellishments(prev => prev.map(item => item.id === te.id ? { ...item, name: val } : item))
                              setIsDirty(true)
                            }}
                            className="w-full px-2 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="Nombre del detalle..."
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={te.cost}
                            onChange={(e) => {
                              const val = e.target.value
                              setTemplateEmbellishments(prev => prev.map(item => item.id === te.id ? { ...item, cost: val } : item))
                              setIsDirty(true)
                            }}
                            className="w-full px-2 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface font-mono text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={te.quantity}
                            onChange={(e) => {
                              const val = e.target.value
                              setTemplateEmbellishments(prev => prev.map(item => item.id === te.id ? { ...item, quantity: val } : item))
                              setIsDirty(true)
                            }}
                            className="w-full px-2 py-1 bg-surface-container-high border border-outline-variant rounded text-sm text-on-surface font-mono text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveEmbellishment(te.id)}
                            className="p-1 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            title="Quitar"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column (Financial Summary) */}
        <div className="lg:col-span-1 lg:sticky lg:top-24 space-y-4">
          <Card className="p-6 border border-primary/30">
            <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary">analytics</span>
              Resumen Financiero
            </h2>

            <div className="space-y-3.5">
              <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/30 text-sm">
                <span className="text-on-surface-variant">Costo Insumos</span>
                <span className="font-mono text-on-surface font-semibold">{formatCurrency(financialSummary.materialCost)}</span>
              </div>
              
              <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/30 text-sm">
                <span className="text-on-surface-variant">Costo Operación</span>
                <span className="font-mono text-on-surface font-semibold">{formatCurrency(financialSummary.processCost)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-outline-variant/30 text-sm">
                <span className="text-on-surface-variant">Costo Personalización</span>
                <span className="font-mono text-on-surface font-semibold">{formatCurrency(financialSummary.embellishmentCost)}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-outline-variant/50">
                <span className="text-on-surface font-medium">Costo Base Unitario</span>
                <span className="font-mono text-headline-sm text-primary font-bold">{formatCurrency(financialSummary.totalCost)}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 text-sm">
                <span className="text-on-surface-variant">Margen Sugerido</span>
                <span className="font-mono text-tertiary font-bold">{financialSummary.margin}%</span>
              </div>

              <div className="flex justify-between items-center py-2.5 border-t border-outline-variant/50">
                <span className="text-on-surface font-medium">Venta Sugerida</span>
                <span className="font-mono text-headline-sm text-tertiary font-bold">{formatCurrency(financialSummary.suggestedPrice)}</span>
              </div>

              <div className="p-3 bg-tertiary-container/10 border border-tertiary/20 rounded-xl flex justify-between items-center mt-2">
                <span className="text-xs text-tertiary font-medium uppercase tracking-wider font-mono">Utilidad/Unidad</span>
                <span className="font-mono text-body-lg text-tertiary font-bold">+{formatCurrency(financialSummary.profit)}</span>
              </div>
            </div>

            {/* Guardar button */}
            <div className="mt-6">
              <Button
                onClick={handleSaveAll}
                disabled={savingChanges || !isDirty}
                className="w-full justify-center text-center font-bold text-sm"
                variant={isDirty ? 'primary' : 'secondary'}
              >
                {savingChanges ? (
                  <>
                    <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                    Guardando Cambios...
                  </>
                ) : isDirty ? (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Guardar Cambios de Plantilla
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">done</span>
                    Sin Cambios Pendientes
                  </>
                )}
              </Button>
              {isDirty && (
                <p className="text-[11px] text-center text-primary mt-2 font-mono animate-pulse">
                  * Tienes cambios sin guardar
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Edit Template Modal ── */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Plantilla"
      >
        <div className="space-y-4">
          {editErrors._general && (
            <div className="p-3 rounded-lg bg-error-container/10 border border-error text-error text-sm">
              {editErrors._general}
            </div>
          )}

          <Input
            label="Nombre"
            value={editForm.name || ''}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre de la plantilla"
            error={editErrors.name}
          />

          <Select
            label="Categoría"
            options={categoryOptions}
            value={editForm.category || ''}
            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Seleccionar (opcional)..."
          />

          <Input
            label="Margen sugerido"
            type="number"
            step="1"
            min="0"
            max="100"
            value={editForm.suggested_margin ?? ''}
            onChange={(e) => setEditForm((f) => ({ ...f, suggested_margin: e.target.value }))}
            placeholder="30"
            suffix="%"
          />

          <Textarea
            label="Descripción"
            value={editForm.description || ''}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descripción del producto..."
          />



          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTemplate} disabled={editSaving}>
              {editSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Template Confirm */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDeleteTemplate}
        title="Eliminar Plantilla"
        message={`¿Estás seguro de que deseas eliminar "${template.name}"? Se eliminarán todos los materiales y procesos asociados. Esta acción no se puede deshacer.`}
      />
    </div>
  )
}
