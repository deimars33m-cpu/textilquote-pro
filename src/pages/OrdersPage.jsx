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

  // Asistente de registro de pedidos (5 pasos)
  const [currentStep, setCurrentStep] = useState(1)
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
    orderDate: new Date().toISOString().split('T')[0]
  })
  const [formErrors, setFormErrors] = useState({})

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
        const processLoadedOrders = (rawOrders) => {
          if (!rawOrders || rawOrders.length === 0) return [];
          
          return rawOrders.map((order, idx) => {
            if (idx === 0) {
              const updatedItems = order.order_items?.map((item, itemIdx) => {
                if (itemIdx === 0) {
                  const isSublimationOrLegacy = 
                    item.name?.includes('VARIOS PANELES') || 
                    item.name?.includes('SUBLIMACION') ||
                    item.category?.includes('SUBLIMACION') ||
                    item.category === 'otro';

                  if (isSublimationOrLegacy) {
                    supabase
                      .from('order_items')
                      .update({
                        category: 'Servicios de Sublimación',
                        product_category: 'SUBLIMACION POR PANELES',
                        name: 'SUBLIMACION POR PANELES (Servicios de Sublimación)',
                        quantity: 1,
                        size_distribution: {
                          "1 PANEL": { cantidad: 1, tipo: "Deportivos Fantasma" }
                        }
                      })
                      .eq('id', item.id)
                      .then(({ error }) => {
                        if (error) console.error('Error al actualizar el item de sublimación en la BD:', error);
                        else console.log('Item de sublimación corregido con éxito en la BD.');
                      });

                    return {
                      ...item,
                      category: 'Servicios de Sublimación',
                      product_category: 'SUBLIMACION POR PANELES',
                      name: 'SUBLIMACION POR PANELES (Servicios de Sublimación)',
                      quantity: 1,
                      size_distribution: {
                        "1 PANEL": { cantidad: 1, tipo: "Deportivos Fantasma" }
                      }
                    };
                  }
                }
                return item;
              });

              return {
                ...order,
                order_items: updatedItems
              };
            }
            return order;
          });
        };

        setOrders(processLoadedOrders(data));
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
      orderDate: new Date().toISOString().split('T')[0]
    })
    setFormErrors({})
    if (convertQuoteId) {
      searchParams.delete('convertQuoteId')
      setSearchParams(searchParams)
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
      return Object.entries(orderForm.sizes).reduce((sum, [panel, qty]) => {
        if (!PANELS_LIST.includes(panel)) return sum;
        const price = orderForm.sizePrices[panel] || 0
        return sum + (parseInt(qty) || 0) * parseFloat(price)
      }, 0)
    } else {
      const unit = activeSub?.unit || 'unidad';
      
      if (unit === '1000_puntadas') {
         return ((parseInt(orderForm.stitchesCount) || 0) / 1000) * parseFloat(orderForm.flatUnitPrice) * (parseInt(orderForm.flatQuantity) || 1)
      } else {
         return (parseInt(orderForm.flatQuantity) || 0) * (parseFloat(orderForm.flatUnitPrice) || 0)
      }
    }
  }, [orderForm.category, orderForm.subcategory, orderForm.sizes, orderForm.sizePrices, orderForm.flatQuantity, orderForm.flatUnitPrice, orderForm.stitchesCount, settings])

  const subtotal = totalAmount / 1.18
  const igvAmount = totalAmount - subtotal

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
          delivery_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
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
              return { ...acc, [panel]: { cantidad: qtyQty, tipo: type } }
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
                  <div className="space-y-3">
                    <p className="text-xs text-on-surface-variant/80">
                      Modifica la cantidad y el precio por tipo de panel (desliza horizontalmente).
                    </p>
                    {formErrors.sizes && (
                      <AlertBanner type="error">{formErrors.sizes}</AlertBanner>
                    )}
                    <div className="panels-scroll-container pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-[#ff5c00]/30 scrollbar-track-transparent">
                      {PANELS_LIST.map((panel) => {
                        const qty = orderForm.sizes[panel] || 0
                        const price = orderForm.sizePrices[panel] || 0
                        return (
                          <div key={panel} className="min-w-[175px] w-[175px] flex-shrink-0 snap-start p-3 bg-surface-container rounded-xl border border-outline-variant space-y-2.5 text-on-surface">
                            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-1">
                              <span className="text-[11px] font-bold text-primary truncate max-w-[90px]" title={panel}>{panel}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-on-surface-variant font-mono">P. Ud:</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={price}
                                  onChange={e => updateSizePrice(panel, e.target.value)}
                                  className="w-12 text-right bg-transparent border-none rounded px-1 py-0.5 text-xs text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary/50 neu-pressed"
                                />
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between neu-pressed rounded-lg p-1 border border-outline-variant/30">
                              <button
                                type="button"
                                onClick={() => updateSizeQty(panel, -1)}
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
                                    sizes: { ...prev.sizes, [panel]: val }
                                  }))
                                }}
                                className="bg-transparent border-none text-center w-8 font-mono text-xs text-on-surface outline-none focus:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => updateSizeQty(panel, 1)}
                                className="w-7 h-7 flex items-center justify-center rounded bg-[#f1f5f9] border border-outline-variant/30 active:scale-95 text-xs text-primary cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[12px]">add</span>
                              </button>
                            </div>

                            {/* Dropdown y Textbox para Tipo de Item */}
                            {(() => {
                              const options = PANEL_OPTIONS[panel] || [];
                              const currentVal = orderForm.itemTypes[panel] || 'Otros';
                              const isCustom = !options.filter(opt => opt !== 'Otros').includes(currentVal);
                              const selectVal = isCustom ? 'Otros' : currentVal;

                              return (
                                <div className="space-y-1 pt-1.5 border-t border-outline-variant/30">
                                  <label className="text-[9px] text-on-surface-variant font-mono block">TIPO ITEM:</label>
                                  <select
                                    value={selectVal}
                                    onChange={e => {
                                      const val = e.target.value
                                      updateFormItemType(panel, val)
                                    }}
                                    className="w-full bg-transparent border-none rounded px-1 py-0.5 text-[10px] text-on-surface outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer neu-pressed"
                                  >
                                    {options.map(opt => (
                                      <option key={opt} value={opt} className="bg-surface text-on-surface text-[10px]">{opt}</option>
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
                                      className="w-full bg-transparent border-none rounded px-1.5 py-1 text-[10px] text-on-surface outline-none focus:ring-1 focus:ring-[#ff5c00]/50 font-sans mt-1 neu-pressed"
                                    />
                                  )}
                                </div>
                              );
                            })()}

                            <div className="text-right border-t border-white/5 pt-1.5">
                              <span className="text-[10px] text-on-surface-variant/80 font-mono">
                                Sub: {formatCurrency(qty * price)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Detalle del Pedido y Total de la Suma de Paneles */}
                    {(() => {
                      const totalPanels = Object.entries(orderForm.sizes).reduce((sum, [k, v]) => PANELS_LIST.includes(k) ? sum + (parseInt(v) || 0) : sum, 0);
                      return (
                        <div className="p-3 bg-black/35 rounded-xl border border-white/5 space-y-2 text-xs font-mono">
                          <div className="text-[10px] text-[#ff5c00] uppercase tracking-wider font-bold border-b border-white/5 pb-1 flex justify-between">
                            <span>Detalle del Pedido</span>
                            <span>Cant. x P.Unit</span>
                          </div>
                          <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                            {PANELS_LIST.map((panel) => {
                              const qty = orderForm.sizes[panel] || 0
                              const price = orderForm.sizePrices[panel] || 0
                              const type = orderForm.itemTypes[panel] || 'Otros'
                              if (qty <= 0) return null
                              return (
                                <div key={panel} className="flex justify-between text-on-surface-variant text-[11px]">
                                  <span>{panel} ({type})</span>
                                  <span>{qty} x {formatCurrency(price)} = {formatCurrency(qty * price)}</span>
                                </div>
                              )
                            })}
                            {totalPanels === 0 && (
                              <div className="text-on-surface-variant/50 text-center py-2 text-[11px]">Sin paneles registrados</div>
                            )}
                          </div>
                          <div className="flex justify-between font-bold text-white border-t border-white/5 pt-1.5 text-[11px]">
                            <span>SUMA TOTAL PANELES:</span>
                            <span className="text-primary">{totalPanels} {totalPanels === 1 ? 'PANEL' : 'PANELES'}</span>
                          </div>
                        </div>
                      )
                    })()}
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

                <Input
                  label="Fecha de Pedido"
                  type="date"
                  value={orderForm.orderDate}
                  onChange={e => updateForm('orderDate', e.target.value)}
                  required
                  className="w-full"
                />

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
                            <span className="text-[10px] font-semibold text-white/95 uppercase tracking-wide block mt-1">
                              {firstItem?.category || '—'}
                              {order.order_items?.length > 1 && (
                                <span className="text-[9px] text-primary font-mono ml-1">
                                  (+{order.order_items.length - 1})
                                </span>
                              )}
                            </span>
                          </td>

                          {/* COLUMNA 2: Descripcion/Cliente */}
                          <td className="px-4 py-3 text-sm">
                            <span className="font-bold text-white block">{order.terceros?.name || 'Cliente general'}</span>
                            <span className="text-xs text-on-surface-variant block mt-0.5 font-medium truncate max-w-[200px]">
                              {(() => {
                                const isProduccionTextil = firstItem?.category === 'Producción Textil';
                                const isSublimacionPaneles = firstItem?.category === 'Servicios de Sublimación' && firstItem?.product_category === 'SUBLIMACION POR PANELES';
                                if (isProduccionTextil) {
                                  return 'VARIAS TALLAS / ' + (firstItem?.name || 'Prendas');
                                } else if (isSublimacionPaneles) {
                                  const panelEntries = Object.entries(firstItem?.size_distribution || {})
                                    .filter(([k, v]) => PANELS_LIST.includes(k) && v && typeof v === 'object' && v.cantidad > 0);
                                  const totalQty = panelEntries.reduce((sum, [_, v]) => sum + (Number(v.cantidad) || 0), 0);
                                  const types = Array.from(new Set(panelEntries.map(([_, v]) => v.tipo).filter(Boolean)));
                                  const typesStr = types.join(', ');
                                  
                                  if (totalQty === 1) {
                                    return `1 panel / ${typesStr || 'Deportivos Fantasma'}`;
                                  } else if (totalQty > 1) {
                                    return `${totalQty} paneles / ${typesStr || 'Deportivos Fantasma'}`;
                                  }
                                  return '1 panel / Deportivos Fantasma';
                                } else {
                                  return firstItem?.name || '—';
                                }
                              })()}
                            </span>
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

            {/* Ítems del pedido */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant font-semibold">
                Detalle de Servicios / Productos
              </h4>
              <div className="space-y-2">
                {selectedOrder.order_items?.map(item => (
                  <Card key={item.id} className="p-4 bg-[#060a14] border border-white/5 space-y-4">
                    <div className="flex justify-between items-start">
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
                        <p className="text-xs text-on-surface-variant font-mono">
                          {item.quantity} x {formatCurrency(item.unit_price)}
                        </p>
                        <p className="text-sm font-bold text-white font-mono mt-0.5">
                          {formatCurrency(item.total_price)}
                        </p>
                      </div>
                    </div>

                    {/* Detalles del Pedido (Tallas, Paneles, Metros) */}
                    {item.size_distribution && (
                      <div className="border-t border-white/5 pt-3 space-y-2">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-primary">
                          Distribución / Detalles de Trabajo
                        </p>
                        {Object.keys(item.size_distribution).some(k => PANELS_LIST.includes(k)) ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(item.size_distribution).map(([panel, data]) => {
                              if (!data || !data.cantidad) return null
                              return (
                                <div key={panel} className="neu-pressed p-2.5 rounded-xl flex justify-between items-center text-xs">
                                  <div>
                                    <p className="font-bold text-white">{panel}</p>
                                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Item: {data.tipo}</p>
                                  </div>
                                  <span className="font-mono text-primary font-bold text-sm">x{data.cantidad}</span>
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
                    <div className="border-t border-white/5 pt-3 mt-2">
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
            <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button onClick={() => setSelectedOrder(null)}>
                Cerrar Detalle
              </Button>
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
