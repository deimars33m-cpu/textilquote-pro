import { useState, useMemo, useEffect, useCallback } from 'react'
import { useCRUD } from '@/hooks/useCRUD'
import { useCategories } from '@/context/CategoryContext'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Modal, ConfirmDialog, Input, Select, Textarea, Button,
  Card, SearchInput, LoadingSpinner, EmptyState,
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
  const { user } = useAuth()
  const { data: materials, loading: loadingMaterials, create, update, remove, refetch: refetchMaterials } = useCRUD('materials', {
    orderBy: 'name',
    orderAsc: true,
  })
  const { categories, categoryMap, loading: loadingCategories } = useCategories()

  // Tabs de navegación: 'inventario' | 'catalogo' | 'kardex'
  const [activeTab, setActiveTab] = useState('inventario')

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})

  // Modal Compra / Ingreso a Almacén
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseForm, setPurchaseForm] = useState({
    material_id: '',
    quantity: '',
    unit_cost: '',
    supplier_name: '',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [savingPurchase, setSavingPurchase] = useState(false)
  const [purchaseError, setPurchaseError] = useState(null)

  // Modal Asignar a Contrato
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({
    material_id: '',
    contract_id: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [activeContracts, setActiveContracts] = useState([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [savingAssign, setSavingAssign] = useState(false)
  const [assignError, setAssignError] = useState(null)

  // Kardex / Historial de Movimientos
  const [movements, setMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [filterMovementType, setFilterMovementType] = useState('')

  const fetchMovements = useCallback(async () => {
    if (!user) return
    setLoadingMovements(true)
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          materials (name, usage_unit, category),
          contract_tracking (contract_name, client_name)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(150)
      if (!error && data) setMovements(data)
    } catch (e) {
      console.error('Error fetching inventory movements:', e)
    } finally {
      setLoadingMovements(false)
    }
  }, [user])

  const fetchActiveContracts = useCallback(async () => {
    if (!user) return
    setLoadingContracts(true)
    try {
      const { data, error } = await supabase
        .from('contract_tracking')
        .select('id, contract_name, client_name, total_units, status')
        .eq('user_id', user.id)
        .neq('status', 'entregado')
        .order('created_at', { ascending: false })
      if (!error && data) setActiveContracts(data)
    } catch (e) {
      console.error('Error fetching active contracts:', e)
    } finally {
      setLoadingContracts(false)
    }
  }, [user])

  useEffect(() => {
    if (activeTab === 'kardex') {
      fetchMovements()
    }
  }, [activeTab, fetchMovements])

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

  // Resumen de Métricas de Almacén
  const inventoryMetrics = useMemo(() => {
    let totalStockItems = 0
    let lowStockCount = 0
    let outOfStockCount = 0
    let totalEstimatedValue = 0

    materials.forEach(m => {
      const stock = Number(m.current_stock) || 0
      const minStock = Number(m.min_stock) || 0
      const price = Number(m.unit_price) || 0

      if (stock > 0) totalStockItems++
      if (stock <= 0) outOfStockCount++
      else if (minStock > 0 && stock <= minStock) lowStockCount++

      totalEstimatedValue += stock * price
    })

    return { totalStockItems, lowStockCount, outOfStockCount, totalEstimatedValue }
  }, [materials])

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

  const openPurchaseModal = (preselectedMaterial = null) => {
    const mat = preselectedMaterial || (materials.length > 0 ? materials[0] : null)
    setPurchaseForm({
      material_id: mat ? mat.id : '',
      quantity: '',
      unit_cost: mat ? (mat.unit_price || '') : '',
      supplier_name: '',
      reference: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setPurchaseError(null)
    setPurchaseModalOpen(true)
  }

  const openAssignModal = (preselectedMaterial = null) => {
    fetchActiveContracts()
    const mat = preselectedMaterial || (materials.length > 0 ? materials[0] : null)
    setAssignForm({
      material_id: mat ? mat.id : '',
      contract_id: '',
      quantity: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setAssignError(null)
    setAssignModalOpen(true)
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
        current_stock: form.current_stock !== '' && form.current_stock !== null ? parseFloat(form.current_stock) : null,
        min_stock: form.min_stock !== '' && form.min_stock !== null ? parseFloat(form.min_stock) : null,
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

  const handleSavePurchase = async () => {
    if (!purchaseForm.material_id) return setPurchaseError('Selecciona un material')
    const qty = parseFloat(purchaseForm.quantity)
    if (isNaN(qty) || qty <= 0) return setPurchaseError('La cantidad debe ser mayor a 0')
    const unitCost = parseFloat(purchaseForm.unit_cost) || 0

    setSavingPurchase(true)
    setPurchaseError(null)
    try {
      const selectedMat = materials.find(m => m.id === purchaseForm.material_id)

      // 1. Insertar movimiento de inventario (compra)
      const { error: errMov } = await supabase.from('inventory_movements').insert({
        user_id: user.id,
        material_id: purchaseForm.material_id,
        movement_type: 'compra',
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        reference: purchaseForm.reference.trim() || null,
        supplier_name: purchaseForm.supplier_name.trim() || null,
        notes: purchaseForm.notes.trim() || null,
        date: purchaseForm.date || new Date().toISOString().split('T')[0],
      })
      if (errMov) throw errMov

      // 2. Actualizar stock en materials
      const currentStock = Number(selectedMat?.current_stock) || 0
      const newStock = currentStock + qty
      const updateData = { current_stock: newStock }
      if (unitCost > 0) {
        updateData.unit_price = unitCost
        updateData.price_updated_at = purchaseForm.date || new Date().toISOString().split('T')[0]
      }
      await supabase.from('materials').update(updateData).eq('id', purchaseForm.material_id)

      setPurchaseModalOpen(false)
      if (refetchMaterials) refetchMaterials()
      if (activeTab === 'kardex') fetchMovements()
    } catch (e) {
      console.error('Error saving purchase movement:', e)
      setPurchaseError(e.message)
    } finally {
      setSavingPurchase(false)
    }
  }

  const handleSaveAssign = async () => {
    if (!assignForm.material_id) return setAssignError('Selecciona un material')
    if (!assignForm.contract_id) return setAssignError('Selecciona un contrato de destino')
    const qty = parseFloat(assignForm.quantity)
    if (isNaN(qty) || qty <= 0) return setAssignError('La cantidad debe ser mayor a 0')

    const selectedMat = materials.find(m => m.id === assignForm.material_id)
    const currentStock = Number(selectedMat?.current_stock) || 0
    if (qty > currentStock) {
      return setAssignError(`La cantidad a transferir (${qty}) supera el stock disponible en almacén (${currentStock}).`)
    }

    setSavingAssign(true)
    setAssignError(null)
    try {
      const selectedContract = activeContracts.find(c => c.id === assignForm.contract_id)
      const unitCost = Number(selectedMat?.unit_price) || 0

      // 1. Insertar movimiento de asignación
      const { error: errMov } = await supabase.from('inventory_movements').insert({
        user_id: user.id,
        material_id: assignForm.material_id,
        contract_id: assignForm.contract_id,
        movement_type: 'asignacion',
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        reference: `Contrato: ${selectedContract?.contract_name || assignForm.contract_id.slice(0, 8)}`,
        notes: assignForm.notes.trim() || `Asignado a contrato ${selectedContract?.contract_name || ''}`,
        date: assignForm.date || new Date().toISOString().split('T')[0],
      })
      if (errMov) throw errMov

      // 2. Descontar stock en almacén
      const newStock = Math.max(0, currentStock - qty)
      await supabase.from('materials').update({ current_stock: newStock }).eq('id', assignForm.material_id)

      // 3. Registrar o actualizar en contract_material_purchases para ese contrato
      const { data: existingRows } = await supabase
        .from('contract_material_purchases')
        .select('*')
        .eq('contract_id', assignForm.contract_id)

      const match = (existingRows || []).find(r => r.material_id === assignForm.material_id || (r.material_name && r.material_name.toLowerCase().trim() === selectedMat.name.toLowerCase().trim()))

      if (match) {
        const newPurchased = (Number(match.qty_purchased) || 0) + qty
        const newStatus = newPurchased >= (match.qty_required || 0) ? 'recibido' : 'parcial'
        await supabase
          .from('contract_material_purchases')
          .update({
            qty_purchased: newPurchased,
            status: newStatus,
            material_id: assignForm.material_id
          })
          .eq('id', match.id)
      } else {
        await supabase
          .from('contract_material_purchases')
          .insert({
            contract_id: assignForm.contract_id,
            material_id: assignForm.material_id,
            material_name: selectedMat.name,
            unit: selectedMat.usage_unit || 'unidad',
            qty_required: qty,
            qty_purchased: qty,
            unit_cost: unitCost,
            status: 'recibido',
            notes: `Asignado desde almacén el ${assignForm.date}`
          })
      }

      setAssignModalOpen(false)
      if (refetchMaterials) refetchMaterials()
      if (activeTab === 'kardex') fetchMovements()
    } catch (e) {
      console.error('Error assigning material to contract:', e)
      setAssignError(e.message)
    } finally {
      setSavingAssign(false)
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
        if (pQty > 0 && uPrice > 0) {
          updated.purchase_price = (uPrice * pQty).toFixed(2)
        }
      }

      return updated
    })
  }

  if (loadingMaterials || loadingCategories) return <LoadingSpinner />

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">warehouse</span>
            Gestión de Almacén e Inventarios
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Control de stock, compras progresivas y asignación directa a contratos de producción
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => openPurchaseModal()} className="border-primary/40 text-primary">
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            Registrar Compra / Entrada
          </Button>
          <Button variant="secondary" onClick={() => openAssignModal()} className="border-emerald-500/40 text-emerald-400">
            <span className="material-symbols-outlined text-[18px]">output</span>
            Asignar a Contrato
          </Button>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nuevo Material
          </Button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Almacén */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="neu-surface p-3.5 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">inventory_2</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant font-mono">Con Stock</p>
            <p className="text-lg font-bold text-on-surface font-mono">{inventoryMetrics.totalStockItems} <span className="text-xs text-on-surface-variant">ítem(s)</span></p>
          </div>
        </div>

        <div className="neu-surface p-3.5 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">payments</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant font-mono">Valor Almacén</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(inventoryMetrics.totalEstimatedValue)}</p>
          </div>
        </div>

        <div className="neu-surface p-3.5 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">warning</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant font-mono">Stock Bajo</p>
            <p className={`text-lg font-bold font-mono ${inventoryMetrics.lowStockCount > 0 ? 'text-amber-400' : 'text-on-surface'}`}>
              {inventoryMetrics.lowStockCount} <span className="text-xs text-on-surface-variant">ítem(s)</span>
            </p>
          </div>
        </div>

        <div className="neu-surface p-3.5 rounded-2xl border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">error</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant font-mono">Agotados</p>
            <p className={`text-lg font-bold font-mono ${inventoryMetrics.outOfStockCount > 0 ? 'text-red-400' : 'text-on-surface'}`}>
              {inventoryMetrics.outOfStockCount} <span className="text-xs text-on-surface-variant">ítem(s)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Pestañas de Vista */}
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('inventario')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'inventario'
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">warehouse</span>
            Inventario y Stock
          </button>
          <button
            onClick={() => setActiveTab('catalogo')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'catalogo'
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">sell</span>
            Catálogo y Precios
          </button>
          <button
            onClick={() => setActiveTab('kardex')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'kardex'
                ? 'bg-primary text-white shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            Kardex / Movimientos
          </button>
        </div>

        <Button variant="secondary" onClick={() => setCategoriesModalOpen(true)} className="text-xs py-1.5 h-auto">
          <span className="material-symbols-outlined text-[16px]">category</span>
          Categorías
        </Button>
      </div>

      {/* Contenido según pestaña */}
      {activeTab === 'kardex' ? (
        /* VISTA KARDEX / MOVIMIENTOS */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <h3 className="font-bold text-on-surface text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">swap_horiz</span>
              Historial de Entradas y Asignaciones
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={filterMovementType}
                onChange={e => setFilterMovementType(e.target.value)}
                options={[
                  { value: '', label: 'Todos los tipos' },
                  { value: 'compra', label: 'Compras (+)' },
                  { value: 'asignacion', label: 'Asignaciones a Contratos (-)' },
                  { value: 'devolucion', label: 'Devoluciones (+)' },
                  { value: 'ajuste', label: 'Ajustes (+/-)' },
                ]}
                className="w-full sm:w-48 text-xs"
              />
              <button
                onClick={fetchMovements}
                className="p-2 rounded-xl neu-raised-sm text-on-surface-variant hover:text-primary transition-colors"
                title="Refrescar historial"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
              </button>
            </div>
          </div>

          {loadingMovements ? (
            <LoadingSpinner />
          ) : movements.length === 0 ? (
            <EmptyState
              icon="history"
              title="Sin movimientos registrados"
              message="Registra compras o asigna materiales a contratos para ver el historial aquí."
            />
          ) : (
            <div className="neu-surface rounded-2xl overflow-hidden border border-outline-variant/30">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-high text-on-surface-variant font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Costo Unit.</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Destino / Contrato</th>
                      <th className="px-4 py-3">Referencia / Proveedor</th>
                      <th className="px-4 py-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-sans">
                    {movements
                      .filter(m => !filterMovementType || m.movement_type === filterMovementType)
                      .map((mov) => {
                        const isEntrada = mov.movement_type === 'compra' || mov.movement_type === 'devolucion'
                        return (
                          <tr key={mov.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-mono text-on-surface-variant whitespace-nowrap">
                              {formatDate(mov.date)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {mov.movement_type === 'compra' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  + Compra / Entrada
                                </span>
                              )}
                              {mov.movement_type === 'asignacion' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  → Asignación Contrato
                                </span>
                              )}
                              {mov.movement_type === 'devolucion' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  ↺ Devolución
                                </span>
                              )}
                              {mov.movement_type === 'ajuste' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                  ± Ajuste
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-bold text-on-surface">
                              {mov.materials?.name || 'Material'}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-bold ${isEntrada ? 'text-emerald-400' : 'text-primary'}`}>
                              {isEntrada ? `+${mov.quantity}` : `-${mov.quantity}`} {mov.materials?.usage_unit || ''}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-on-surface-variant">
                              {formatCurrency(mov.unit_cost)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-on-surface">
                              {formatCurrency(mov.total_cost || (mov.quantity * mov.unit_cost))}
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant">
                              {mov.contract_tracking ? (
                                <span className="font-bold text-primary">
                                  {mov.contract_tracking.contract_name} ({mov.contract_tracking.client_name})
                                </span>
                              ) : (
                                <span className="text-on-surface-variant/50 italic">Almacén General</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant">
                              {mov.supplier_name || mov.reference || '—'}
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant text-[11px] max-w-xs truncate">
                              {mov.notes || '—'}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VISTAS DE INVENTARIO Y CATÁLOGO */
        <>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar material..."
            />
            <Select
              options={categoryOptions}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              placeholder="Todas las categorías"
              className="w-full sm:w-48"
            />
          </div>

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
                            
                            {activeTab === 'inventario' ? (
                              <>
                                <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Stock en Almacén</th>
                                <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Stock Mínimo</th>
                                <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Valor Estimado</th>
                              </>
                            ) : (
                              <>
                                <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Precio Unit.</th>
                                <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Merma %</th>
                                <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Última Actualización</th>
                              </>
                            )}

                            <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((m) => {
                            const outdated = isPriceOutdated(m.price_updated_at)
                            const currentStock = Number(m.current_stock) || 0
                            const minStock = Number(m.min_stock) || 0
                            const isLowStock = minStock > 0 && currentStock <= minStock
                            const isOutOfStock = currentStock <= 0

                            return (
                              <tr key={m.id} className="border-t border-outline-variant/30">
                                <td className="px-4 py-3 text-sm text-on-surface font-medium">
                                  <div className="flex items-center gap-2">
                                    <span>{m.name}</span>
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

                                {activeTab === 'inventario' ? (
                                  <>
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5 font-mono">
                                        <span className={`font-bold text-sm ${isOutOfStock ? 'text-red-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                                          {currentStock}
                                        </span>
                                        {isOutOfStock ? (
                                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                            Agotado
                                          </span>
                                        ) : isLowStock ? (
                                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            Bajo
                                          </span>
                                        ) : (
                                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            Disponible
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-mono text-on-surface-variant">
                                      {minStock > 0 ? minStock : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-mono text-on-surface font-bold">
                                      {formatCurrency(currentStock * (m.unit_price || 0))}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-4 py-3 text-sm text-right font-mono text-on-surface font-bold">
                                      {formatCurrency(m.unit_price)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-mono text-on-surface-variant">
                                      {m.default_waste_pct ?? 0}%
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${outdated ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                                      {formatDate(m.price_updated_at)}
                                    </td>
                                  </>
                                )}

                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* Botón rápido Registrar Entrada */}
                                    <button
                                      onClick={() => openPurchaseModal(m)}
                                      className="p-1.5 rounded-lg neu-raised-sm text-primary hover:bg-primary/10 transition-colors"
                                      title="Registrar Compra / Ingreso a Almacén"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                                    </button>

                                    {/* Botón rápido Asignar a Contrato */}
                                    <button
                                      onClick={() => openAssignModal(m)}
                                      disabled={currentStock <= 0}
                                      className={`p-1.5 rounded-lg neu-raised-sm transition-colors ${
                                        currentStock > 0
                                          ? 'text-emerald-400 hover:bg-emerald-500/10 cursor-pointer'
                                          : 'text-on-surface-variant/30 cursor-not-allowed'
                                      }`}
                                      title={currentStock > 0 ? "Asignar stock a Contrato" : "Sin stock para asignar"}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">output</span>
                                    </button>

                                    <button
                                      onClick={() => openEdit(m)}
                                      className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-on-surface transition-colors"
                                      title="Editar"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <button
                                      onClick={() => setDeleteTarget(m)}
                                      className="p-1.5 rounded-lg neu-raised-sm text-on-surface-variant hover:text-error transition-colors"
                                      title="Eliminar"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
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
                Total materiales: {filtered.length}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Registrar Compra / Entrada a Almacén */}
      <Modal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title="Registrar Compra / Ingreso a Almacén"
        size="md"
      >
        <div className="space-y-4">
          {purchaseError && (
            <div className="p-3 rounded-lg bg-error-container/10 border border-error text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>{purchaseError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Material a Ingresar *
              </label>
              <select
                className="w-full px-3 py-2 neu-pressed bg-surface-container-high rounded-xl text-sm text-on-surface outline-none"
                value={purchaseForm.material_id}
                onChange={e => {
                  const mId = e.target.value
                  const found = materials.find(m => m.id === mId)
                  setPurchaseForm(f => ({
                    ...f,
                    material_id: mId,
                    unit_cost: found ? (found.unit_price || '') : f.unit_cost
                  }))
                }}
              >
                <option value="">-- Seleccionar material --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.category}) · Stock actual: {m.current_stock ?? 0} {m.usage_unit || ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Cantidad a Ingresar *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={purchaseForm.quantity}
                  onChange={e => setPurchaseForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Costo Unitario (Bs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={purchaseForm.unit_cost}
                  onChange={e => setPurchaseForm(f => ({ ...f, unit_cost: e.target.value }))}
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono outline-none"
                />
              </div>
            </div>

            {purchaseForm.quantity && purchaseForm.unit_cost && (
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex justify-between items-center text-xs">
                <span className="text-on-surface-variant">Inversión Total Estimada:</span>
                <span className="font-bold text-primary font-mono text-sm">
                  {formatCurrency((parseFloat(purchaseForm.quantity) || 0) * (parseFloat(purchaseForm.unit_cost) || 0))}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Proveedor
                </label>
                <input
                  type="text"
                  placeholder="Ej: Distribuidora Textil"
                  value={purchaseForm.supplier_name}
                  onChange={e => setPurchaseForm(f => ({ ...f, supplier_name: e.target.value }))}
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Nro. Factura / Recibo
                </label>
                <input
                  type="text"
                  placeholder="Opcional"
                  value={purchaseForm.reference}
                  onChange={e => setPurchaseForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Fecha de Compra
              </label>
              <input
                type="date"
                value={purchaseForm.date}
                onChange={e => setPurchaseForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Notas adicionales
              </label>
              <input
                type="text"
                placeholder="Observaciones de la compra..."
                value={purchaseForm.notes}
                onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <Button variant="secondary" onClick={() => setPurchaseModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePurchase} disabled={savingPurchase}>
              {savingPurchase ? 'Guardando...' : 'Confirmar Ingreso'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Asignar Material a Contrato */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Asignar Material de Almacén a Contrato"
        size="md"
      >
        <div className="space-y-4">
          {assignError && (
            <div className="p-3 rounded-lg bg-error-container/10 border border-error text-error text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>{assignError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Material a Asignar *
              </label>
              <select
                className="w-full px-3 py-2 neu-pressed bg-surface-container-high rounded-xl text-sm text-on-surface outline-none"
                value={assignForm.material_id}
                onChange={e => setAssignForm(f => ({ ...f, material_id: e.target.value }))}
              >
                <option value="">-- Seleccionar material --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} · Stock en Almacén: {m.current_stock ?? 0} {m.usage_unit || ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Contrato de Destino *
              </label>
              {loadingContracts ? (
                <p className="text-xs text-on-surface-variant italic">Cargando contratos activos...</p>
              ) : activeContracts.length === 0 ? (
                <p className="text-xs text-amber-400 bg-amber-400/10 p-2 rounded-lg border border-amber-400/20">
                  No hay contratos activos en proceso. Crea un contrato en la hoja de contratos primero.
                </p>
              ) : (
                <select
                  className="w-full px-3 py-2 neu-pressed bg-surface-container-high rounded-xl text-sm text-on-surface outline-none"
                  value={assignForm.contract_id}
                  onChange={e => setAssignForm(f => ({ ...f, contract_id: e.target.value }))}
                >
                  <option value="">-- Seleccionar contrato activo --</option>
                  {activeContracts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.contract_name} ({c.client_name}) · {c.total_units} prendas
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Cantidad a Transferir *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={assignForm.quantity}
                  onChange={e => setAssignForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Fecha de Asignación
                </label>
                <input
                  type="date"
                  value={assignForm.date}
                  onChange={e => setAssignForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Notas / Referencia de Destino
              </label>
              <input
                type="text"
                placeholder="Ej: Entrega a taller de corte..."
                value={assignForm.notes}
                onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAssign} disabled={savingAssign || activeContracts.length === 0}>
              {savingAssign ? 'Asignando...' : 'Confirmar Asignación'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Crear / Editar Material (Catálogo base) */}
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
                label="Stock actual en almacén"
                type="number"
                step="any"
                min="0"
                value={form.current_stock}
                onChange={(e) => updateField('current_stock', e.target.value)}
                placeholder="0"
              />

              <Input
                label="Stock mínimo de alerta"
                type="number"
                step="any"
                min="0"
                value={form.min_stock}
                onChange={(e) => updateField('min_stock', e.target.value)}
                placeholder="0"
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

      {/* Diálogo Eliminar */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Material"
        message={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
      />

      {/* Modal Categorías */}
      <MaterialCategoriesModal
        isOpen={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        materials={materials}
      />
    </div>
  )
}
