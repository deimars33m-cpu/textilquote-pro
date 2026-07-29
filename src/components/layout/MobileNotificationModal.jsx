import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/index.jsx'
import { useNotifications } from '@/context/NotificationContext'
import { formatCurrency } from '@/lib/formatters'

export default function MobileNotificationModal() {
  const navigate = useNavigate()
  const {
    fixedExpensesNotifications,
    orderNotifications,
    totalAlertsCount,
    mobileModalOpen,
    setMobileModalOpen
  } = useNotifications()

  const { overdue, dueSoon, totalPendingAmount } = fixedExpensesNotifications
  const { overdueOrders, dueSoonOrders } = orderNotifications

  return (
    <Modal
      isOpen={mobileModalOpen}
      onClose={() => setMobileModalOpen(false)}
      title="Notificaciones & Alertas"
      size="md"
    >
      <div className="space-y-4 text-on-surface">
        {totalAlertsCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3 neu-pressed p-6 rounded-2xl">
            <span className="material-symbols-outlined text-emerald-400 text-4xl">check_circle</span>
            <p className="text-sm font-bold text-white">¡No tienes avisos pendientes!</p>
            <p className="text-xs text-on-surface-variant">Tus gastos fijos y entregas de pedidos están al día.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Header Resumen */}
            {totalPendingAmount > 0 && (
              <div className="p-3.5 rounded-xl bg-error/10 border border-error/30 flex items-center justify-between">
                <span className="text-xs font-bold text-white">Total Pendiente Gastos Fijos:</span>
                <span className="text-sm font-mono font-bold text-error">{formatCurrency(totalPendingAmount)}</span>
              </div>
            )}

            {/* SECCIÓN 1: GASTOS FIJOS VENCIDOS */}
            {overdue.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold text-error uppercase tracking-wider">
                  🚨 Gastos Fijos Vencidos ({overdue.length})
                </h4>
                {overdue.map(item => (
                  <div
                    key={`m-overdue-${item.id}`}
                    className="p-3 rounded-xl bg-error/15 border border-error/30 flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <span className="text-[9px] font-bold text-error font-mono block uppercase">
                        VENCIDO HACE {item.daysOverdue} DÍA(S) (Día {item.dueDay})
                      </span>
                      <span className="text-xs font-bold text-white block">{item.concept}</span>
                      <span className="text-xs font-mono font-bold text-error block mt-0.5">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setMobileModalOpen(false)
                        navigate('/expenses')
                      }}
                      className="px-3 py-1.5 rounded-lg bg-error text-white font-bold text-xs hover:brightness-110 shrink-0 cursor-pointer shadow-sm"
                    >
                      Pagar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SECCIÓN 2: GASTOS FIJOS PRÓXIMOS */}
            {dueSoon.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  ⏰ Gastos Fijos Próximos a Vencer ({dueSoon.length})
                </h4>
                {dueSoon.map(item => (
                  <div
                    key={`m-duesoon-${item.id}`}
                    className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <span className="text-[9px] font-bold text-amber-400 font-mono block uppercase">
                        {item.daysLeft === 0 ? 'VENCE HOY' : `VENCE EN ${item.daysLeft} DÍA(S)`} (Día {item.dueDay})
                      </span>
                      <span className="text-xs font-bold text-white block">{item.concept}</span>
                      <span className="text-xs font-mono font-bold text-amber-400 block mt-0.5">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setMobileModalOpen(false)
                        navigate('/expenses')
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:brightness-110 shrink-0 cursor-pointer shadow-sm"
                    >
                      Registrar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SECCIÓN 3: PEDIDOS */}
            {(overdueOrders.length > 0 || dueSoonOrders.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
                  📦 Entregas de Pedidos
                </h4>
                {overdueOrders.map(ord => (
                  <div
                    key={`m-ord-over-${ord.id}`}
                    className="p-3 rounded-xl bg-error/10 border border-error/30 flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <span className="text-[9px] font-mono font-bold text-error uppercase block">Atrasado {ord.daysOverdue} día(s)</span>
                      <span className="text-xs font-bold text-white block">Pedido #{ord.order_number?.toString().padStart(4, '0')}</span>
                      <span className="text-xs text-on-surface-variant truncate block">{ord.terceros?.name || 'Cliente'}</span>
                    </div>
                    <button
                      onClick={() => {
                        setMobileModalOpen(false)
                        navigate('/orders')
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Ver
                    </button>
                  </div>
                ))}

                {dueSoonOrders.map(ord => (
                  <div
                    key={`m-ord-due-${ord.id}`}
                    className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/40 flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <span className="text-[9px] font-mono font-bold text-amber-400 uppercase block">
                        {ord.daysLeft === 0 ? 'Entrega Hoy' : `Entrega en ${ord.daysLeft} día(s)`}
                      </span>
                      <span className="text-xs font-bold text-white block">Pedido #{ord.order_number?.toString().padStart(4, '0')}</span>
                      <span className="text-xs text-on-surface-variant truncate block">{ord.terceros?.name || 'Cliente'}</span>
                    </div>
                    <button
                      onClick={() => {
                        setMobileModalOpen(false)
                        navigate('/orders')
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-white font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Ver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-outline-variant">
          <button
            onClick={() => setMobileModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
