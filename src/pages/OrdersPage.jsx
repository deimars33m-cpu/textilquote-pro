import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Card, SearchInput, Button, StatusBadge,
  LoadingSpinner, EmptyState, Select, AlertBanner, Modal,
  Input, Textarea
} from '@/components/ui/index.jsx'
import { formatCurrency, formatDate, formatQuoteNumber } from '@/lib/formatters'
import { useGlobalSettings } from '@/context/GlobalSettingsContext'

const SIZES_LIST = ['2', '4', '6', '8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const PANELS_LIST = ['1 PANEL', '2 PANELES', '3 PANELES', '4 PANELES', '5 PANELES', '6 PANELES']

const SIZE_FACTORS = {
  '4': { priceFactor: 0.52, m2: [0.17, 0.35, 0.52, 0.70, 0.87], panels: [0.44, 0.87, 1.31, 1.74, 2.18] },
  '6': { priceFactor: 0.54, m2: [0.19, 0.38, 0.57, 0.76, 0.95], panels: [0.48, 0.95, 1.43, 1.90, 2.38] },
  '8': { priceFactor: 0.70, m2: [0.21, 0.42, 0.63, 0.84, 1.05], panels: [0.53, 1.05, 1.58, 2.10, 2.63] },
  '10': { priceFactor: 0.70, m2: [0.24, 0.48, 0.73, 0.97, 1.21], panels: [0.61, 1.21, 1.82, 2.42, 3.03] },
  '12': { priceFactor: 0.90, m2: [0.27, 0.55, 0.82, 1.10, 1.37], panels: [0.69, 1.37, 2.06, 2.74, 3.43] },
  '14': { priceFactor: 0.90, m2: [0.31, 0.61, 0.92, 1.22, 1.53], panels: [0.77, 1.53, 2.30, 3.06, 3.83] },
  'S': { priceFactor: 0.96, m2: [0.34, 0.68, 1.01, 1.35, 1.69], panels: [0.85, 1.69, 2.54, 3.38, 4.23] },
  'M': { priceFactor: 1.00, m2: [0.37, 0.74, 1.11, 1.48, 1.85], panels: [0.93, 1.85, 2.78, 3.70, 4.63] },
  'L': { priceFactor: 1.00, m2: [0.40, 0.80, 1.20, 1.60, 2.00], panels: [1.00, 2.00, 3.00, 4.00, 5.00] },
  'XL': { priceFactor: 1.16, m2: [0.41, 0.82, 1.23, 1.64, 2.05], panels: [1.03, 2.05, 3.08, 4.10, 5.13] },
  'XXL': { priceFactor: 1.20, m2: [0.42, 0.84, 1.26, 1.68, 2.10], panels: [1.05, 2.10, 3.15, 4.20, 5.25] }
}
const SUBLIMATION_SIZES = ['4', '6', '8', '10', '12', '14', 'S', 'M', 'L', 'XL', 'XXL']

const getInitialPanelSizePrices = (basePrice = 10) => {
  return PANELS_LIST.reduce((acc, panel) => {
    const match = panel.match(/^(\d+)/)
    const panelsCount = match ? parseInt(match[1]) : 1
    const sizePrices = SUBLIMATION_SIZES.reduce((accSize, size) => {
      const factor = SIZE_FACTORS[size]?.priceFactor || 1.0
      const price = basePrice * factor * panelsCount
      return { ...accSize, [size]: price }
    }, {})
    return { ...acc, [panel]: sizePrices }
  }, {})
}

const calculateItemMetrics = (sizeDistribution) => {
  let totalGarments = 0
  let totalNominalPanels = 0
  let totalEquivalentPanels = 0
  let totalM2 = 0

  if (!sizeDistribution) return null;

  PANELS_LIST.forEach(panel => {
    const pData = sizeDistribution[panel]
    if (pData && pData.tallas) {
      const match = panel.match(/^(\d+)/)
      const panelsPerGarment = match ? parseInt(match[1]) : 1
      
      SUBLIMATION_SIZES.forEach(size => {
        const qty = pData.tallas[size] || 0
        if (qty > 0) {
          totalGarments += qty
          totalNominalPanels += qty * panelsPerGarment
          
          const f = SIZE_FACTORS[size]
          if (f) {
            const idx = Math.min(4, panelsPerGarment - 1)
            const m2Val = f.m2[idx] * (panelsPerGarment > 5 ? panelsPerGarment / 5 : 1)
            const pVal = f.panels[idx] * (panelsPerGarment > 5 ? panelsPerGarment / 5 : 1)
            totalM2 += qty * m2Val
            totalEquivalentPanels += qty * pVal
          }
        }
      })
    }
  })

  return { totalGarments, totalNominalPanels, totalEquivalentPanels, totalM2 }
}

const initialPanelSizes = PANELS_LIST.reduce((acc, panel) => ({
  ...acc,
  [panel]: SUBLIMATION_SIZES.reduce((accSize, size) => ({ ...accSize, [size]: 0 }), {})
}), {})

const PANEL_OPTIONS = {
  '1 PANEL': ['Almohadas', 'Delantera suelta', 'Otros'],
  '2 PANELES': ['Short', 'Delantera+Espalda', 'Otros'],
  '3 PANELES': ['Polera manga corta', 'Otros'],
  '4 PANELES': ['Malla+Short', 'Chaqueta deportiva', 'Camiseta manga larga', 'Otros'],
  '5 PANELES': ['Camiseta+Short', 'Otros'],
  '6 PANELES': ['Camiseta manga larga + Short', 'Otros']
}

const initialItemTypes = PANELS_LIST.reduce((acc, panel) => ({
  ...acc,
  [panel]: PANEL_OPTIONS[panel]?.[0] || 'Otros'
}), {})

const initialSizes = {
  ...SIZES_LIST.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}),
  ...PANELS_LIST.reduce((acc, panel) => ({ ...acc, [panel]: 0 }), {})
}

const initialSizePrices = {
  ...SIZES_LIST.reduce((acc, size) => {
    let price = 50
    if (['2', '4', '6'].includes(size)) price = 40
    else if (['8', '10', '12'].includes(size)) price = 45
    else if (['14', '16'].includes(size)) price = 50
    else if (size === 'S') price = 55
    else if (size === 'M') price = 60
    else if (size === 'L') price = 65
    else if (size === 'XL') price = 70
    else if (size === 'XXL') price = 75
    else if (size === 'XXXL') price = 80
    return { ...acc, [size]: price }
  }, {}),
  ...PANELS_LIST.reduce((acc, panel, idx) => {
    const price = (idx + 1) * 20
    return { ...acc, [panel]: price }
  }, {})
}

const getOrderCategoryStyle = (categoryName) => {
  const name = (categoryName || '').toLowerCase().trim();
  if (name.includes('producción') || name.includes('produccion')) {
    return 'bg-red-500/15 text-red-400 border border-red-500/30';
  }
  if (name.includes('sublimación') || name.includes('sublimacion')) {
    return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
  }
  if (name.includes('bordado')) {
    return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
  }
  if (name.includes('corte') || name.includes('vinil')) {
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  }
  if (name.includes('dtf') && !name.includes('uv')) {
    return 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
  }
  if (name.includes('uv-dtf') || name.includes('uv dtf')) {
    return 'bg-pink-500/15 text-pink-400 border border-pink-500/30';
  }
  return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
}

