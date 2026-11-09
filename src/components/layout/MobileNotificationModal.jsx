import { useState } from 'react'
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

  const { overdue = [], dueSoon = [], completed = [], totalPendingAmount = 0 } = fixedExpensesNotifications
  const { overdueOrders = [], dueSoonOrders = [] } = orderNotifications
  const [showCompleted, setShowCompleted] = useState(false)

  const handlePayExpense = (item) => {
    setMobileModalOpen(false)
    navigate('/expenses', { state: { quickPayItem: item } })
  }

  return (
    <Modal
      isOpen={mobileModalOpen}
      onClose={() => setMobileModalOpen(false)}
      title="Notificaciones & Alertas"
      size="md"
    >
      <div className="space-y-4 text-on-surface">
        {totalAlertsCount === 0 && completed.length === 0 ? (
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
                    className="p-3.5 rounded-xl bg-error/15 border border-error/30 space-y-2 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-bold text-error font-mono uppercase">
                          VENCIDO HACE {item.daysOverdue} DÍA(S) (Día {item.dueDay})
                        </span>
                        {item.isPartial && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono text-[8px] font-bold border border-amber-500/30">
                            Parcial ({item.percentagePaid}%)
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-error block">
                          {formatCurrency(item.remainingAmount > 0 ? item.remainingAmount : item.amount)}
                        </span>
                        {item.isPartial && (
                          <span className="text-[8px] font-mono text-on-surface-variant block">
                            de {formatCurrency(item.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-bold text-white block">{item.concept}</span>

                    {item.isPartial && (
                      <div className="space-y-1 py-1">
                        <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-400 h-1.5 rounded-full"
                            style={{ width: `${item.percentagePaid}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono">
                          <span className="text-emerald-400 font-semibold">Pagado: {formatCurrency(item.paidAmount)}</span>
                          <span className="text-error font-bold">Resta: {formatCurrency(item.remainingAmount)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handlePayExpense(item)}
                        className="px-3 py-1.5 rounded-lg bg-error text-white font-bold text-xs hover:brightness-110 shrink-0 cursor-pointer shadow-sm"
                      >
                        {item.isPartial ? 'Pagar Saldo' : 'Pagar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SECCIÓN 2: GASTOS FIJOS PRÓXIMOS / EN CURSO */}
            {dueSoon.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  ⏰ Gastos Fijos por Vencer ({dueSoon.length})
                </h4>
                {dueSoon.map(item => (
                  <div
                    key={`m-duesoon-${item.id}`}
                    className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 space-y-2 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-bold text-amber-400 font-mono uppercase">
                          {item.daysLeft === 0 ? 'VENCE HOY' : item.daysLeft < 0 ? `VENCIDO (${Math.abs(item.daysLeft)}d)` : `VENCE EN ${item.daysLeft} DÍA(S)`} (Día {item.dueDay})
                        </span>
                        {item.isPartial && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[8px] font-bold border border-amber-500/30">
                            Parcial ({item.percentagePaid}%)
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-400 block">
                          {formatCurrency(item.remainingAmount > 0 ? item.remainingAmount : item.amount)}
                        </span>
                        {item.isPartial && (
                          <span className="text-[8px] font-mono text-on-surface-variant block">
                            de {formatCurrency(item.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-bold text-white block">{item.concept}</span>

                    {item.isPartial && (
                      <div className="space-y-1 py-1">
                        <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-400 h-1.5 rounded-full"
                            style={{ width: `${item.percentagePaid}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono">
                          <span className="text-emerald-400 font-semibold">Pagado: {formatCurrency(item.paidAmount)}</span>
                          <span className="text-amber-400 font-bold">Resta: {formatCurrency(item.remainingAmount)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handlePayExpense(item)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:brightness-110 shrink-0 cursor-pointer shadow-sm"
                      >
                        {item.isPartial ? 'Completar Saldo' : 'Registrar'}
                      </button>
                    </div>
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

            {/* SECCIÓN 4: GASTOS FIJOS PAGADOS COMPLETAMENTE */}
            {completed.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-outline-variant/30">
                <button
                  onClick={() => setShowCompleted(prev => !prev)}
                  className="w-full flex items-center justify-between px-1 py-1.5 text-left cursor-pointer hover:bg-white/5 rounded-lg transition-colors group"
                >
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Pagados del Mes ({completed.length})
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-white transition-transform duration-200" style={{ transform: showCompleted ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    expand_more
                  </span>
                </button>

                {showCompleted && (
                  <div className="space-y-2 pt-1">
                    {completed.map(item => (
                      <div
                        key={`m-comp-${item.id}`}
                        className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-left"
                      >
                        <div>
                          <span className="text-xs font-bold text-white block">{item.concept}</span>
                          <span className="text-[9px] font-mono text-emerald-300/70">
                            Cubierto 100% ({item.matchingExpensesCount} pago(s))
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {formatCurrency(item.paidAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
