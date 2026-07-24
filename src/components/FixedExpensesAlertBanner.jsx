import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGlobalSettings } from '@/context/GlobalSettingsContext'
import { formatCurrency } from '@/lib/formatters'

export function FixedExpensesAlertBanner({ expenses = [], onQuickPay = null }) {
  const navigate = useNavigate()
  const { settings } = useGlobalSettings()
  const fixedExpenses = settings.fixedExpenses || []

  const alertAnalysis = useMemo(() => {
    const today = new Date()
    const currentDay = today.getDate()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`

    const activeItems = fixedExpenses.filter(item => item.active !== false)

    const overdue = []
    const dueSoon = []
    let totalPendingAmount = 0

    activeItems.forEach(item => {
      // Verificar si ya fue pagado este mes en la tabla de gastos
      const isPaid = expenses.some(exp => {
        const expDate = exp.date || exp.created_at || ''
        const matchesMonth = expDate.startsWith(monthStr)
        const matchesConcept = (exp.specific_item || exp.specificItem || exp.description || '')
          .toLowerCase()
          .includes((item.concept || '').toLowerCase()) ||
          (exp.category_key || exp.categoryKey || '').toLowerCase() === (item.category || '').toLowerCase()
        return matchesMonth && matchesConcept
      })

      if (!isPaid) {
        totalPendingAmount += Number(item.amount) || 0
        const daysDiff = item.dueDay - currentDay

        if (currentDay > item.dueDay) {
          overdue.push({
            ...item,
            daysOverdue: currentDay - item.dueDay
          })
        } else if (daysDiff >= 0 && daysDiff <= 5) {
          dueSoon.push({
            ...item,
            daysLeft: daysDiff
          })
        }
      }
    })

    return { overdue, dueSoon, totalPendingAmount }
  }, [fixedExpenses, expenses])

  const { overdue, dueSoon, totalPendingAmount } = alertAnalysis

  if (overdue.length === 0 && dueSoon.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 mb-6 animate-fade-in">
      {/* Banner Principal de Notificación */}
      <div className={`p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden shadow-lg transition-all ${
        overdue.length > 0
          ? 'bg-gradient-to-r from-error/20 via-surface-container-high to-surface-container-low border-error/40 text-on-surface'
          : 'bg-gradient-to-r from-amber-500/20 via-surface-container-high to-surface-container-low border-amber-500/40 text-on-surface'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              overdue.length > 0 ? 'bg-error/20 text-error animate-pulse' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <span className="material-symbols-outlined text-[24px]">
                {overdue.length > 0 ? 'warning' : 'notifications_active'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-base">
                  {overdue.length > 0
                    ? `⚠️ ¡Tienes ${overdue.length} Gasto(s) Fijo(s) Vencido(s) este mes!`
                    : `⏰ ${dueSoon.length} Gasto(s) Fijo(s) próximo(s) a vencer`}
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-white">
                  Pendiente: {formatCurrency(totalPendingAmount)}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Registra los pagos para mantener tus cuentas al día y evitar cortes o penalizaciones.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/configuracion')}
            className="self-start md:self-center px-3.5 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            Gestionar Fijos
          </button>
        </div>

        {/* Lista de Ítems Alerta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-white/10">
          {/* Overdue Items */}
          {overdue.map(item => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-error/15 border border-error/30 flex items-center justify-between gap-2"
            >
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-error block">
                  VENCIDO HACE {item.daysOverdue} DÍA(S) (Día {item.dueDay})
                </span>
                <span className="font-bold text-white text-xs block truncate" title={item.concept}>
                  {item.concept}
                </span>
                <span className="text-xs font-mono text-error font-bold block mt-0.5">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              {onQuickPay ? (
                <button
                  onClick={() => onQuickPay(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-error text-white font-bold text-[10px] hover:brightness-110 transition-all shrink-0 cursor-pointer shadow-sm"
                >
                  Pagar
                </button>
              ) : (
                <button
                  onClick={() => navigate('/gastos')}
                  className="px-2.5 py-1.5 rounded-lg bg-error text-white font-bold text-[10px] hover:brightness-110 transition-all shrink-0 cursor-pointer shadow-sm"
                >
                  Registrar
                </button>
              )}
            </div>
          ))}

          {/* Due Soon Items */}
          {dueSoon.map(item => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-2"
            >
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block">
                  {item.daysLeft === 0 ? 'VENCE HOY' : `VENCE EN ${item.daysLeft} DÍA(S)`} (Día {item.dueDay})
                </span>
                <span className="font-bold text-white text-xs block truncate" title={item.concept}>
                  {item.concept}
                </span>
                <span className="text-xs font-mono text-amber-400 font-bold block mt-0.5">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              {onQuickPay ? (
                <button
                  onClick={() => onQuickPay(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-[10px] hover:brightness-110 transition-all shrink-0 cursor-pointer shadow-sm"
                >
                  Pagar
                </button>
              ) : (
                <button
                  onClick={() => navigate('/gastos')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-[10px] hover:brightness-110 transition-all shrink-0 cursor-pointer shadow-sm"
                >
                  Registrar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
