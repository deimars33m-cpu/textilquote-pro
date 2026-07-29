import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/context/NotificationContext'
import { formatCurrency } from '@/lib/formatters'

export default function NotificationRightSidebar() {
  const navigate = useNavigate()
  const {
    fixedExpensesNotifications,
    orderNotifications,
    totalAlertsCount,
    sidebarCollapsed,
    setSidebarCollapsed
  } = useNotifications()

  const { overdue, dueSoon, totalPendingAmount } = fixedExpensesNotifications
  const { overdueOrders, dueSoonOrders } = orderNotifications

  if (sidebarCollapsed) {
    return (
      <div className="hidden xl:flex fixed right-0 top-16 h-[calc(100vh-64px)] w-[60px] bg-surface-container/95 backdrop-blur-md border-l border-outline-variant flex-col items-center py-4 z-40 transition-all duration-300">
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="relative p-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer group"
          title="Expandir Notificaciones"
        >
          <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">notifications</span>
          {totalAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-error text-white font-mono text-[10px] font-bold flex items-center justify-center animate-bounce shadow-md">
              {totalAlertsCount > 9 ? '9+' : totalAlertsCount}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <aside className="hidden xl:flex fixed right-0 top-16 h-[calc(100vh-64px)] w-[280px] bg-surface-container/95 backdrop-blur-md border-l border-outline-variant flex-col py-4 px-3 z-40 transition-all duration-300 select-none">
      {/* Header Sidebar */}
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/50 mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">notifications</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Notificaciones</h3>
            <span className="text-[10px] text-on-surface-variant font-mono block">Alertas en tiempo real</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {totalAlertsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-error/20 text-error text-[10px] font-mono font-bold border border-error/30">
              {totalAlertsCount} activa(s)
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="p-1 text-on-surface-variant hover:text-white rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
            title="Colapsar"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Notificaciones Scrollable Body */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {totalAlertsCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant gap-2 neu-pressed p-4 rounded-2xl">
            <span className="material-symbols-outlined text-emerald-400 text-3xl">check_circle</span>
            <p className="text-xs font-bold text-white">¡Todo al día!</p>
            <p className="text-[10px]">No tienes gastos ni entregas vencidas pendientes.</p>
          </div>
        ) : (
          <>
            {/* SECCIÓN 1: GASTOS FIJOS VENCIDOS */}
            {overdue.length > 0 && (
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold text-error uppercase tracking-wider block px-1">
                  🚨 Gastos Vencidos ({overdue.length})
                </span>
                {overdue.map(item => (
                  <div
                    key={`overdue-${item.id}`}
                    className="p-3 rounded-xl bg-error/10 border border-error/30 space-y-1.5 hover:border-error/50 transition-all text-left"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-bold uppercase text-error font-mono">
                        Vencido (Día {item.dueDay})
                      </span>
                      <span className="text-[10px] font-mono font-bold text-white">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white truncate" title={item.concept}>
                      {item.concept}
                    </p>
                    <div className="flex justify-between items-center pt-1 border-t border-error/20">
                      <span className="text-[9px] text-error/80 font-mono">Hace {item.daysOverdue} día(s)</span>
                      <button
                        onClick={() => navigate('/expenses')}
                        className="px-2 py-1 rounded bg-error text-white font-bold text-[9px] hover:brightness-110 transition-all cursor-pointer"
                      >
                        Pagar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SECCIÓN 2: GASTOS FIJOS PRÓXIMOS A VENCER */}
            {dueSoon.length > 0 && (
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider block px-1">
                  ⏰ Gastos por Vencer ({dueSoon.length})
                </span>
                {dueSoon.map(item => (
                  <div
                    key={`duesoon-${item.id}`}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 hover:border-amber-500/50 transition-all text-left"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-bold uppercase text-amber-400 font-mono">
                        {item.daysLeft === 0 ? 'Vence Hoy' : `En ${item.daysLeft} día(s)`}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-white">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white truncate" title={item.concept}>
                      {item.concept}
                    </p>
                    <div className="flex justify-between items-center pt-1 border-t border-amber-500/20">
                      <span className="text-[9px] text-amber-300/80 font-mono">Día {item.dueDay}</span>
                      <button
                        onClick={() => navigate('/expenses')}
                        className="px-2 py-1 rounded bg-amber-500 text-black font-bold text-[9px] hover:brightness-110 transition-all cursor-pointer"
                      >
                        Registrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SECCIÓN 3: PEDIDOS PRÓXIMOS A ENTREGA */}
            {(overdueOrders.length > 0 || dueSoonOrders.length > 0) && (
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider block px-1">
                  📦 Entregas de Pedidos
                </span>
                {overdueOrders.map(ord => (
                  <div
                    key={`ord-overdue-${ord.id}`}
                    className="p-3 rounded-xl bg-error/10 border border-error/30 space-y-1 text-left"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold text-primary">
                        Pedido #{ord.order_number?.toString().padStart(4, '0')}
                      </span>
                      <span className="text-[9px] font-mono text-error font-bold uppercase">Entrega Atrasada</span>
                    </div>
                    <p className="text-xs text-white truncate">{ord.terceros?.name || 'Cliente sin nombre'}</p>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[9px] text-on-surface-variant font-mono">Atrasado {ord.daysOverdue}d</span>
                      <button
                        onClick={() => navigate('/orders')}
                        className="px-2 py-0.5 rounded bg-primary/20 text-primary font-bold text-[9px] border border-primary/30 hover:bg-primary hover:text-white transition-colors cursor-pointer"
                      >
                        Ver Pedido
                      </button>
                    </div>
                  </div>
                ))}

                {dueSoonOrders.map(ord => (
                  <div
                    key={`ord-duesoon-${ord.id}`}
                    className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/40 space-y-1 text-left"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold text-primary">
                        Pedido #{ord.order_number?.toString().padStart(4, '0')}
                      </span>
                      <span className="text-[9px] font-mono text-amber-400 font-bold uppercase">
                        {ord.daysLeft === 0 ? 'Entrega Hoy' : `Entrega en ${ord.daysLeft}d`}
                      </span>
                    </div>
                    <p className="text-xs text-white truncate">{ord.terceros?.name || 'Cliente sin nombre'}</p>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[9px] text-on-surface-variant font-mono">{ord.delivery_date}</span>
                      <button
                        onClick={() => navigate('/orders')}
                        className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[9px] hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        Ver Pedido
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Sidebar */}
      {totalPendingAmount > 0 && (
        <div className="pt-3 border-t border-outline-variant/50 mt-auto">
          <div className="neu-pressed p-2.5 rounded-xl flex items-center justify-between text-xs">
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">Total Pendiente:</span>
            <span className="font-mono font-bold text-error">{formatCurrency(totalPendingAmount)}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
