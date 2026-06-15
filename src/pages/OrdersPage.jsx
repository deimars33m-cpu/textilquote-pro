import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  Card, SearchInput, Button, StatusBadge,
  LoadingSpinner, EmptyState, Select, AlertBanner, Modal
} from '@/components/ui/index.jsx'
import { formatCurrency, formatDate, formatQuoteNumber } from '@/lib/formatters'

export default function OrdersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const convertQuoteId = searchParams.get('convertQuoteId')

  // Estado de datos
  const [orders, setOrders] = useState([])
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

  useEffect(() => {
    if (user) {
      fetchOrders()
    }
  }, [user])

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
          clients (name, phone),
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
        setOrders(data || [])
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setDbError(err.message || 'Error al cargar los pedidos.')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const clientName = o.clients?.name || 'Cliente general'
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
    if (convertQuoteId) {
      searchParams.delete('convertQuoteId')
      setSearchParams(searchParams)
    }
  }

  // Renderizador del panel lateral
  const renderNewOrderPanel = (isMobile = false, onClose = null) => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <div>
            <h3 className="text-body-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">add_shopping_cart</span>
              Registrar Nuevo Pedido
            </h3>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider mt-1">
              Servicios Rápidos o Cotizaciones
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

        {convertQuoteId && (
          <AlertBanner type="info">
            <span className="font-semibold">Cotización aprobada detectada.</span> Los datos de la cotización se precargarán automáticamente en este panel.
          </AlertBanner>
        )}

        <div className="p-6 rounded-2xl bg-[#060a14] border border-white/5 flex flex-col items-center justify-center text-center py-12 min-h-[300px]">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary orange-glow">
            <span className="material-symbols-outlined text-[32px]">design_services</span>
          </div>
          <h4 className="text-body-lg font-semibold text-white mb-2">Formulario de Pedidos</h4>
          <p className="text-xs text-on-surface-variant max-w-[240px] leading-relaxed">
            Este espacio está reservado para la implementación posterior del formulario de registro y sus parámetros de costeo.
          </p>
          <div className="mt-6 w-full space-y-3">
            <div className="w-full h-10 rounded-xl bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center text-[11px] text-on-surface-variant font-mono">
              [Datos Generales e Importación]
            </div>
            <div className="w-full h-14 rounded-xl bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center text-[11px] text-on-surface-variant font-mono">
              [Ítems: Servicios / Confección]
            </div>
            <div className="w-full h-16 rounded-xl bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center text-[11px] text-on-surface-variant font-mono">
              [Parámetros de Insumos y Procesos]
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={isMobile ? onClose : () => {}}
            disabled
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full opacity-60 pointer-events-none"
            disabled
          >
            Registrar Pedido
          </Button>
        </div>
      </div>
    )
  }

  return (
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
          {/* Botón visible solo en móviles que abre el panel derecho */}
          <Button
            className="lg:hidden"
            onClick={() => setShowMobileForm(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            Nuevo Pedido
          </Button>
        </div>
      </div>

      {/* Grid General */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA: Listado y Estadísticas (Toma 8 de 12 en PC) */}
        <div className="lg:col-span-8 space-y-6">
          
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
          <Card className="p-4 space-y-4">
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
          {loading ? (
            <LoadingSpinner />
          ) : filteredOrders.length === 0 ? (
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
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full zebra-table">
                  <thead>
                    <tr className="bg-surface-container-high">
                      <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">N°</th>
                      <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Cliente</th>
                      <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Ítem Principal</th>
                      <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Tipo</th>
                      <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Monto</th>
                      <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Producción</th>
                      <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Pago</th>
                      <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredOrders.map(order => {
                      const firstItem = order.order_items?.[0]
                      const orderNum = `#${order.order_number?.toString().padStart(4, '0')}`

                      // Mapeos visuales de estados de pago
                      const paymentBadges = {
                        pendiente: 'bg-error-container/20 text-error border border-error/20',
                        adelanto: 'bg-primary/10 text-primary border border-primary/20',
                        pagado: 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                      }

                      const paymentLabels = {
                        pendiente: 'Pendiente',
                        adelanto: 'Adelanto',
                        pagado: 'Pagado'
                      }

                      // Mapeo visual de producción
                      const statusBadges = {
                        pendiente: 'bg-white/5 text-on-surface-variant border border-white/10',
                        en_proceso: 'bg-primary/10 text-primary border border-primary/20',
                        listo: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                        entregado: 'bg-tertiary/10 text-tertiary border border-tertiary/20',
                        cancelado: 'bg-error-container/25 text-error border border-error/20'
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
                          <td className="px-4 py-3 text-sm font-mono text-primary font-semibold">
                            {orderNum}
                          </td>
                          <td className="px-4 py-3 text-sm text-on-surface font-medium">
                            {order.clients?.name || 'Cliente general'}
                          </td>
                          <td className="px-4 py-3 text-sm text-on-surface-variant">
                            {firstItem?.name || '—'}
                            {order.order_items?.length > 1 && (
                              <span className="text-xs text-primary font-mono ml-1">
                                (+{order.order_items.length - 1})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">
                            {order.order_type === 'servicio_diario' ? (
                              <span className="text-on-surface-variant/80">Servicio Diario</span>
                            ) : (
                              <span className="text-primary font-bold">Cotizado</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-mono font-bold text-white">
                            {formatCurrency(order.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`status-badge rounded-full ${statusBadges[order.status]}`}>
                              {statusLabels[order.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`status-badge rounded-full ${paymentBadges[order.payment_status]}`}>
                              {paymentLabels[order.payment_status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              Detalle
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>

        {/* COLUMNA DERECHA: Formulario Fijo en PC (Toma 4 de 12 en PC, oculta en móvil) */}
        <div className="hidden lg:block lg:col-span-4">
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
                  {selectedOrder.clients?.name || 'Cliente general'}
                </p>
                {selectedOrder.clients?.phone && (
                  <p className="text-xs text-on-surface-variant mt-0.5">Tel: {selectedOrder.clients.phone}</p>
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
                        {item.size_distribution && Object.keys(item.size_distribution).length > 0 && (
                          <div className="text-[10px] text-on-surface-variant font-mono mt-2 flex flex-wrap gap-1 items-center">
                            <span className="font-bold text-primary">Tallas:</span>
                            {Object.entries(item.size_distribution).map(([size, qty]) => (
                              <span key={size} className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{size}({qty})</span>
                            ))}
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
  )
}