const getDefaultDeliveryDate = (category) => {
  const days = (category === 'servicios_sublimacion' || (category || '').toLowerCase().includes('sublimacion')) ? 2 : 15;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export default function OrdersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const convertQuoteId = searchParams.get('convertQuoteId')
  const { settings, getServicePrice } = useGlobalSettings()

  // Estado de datos
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)
  
  // Filtros
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('todos')
  const [paymentFilter, setPaymentFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Control de interfaz responsive
  const [showMobileForm, setShowMobileForm] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeActionMenu, setActiveActionMenu] = useState(null)

  // Estado para detalles de finanzas y sobras (Task #3)
  const [orderExpenses, setOrderExpenses] = useState([])
  const [estimatedMaterials, setEstimatedMaterials] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsTab, setDetailsTab] = useState('trabajo') // 'trabajo' o 'finanzas'

  // Asistente de registro de pedidos (5 pasos)
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedPanelFilter, setSelectedPanelFilter] = useState('1 PANEL')
  const [orderForm, setOrderForm] = useState({
    clientName: '',
    clientNit: '',
    clientPhone: '',
    clientEmail: '',
    category: '',
    subcategory: '',
    sizes: initialSizes,
    sizePrices: settings.sizes, // Precios dinámicos para tallas
    itemTypes: initialItemTypes,
    productName: '',
    flatQuantity: 1,
    stitchesCount: 0,
    flatUnitPrice: 50,
    paymentMethod: 'efectivo',
    advanceAmount: 0,
    paymentNotes: '',
    particularDetails: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    basePanelPrice: 10,
    panelSizes: initialPanelSizes,
    panelSizePrices: getInitialPanelSizePrices(10)
  })
  const [formErrors, setFormErrors] = useState({})

  const [editingOrder, setEditingOrder] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [selectedPanelFilterEdit, setSelectedPanelFilterEdit] = useState('1 PANEL')

  const clientSuggestions = useMemo(() => {
    const query = orderForm.clientName?.trim().toLowerCase()
    if (!query || query.length < 2) return []
    return clients.filter(c => c.name.toLowerCase().includes(query) && c.name.toLowerCase() !== query)
  }, [clients, orderForm.clientName])

  // Update flatUnitPrice automatically when subcategory changes (if service)
  useEffect(() => {
    if (orderForm.category && orderForm.category !== 'produccion_textil' && orderForm.subcategory !== 'sublimacion_localizada' && currentStep === 4) {
      if (orderForm.flatUnitPrice === 50) {
         updateForm('flatUnitPrice', getServicePrice(orderForm.category, orderForm.subcategory))
      }
    }
  }, [orderForm.subcategory, currentStep, orderForm.category, settings, getServicePrice])

  useEffect(() => {
    if (user) {
      fetchOrders()
      fetchClients()
    }
  }, [user])

  // Cargar gastos relacionados y materiales estimados al seleccionar un pedido
  useEffect(() => {
    async function fetchOrderDetails() {
      if (!selectedOrder) {
        setOrderExpenses([])
        setEstimatedMaterials([])
        setDetailsTab('trabajo') // Reset tab
        return
      }

      setLoadingDetails(true)
      try {
        // 1. Cargar gastos vinculados a este pedido
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*, materials(*)')
          .eq('order_id', selectedOrder.id)
        
        if (expensesError) throw expensesError
        setOrderExpenses(expensesData || [])

        // 2. Cargar materiales estimados de la cotización si existe
        if (selectedOrder.quote_id) {
          const { data: quoteData, error: quoteError } = await supabase
            .from('quotes')
            .select(`
              quote_items (
                quantity,
                quote_materials (
                  *,
                  materials (*)
                )
              )
            `)
            .eq('id', selectedOrder.quote_id)
            .single()

          if (quoteError) throw quoteError

          if (quoteData?.quote_items) {
            // Aplanar y pre-calcular cantidad estimada total
            const flattenedMaterials = quoteData.quote_items.flatMap(item => {
              const itemQty = Number(item.quantity) || 1
              const mats = item.quote_materials || []
              return mats.map(m => {
                const qtyPerUnit = Number(m.quantity_per_unit) || 0
                const wastePct = Number(m.waste_pct) || 0
                return {
                  ...m,
                  item_quantity: itemQty,
                  estimated_qty: itemQty * qtyPerUnit * (1 + wastePct / 100),
                  estimated_cost: Number(m.total_cost) || 0
                }
              })
            })
            setEstimatedMaterials(flattenedMaterials)
          } else {
            setEstimatedMaterials([])
          }
        } else {
          setEstimatedMaterials([])
        }
      } catch (err) {
        console.error('Error fetching order finance details:', err)
      } finally {
        setLoadingDetails(false)
      }
    }

    fetchOrderDetails()
  }, [selectedOrder])

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('terceros')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'cliente')
        .order('name', { ascending: true })
      if (!error && data) {
        setClients(data)
      }
    } catch (e) {
      console.error('Error fetching clients:', e)
    }
  }

  // Si viene una cotización para convertir en el URL, abre el panel/modal
  useEffect(() => {
    if (convertQuoteId) {
      setShowMobileForm(true)
    }
  }, [convertQuoteId])

  async function fetchOrders() {
    setLoading(true)
    setDbError(null)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          terceros (name, phone),
          order_items (
            *
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        // Capturar si la tabla no existe en la BD
        if (error.code === '42P01' || error.message?.includes('relation "orders" does not exist')) {
          setDbError('orders_table_missing')
        } else {
          throw error
        }
      } else {
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setDbError(err.message || 'Error al cargar los pedidos.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (orderId, currentStatus) => {
    const statuses = ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado']
    const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length
    const nextStatus = statuses[nextIdx]
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)
      if (error) throw error
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o))
    } catch (err) {
      console.error('Error updating order status:', err)
      alert('Error al actualizar el estado: ' + err.message)
    }
  }

  const handleUpdatePaymentStatus = async (orderId, currentPaymentStatus, orderTotal) => {
    const paymentStatuses = ['pendiente', 'adelanto', 'pagado']
    const nextIdx = (paymentStatuses.indexOf(currentPaymentStatus) + 1) % paymentStatuses.length
    const nextPaymentStatus = paymentStatuses[nextIdx]
    
    let nextPaidAmount = 0
    if (nextPaymentStatus === 'pagado') {
      nextPaidAmount = orderTotal
    } else if (nextPaymentStatus === 'adelanto') {
      nextPaidAmount = orderTotal * 0.5
    }
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          payment_status: nextPaymentStatus,
          paid_amount: nextPaidAmount
        })
        .eq('id', orderId)
      if (error) throw error
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: nextPaymentStatus, paid_amount: nextPaidAmount } : o))
    } catch (err) {
      console.error('Error updating payment status:', err)
      alert('Error al actualizar el pago: ' + err.message)
    }
  }

  const handleDeleteOrder = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este pedido?')) {
      try {
        // Eliminar items primero por restricciones de llave foránea si no hay cascade delete
        await supabase
          .from('order_items')
          .delete()
          .eq('order_id', id)

        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', id)

        if (error) throw error
        setOrders(prev => prev.filter(o => o.id !== id))
      } catch (err) {
        console.error('Error deleting order:', err)
        alert('Error al eliminar el pedido: ' + err.message)
      }
    }
  }

  // Filtrar pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const clientName = o.terceros?.name || 'Cliente general'
      const orderNum = `#${o.order_number?.toString().padStart(4, '0')}`
      const firstItemName = o.order_items?.[0]?.name || ''

      const matchesSearch =
        clientName.toLowerCase().includes(search.toLowerCase()) ||
        orderNum.toLowerCase().includes(search.toLowerCase()) ||
        firstItemName.toLowerCase().includes(search.toLowerCase())

      const matchesType = typeFilter === 'todos' || o.order_type === typeFilter
      const matchesPayment = paymentFilter === 'todos' || o.payment_status === paymentFilter
      const matchesStatus = statusFilter === 'todos' || o.status === statusFilter

      return matchesSearch && matchesType && matchesPayment && matchesStatus
    })
  }, [orders, search, typeFilter, paymentFilter, statusFilter])

  // Estadísticas del día
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    let dailySales = 0
    let pendingProduction = 0
    let pendingCobro = 0

    orders.forEach(o => {
      const orderDateStr = o.created_at?.split('T')[0]
      if (orderDateStr === todayStr) {
        dailySales += parseFloat(o.total_amount) || 0
      }
      if (o.status === 'pendiente' || o.status === 'en_proceso') {
        pendingProduction++
      }
      pendingCobro += (parseFloat(o.total_amount) || 0) - (parseFloat(o.paid_amount) || 0)
    })

    return {
      dailySales,
      pendingProduction,
      pendingCobro
    }
  }, [orders])

  // Opciones de tipo de pedido para select
  const typeOptions = [
    { value: 'todos', label: 'Todos los tipos' },
    { value: 'servicio_diario', label: 'Servicio Diario (Venta Menor)' },
    { value: 'pedido_cotizado', label: 'Pedido Cotizado (Mayor)' }
  ]

  // Opciones de estado de pago
  const paymentOptions = [
    { value: 'todos', label: 'Cualquier Pago' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'adelanto', label: 'Adelanto' },
    { value: 'pagado', label: 'Pagado' }
  ]

  // Opciones de estado de producción
  const statusOptions = [
    { value: 'todos', label: 'Cualquier Producción' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_proceso', label: 'En Proceso' },
    { value: 'listo', label: 'Listo' },
    { value: 'entregado', label: 'Entregado' },
    { value: 'cancelado', label: 'Cancelado' }
  ]

  // Limpiar parámetro de cotización de URL al cerrar
  const handleCloseForm = () => {
    setShowMobileForm(false)
    setCurrentStep(1)
    setOrderForm({
      clientName: '',
      clientNit: '',
      clientPhone: '',
      clientEmail: '',
      category: '',
      subcategory: '',
      sizes: initialSizes,
      sizePrices: settings.sizes, // Precios por defecto del catálogo
      itemTypes: initialItemTypes,
      productName: '',
      flatQuantity: 1,
      stitchesCount: 0,
      flatUnitPrice: 50,
      paymentMethod: 'efectivo',
      advanceAmount: 0,
      paymentNotes: '',
      particularDetails: '',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      basePanelPrice: 10,
      panelSizes: initialPanelSizes,
      panelSizePrices: getInitialPanelSizePrices(10)
    })
    setFormErrors({})
    if (convertQuoteId) {
      searchParams.delete('convertQuoteId')
      setSearchParams(searchParams)
    }
  }

  const loadOrderToEdit = (order) => {
    const item = order.order_items?.[0]
    if (!item) return;

    const categoryObj = settings.categories.find(c => c.label.toLowerCase() === item.category.toLowerCase())
    const categoryId = categoryObj ? categoryObj.id : ''

    let subcategoryId = ''
    if (categoryId) {
      const subcategoryObj = (settings.subcategories[categoryId] || []).find(s => s.label.toLowerCase() === item.product_category.toLowerCase())
      subcategoryId = subcategoryObj ? subcategoryObj.id : ''
    }

    const isSublimacionPaneles = categoryId === 'servicios_sublimacion' && subcategoryId === 'sublimacion_localizada'
    
    let loadedPanelSizes = JSON.parse(JSON.stringify(initialPanelSizes))
    let loadedItemTypes = JSON.parse(JSON.stringify(initialItemTypes))
    let loadedSizes = JSON.parse(JSON.stringify(initialSizes))
    let loadedBasePanelPrice = 10

    if (isSublimacionPaneles && item.size_distribution) {
      PANELS_LIST.forEach(panel => {
        const pData = item.size_distribution[panel]
        if (pData) {
          loadedItemTypes[panel] = pData.tipo || PANEL_OPTIONS[panel]?.[0] || 'Otros'
          loadedSizes[panel] = Number(pData.cantidad) || 0
          if (pData.tallas) {
            SUBLIMATION_SIZES.forEach(size => {
              loadedPanelSizes[panel][size] = Number(pData.tallas[size]) || 0
            })
          }
        }
      })
      const itemMetrics = calculateItemMetrics(item.size_distribution)
      if (itemMetrics && itemMetrics.totalEquivalentPanels > 0) {
        loadedBasePanelPrice = Math.round((item.total_price / itemMetrics.totalEquivalentPanels) * 10) / 10
      }
    } else if (item.size_distribution) {
      SIZES_LIST.forEach(size => {
        loadedSizes[size] = Number(item.size_distribution[size]) || 0
      })
    }

    const initialPrices = categoryId === 'produccion_textil'
      ? settings.sizes
      : (categoryId && subcategoryId && settings.sizesBySubcategory?.[subcategoryId]) || settings.sizes

    setEditForm({
      orderId: order.id,
      itemId: item.id,
      clientName: order.terceros?.name || 'Cliente general',
      category: categoryId,
      subcategory: subcategoryId,
      sizes: loadedSizes,
      sizePrices: initialPrices,
      itemTypes: loadedItemTypes,
      productName: item.name || '',
      flatQuantity: Number(item.quantity) || 1,
      stitchesCount: item.production_time_minutes ? (Number(item.quantity) * 1000) : 0,
      flatUnitPrice: Number(item.unit_price) || 50,
      particularDetails: item.description || '',
      orderNotes: order.notes || '',
      orderDate: order.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      deliveryDate: order.delivery_date?.split('T')[0] || '',
      basePanelPrice: loadedBasePanelPrice,
      panelSizes: loadedPanelSizes,
      panelSizePrices: getInitialPanelSizePrices(loadedBasePanelPrice)
    })

    setEditingOrder(order)
    setSelectedPanelFilterEdit('1 PANEL')
  }

  const updateEditForm = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateEditSizeQty = (size, delta) => {
    setEditForm(prev => {
      const currentVal = prev.sizes[size] || 0
      const newVal = Math.max(0, currentVal + delta)
      return {
        ...prev,
        sizes: {
          ...prev.sizes,
          [size]: newVal
        }
      }
    })
  }

  const updateEditSizePrice = (size, val) => {
    setEditForm(prev => ({
      ...prev,
      sizePrices: {
        ...prev.sizePrices,
        [size]: Math.max(0, parseFloat(val) || 0)
      }
    }))
  }

  const updateEditFormItemType = (panel, val) => {
    setEditForm(prev => ({
      ...prev,
      itemTypes: {
        ...prev.itemTypes,
        [panel]: val
      }
    }))
  }

  const handleEditBasePanelPriceChange = (val) => {
    const numericVal = parseFloat(val) || 0
    setEditForm(prev => {
      const newPrices = PANELS_LIST.reduce((acc, panel) => {
        const match = panel.match(/^(\d+)/)
        const panelsCount = match ? parseInt(match[1]) : 1
        const sizePrices = SUBLIMATION_SIZES.reduce((accSize, size) => {
          const factor = SIZE_FACTORS[size]?.priceFactor || 1.0
          const price = numericVal * factor * panelsCount
          return { ...accSize, [size]: price }
        }, {})
        return { ...acc, [panel]: sizePrices }
      }, {})
      return {
        ...prev,
        basePanelPrice: numericVal,
        panelSizePrices: newPrices
      }
    })
  }

  const updateEditPanelSizeQty = (panel, size, deltaOrVal, isDirectVal = false) => {
    setEditForm(prev => {
      const currentVal = prev.panelSizes[panel]?.[size] || 0
      const newVal = isDirectVal ? Math.max(0, deltaOrVal) : Math.max(0, currentVal + deltaOrVal)
      const updatedSizes = {
        ...prev.panelSizes,
        [panel]: {
          ...prev.panelSizes[panel],
          [size]: newVal
        }
      }
      const totalQtyForPanel = Object.values(updatedSizes[panel]).reduce((sum, v) => sum + v, 0)
      return {
        ...prev,
        panelSizes: updatedSizes,
        sizes: {
          ...prev.sizes,
          [panel]: totalQtyForPanel
        }
      }
    })
  }

  const editMetrics = useMemo(() => {
    if (!editForm || !editForm.panelSizes) return { totalGarments: 0, totalNominalPanels: 0, totalEquivalentPanels: 0, totalM2: 0 }
    let totalGarments = 0
    let totalNominalPanels = 0
    let totalEquivalentPanels = 0
    let totalM2 = 0

    PANELS_LIST.forEach(panel => {
      const match = panel.match(/^(\d+)/)
      const panelsPerGarment = match ? parseInt(match[1]) : 1
      SUBLIMATION_SIZES.forEach(size => {
        const qty = editForm.panelSizes[panel]?.[size] || 0
        if (qty > 0) {
          totalGarments += qty
          totalNominalPanels += qty * panelsPerGarment
          const f = SIZE_FACTORS[size]
          if (f) {
            const idx = Math.min(4, panelsPerGarment - 1)
            const m2Val = f.m2[idx] * (panelsPerGarment > 5 ? panelsPerGarment / 5 : 1)
            const pVal = f.panels[idx] * (panelsPerGarment > 5 ? panelsPerGarment / 5 : 1)
            totalM2 += qty * m2Val
            totalEquivalentPanels += qty * pVal
          }
        }
      })
    })

    return { totalGarments, totalNominalPanels, totalEquivalentPanels, totalM2 }
  }, [editForm?.panelSizes])

  const editTotalAmount = useMemo(() => {
    if (!editForm) return 0
    const activeSub = settings.subcategories[editForm.category]?.find(s => s.id === editForm.subcategory)
    const usesSizes = activeSub?.unit === 'tallas' || (!activeSub?.unit && editForm.category === 'produccion_textil')

    if (usesSizes) {
      return Object.entries(editForm.sizes).reduce((sum, [size, qty]) => {
        if (!SIZES_LIST.includes(size)) return sum;
        const price = editForm.sizePrices[size] || 0
        return sum + (parseInt(qty) || 0) * parseFloat(price)
      }, 0)
    } else if (editForm.category === 'servicios_sublimacion' && editForm.subcategory === 'sublimacion_localizada') {
      return PANELS_LIST.reduce((sum, panel) => {
        const panelSum = SUBLIMATION_SIZES.reduce((subSum, size) => {
          const qty = editForm.panelSizes[panel]?.[size] || 0
          const price = editForm.panelSizePrices[panel]?.[size] || 0
          return subSum + qty * price
        }, 0)
        return sum + panelSum
      }, 0)
    } else {
      const unit = activeSub?.unit || 'unidad';
      if (unit === '1000_puntadas') {
         return ((parseInt(editForm.stitchesCount) || 0) / 1000) * parseFloat(editForm.flatUnitPrice) * (parseInt(editForm.flatQuantity) || 1)
      } else {
         return (parseInt(editForm.flatQuantity) || 0) * (parseFloat(editForm.flatUnitPrice) || 0)
      }
    }
  }, [editForm?.category, editForm?.subcategory, editForm?.sizes, editForm?.sizePrices, editForm?.flatQuantity, editForm?.flatUnitPrice, editForm?.stitchesCount, editForm?.panelSizes, editForm?.panelSizePrices, settings])

  const handleUpdateOrder = async () => {
    if (saving) return
    const activeSub = settings.subcategories[editForm.category]?.find(s => s.id === editForm.subcategory)
    const usesSizes = activeSub?.unit === 'tallas' || (!activeSub?.unit && editForm.category === 'produccion_textil')
    const isSublimacionPaneles = editForm.category === 'servicios_sublimacion' && editForm.subcategory === 'sublimacion_localizada'

    // Validation
    if (usesSizes) {
      const totalQty = Object.entries(editForm.sizes).reduce((sum, [k, v]) => SIZES_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
      if (totalQty <= 0) {
        alert('Debe ingresar cantidad en al menos una talla.')
        return
      }
    } else if (isSublimacionPaneles) {
      const totalPanels = Object.entries(editForm.sizes).reduce((sum, [k, v]) => PANELS_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
      if (totalPanels <= 0) {
        alert('Debe ingresar cantidad en al menos un tipo de panel.')
        return
      }
    } else {
      if (!editForm.productName?.trim()) {
        alert('El detalle del servicio es requerido.')
        return
      }
      if ((parseInt(editForm.flatQuantity) || 0) <= 0) {
        alert('La cantidad debe ser mayor a 0.')
        return
      }
      if ((parseFloat(editForm.flatUnitPrice) || 0) <= 0) {
        alert('El precio unitario debe ser mayor a 0.')
        return
      }
    }

    setSaving(true)
    try {
      // 1. Recalcular cantidades y distribución
      const qty = usesSizes
        ? Object.entries(editForm.sizes).reduce((sum, [k, v]) => SIZES_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
        : isSublimacionPaneles
          ? Object.entries(editForm.sizes).reduce((sum, [k, v]) => PANELS_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
          : editForm.flatQuantity
          
      const unitPrice = usesSizes
        ? (editTotalAmount / Math.max(1, qty))
        : isSublimacionPaneles
          ? (editTotalAmount / Math.max(1, qty))
          : editForm.flatUnitPrice

      const sizeDist = usesSizes
        ? SIZES_LIST.reduce((acc, size) => ({ ...acc, [size]: editForm.sizes[size] || 0 }), {})
        : isSublimacionPaneles
          ? PANELS_LIST.reduce((acc, panel) => {
              const qtyQty = editForm.sizes[panel] || 0
              const type = editForm.itemTypes[panel] || 'Otros'
              const tallas = SUBLIMATION_SIZES.reduce((accSize, size) => {
                const q = editForm.panelSizes[panel]?.[size] || 0
                if (q > 0) accSize[size] = q
                return accSize
              }, {})
              return { ...acc, [panel]: { cantidad: qtyQty, tipo: type, tallas: tallas } }
            }, {})
          : null

      const itemName = (usesSizes || isSublimacionPaneles)
        ? `${settings.subcategories[editForm.category]?.find(s => s.id === editForm.subcategory)?.label || 'Producto'} (${settings.categories.find(c => c.id === editForm.category)?.label})`
        : editForm.productName

      const total = editTotalAmount
      const advance = editingOrder.paid_amount
      const paymentStatus = advance >= total ? 'pagado' : (advance > 0 ? 'adelanto' : 'pendiente')

      // 2. Actualizar tabla orders
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          notes: editForm.orderNotes || '',
          delivery_date: editForm.deliveryDate ? new Date(editForm.deliveryDate).toISOString() : null,
          total_amount: total,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', editForm.orderId)

      if (orderError) throw orderError

      // 3. Actualizar tabla order_items
      const { error: itemError } = await supabase
        .from('order_items')
        .update({
          name: itemName,
          description: editForm.particularDetails || '',
          quantity: qty,
          unit_price: unitPrice,
          total_price: total,
          size_distribution: sizeDist
        })
        .eq('id', editForm.itemId)

      if (itemError) throw itemError

      // 4. Recargar lista y limpiar
      await fetchOrders()
      setEditingOrder(null)
      setEditForm(null)
      alert('Pedido actualizado con éxito.')
    } catch (err) {
      console.error('Error al actualizar pedido:', err)
      alert(`Error al actualizar el pedido: ${err.message || 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  // Helper methods for order entry wizard
  const updateForm = (field, value) => {
    setOrderForm(prev => ({
      ...prev,
      [field]: value
    }))
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const updateSizeQty = (size, delta) => {
    setOrderForm(prev => {
      const currentVal = prev.sizes[size] || 0
      const newVal = Math.max(0, currentVal + delta)
      return {
        ...prev,
        sizes: {
          ...prev.sizes,
          [size]: newVal
        }
      }
    })
    if (formErrors.sizes) {
      setFormErrors(prev => {
        const next = { ...prev }
        delete next.sizes
        return next
      })
    }
  }

  const updateSizePrice = (size, val) => {
    setOrderForm(prev => ({
      ...prev,
      sizePrices: {
        ...prev.sizePrices,
        [size]: Math.max(0, parseFloat(val) || 0)
      }
    }))
  }

  const updateFormItemType = (panel, val) => {
    setOrderForm(prev => ({
      ...prev,
      itemTypes: {
        ...prev.itemTypes,
        [panel]: val
      }
    }))
  }

  const handleBasePanelPriceChange = (val) => {
    const numericVal = parseFloat(val) || 0
    setOrderForm(prev => {
      const newPrices = PANELS_LIST.reduce((acc, panel) => {
        const match = panel.match(/^(\d+)/)
        const panelsCount = match ? parseInt(match[1]) : 1
        const sizePrices = SUBLIMATION_SIZES.reduce((accSize, size) => {
          const factor = SIZE_FACTORS[size]?.priceFactor || 1.0
          const price = numericVal * factor * panelsCount
          return { ...accSize, [size]: price }
        }, {})
        return { ...acc, [panel]: sizePrices }
      }, {})
      return {
        ...prev,
        basePanelPrice: numericVal,
        panelSizePrices: newPrices
      }
    })
  }

  const metrics = useMemo(() => {
    let totalGarments = 0
    let totalNominalPanels = 0
    let totalEquivalentPanels = 0
    let totalM2 = 0

    PANELS_LIST.forEach(panel => {
      const match = panel.match(/^(\d+)/)
      const panelsPerGarment = match ? parseInt(match[1]) : 1
      
      SUBLIMATION_SIZES.forEach(size => {
        const qty = orderForm.panelSizes[panel]?.[size] || 0
        if (qty > 0) {
          totalGarments += qty
          totalNominalPanels += qty * panelsPerGarment
          
          const f = SIZE_FACTORS[size]
          if (f) {
            const idx = Math.min(4, panelsPerGarment - 1)
            const m2Val = f.m2[idx] * (panelsPerGarment > 5 ? panelsPerGarment / 5 : 1)
            const pVal = f.panels[idx] * (panelsPerGarment > 5 ? panelsPerGarment / 5 : 1)
            totalM2 += qty * m2Val
            totalEquivalentPanels += qty * pVal
          }
        }
      })
    })

    return { totalGarments, totalNominalPanels, totalEquivalentPanels, totalM2 }
  }, [orderForm.panelSizes])

  const totalAmount = useMemo(() => {
    const activeSub = settings.subcategories[orderForm.category]?.find(s => s.id === orderForm.subcategory)
    const usesSizes = activeSub?.unit === 'tallas' || (!activeSub?.unit && orderForm.category === 'produccion_textil')

    if (usesSizes) {
      return Object.entries(orderForm.sizes).reduce((sum, [size, qty]) => {
        if (!SIZES_LIST.includes(size)) return sum;
        const price = orderForm.sizePrices[size] || 0
        return sum + (parseInt(qty) || 0) * parseFloat(price)
      }, 0)
    } else if (orderForm.category === 'servicios_sublimacion' && orderForm.subcategory === 'sublimacion_localizada') {
      return PANELS_LIST.reduce((sum, panel) => {
        const panelSum = SUBLIMATION_SIZES.reduce((subSum, size) => {
          const qty = orderForm.panelSizes[panel]?.[size] || 0
          const price = orderForm.panelSizePrices[panel]?.[size] || 0
          return subSum + qty * price
        }, 0)
        return sum + panelSum
      }, 0)
    } else {
      const unit = activeSub?.unit || 'unidad';
      
      if (unit === '1000_puntadas') {
         return ((parseInt(orderForm.stitchesCount) || 0) / 1000) * parseFloat(orderForm.flatUnitPrice) * (parseInt(orderForm.flatQuantity) || 1)
      } else {
         return (parseInt(orderForm.flatQuantity) || 0) * (parseFloat(orderForm.flatUnitPrice) || 0)
      }
    }
  }, [orderForm.category, orderForm.subcategory, orderForm.sizes, orderForm.sizePrices, orderForm.flatQuantity, orderForm.flatUnitPrice, orderForm.stitchesCount, orderForm.panelSizes, orderForm.panelSizePrices, settings])

  const subtotal = totalAmount / 1.18
  const igvAmount = totalAmount - subtotal

  const orderMetrics = useMemo(() => {
    if (!selectedOrder?.order_items) return null;
    return selectedOrder.order_items.reduce((acc, item) => {
      const itemMetrics = calculateItemMetrics(item.size_distribution);
      if (itemMetrics) {
        acc.totalNominalPanels += itemMetrics.totalNominalPanels;
        acc.totalEquivalentPanels += itemMetrics.totalEquivalentPanels;
        acc.totalM2 += itemMetrics.totalM2;
      }
      return acc;
    }, { totalNominalPanels: 0, totalEquivalentPanels: 0, totalM2: 0 });
  }, [selectedOrder])

  const validateStep = (step) => {
    const errors = {}
    if (step === 1) {
      if (!orderForm.clientName?.trim()) {
        errors.clientName = 'El nombre o razón social es requerido.'
      }
    } else if (step === 2) {
      if (!orderForm.category) {
        errors.category = 'Debe seleccionar una categoría principal.'
      }
    } else if (step === 3) {
      if (!orderForm.subcategory) {
        errors.subcategory = 'Debe seleccionar una subcategoría.'
      }
    } else if (step === 4) {
      const activeSub = settings.subcategories[orderForm.category]?.find(s => s.id === orderForm.subcategory)
      const usesSizes = activeSub?.unit === 'tallas' || (!activeSub?.unit && orderForm.category === 'produccion_textil')

      if (usesSizes) {
        const totalQty = Object.entries(orderForm.sizes).reduce((sum, [k, v]) => SIZES_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
        if (totalQty <= 0) {
          errors.sizes = 'Debe ingresar cantidad en al menos una talla.'
        }
      } else if (orderForm.category === 'servicios_sublimacion' && orderForm.subcategory === 'sublimacion_localizada') {
        const totalPanels = Object.entries(orderForm.sizes).reduce((sum, [k, v]) => PANELS_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
        if (totalPanels <= 0) {
          errors.sizes = 'Debe ingresar cantidad en al menos un tipo de panel.'
        }
      } else {
        if (!orderForm.productName?.trim()) {
          errors.productName = 'El detalle del servicio es requerido.'
        }
        if ((parseInt(orderForm.flatQuantity) || 0) <= 0) {
          errors.flatQuantity = 'La cantidad debe ser mayor a 0.'
        }
        if ((parseFloat(orderForm.flatUnitPrice) || 0) <= 0) {
          errors.flatUnitPrice = 'El precio unitario debe ser mayor a 0.'
        }
      }
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep(prev => prev + 1)
      } else {
        handleRegister()
      }
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    } else {
      handleCloseForm()
    }
  }

  const handleRegister = async () => {
    if (saving) return; // Prevent double submit
    
    const total = totalAmount
    const advance = parseFloat(orderForm.advanceAmount) || 0
    const activeSub = settings.subcategories[orderForm.category]?.find(s => s.id === orderForm.subcategory)
    const usesSizes = activeSub?.unit === 'tallas' || (!activeSub?.unit && orderForm.category === 'produccion_textil')
    const isSublimacionPaneles = orderForm.category === 'servicios_sublimacion' && orderForm.subcategory === 'sublimacion_localizada'

    setSaving(true)
    try {
      let clientId = null
      const clientName = orderForm.clientName.trim()
      const clientPhone = orderForm.clientPhone?.trim() || ''
      const clientEmail = orderForm.clientEmail?.trim() || ''
      const clientNit = orderForm.clientNit?.trim() || ''

      // 1. Resolver el cliente (buscar si existe o crear uno nuevo)
      const { data: existingClients, error: clientFindError } = await supabase
        .from('terceros')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', clientName)
        .eq('role', 'cliente')
        
      if (clientFindError) throw clientFindError

      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id
      } else {
        const { data: newClient, error: clientCreateError } = await supabase
          .from('terceros')
          .insert({
            user_id: user.id,
            name: clientName,
            phone: clientPhone,
            email: clientEmail,
            role: 'cliente',
            notes: clientNit ? `NIT: ${clientNit}` : ''
          })
          .select()
          .single()
        if (clientCreateError) throw clientCreateError
        clientId = newClient.id
      }

      // 2. Insertar el Pedido principal
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          tercero_id: clientId,
          order_type: orderForm.category === 'produccion_textil' ? 'pedido_cotizado' : 'servicio_diario',
          status: 'pendiente',
          payment_status: advance >= total ? 'pagado' : (advance > 0 ? 'adelanto' : 'pendiente'),
          total_amount: total,
          paid_amount: advance,
          delivery_date: orderForm.deliveryDate ? new Date(orderForm.deliveryDate).toISOString().split('T')[0] : null,
          created_at: orderForm.orderDate ? new Date(orderForm.orderDate + 'T12:00:00Z').toISOString() : new Date().toISOString(),
          notes: orderForm.paymentNotes
        })
        .select()
        .single()
      if (orderError) throw orderError

      // 3. Calcular cantidades y distribución
      const qty = usesSizes
        ? Object.entries(orderForm.sizes).reduce((sum, [k, v]) => SIZES_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
        : isSublimacionPaneles
          ? Object.entries(orderForm.sizes).reduce((sum, [k, v]) => PANELS_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0)
          : orderForm.flatQuantity
          
      const unitPrice = usesSizes
        ? (total / Math.max(1, qty))
        : isSublimacionPaneles
          ? (total / Math.max(1, qty))
          : orderForm.flatUnitPrice

      const sizeDist = usesSizes
        ? SIZES_LIST.reduce((acc, size) => ({ ...acc, [size]: orderForm.sizes[size] || 0 }), {})
        : isSublimacionPaneles
          ? PANELS_LIST.reduce((acc, panel) => {
              const qtyQty = orderForm.sizes[panel] || 0
              const type = orderForm.itemTypes[panel] || 'Otros'
              const tallas = SUBLIMATION_SIZES.reduce((accSize, size) => {
                const q = orderForm.panelSizes[panel]?.[size] || 0
                if (q > 0) accSize[size] = q
                return accSize
              }, {})
              return { ...acc, [panel]: { cantidad: qtyQty, tipo: type, tallas: tallas } }
            }, {})
          : null

      const itemName = (usesSizes || isSublimacionPaneles)
        ? `${settings.subcategories[orderForm.category]?.find(s => s.id === orderForm.subcategory)?.label || 'Producto'} (${settings.categories.find(c => c.id === orderForm.category)?.label})`
        : orderForm.productName

      // 4. Insertar el Ítem del Pedido
      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: newOrder.id,
          name: itemName,
          category: settings.categories.find(c => c.id === orderForm.category)?.label || 'otro',
          product_category: settings.subcategories[orderForm.category]?.find(s => s.id === orderForm.subcategory)?.label || '',
          description: orderForm.particularDetails || '',
          quantity: qty,
          unit_price: unitPrice,
          total_price: total,
          size_distribution: sizeDist
        })
      if (itemError) throw itemError

      // 5. Recargar lista y limpiar
      await fetchOrders()
      await fetchClients()
      handleCloseForm()
      alert('Pedido registrado con éxito en la Base de Datos.')
    } catch (err) {
      console.error('Error al registrar pedido:', err)
      alert(`Error al registrar el pedido: ${err.message || 'Error desconocido'}`)
    } finally {
      setSaving(false)
    }
  }

  // Renderizador del panel lateral
  const renderNewOrderPanel = (isMobile = false, onClose = null) => {
    const activeSub = settings.subcategories[orderForm.category]?.find(s => s.id === orderForm.subcategory)
    const usesSizes = activeSub?.unit === 'tallas' || (!activeSub?.unit && orderForm.category === 'produccion_textil')

    return (
      <div className="space-y-6">
        <style dangerouslySetInnerHTML={{__html: `
          .sizes-scroll-container {
            display: grid;
            grid-template-rows: repeat(2, minmax(0, 1fr));
            grid-auto-flow: column;
            gap: 12px;
            overflow-x: auto;
          }
          .sizes-scroll-container::-webkit-scrollbar {
            height: 6px;
          }
          .sizes-scroll-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 3px;
          }
          .sizes-scroll-container::-webkit-scrollbar-thumb {
            background: rgba(255, 92, 0, 0.3);
            border-radius: 3px;
          }
          .sizes-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #ff5c00;
          }
          .panels-scroll-container {
            display: flex;
            gap: 12px;
            overflow-x: auto;
          }
          .panels-scroll-container::-webkit-scrollbar {
            height: 6px;
          }
          .panels-scroll-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 3px;
          }
          .panels-scroll-container::-webkit-scrollbar-thumb {
            background: rgba(255, 92, 0, 0.3);
            border-radius: 3px;
          }
          .panels-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #ff5c00;
          }
        `}} />

        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <div>
            <h3 className="text-body-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">add_shopping_cart</span>
              Registrar Nuevo Pedido
            </h3>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider mt-1">
              Ingreso de Ventas y Servicios Manual
            </p>
          </div>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="neu-raised-sm p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* Step Indicator and Progress Bars */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-mono text-[#ff5c00] uppercase tracking-wider font-bold">Paso {currentStep} de 5</span>
            <span className="text-on-surface-variant/70">Ingreso Manual</span>
          </div>
          <div className="flex gap-1.5 h-1.5 w-full bg-white/[0.02] rounded-full p-[1px]">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-full rounded-full transition-all duration-300 ${
                  s <= currentStep ? 'bg-[#ff5c00] shadow-[0_0_6px_rgba(255,92,0,0.6)]' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[340px] flex flex-col justify-between">
          <div className="space-y-4">
            {/* ─── PASO 1: Registro de Cliente ─── */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-lg border border-white/5">
                  <p className="text-[11px] text-on-surface-variant/80">
                    ¿Es un cliente rápido?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      updateForm('clientName', 'Cliente General')
                      updateForm('clientNit', '')
                      updateForm('clientPhone', '')
                      updateForm('clientEmail', '')
                      setCurrentStep(2)
                    }}
                    className="neu-raised-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-primary hover:text-white transition-colors cursor-pointer"
                  >
                    Usar Cliente General ⚡
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      label="Nombre o Razón Social"
                      value={orderForm.clientName}
                      onChange={e => updateForm('clientName', e.target.value)}
                      placeholder="Ej. Textiles Pro-Weave S.A."
                      error={formErrors.clientName}
                      required
                    />
                    {clientSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-surface-container border border-outline-variant rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-outline-variant/30">
                        {clientSuggestions.map(client => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              updateForm('clientName', client.name)
                              updateForm('clientPhone', client.phone || '')
                              updateForm('clientEmail', client.email || '')
                              const nitMatch = client.notes?.match(/NIT:\s*([^\s,]+)/)
                              updateForm('clientNit', nitMatch ? nitMatch[1] : '')
                            }}
                            className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-primary/10 hover:text-primary transition-colors flex justify-between items-center bg-transparent border-none"
                          >
                            <span className="font-semibold">{client.name}</span>
                            {client.phone && <span className="text-[10px] text-on-surface-variant font-mono">{client.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input
                    label="ID / NIT (Opcional)"
                    value={orderForm.clientNit}
                    onChange={e => updateForm('clientNit', e.target.value)}
                    placeholder="Ej. 10293847-5"
                    className="font-mono"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Teléfono"
                      value={orderForm.clientPhone}
                      onChange={e => updateForm('clientPhone', e.target.value)}
                      placeholder="Ej. 70012345"
                      className="font-mono"
                    />
                    <Input
                      label="Correo Electrónico"
                      type="email"
                      value={orderForm.clientEmail}
                      onChange={e => updateForm('clientEmail', e.target.value)}
                      placeholder="cliente@correo.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── PASO 2: Categorización de Ingreso ─── */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-xs text-on-surface-variant/80">
                  Selecciona la categoría principal del pedido o servicio a registrar.
                </p>
                {formErrors.category && (
                  <AlertBanner type="error">{formErrors.category}</AlertBanner>
                )}
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                  {settings.categories.map((cat) => {
                    const isActive = orderForm.category === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          updateForm('category', cat.id)
                          updateForm('subcategory', '')
                          updateForm('deliveryDate', getDefaultDeliveryDate(cat.id))
                          
                          // Pre-cargar precios según la categoría elegida
                          if (cat.id === 'produccion_textil') {
                             updateForm('sizePrices', settings.sizes)
                          } else if (cat.id === 'servicios_sublimacion') {
                             const subLocalizada = settings.subcategories['servicios_sublimacion']?.find(s => s.id === 'sublimacion_localizada')
                             const basePanelPrice = subLocalizada?.unitPrice || 20
                             const calculatedPanelPrices = PANELS_LIST.reduce((acc, panel, idx) => {
                               acc[panel] = basePanelPrice * (idx + 1)
                               return acc
                             }, {})
                             updateForm('sizePrices', calculatedPanelPrices)
                          }

                          setCurrentStep(3)
                        }}
                        className={`btn-3d-raised rounded-xl p-3 flex flex-col items-center justify-center gap-2 h-24 text-center cursor-pointer ${
                          isActive ? 'btn-3d-active' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[28px] ${isActive ? 'text-[#ff5c00]' : 'text-on-surface-variant'}`}>
                          {cat.icon}
                        </span>
                        <span className="text-[11px] font-bold tracking-wide text-on-surface leading-tight">
                          {cat.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── PASO 3: Selección de Subcategoría ─── */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-xs text-on-surface-variant/80">
                  Detalla la subcategoría específica del servicio seleccionado.
                </p>
                {formErrors.subcategory && (
                  <AlertBanner type="error">{formErrors.subcategory}</AlertBanner>
                )}
                {(() => {
                  const isProduccionTextil = orderForm.category === 'produccion_textil';
                  return (
                    <div className={`grid ${isProduccionTextil ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3 max-w-md mx-auto`}>
                      {(settings.subcategories[orderForm.category] || []).map((sub) => {
                        const isActive = orderForm.subcategory === sub.id
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              updateForm('subcategory', sub.id)
                              const usesSizes = sub.unit === 'tallas' || (!sub.unit && orderForm.category === 'produccion_textil')
                              
                              if (!usesSizes && sub.id !== 'sublimacion_localizada') {
                                 const price = sub.unitPrice || getServicePrice(orderForm.category, sub.id) || 50
                                 updateForm('flatUnitPrice', price)
                                 updateForm('productName', sub.label)
                              } else if (sub.id === 'sublimacion_localizada') {
                                 const basePanelPrice = sub.unitPrice || 20
                                 const calculatedPanelPrices = PANELS_LIST.reduce((acc, panel, idx) => {
                                   acc[panel] = basePanelPrice * (idx + 1)
                                   return acc
                                 }, {})
                                 updateForm('sizePrices', calculatedPanelPrices)
                              } else if (usesSizes) {
                                 const specificPrices = settings.sizesBySubcategory?.[sub.id];
                                 if (specificPrices && Object.keys(specificPrices).length > 0) {
                                   updateForm('sizePrices', specificPrices);
                                 } else {
                                   updateForm('sizePrices', settings.sizes);
                                 }
                              }
                              setCurrentStep(4)
                            }}
                            className={`btn-3d-raised rounded-xl p-3 flex items-center gap-3 cursor-pointer text-left ${
                              isActive ? 'btn-3d-active' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-[#ff5c00]/10' : 'bg-white/5'}`}>
                              <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-[#ff5c00]' : 'text-on-surface-variant'}`}>
                                {sub.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={isProduccionTextil ? "text-[11px] font-bold text-on-surface tracking-wide truncate" : "text-[12px] font-bold text-on-surface tracking-wide leading-tight"}>
                                {sub.label}
                              </p>
                              <p className={isProduccionTextil ? "text-[9px] text-on-surface-variant truncate" : "text-[10px] text-on-surface-variant leading-tight mt-0.5"}>
                                {sub.description}
                              </p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'led-glow-active' : 'bg-white/10'}`} />
                          </button>
                        )
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ─── PASO 4: Registro de Pedido (Detalle / Cantidades) ─── */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-fade-in">
                {/* Encabezado de la Subcategoría Seleccionada */}
                {(() => {
                  const subLabel = settings.subcategories[orderForm.category]?.find(sub => sub.id === orderForm.subcategory)?.label || '';
                  if (!subLabel) return null;
                  return (
                    <div className="neu-pressed px-3 py-2 rounded-xl flex items-center gap-2 border border-white/5 bg-white/[0.01]">
                      <span className="material-symbols-outlined text-primary text-[18px]">bookmark</span>
                      <div className="flex-1">
                        <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">Servicio Seleccionado</p>
                        <p className="text-xs font-bold text-white uppercase">{subLabel}</p>
                      </div>
                    </div>
                  );
                })()}

                 {usesSizes ? (
                  <div className="space-y-3">
                    <p className="text-xs text-on-surface-variant/80">
                      Modifica la cantidad y el precio sugerido de confección por talla (desliza horizontalmente, 2 filas).
                    </p>
                    {formErrors.sizes && (
                      <AlertBanner type="error">{formErrors.sizes}</AlertBanner>
                    )}
                    <div className="sizes-scroll-container pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-[#ff5c00]/30 scrollbar-track-transparent">
                      {SIZES_LIST.map((size) => {
                        const qty = orderForm.sizes[size] || 0
                        const price = orderForm.sizePrices[size] || 0
                        return (
                          <div key={size} className="min-w-[155px] w-[155px] flex-shrink-0 snap-start p-3 bg-surface-container rounded-xl border border-outline-variant space-y-2 text-on-surface">
                            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-1">
                              <span className="text-body-md font-bold text-primary">{size}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-on-surface-variant font-mono">P. Ud:</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={price}
                                  onChange={e => updateSizePrice(size, e.target.value)}
                                  className="w-12 text-right bg-transparent border-none rounded px-1 py-0.5 text-xs text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary/50 neu-pressed"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between neu-pressed rounded-lg p-1 border border-outline-variant/30">
                              <button
                                type="button"
                                onClick={() => updateSizeQty(size, -1)}
                                className="w-7 h-7 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-xs text-on-surface hover:text-[#ff5c00] cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[12px]">remove</span>
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={qty}
                                onChange={e => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0)
                                  setOrderForm(prev => ({
                                    ...prev,
                                    sizes: { ...prev.sizes, [size]: val }
                                  }))
                                }}
                                className="bg-transparent border-none text-center w-8 font-mono text-xs text-on-surface outline-none focus:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => updateSizeQty(size, 1)}
                                className="w-7 h-7 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-xs text-primary cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[12px]">add</span>
                              </button>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-on-surface-variant/80 font-mono">
                                Sub: {formatCurrency(qty * price)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (orderForm.category === 'servicios_sublimacion' && orderForm.subcategory === 'sublimacion_localizada') ? (
                  <div className="space-y-4">
                    {/* Configuración de Tarifa Base por Panel */}
                    <div className="neu-pressed px-3 py-2 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#ff7a00] text-sm">payments</span>
                        <span className="text-xs font-bold text-white">Precio Base por Panel:</span>
                      </div>
                      <div className="w-[90px] shrink-0">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={orderForm.basePanelPrice || 10}
                          onChange={e => handleBasePanelPriceChange(e.target.value)}
                          className="w-full bg-transparent border-none rounded px-2 py-1 text-xs font-bold text-[#ff7a00] text-right outline-none focus:ring-1 focus:ring-primary/50 font-mono neu-pressed"
                        />
                      </div>
                    </div>

                    {/* Botones de Selección de Panel (Filtro) */}
                    <div className="flex gap-2 pb-1 justify-between">
                      {PANELS_LIST.map((panel) => {
                        const isActive = selectedPanelFilter === panel
                        const num = panel.match(/^(\d+)/)?.[0] || '1'
                        return (
                          <button
                            key={panel}
                            type="button"
                            onClick={() => setSelectedPanelFilter(panel)}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center btn-3d-raised ${
                              isActive ? 'btn-3d-active border-[#ff5c00]/50' : 'text-on-surface-variant'
                            }`}
                          >
                            {num}P
                          </button>
                        )
                      })}
                    </div>

                    {formErrors.sizes && (
                      <AlertBanner type="error">{formErrors.sizes}</AlertBanner>
                    )}

                    <div>
                      {(() => {
                        const panel = selectedPanelFilter
                        const totalQty = Object.values(orderForm.panelSizes[panel] || {}).reduce((sum, v) => sum + v, 0)
                        
                        return (
                          <div key={panel} className="w-full p-4 bg-surface-container rounded-xl border border-outline-variant space-y-4 text-on-surface">
                            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                              <div>
                                <span className="text-sm font-black text-primary block">{panel}</span>
                                <span className="text-[9px] text-on-surface-variant font-mono uppercase">Prendas Totales: {totalQty}</span>
                              </div>
                              
                              {/* Dropdown y Textbox para Tipo de Item */}
                              {(() => {
                                const options = PANEL_OPTIONS[panel] || [];
                                const currentVal = orderForm.itemTypes[panel] || 'Otros';
                                const isCustom = !options.filter(opt => opt !== 'Otros').includes(currentVal);
                                const selectVal = isCustom ? 'Otros' : currentVal;

                                return (
                                  <div className="w-[170px] flex flex-col gap-1 items-end">
                                    <select
                                      value={selectVal}
                                      onChange={e => {
                                        const val = e.target.value
                                        updateFormItemType(panel, val)
                                      }}
                                      className="w-full bg-transparent border-none rounded px-2 py-1 text-[11px] font-semibold text-white outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer neu-pressed"
                                    >
                                      {options.map(opt => (
                                        <option key={opt} value={opt} className="bg-surface text-on-surface text-[11px]">{opt}</option>
                                      ))}
                                    </select>
                                    {selectVal === 'Otros' && (
                                      <input
                                        type="text"
                                        placeholder="Especificar..."
                                        value={currentVal === 'Otros' ? '' : currentVal}
                                        onChange={e => {
                                          const val = e.target.value
                                          updateFormItemType(panel, val || 'Otros')
                                        }}
                                        className="w-full bg-transparent border-none rounded px-2 py-1 text-[10px] text-on-surface outline-none focus:ring-1 focus:ring-[#ff5c00]/50 font-sans mt-0.5 neu-pressed"
                                      />
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Grid de cantidades por talla */}
                            <div className="grid grid-cols-3 gap-2">
                              {SUBLIMATION_SIZES.map((size) => {
                                const qty = orderForm.panelSizes[panel]?.[size] || 0
                                const price = orderForm.panelSizePrices[panel]?.[size] || 0
                                return (
                                  <div key={size} className="neu-pressed p-2 rounded-xl flex flex-col justify-between items-center text-center space-y-1 bg-white/[0.01]">
                                    <span className="text-[10px] font-bold text-primary font-mono">{size}</span>
                                    <div className="flex items-center justify-between w-full px-1 py-0.5 bg-black/10 rounded-lg">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val = Math.max(0, qty - 1)
                                          setOrderForm(prev => {
                                            const updatedSizes = {
                                              ...prev.panelSizes,
                                              [panel]: {
                                                ...prev.panelSizes[panel],
                                                [size]: val
                                              }
                                            }
                                            const totalQtyForPanel = Object.values(updatedSizes[panel]).reduce((sum, v) => sum + v, 0)
                                            return {
                                              ...prev,
                                              panelSizes: updatedSizes,
                                              sizes: { ...prev.sizes, [panel]: totalQtyForPanel }
                                            }
                                          })
                                        }}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-[10px] text-on-surface hover:text-[#ff5c00] cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={qty || ''}
                                        onChange={e => {
                                          const val = Math.max(0, parseInt(e.target.value) || 0)
                                          setOrderForm(prev => {
                                            const updatedSizes = {
                                              ...prev.panelSizes,
                                              [panel]: {
                                                ...prev.panelSizes[panel],
                                                [size]: val
                                              }
                                            }
                                            const totalQtyForPanel = Object.values(updatedSizes[panel]).reduce((sum, v) => sum + v, 0)
                                            return {
                                              ...prev,
                                              panelSizes: updatedSizes,
                                              sizes: { ...prev.sizes, [panel]: totalQtyForPanel }
                                            }
                                          })
                                        }}
                                        className="bg-transparent border-none text-center w-6 font-mono text-[11px] text-on-surface outline-none focus:ring-0 p-0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const val = qty + 1
                                          setOrderForm(prev => {
                                            const updatedSizes = {
                                              ...prev.panelSizes,
                                              [panel]: {
                                                ...prev.panelSizes[panel],
                                                [size]: val
                                              }
                                            }
                                            const totalQtyForPanel = Object.values(updatedSizes[panel]).reduce((sum, v) => sum + v, 0)
                                            return {
                                              ...prev,
                                              panelSizes: updatedSizes,
                                              sizes: { ...prev.sizes, [panel]: totalQtyForPanel }
                                            }
                                          })
                                        }}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-[10px] text-primary cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="text-[8px] text-on-surface-variant font-mono">Bs {price.toFixed(1)}</span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Subtotal del Módulo */}
                            <div className="text-right border-t border-white/5 pt-2 flex justify-between items-center text-[10px] font-mono text-on-surface-variant">
                              <span>SUBTOTAL MÓDULO:</span>
                              <span className="text-xs text-white font-bold">
                                {(() => {
                                  const sub = SUBLIMATION_SIZES.reduce((sum, size) => {
                                    const q = orderForm.panelSizes[panel]?.[size] || 0
                                    const p = orderForm.panelSizePrices[panel]?.[size] || 0
                                    return sum + q * p
                                  }, 0)
                                  return formatCurrency(sub)
                                })()}
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Detalle del Pedido y Total de la Suma de Paneles */}
                    {metrics.totalGarments > 0 ? (
                      <div className="p-4 rounded-xl neu-pressed space-y-3 text-xs font-mono">
                        <div className="text-[10px] text-[#ff5c00] uppercase tracking-wider font-bold border-b border-white/5 pb-1.5 flex justify-between">
                          <span>Desglose por Tallas</span>
                          <span>Subtotal</span>
                        </div>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                          {PANELS_LIST.map((panel) => {
                            const type = orderForm.itemTypes[panel] || 'Otros'
                            const activeSizes = SUBLIMATION_SIZES.filter(size => (orderForm.panelSizes[panel]?.[size] || 0) > 0)
                            if (activeSizes.length === 0) return null
                            
                            return (
                              <div key={panel} className="space-y-1">
                                <div className="text-white font-bold text-[11px] flex justify-between">
                                  <span>{panel} ({type})</span>
                                </div>
                                <div className="pl-3 space-y-0.5 border-l border-primary/20">
                                  {activeSizes.map(size => {
                                    const qty = orderForm.panelSizes[panel][size]
                                    const price = orderForm.panelSizePrices[panel][size]
                                    return (
                                      <div key={size} className="flex justify-between text-on-surface-variant text-[10px]">
                                        <span>Talla {size}: {qty} uds x {formatCurrency(price)}</span>
                                        <span>{formatCurrency(qty * price)}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="border-t border-white/5 pt-2.5 space-y-1.5 text-[10px] text-on-surface-variant">
                          <div className="flex justify-between">
                            <span>Prendas Totales:</span>
                            <span className="text-white font-bold">{metrics.totalGarments} unidades</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Metraje Estimado (m²):</span>
                            <span className="text-white font-bold">{metrics.totalM2.toFixed(2)} m²</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cantidad de Paneles (Nominal):</span>
                            <span className="text-white font-bold">{metrics.totalNominalPanels} paneles</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cantidad de Paneles (Prorrateado):</span>
                            <span className="text-[#ff7a00] font-bold">{metrics.totalEquivalentPanels.toFixed(2)} paneles</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-black/35 rounded-xl border border-white/5 text-center text-on-surface-variant text-xs italic">
                        Sin prendas de sublimación registradas.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-on-surface-variant/80">
                      Introduce el detalle del servicio rápido y sus cantidades manuales.
                    </p>
                    <Input
                      label="Detalle del Servicio / Producto"
                      value={orderForm.productName}
                      onChange={e => updateForm('productName', e.target.value)}
                      placeholder="Ej. Estampado corporativo"
                      error={formErrors.productName}
                      required
                    />
                    
                    {(() => {
                      const activeSub = settings.subcategories[orderForm.category]?.find(s => s.id === orderForm.subcategory);
                      const unit = activeSub?.unit || 'unidad';
                      
                      return (
                        <div className="space-y-4">
                           {unit === '1000_puntadas' && (
                             <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-3">
                                <p className="text-[11px] text-primary font-bold">Detalle de Bordado (1000 Puntadas)</p>
                                <div className="grid grid-cols-2 gap-3">
                                   <div className="space-y-1">
                                      <label className="text-xs text-on-surface-variant font-medium">Cant. Puntadas (total por logo)</label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={orderForm.stitchesCount}
                                        onChange={e => updateForm('stitchesCount', Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#ff5c00]"
                                      />
                                   </div>
                                   <div className="space-y-1">
                                      <label className="text-xs text-on-surface-variant font-medium">Precio Base (por 1000)</label>
                                      <div className="relative">
                                         <span className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs">Bs</span>
                                         <input
                                           type="number"
                                           min="0"
                                           step="0.1"
                                           value={orderForm.flatUnitPrice}
                                           onChange={e => updateForm('flatUnitPrice', e.target.value)}
                                           className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono outline-none focus:border-[#ff5c00]"
                                         />
                                      </div>
                                   </div>
                                </div>
                             </div>
                           )}

                           <div className="grid grid-cols-2 gap-3">
                             {/* Control +/- para Cantidad Global */}
                             <div className="space-y-1">
                               <label className="text-xs text-on-surface-variant font-medium">
                                 {unit === 'metro' ? 'Metros' : unit === '1000_puntadas' ? 'Cant. Prendas' : 'Cantidad'}
                               </label>
                               <div className="flex items-center justify-between bg-black/20 rounded-xl p-1 border border-white/10 h-10">
                                 <button
                                   type="button"
                                   onClick={() => updateForm('flatQuantity', Math.max(1, (parseInt(orderForm.flatQuantity) || 1) - 1))}
                                   className="w-8 h-8 flex items-center justify-center rounded bg-[#0f131a] border border-white/5 active:scale-95 text-xs text-on-surface-variant hover:text-white cursor-pointer"
                                 >
                                   <span className="material-symbols-outlined text-[14px]">remove</span>
                                 </button>
                                 <input
                                   type="number"
                                   min="1"
                                   value={orderForm.flatQuantity}
                                   onChange={e => updateForm('flatQuantity', Math.max(1, parseInt(e.target.value) || 1))}
                                   className="bg-transparent border-none text-center w-8 font-mono text-xs text-white outline-none focus:ring-0"
                                 />
                                 <button
                                   type="button"
                                   onClick={() => updateForm('flatQuantity', (parseInt(orderForm.flatQuantity) || 1) + 1)}
                                   className="w-8 h-8 flex items-center justify-center rounded bg-[#0f131a] border border-white/5 active:scale-95 text-xs text-primary cursor-pointer"
                                 >
                                   <span className="material-symbols-outlined text-[14px]">add</span>
                                 </button>
                               </div>
                               {formErrors.flatQuantity && (
                                 <span className="text-[10px] text-error font-medium">{formErrors.flatQuantity}</span>
                               )}
                             </div>

                             {unit !== '1000_puntadas' && (
                               <Input
                                 label="Precio Unitario (Bs)"
                                 type="number"
                                 min="0"
                                 step="0.1"
                                 value={orderForm.flatUnitPrice}
                                 onChange={e => updateForm('flatUnitPrice', e.target.value)}
                                 error={formErrors.flatUnitPrice}
                                 required
                               />
                             )}
                           </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-on-surface-variant font-medium">Detalle del Pedido Particular</label>
                  <Textarea
                    value={orderForm.particularDetails}
                    onChange={e => updateForm('particularDetails', e.target.value)}
                    placeholder="Ej. Bordado dorado en pecho, logo en manga, talla XL extra larga, etc."
                    rows={2}
                  />
                </div>

                <div className="p-3 bg-black/30 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                  <span className="font-mono text-on-surface-variant uppercase font-semibold">Subtotal Preliminar:</span>
                  <span className="font-mono text-primary font-bold text-sm">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            )}

            {/* ─── PASO 5: Monetización y Pago ─── */}
            {currentStep === 5 && (
              <div className="space-y-4 animate-fade-in text-on-surface">
                <p className="text-xs text-on-surface-variant/80">
                  Selecciona la fecha, método de pago e ingresa el adelanto.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Fecha de Pedido"
                    type="date"
                    value={orderForm.orderDate}
                    onChange={e => updateForm('orderDate', e.target.value)}
                    required
                    className="w-full"
                  />
                  <Input
                    label="Fecha de Entrega"
                    type="date"
                    value={orderForm.deliveryDate}
                    onChange={e => updateForm('deliveryDate', e.target.value)}
                    required
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <Input
                    label="Adelanto (Bs)"
                    type="number"
                    min="0"
                    max={totalAmount}
                    step="1"
                    value={orderForm.advanceAmount}
                    onChange={e => updateForm('advanceAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="Ej. 100"
                    suffix="Bs"
                    className="w-full"
                  />
                  <div className="flex gap-2 pb-1.5 h-11">
                    <button
                      type="button"
                      onClick={() => updateForm('advanceAmount', Math.round(totalAmount * 0.5))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center btn-3d-raised ${
                        Number(orderForm.advanceAmount) === Math.round(totalAmount * 0.5) ? 'btn-3d-active border-[#ff5c00]/50' : ''
                      }`}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => updateForm('advanceAmount', totalAmount)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center btn-3d-raised ${
                        Number(orderForm.advanceAmount) === totalAmount ? 'btn-3d-active border-[#ff5c00]/50' : ''
                      }`}
                    >
                      100%
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">
                    Saldo Pendiente
                  </label>
                  <div className="w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-error font-mono font-bold flex items-center justify-start h-10">
                    {formatCurrency(Math.max(0, totalAmount - (parseFloat(orderForm.advanceAmount) || 0)))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-wider">Método de Pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'efectivo', label: 'Efectivo', icon: 'payments' },
                      { id: 'tarjeta', label: 'Tarjeta', icon: 'credit_card' },
                      { id: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
                      { id: 'yape_plin', label: 'Yape / Plin', icon: 'qr_code_scanner' }
                    ].map((method) => {
                      const isActive = orderForm.paymentMethod === method.id
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => updateForm('paymentMethod', method.id)}
                          className={`btn-3d-raised rounded-xl py-2 px-3 flex items-center gap-2 cursor-pointer ${
                            isActive ? 'btn-3d-active' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{method.icon}</span>
                          <span className="text-[11px] font-bold">{method.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Textarea
                  label="Observaciones de Pago (Opcional)"
                  value={orderForm.paymentNotes}
                  onChange={e => updateForm('paymentNotes', e.target.value)}
                  placeholder="Ingrese detalles de pago, cuenta de banco, etc."
                  rows={2}
                />

                <div className="bg-surface-container border border-outline-variant rounded-xl p-3 space-y-2 text-xs font-mono text-on-surface">
                  <div className="flex justify-between border-b border-outline-variant/30 pb-1 text-on-surface-variant">
                    <span>Total a Pagar</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between border-b border-outline-variant/30 pb-1 text-on-surface-variant">
                    <span>Adelanto Realizado</span>
                    <span>{formatCurrency(parseFloat(orderForm.advanceAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-[#ff5c00] pt-1">
                    <span>SALDO PENDIENTE</span>
                    <span>{formatCurrency(Math.max(0, totalAmount - (parseFloat(orderForm.advanceAmount) || 0)))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex gap-3">
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-1.5"
              onClick={handlePrev}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Atrás
            </Button>
            {currentStep !== 2 && currentStep !== 3 && (
              <Button
                variant="primary"
                className="w-full flex items-center justify-center gap-1.5"
                onClick={handleNext}
                disabled={saving}
                style={currentStep === 5 ? { backgroundColor: '#ff5c00', color: 'white' } : {}}
              >
                {currentStep === 5 ? (
                  saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Registrar
                    </>
                  )
                ) : (
                  <>
                    Continuar
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="animate-fade-in space-y-6">
      {/* Banner de error cuando no está creada la tabla */}
      {dbError === 'orders_table_missing' && (
        <AlertBanner type="error">
          <div className="space-y-2">
            <p className="font-bold">¡Tabla de Base de Datos Pendiente!</p>
            <p className="text-xs">
              La tabla <code className="font-mono text-white bg-black/40 px-1 py-0.5 rounded">orders</code> no existe en Supabase.
              Para habilitar este módulo, por favor ejecuta el script de migración SQL provisto en la carpeta del proyecto en el SQL Editor de tu consola de Supabase.
            </p>
            <p className="text-xs font-semibold text-white/90">
              Archivo a ejecutar: <span className="font-mono underline">supabase/orders_schema.sql</span>
            </p>
          </div>
        </AlertBanner>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">Pedidos e Ingresos</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Registra y gestiona las ventas diarias de servicios e ingresos por cotización
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón visible solo en tablets (md -> lg) que abre el panel derecho */}
          <Button
            className="hidden md:flex lg:hidden items-center gap-1.5 neu-button-primary"
            onClick={() => setShowMobileForm(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            Nuevo Pedido
          </Button>
        </div>
      </div>

      {/* Grid General */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA: Listado y Estadísticas (Toma 9 de 12 en PC) */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Métricas Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-surface-container/40">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">Ventas de Hoy</p>
                  <h3 className="text-headline-sm font-bold text-white font-mono mt-1">
                    {formatCurrency(stats.dailySales)}
                  </h3>
                </div>
                <div className="p-2 rounded-xl bg-tertiary/10 text-tertiary">
                  <span className="material-symbols-outlined text-[20px]">monetization_on</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-surface-container/40">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">En Producción</p>
                  <h3 className="text-headline-sm font-bold text-primary font-mono mt-1">
                    {stats.pendingProduction} <span className="text-xs font-sans text-on-surface-variant font-normal">pedidos</span>
                  </h3>
                </div>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[20px]">build</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-surface-container/40">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">Por Cobrar</p>
                  <h3 className="text-headline-sm font-bold text-error font-mono mt-1">
                    {formatCurrency(stats.pendingCobro)}
                  </h3>
                </div>
                <div className="p-2 rounded-xl bg-error/10 text-error">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="py-2.5 px-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar por cliente, pedido o ítem..."
                />
              </div>
              <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                <div className="w-[120px] sm:w-[150px]">
                  <Select
                    options={typeOptions}
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                  />
                </div>
                <div className="w-[120px] sm:w-[150px]">
                  <Select
                    options={paymentOptions}
                    value={paymentFilter}
                    onChange={e => setPaymentFilter(e.target.value)}
                  />
                </div>
                <div className="w-[120px] sm:w-[150px]">
                  <Select
                    options={statusOptions}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Tabla de Resultados */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full zebra-table whitespace-nowrap">
                <thead>
                  <tr className="bg-surface-container-high text-xs uppercase tracking-wider font-mono text-on-surface-variant">
                    <th className="text-left px-4 py-3 min-w-[120px]">Pedido y Fecha</th>
                    <th className="text-left px-4 py-3 min-w-[160px]">Cliente / Detalle</th>
                    <th className="text-right px-4 py-3 min-w-[140px]">Montos (Total / Adelanto)</th>
                    <th className="text-center px-4 py-3 min-w-[170px]">Estados / Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-12">
                        <LoadingSpinner />
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-12">
                        <EmptyState
                          icon="shopping_bag"
                          title="Sin pedidos registrados"
                          message={
                            dbError === 'orders_table_missing'
                              ? 'Debes crear las tablas en Supabase antes de poder registrar e ingresar pedidos.'
                              : search || typeFilter !== 'todos' || paymentFilter !== 'todos' || statusFilter !== 'todos'
                              ? 'No se encontraron pedidos con los filtros seleccionados.'
                              : 'Registra tu primer pedido de mostrador o servicio rápido en el panel lateral.'
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => {
                      const firstItem = order.order_items?.[0]
                      const orderNum = `#${order.order_number?.toString().padStart(4, '0')}`

                      // Mapeos visuales de estados de pago
                      const paymentBadges = {
                        pendiente: 'bg-error-container/20 text-error border border-error/20 hover:bg-error-container/30',
                        adelanto: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
                        pagado: 'bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary/20'
                      }

                      const paymentLabels = {
                        pendiente: 'Pendiente',
                        adelanto: 'Adelanto',
                        pagado: 'Pagado'
                      }

                      // Mapeo visual de producción
                      const statusBadges = {
                        pendiente: 'bg-white/5 text-on-surface-variant border border-white/10 hover:bg-white/10',
                        en_proceso: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
                        listo: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20',
                        entregado: 'bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary/20',
                        cancelado: 'bg-error-container/25 text-error border border-error/20 hover:bg-error-container/35'
                      }

                      const statusLabels = {
                        pendiente: 'Pendiente',
                        en_proceso: 'En Proceso',
                        listo: 'Listo',
                        entregado: 'Entregado',
                        cancelado: 'Cancelado'
                      }

                      return (
                        <tr key={order.id} className="hover:bg-white/[0.01] transition-colors">
                          {/* COLUMNA 1: Fecha y categoría */}
                          <td className="px-4 py-3 text-sm">
                            <span className="font-mono text-primary font-bold block">{orderNum}</span>
                            <span className="text-[10px] text-on-surface-variant font-mono block mt-0.5">{formatDate(order.created_at)}</span>
                            {/* Delivery Date and Alert */}
                            {(() => {
                              const isDelayed = order.delivery_date && order.status !== 'entregado' && order.status !== 'cancelado' && order.status !== 'listo' && (order.delivery_date.split('T')[0] < new Date().toISOString().split('T')[0]);
                              if (isDelayed) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[9px] bg-error-container/25 text-error border border-error/20 font-bold px-1.5 py-0.5 rounded-md mt-1 animate-pulse">
                                    <span className="material-symbols-outlined text-[10px]">alarm</span>
                                    RETRASADO ({formatDate(order.delivery_date)})
                                  </span>
                                )
                              }
                              if (order.delivery_date) {
                                return (
                                  <span className="text-[9px] text-[#ff7a00] font-bold block mt-1 font-mono">
                                    Entrega: {formatDate(order.delivery_date)}
                                  </span>
                                )
                              }
                              return null;
                            })()}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getOrderCategoryStyle(firstItem?.category)}`}>
                                {firstItem?.category || '—'}
                              </span>
                              {order.order_items?.length > 1 && (
                                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-mono font-bold">
                                  +{order.order_items.length - 1}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* COLUMNA 2: Descripcion/Cliente */}
                          <td className="px-4 py-3 text-sm">
                            <span className="font-bold text-white block">{order.terceros?.name || 'Cliente general'}</span>
                            {(() => {
                              const isProduccionTextil = firstItem?.category === 'Producción Textil';
                              const isSublimacionPaneles = firstItem?.category === 'Servicios de Sublimación' && firstItem?.product_category === 'SUBLIMACION POR PANELES';
                              if (isProduccionTextil) {
                                const activeSizes = SIZES_LIST.filter(size => (firstItem?.size_distribution?.[size] || 0) > 0)
                                  .map(size => `T${size}: ${firstItem.size_distribution[size]}`);
                                const sizesStr = activeSizes.join(', ');
                                return (
                                  <>
                                    <span className="text-xs text-on-surface-variant block mt-0.5 font-medium">
                                      {firstItem?.name || 'Prendas'}
                                    </span>
                                    {sizesStr && (
                                      <span className="text-[11px] text-cyan-400 font-mono block mt-0.5">
                                        {sizesStr}
                                      </span>
                                    )}
                                  </>
                                );
                              } else if (isSublimacionPaneles) {
                                const activePanels = PANELS_LIST.filter(panel => {
                                  const pData = firstItem?.size_distribution?.[panel];
                                  const totalPanelQty = pData?.tallas ? Object.values(pData.tallas).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0;
                                  return pData && (pData.cantidad > 0 || totalPanelQty > 0);
                                }).map(panel => {
                                  const pData = firstItem.size_distribution[panel];
                                  const num = panel.match(/^(\d+)/)?.[0] || '1';
                                  const type = pData.tipo || 'Otros';
                                  const tallasStr = SUBLIMATION_SIZES.filter(size => (pData.tallas?.[size] || 0) > 0)
                                    .map(size => `T${size}: ${pData.tallas[size]}`)
                                    .join(', ');
                                  return (
                                    <div key={panel} className="mt-0.5">
                                      <span className="text-xs text-on-surface-variant block font-medium">
                                        {num}P ({type.toLowerCase()})
                                      </span>
                                      {tallasStr && (
                                        <span className="text-[11px] text-cyan-400 font-mono block mt-0.5">
                                          {tallasStr}
                                        </span>
                                      )}
                                    </div>
                                  );
                                });
                                return activePanels.length > 0 ? (
                                  <div className="space-y-1 mt-0.5">{activePanels}</div>
                                ) : (
                                  <span className="text-xs text-on-surface-variant block mt-0.5 font-medium">
                                    1P (deportivos fantasma)
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-xs text-on-surface-variant block mt-0.5 font-medium truncate max-w-[200px]">
                                    {firstItem?.name || '—'}
                                  </span>
                                );
                              }
                            })()}
                            {firstItem?.description && (
                              <span className="text-[10px] text-primary/80 italic block mt-1 max-w-[220px] truncate" title={firstItem.description}>
                                Detalle: {firstItem.description}
                              </span>
                            )}
                          </td>

                          {/* COLUMNA 3: Montos */}
                          <td className="px-4 py-3 text-sm text-right font-mono min-w-[140px]">
                            <span className="font-bold text-white block text-sm">{formatCurrency(order.total_amount)}</span>
                            <span className="text-[10px] text-on-surface-variant block mt-0.5">
                              {(() => {
                                const firstItem = order.order_items?.[0];
                                const isSublimacionPaneles = 
                                  (firstItem?.category || '').toLowerCase().includes('sublimaci') && 
                                  (firstItem?.product_category || '').toLowerCase().includes('panel');
                                if (isSublimacionPaneles) {
                                  const itemMetrics = calculateItemMetrics(firstItem.size_distribution);
                                  if (itemMetrics && itemMetrics.totalNominalPanels > 0) {
                                    const avgNominalPrice = order.total_amount / itemMetrics.totalNominalPanels;
                                    return (
                                      <>
                                        <span className="block font-semibold text-white">{itemMetrics.totalNominalPanels} paneles × {formatCurrency(avgNominalPrice, 1)}</span>
                                        <span className="block text-[9px] text-[#ff7a00] font-bold">{itemMetrics.totalM2.toFixed(2)} m²</span>
                                      </>
                                    );
                                  }
                                }
                                const totalQty = order.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
                                const avgPrice = totalQty > 0 ? (order.total_amount / totalQty) : 0
                                return `${totalQty} uds × ${formatCurrency(avgPrice, 0)}`
                              })()}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                              Adelanto: {formatCurrency(order.paid_amount || 0)}
                            </span>
                          </td>

                          {/* COLUMNA 4: Estados / Acciones */}
                          <td className="px-4 py-3 text-center min-w-[170px]">
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                              {/* Estado de produccion button */}
                              <button
                                onClick={() => handleUpdateStatus(order.id, order.status)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${statusBadges[order.status]}`}
                                title="Click para cambiar estado de producción"
                              >
                                {statusLabels[order.status]}
                              </button>

                              {/* Estado de pago button */}
                              <button
                                onClick={() => handleUpdatePaymentStatus(order.id, order.payment_status, order.total_amount)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${paymentBadges[order.payment_status]}`}
                                title="Click para cambiar estado de pago"
                              >
                                {paymentLabels[order.payment_status]}
                              </button>

                              {/* Tres puntos Acciones Menu */}
                              <div className="relative inline-block text-left ml-1">
                                <button
                                  onClick={() => setActiveActionMenu(activeActionMenu === order.id ? null : order.id)}
                                  className="p-1.5 text-on-surface-variant hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                  title="Más acciones"
                                >
                                  <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                </button>
                                
                                {activeActionMenu === order.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-20" 
                                      onClick={() => setActiveActionMenu(null)}
                                    />
                                    <div className="absolute right-0 mt-1 w-32 rounded-xl bg-surface-container-high border border-outline-variant/60 shadow-lg py-1.5 z-30 animate-fade-in text-left">
                                      <button
                                        onClick={() => {
                                          setSelectedOrder(order)
                                          setActiveActionMenu(null)
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-on-surface hover:bg-white/5 hover:text-white flex items-center gap-2 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                                        Ver Detalle
                                      </button>
                                      <button
                                        onClick={() => {
                                          loadOrderToEdit(order)
                                          setActiveActionMenu(null)
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-on-surface hover:bg-white/5 hover:text-white flex items-center gap-2 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-primary">edit</span>
                                        Editar Pedido
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteOrder(order.id)
                                          setActiveActionMenu(null)
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-error hover:bg-error/10 flex items-center gap-2 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                        Eliminar
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

        </div>

        {/* COLUMNA DERECHA: Formulario Fijo en PC (Toma 3 de 12 en PC, oculta en móvil) */}
        <div className="hidden lg:block lg:col-span-3">
          <Card className="p-6 sticky top-24 border border-white/5">
            {renderNewOrderPanel(false, null)}
          </Card>
        </div>

      </div>

      {/* MODAL DESPLEGABLE EN MÓVIL (para el formulario) */}
      {showMobileForm && (
        <Modal
          isOpen={showMobileForm}
          onClose={handleCloseForm}
          title="Nuevo Pedido"
          size="md"
        >
          {renderNewOrderPanel(true, handleCloseForm)}
        </Modal>
      )}

      {/* MODAL DE DETALLE DEL PEDIDO (Detalles registrados) */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Detalle de Pedido ${selectedOrder.order_number?.toString().padStart(4, '0')}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Cabecera del pedido */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
              <div>
                <p className="text-xs text-on-surface-variant font-mono uppercase">Cliente</p>
                <p className="text-sm font-semibold text-white mt-0.5">
                  {selectedOrder.terceros?.name || 'Cliente general'}
                </p>
                {selectedOrder.terceros?.phone && (
                  <p className="text-xs text-on-surface-variant mt-0.5">Tel: {selectedOrder.terceros.phone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-on-surface-variant font-mono uppercase">Fecha Registro</p>
                <p className="text-sm text-white font-mono mt-0.5">{formatDate(selectedOrder.created_at)}</p>
                {selectedOrder.delivery_date && (
                  <p className="text-xs text-primary mt-0.5 font-mono">
                    Entrega: {formatDate(selectedOrder.delivery_date)}
                  </p>
                )}
              </div>
            </div>

            {/* Selector de pestañas */}
            <div className="flex border-b border-white/10 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setDetailsTab('trabajo')}
                className={`flex items-center gap-2 px-4 py-2 font-medium text-xs transition-all duration-300 border-b-2 whitespace-nowrap shrink-0 ${
                  detailsTab === 'trabajo'
                    ? 'border-primary text-primary bg-primary/5 rounded-t-lg font-bold'
                    : 'border-transparent text-on-surface-variant hover:text-white hover:bg-white/5 rounded-t-lg'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
                Distribución de Trabajo
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab('finanzas')}
                className={`flex items-center gap-2 px-4 py-2 font-medium text-xs transition-all duration-300 border-b-2 whitespace-nowrap shrink-0 ${
                  detailsTab === 'finanzas'
                    ? 'border-primary text-primary bg-primary/5 rounded-t-lg font-bold'
                    : 'border-transparent text-on-surface-variant hover:text-white hover:bg-white/5 rounded-t-lg'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">analytics</span>
                Finanzas y Sobras
              </button>
            </div>

            {detailsTab === 'trabajo' && (
              <>
                {/* Ítems del pedido */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant font-semibold text-left">
                    Detalle de Servicios / Productos
                  </h4>
                  <div className="space-y-2">
                    {selectedOrder.order_items?.map(item => (
                      <Card key={item.id} className="p-4 bg-[#060a14] border border-white/5 space-y-4">
                        <div className="flex justify-between items-start text-left">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-on-surface-variant uppercase font-mono">
                                Servicio: {item.category}
                              </span>
                              {item.product_category && (
                                <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full text-primary uppercase font-mono">
                                  Categoría: {item.product_category}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <div className="text-xs text-[#ff5c00] mt-2 bg-primary/5 border border-primary/20 rounded-lg p-2 font-mono">
                                <strong>Detalle:</strong> {item.description}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {(() => {
                              const isSub = 
                                (item.category || '').toLowerCase().includes('sublimaci') && 
                                (item.product_category || '').toLowerCase().includes('panel');
                              if (isSub) {
                                const itemMetrics = calculateItemMetrics(item.size_distribution);
                                if (itemMetrics && itemMetrics.totalNominalPanels > 0) {
                                  const avgNominalPrice = item.total_price / itemMetrics.totalNominalPanels;
                                  return (
                                    <>
                                      <p className="text-xs text-on-surface-variant font-mono">
                                        {itemMetrics.totalNominalPanels} paneles x {formatCurrency(avgNominalPrice)}
                                      </p>
                                      <p className="text-[10px] text-[#ff7a00] font-mono font-bold mt-0.5">
                                        {itemMetrics.totalM2.toFixed(2)} m²
                                      </p>
                                    </>
                                  );
                                }
                              }
                              return (
                                <p className="text-xs text-on-surface-variant font-mono">
                                  {item.quantity} x {formatCurrency(item.unit_price)}
                                </p>
                              );
                            })()}
                            <p className="text-sm font-bold text-white font-mono mt-0.5">
                              {formatCurrency(item.total_price)}
                            </p>
                          </div>
                        </div>

                        {/* Detalles del Pedido (Tallas, Paneles, Metros) */}
                        {item.size_distribution && (
                          <div className="border-t border-white/5 pt-3 space-y-3 text-left">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-primary">
                              Distribución / Detalles de Trabajo
                            </p>

                            {/* Resumen Métrico de Sublimación */}
                            {(() => {
                              const itemMetrics = calculateItemMetrics(item.size_distribution);
                              if (!itemMetrics || itemMetrics.totalNominalPanels === 0) return null;
                              return (
                                <div className="grid grid-cols-3 gap-2 bg-[#ff5c00]/5 border border-primary/20 p-3 rounded-xl text-center">
                                  <div>
                                    <p className="text-[8px] text-on-surface-variant uppercase font-mono">Paneles Nominales</p>
                                    <p className="text-sm font-mono font-bold text-white mt-0.5">
                                      {itemMetrics.totalNominalPanels}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] text-on-surface-variant uppercase font-mono">Paneles Prorrateados</p>
                                    <p className="text-sm font-mono font-bold text-[#ff7a00] mt-0.5">
                                      {itemMetrics.totalEquivalentPanels.toFixed(2)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[8px] text-on-surface-variant uppercase font-mono">Metraje Total (m²)</p>
                                    <p className="text-sm font-mono font-bold text-[#ff7a00] mt-0.5">
                                      {itemMetrics.totalM2.toFixed(2)} m²
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}

                            {Object.keys(item.size_distribution).some(k => PANELS_LIST.includes(k)) ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(item.size_distribution).map(([panel, data]) => {
                                  if (!data || (!data.cantidad && !Object.values(data.tallas || {}).some(v => v > 0))) return null
                                  return (
                                    <div key={panel} className="neu-pressed p-3 rounded-xl space-y-2 text-xs">
                                      <div className="flex justify-between items-center border-b border-white/5 pb-1">
                                        <div>
                                          <p className="font-bold text-white">{panel}</p>
                                          <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Item: {data.tipo}</p>
                                        </div>
                                        <span className="font-mono text-primary font-bold text-sm">x{data.cantidad}</span>
                                      </div>
                                      {data.tallas && Object.keys(data.tallas).length > 0 && (
                                        <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px]">
                                          {Object.entries(data.tallas).map(([size, q]) => (
                                            <div key={size} className="bg-white/5 rounded px-2 py-0.5 text-center text-on-surface-variant">
                                              <span className="font-bold text-primary mr-1">{size}:</span>
                                              <span className="font-mono">{q}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(item.size_distribution).map(([size, qty]) => {
                                  if (!qty) return null
                                  return (
                                    <div key={size} className="neu-pressed px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
                                      <span className="font-bold text-primary">{size}</span>
                                      <span className="font-mono text-white">({qty} uds)</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {(item.product_category === 'SUBLIMACION POR METRO' || item.product_category === 'SUBLIMACION CALANDRA') && (
                          <div className="border-t border-white/5 pt-3">
                            <div className="neu-pressed p-2.5 rounded-xl flex justify-between items-center text-xs">
                              <span className="font-medium text-on-surface-variant font-mono uppercase text-[9px]">Metraje de Trabajo:</span>
                              <span className="font-mono font-bold text-primary text-xs">{item.quantity} metros</span>
                            </div>
                          </div>
                        )}

                        {/* Parámetros de costeo recolectados */}
                        <div className="border-t border-white/5 pt-3 mt-2 text-left">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-2">
                            Parámetros de Costeo Recolectados (Fase 1)
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="neu-pressed p-2 rounded-xl">
                              <p className="text-[8px] text-on-surface-variant uppercase font-mono">Tiempo Empleado</p>
                              <p className="text-xs font-mono font-bold text-white mt-1">
                                {item.production_time_minutes ? `${item.production_time_minutes} min` : '—'}
                              </p>
                            </div>
                            <div className="neu-pressed p-2 rounded-xl">
                              <p className="text-[8px] text-on-surface-variant uppercase font-mono">Materiales (Est.)</p>
                              <p className="text-xs font-mono font-bold text-white mt-1">
                                {item.materials_cost ? formatCurrency(item.materials_cost) : '—'}
                              </p>
                            </div>
                            <div className="neu-pressed p-2 rounded-xl">
                              <p className="text-[8px] text-on-surface-variant uppercase font-mono">Procesos (Est.)</p>
                              <p className="text-xs font-mono font-bold text-white mt-1">
                                {item.processes_cost ? formatCurrency(item.processes_cost) : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Total general e información complementaria */}
                <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                  <div className="space-y-1">
                    {selectedOrder.notes && (
                      <p className="text-xs text-on-surface-variant max-w-md">
                        <span className="font-semibold text-white">Notas:</span> {selectedOrder.notes}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs text-on-surface-variant font-mono">
                        Tipo de Ingreso: {selectedOrder.order_type === 'servicio_diario' ? 'Servicio Diario' : 'Desde Cotización'}
                      </span>
                    </div>
                    {orderMetrics && orderMetrics.totalNominalPanels > 0 && (
                      <div className="mt-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1 text-[11px] font-mono w-[240px]">
                        <p className="text-primary font-bold uppercase text-[9px] tracking-wider mb-1">Totales del Trabajo</p>
                        <div className="flex justify-between gap-4">
                          <span className="text-on-surface-variant">Paneles Nominales:</span>
                          <span className="text-white font-bold">{orderMetrics.totalNominalPanels}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-on-surface-variant">Paneles Prorrateados:</span>
                          <span className="text-white font-bold">{orderMetrics.totalEquivalentPanels.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-on-surface-variant">Metraje de Sublimación:</span>
                          <span className="text-[#ff7a00] font-bold">{orderMetrics.totalM2.toFixed(2)} m²</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full sm:w-auto neu-pressed p-4 rounded-xl min-w-[200px] text-right space-y-2">
                    <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono">
                      <span>Total Pedido:</span>
                      <span className="font-bold text-white">{formatCurrency(selectedOrder.total_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono">
                      <span>Monto Pagado:</span>
                      <span className="font-bold text-tertiary">{formatCurrency(selectedOrder.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono border-t border-white/10 pt-1">
                      <span>Saldo Pendiente:</span>
                      <span className="font-bold text-error">
                        {formatCurrency(selectedOrder.total_amount - selectedOrder.paid_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {detailsTab === 'finanzas' && (() => {
              if (loadingDetails) {
                return (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <LoadingSpinner />
                    <span className="text-xs text-on-surface-variant mt-2 font-mono">Cargando datos financieros...</span>
                  </div>
                );
              }

              // Calcular total gastos
              const totalExpenses = orderExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
              const netUtility = selectedOrder.total_amount - totalExpenses;
              const realMargin = selectedOrder.total_amount > 0 ? (netUtility / selectedOrder.total_amount) * 100 : 0;

              // Consolidar materiales (estimados vs comprados)
              const materialsMap = {};

              // 1. Agregar estimados
              estimatedMaterials.forEach(est => {
                const matId = est.material_id;
                const key = matId || est.material_name.toLowerCase().trim();
                
                if (!materialsMap[key]) {
                  materialsMap[key] = {
                    id: matId,
                    name: est.material_name,
                    category: est.materials?.category || 'Materia Prima',
                    unit: est.materials?.purchase_unit || 'uds',
                    estimatedQty: 0,
                    estimatedCost: 0,
                    purchasedQty: 0,
                    purchasedCost: 0
                  };
                }
                
                materialsMap[key].estimatedQty += est.estimated_qty || 0;
                materialsMap[key].estimatedCost += est.estimated_cost || 0;
              });

              // 2. Agregar gastos reales de materiales
              orderExpenses.forEach(exp => {
                // Solo si el gasto está relacionado a un material o se infiere
                if (exp.material_id || exp.category_key?.toUpperCase() === 'INSUMOS') {
                  const matId = exp.material_id;
                  const key = matId || exp.specific_item?.toLowerCase().trim() || exp.description?.toLowerCase().trim() || 'gasto insumo';
                  
                  if (!materialsMap[key]) {
                    materialsMap[key] = {
                      id: matId,
                      name: exp.materials?.name || exp.specific_item || 'Insumo Adicional',
                      category: exp.materials?.category || exp.subcategory || 'Insumos',
                      unit: exp.materials?.purchase_unit || 'uds',
                      estimatedQty: 0,
                      estimatedCost: 0,
                      purchasedQty: 0,
                      purchasedCost: 0
                    };
                  }
                  
                  materialsMap[key].purchasedQty += Number(exp.quantity) || 0;
                  materialsMap[key].purchasedCost += Number(exp.amount) || 0;
                }
              });

              const consolidatedMaterials = Object.values(materialsMap);

              // Filtrar gastos generales (que no son materiales)
              const generalExpenses = orderExpenses.filter(exp => {
                // Si no tiene material_id y no es de categoría INSUMOS
                return !exp.material_id && exp.category_key?.toUpperCase() !== 'INSUMOS';
              });

              return (
                <div className="space-y-6 animate-fade-in text-left">
                  {/* Resumen Financiero en Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Valor Pedido */}
                    <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block">Ingreso Total</span>
                        <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                      </div>
                      <div>
                        <span className="font-mono text-lg font-bold text-white block">
                          {formatCurrency(selectedOrder.total_amount)}
                        </span>
                        <span className="text-[10px] text-on-surface-variant block mt-0.5">Valor del pedido</span>
                      </div>
                    </div>

                    {/* Gastos Reales */}
                    <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block">Gastos Incurridos</span>
                        <span className="material-symbols-outlined text-amber-400 text-[18px]">shopping_cart</span>
                      </div>
                      <div>
                        <span className="font-mono text-lg font-bold text-white block">
                          {formatCurrency(totalExpenses)}
                        </span>
                        <span className="text-[10px] text-on-surface-variant block mt-0.5">{orderExpenses.length} transacciones</span>
                      </div>
                    </div>

                    {/* Utilidad Neta */}
                    <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block">Utilidad Real</span>
                        <span className={`material-symbols-outlined text-[18px] ${netUtility >= 0 ? 'text-emerald-400' : 'text-error'}`}>
                          {netUtility >= 0 ? 'trending_up' : 'trending_down'}
                        </span>
                      </div>
                      <div>
                        <span className={`font-mono text-lg font-bold block ${netUtility >= 0 ? 'text-emerald-400' : 'text-error'}`}>
                          {formatCurrency(netUtility)}
                        </span>
                        <span className="text-[10px] text-on-surface-variant block mt-0.5">Ingresos - Gastos</span>
                      </div>
                    </div>

                    {/* Margen Real */}
                    <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 left-0 w-1 h-full bg-violet-500" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider block">Margen Neto</span>
                        <span className="material-symbols-outlined text-violet-400 text-[18px]">percent</span>
                      </div>
                      <div>
                        <span className={`font-mono text-lg font-bold block ${realMargin >= 0 ? 'text-violet-400' : 'text-error'}`}>
                          {realMargin.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-on-surface-variant block mt-0.5">Retorno sobre ventas</span>
                      </div>
                    </div>
                  </div>

                  {/* Advertencia para Servicio Diario */}
                  {selectedOrder.order_type === 'servicio_diario' && (
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-on-surface-variant font-mono flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-amber-500 text-base">warning</span>
                      <div>
                        <p className="font-semibold text-white">Servicio Diario (Sin Cotización Previa)</p>
                        <p className="mt-0.5 text-[11px]">
                          Este pedido se registró como Servicio Diario, por lo que no posee estimaciones de materiales de cotización. 
                          Las métricas de sobras y costos estimados se muestran en cero. Se listan únicamente las compras reales incurridas.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tabla de Control de Sobras de Materiales */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                        Control de Sobras (Materiales Estimados vs. Comprados)
                      </h4>
                      {selectedOrder.order_type !== 'servicio_diario' && (
                        <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-on-surface-variant">
                          Materia prima de cotización
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-white/5 text-on-surface-variant font-mono uppercase text-[9px] border-b border-white/5">
                            <th className="py-2.5 px-3">Material / Insumo</th>
                            <th className="py-2.5 px-3 text-center">Estimado (Cotiz.)</th>
                            <th className="py-2.5 px-3 text-center">Comprado (Gastos)</th>
                            <th className="py-2.5 px-3 text-center">Diferencia (Sobra)</th>
                            <th className="py-2.5 px-3 text-right">Costo Estimado</th>
                            <th className="py-2.5 px-3 text-right">Costo Real</th>
                            <th className="py-2.5 px-3 text-right">Costo Dif.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {consolidatedMaterials.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="py-6 text-center text-on-surface-variant italic text-[11px] font-mono">
                                Ningún material o insumo relacionado a este pedido todavía.
                              </td>
                            </tr>
                          ) : (
                            consolidatedMaterials.map((mat, idx) => {
                              const qtyDiff = mat.purchasedQty - mat.estimatedQty;
                              const costDiff = mat.purchasedCost - mat.estimatedCost;

                              return (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors font-mono">
                                  <td className="py-2.5 px-3">
                                    <p className="font-semibold text-white font-sans text-xs">{mat.name}</p>
                                    <p className="text-[9px] text-on-surface-variant mt-0.5">{mat.category}</p>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {mat.estimatedQty > 0 ? `${mat.estimatedQty.toFixed(2)} ${mat.unit}` : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {mat.purchasedQty > 0 ? `${mat.purchasedQty.toFixed(2)} ${mat.unit}` : '—'}
                                  </td>
                                  <td className={`py-2.5 px-3 text-center font-bold ${
                                    qtyDiff > 0 
                                      ? 'text-cyan-400' 
                                      : qtyDiff < 0 
                                        ? 'text-amber-500' 
                                        : 'text-on-surface-variant'
                                  }`}>
                                    {qtyDiff > 0 
                                      ? `+${qtyDiff.toFixed(2)} ${mat.unit}` 
                                      : qtyDiff < 0 
                                        ? `${qtyDiff.toFixed(2)} ${mat.unit}` 
                                        : '0.00'
                                    }
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-on-surface-variant">
                                    {mat.estimatedCost > 0 ? formatCurrency(mat.estimatedCost) : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-white font-bold">
                                    {mat.purchasedCost > 0 ? formatCurrency(mat.purchasedCost) : '—'}
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-bold ${costDiff > 0 ? 'text-red-400' : costDiff < 0 ? 'text-emerald-400' : 'text-on-surface-variant'}`}>
                                    {costDiff > 0 
                                      ? `+${formatCurrency(costDiff)}` 
                                      : costDiff < 0 
                                        ? `-${formatCurrency(Math.abs(costDiff))}` 
                                        : 'Bs 0.00'
                                    }
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {consolidatedMaterials.length > 0 && (
                      <div className="flex gap-4 text-[10px] font-mono text-on-surface-variant px-1.5 pt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
                          Diferencia Cantidad (+) = Sobrante de material en taller.
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-red-400" />
                          Costo Dif. (+) = Desviación de costo (sobregasto).
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-emerald-400" />
                          Costo Dif. (-) = Ahorro de costo.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tabla de Otros Gastos Generales (No materia prima) */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                      Otros Gastos Relacionados (Transporte, Mano de Obra, Tercerización, etc.)
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-white/5 text-on-surface-variant font-mono uppercase text-[9px] border-b border-white/5">
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Detalle / Ítem Específico</th>
                            <th className="py-2.5 px-3">Categoría / Subcat.</th>
                            <th className="py-2.5 px-3 text-center">Proveedor</th>
                            <th className="py-2.5 px-3 text-center">Cantidad</th>
                            <th className="py-2.5 px-3 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {generalExpenses.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-6 text-center text-on-surface-variant italic text-[11px] font-mono">
                                Sin otros gastos relacionados. Todos los gastos corresponden a materias primas o no se han cargado gastos generales.
                              </td>
                            </tr>
                          ) : (
                            generalExpenses.map((exp, idx) => (
                              <tr key={idx} className="hover:bg-white/[0.02] transition-colors font-mono">
                                <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">
                                  {formatDate(exp.date)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <p className="font-semibold text-white font-sans text-xs">{exp.specific_item}</p>
                                  {exp.description && <p className="text-[10px] text-on-surface-variant mt-0.5">{exp.description}</p>}
                                </td>
                                <td className="py-2.5 px-3 text-on-surface-variant">
                                  {exp.category_label} / {exp.subcategory}
                                </td>
                                <td className="py-2.5 px-3 text-center text-on-surface-variant">
                                  {exp.provider || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-center text-on-surface-variant">
                                  {exp.quantity}
                                </td>
                                <td className="py-2.5 px-3 text-right text-white font-bold font-mono">
                                  {formatCurrency(exp.amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button onClick={() => setSelectedOrder(null)}>
                Cerrar Detalle
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editingOrder && editForm && (
        <Modal
          isOpen={!!editingOrder}
          onClose={() => {
            setEditingOrder(null)
            setEditForm(null)
          }}
          title={`Editar Pedido #${editingOrder.order_number?.toString().padStart(4, '0')}`}
          size="lg"
        >
          <div className="space-y-6 text-left">
            {/* Cabecera Informativa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-white/5 text-on-surface">
              <div>
                <p className="text-xs text-on-surface-variant font-mono uppercase">Cliente</p>
                <p className="text-sm font-semibold text-white mt-0.5">{editForm.clientName}</p>
                <p className="text-[10px] text-on-surface-variant font-mono mt-1">
                  CATEGORÍA: {settings.categories.find(c => c.id === editForm.category)?.label || '—'}
                </p>
                <p className="text-[10px] text-on-surface-variant font-mono">
                  SUBCATEGORÍA: {settings.subcategories[editForm.category]?.find(s => s.id === editForm.subcategory)?.label || '—'}
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-on-surface-variant font-mono uppercase block mb-1">
                    Fecha de Entrega
                  </label>
                  <input
                    type="date"
                    value={editForm.deliveryDate}
                    onChange={e => updateEditForm('deliveryDate', e.target.value)}
                    className="w-full bg-[#0d1527] border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Inputs de Descripción y Notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-on-surface">
              <div>
                <label className="text-[10px] text-on-surface-variant font-mono uppercase block mb-1">
                  Detalles Particulares del Pedido (Para Producción)
                </label>
                <textarea
                  value={editForm.particularDetails}
                  onChange={e => updateEditForm('particularDetails', e.target.value)}
                  placeholder="Ej. Nombre del equipo, diseño, patrocinadores, etc."
                  rows="3"
                  className="w-full bg-[#0d1527] border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-primary/50 font-sans resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-on-surface-variant font-mono uppercase block mb-1">
                  Notas de Pago / Notas Generales
                </label>
                <textarea
                  value={editForm.orderNotes}
                  onChange={e => updateEditForm('orderNotes', e.target.value)}
                  placeholder="Ej. Saldo contra entrega, observaciones del cliente, etc."
                  rows="3"
                  className="w-full bg-[#0d1527] border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-primary/50 font-sans resize-none"
                />
              </div>
            </div>

            {/* Configuración de Cantidades y Precios */}
            <div className="border-t border-white/5 pt-4 space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                Configuración de Tallas / Cantidades
              </h4>

              {(() => {
                const activeSub = settings.subcategories[editForm.category]?.find(s => s.id === editForm.subcategory)
                const usesSizes = activeSub?.unit === 'tallas' || (!activeSub?.unit && editForm.category === 'produccion_textil')
                const isSublimacionPaneles = editForm.category === 'servicios_sublimacion' && editForm.subcategory === 'sublimacion_localizada'

                if (usesSizes) {
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-on-surface-variant/80 text-left">
                        Modifica la cantidad y el precio sugerido de confección por talla (desliza horizontalmente, 2 filas).
                      </p>
                      <div className="sizes-scroll-container pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-[#ff5c00]/30 scrollbar-track-transparent">
                        {SIZES_LIST.map((size) => {
                          const qty = editForm.sizes[size] || 0
                          const price = editForm.sizePrices[size] || 0
                          return (
                            <div key={size} className="min-w-[155px] w-[155px] flex-shrink-0 snap-start p-3 bg-[#0d1527] rounded-xl border border-outline-variant/30 space-y-2 text-on-surface">
                              <div className="flex justify-between items-center border-b border-outline-variant/30 pb-1">
                                <span className="text-body-md font-bold text-primary">{size}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-on-surface-variant font-mono">P. Ud:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={price}
                                    onChange={e => updateEditSizePrice(size, e.target.value)}
                                    className="w-12 text-right bg-transparent border-none rounded px-1 py-0.5 text-xs text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary/50 neu-pressed"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between neu-pressed rounded-lg p-1 border border-outline-variant/30">
                                <button
                                  type="button"
                                  onClick={() => updateEditSizeQty(size, -1)}
                                  className="w-7 h-7 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-xs text-on-surface hover:text-[#ff5c00] cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[12px]">remove</span>
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={qty}
                                  onChange={e => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0)
                                    setEditForm(prev => ({
                                      ...prev,
                                      sizes: { ...prev.sizes, [size]: val }
                                    }))
                                  }}
                                  className="bg-transparent border-none text-center w-8 font-mono text-xs text-on-surface outline-none focus:ring-0 p-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateEditSizeQty(size, 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-xs text-primary cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[12px]">add</span>
                                </button>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-on-surface-variant/80 font-mono">
                                  Sub: {formatCurrency(qty * price)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                } else if (isSublimacionPaneles) {
                  const panel = selectedPanelFilterEdit
                  const totalQty = Object.values(editForm.panelSizes[panel] || {}).reduce((sum, v) => sum + v, 0)
                  
                  return (
                    <div className="space-y-4">
                      {/* Configuración de Tarifa Base por Panel */}
                      <div className="neu-pressed px-3 py-2 rounded-xl flex items-center justify-between gap-3 bg-[#0d1527]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#ff7a00] text-sm">payments</span>
                          <span className="text-xs font-bold text-white">Precio Base por Panel:</span>
                        </div>
                        <div className="w-[90px] shrink-0">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={editForm.basePanelPrice || 10}
                            onChange={e => handleEditBasePanelPriceChange(e.target.value)}
                            className="w-full bg-transparent border-none rounded px-2 py-1 text-xs font-bold text-[#ff7a00] text-right outline-none focus:ring-1 focus:ring-primary/50 font-mono neu-pressed"
                          />
                        </div>
                      </div>

                      {/* Botones de Selección de Panel (Filtro) */}
                      <div className="flex gap-2 pb-1 justify-between">
                        {PANELS_LIST.map((p) => {
                          const isActive = selectedPanelFilterEdit === p
                          const num = p.match(/^(\d+)/)?.[0] || '1'
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSelectedPanelFilterEdit(p)}
                              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center flex items-center justify-center btn-3d-raised ${
                                isActive ? 'btn-3d-active border-[#ff5c00]/50' : 'text-on-surface-variant'
                              }`}
                            >
                              {num}P
                            </button>
                          )
                        })}
                      </div>

                      {/* Panel Editor de Tallas Activo */}
                      <div key={panel} className="w-full p-4 bg-[#0d1527] rounded-xl border border-outline-variant/30 space-y-4 text-on-surface">
                        <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                          <div>
                            <span className="text-sm font-black text-primary block">{panel}</span>
                            <span className="text-[9px] text-on-surface-variant font-mono uppercase">Prendas Totales: {totalQty}</span>
                          </div>
                          
                          {/* Dropdown y Textbox para Tipo de Item */}
                          {(() => {
                            const options = PANEL_OPTIONS[panel] || [];
                            const currentVal = editForm.itemTypes[panel] || 'Otros';
                            const isCustom = !options.filter(opt => opt !== 'Otros').includes(currentVal);
                            const selectVal = isCustom ? 'Otros' : currentVal;

                            return (
                              <div className="w-[170px] flex flex-col gap-1 items-end">
                                <select
                                  value={selectVal}
                                  onChange={e => {
                                    const val = e.target.value
                                    updateEditFormItemType(panel, val)
                                  }}
                                  className="w-full bg-transparent border-none rounded px-2 py-1 text-[11px] font-semibold text-white outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer neu-pressed"
                                >
                                  {options.map(opt => (
                                    <option key={opt} value={opt} className="bg-surface text-on-surface text-[11px]">{opt}</option>
                                  ))}
                                </select>
                                {selectVal === 'Otros' && (
                                  <input
                                    type="text"
                                    placeholder="Especificar..."
                                    value={currentVal === 'Otros' ? '' : currentVal}
                                    onChange={e => {
                                      const val = e.target.value
                                      updateEditFormItemType(panel, val || 'Otros')
                                    }}
                                    className="w-full bg-transparent border-none rounded px-2 py-1 text-[10px] text-on-surface outline-none focus:ring-1 focus:ring-[#ff5c00]/50 font-sans mt-0.5 neu-pressed"
                                  />
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Grid de cantidades por talla */}
                        <div className="grid grid-cols-3 gap-2">
                          {SUBLIMATION_SIZES.map((size) => {
                            const qty = editForm.panelSizes[panel]?.[size] || 0
                            const price = editForm.panelSizePrices[panel]?.[size] || 0
                            return (
                              <div key={size} className="neu-pressed p-2 rounded-xl flex flex-col justify-between items-center text-center space-y-1 bg-white/[0.01]">
                                <span className="text-[10px] font-bold text-primary font-mono">{size}</span>
                                <div className="flex items-center justify-between w-full px-1 py-0.5 bg-black/10 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => updateEditPanelSizeQty(panel, size, -1)}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-[10px] text-on-surface hover:text-[#ff5c00] cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={qty || ''}
                                    onChange={e => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0)
                                      updateEditPanelSizeQty(panel, size, val, true)
                                    }}
                                    className="bg-transparent border-none text-center w-6 font-mono text-[11px] text-on-surface outline-none focus:ring-0 p-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateEditPanelSizeQty(panel, size, 1)}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-[10px] text-primary cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-[8px] text-on-surface-variant font-mono">Bs {price.toFixed(1)}</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Subtotal del Módulo */}
                        <div className="text-right border-t border-white/5 pt-2 flex justify-between items-center text-[10px] font-mono text-on-surface-variant">
                          <span>SUBTOTAL MÓDULO:</span>
                          <span className="text-xs text-white font-bold">
                            {(() => {
                              const sub = SUBLIMATION_SIZES.reduce((sum, size) => {
                                const q = editForm.panelSizes[panel]?.[size] || 0
                                const p = editForm.panelSizePrices[panel]?.[size] || 0
                                return sum + q * p
                              }, 0)
                              return formatCurrency(sub)
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Resumen Métrico de Sublimación en tiempo real */}
                      <div className="grid grid-cols-3 gap-2 bg-[#ff5c00]/5 border border-primary/20 p-3 rounded-xl text-center">
                        <div>
                          <p className="text-[8px] text-on-surface-variant uppercase font-mono">Paneles Nominales</p>
                          <p className="text-sm font-mono font-bold text-white mt-0.5">
                            {editMetrics.totalNominalPanels}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] text-on-surface-variant uppercase font-mono">Paneles Prorrateados</p>
                          <p className="text-sm font-mono font-bold text-[#ff7a00] mt-0.5">
                            {editMetrics.totalEquivalentPanels.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] text-on-surface-variant uppercase font-mono">Metraje Total (m²)</p>
                          <p className="text-sm font-mono font-bold text-[#ff7a00] mt-0.5">
                            {editMetrics.totalM2.toFixed(2)} m²
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                } else {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Input
                          label="Detalle del Servicio"
                          value={editForm.productName}
                          onChange={e => updateEditForm('productName', e.target.value)}
                          placeholder="Ej. Bordado de camisas"
                          required
                        />
                      </div>
                      <div>
                        <Input
                          label="Cantidad"
                          type="number"
                          min="1"
                          value={editForm.flatQuantity}
                          onChange={e => updateEditForm('flatQuantity', Math.max(1, parseInt(e.target.value) || 1))}
                          required
                        />
                      </div>
                      <div>
                        <Input
                          label="Precio Unitario"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editForm.flatUnitPrice}
                          onChange={e => updateEditForm('flatUnitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                          required
                        />
                      </div>
                    </div>
                  )
                }
              })()}
            </div>

            {/* Total general y Acciones de guardado */}
            <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="w-full sm:w-auto neu-pressed p-4 rounded-xl min-w-[200px] text-right space-y-2 bg-[#0d1527]">
                <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono">
                  <span>Subtotal:</span>
                  <span className="font-bold text-white">{formatCurrency(editTotalAmount / 1.18)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono">
                  <span>IGV (18%):</span>
                  <span className="font-bold text-white">{formatCurrency(editTotalAmount - (editTotalAmount / 1.18))}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-on-surface-variant font-mono border-t border-white/10 pt-1">
                  <span>Total Estimado:</span>
                  <span className="font-bold text-primary text-sm font-mono">
                    {formatCurrency(editTotalAmount)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 w-full sm:w-auto">
                <Button
                  onClick={() => {
                    setEditingOrder(null)
                    setEditForm(null)
                  }}
                  variant="outline"
                  className="cursor-pointer"
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateOrder}
                  disabled={saving}
                  className="neu-button-primary cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
    {/* Botón flotante móvil de registro de pedidos, fijado fuera del contenedor de scroll/animación */}
    <Button
      className="md:hidden fixed bottom-[80px] right-4 z-40 shadow-lg rounded-full w-12 h-12 flex items-center justify-center p-0 neu-button-primary"
      onClick={() => setShowMobileForm(true)}
    >
      <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
    </Button>
    </>
  )
}
