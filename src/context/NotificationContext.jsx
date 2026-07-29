import { createContext, useContext, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobalSettings } from '@/context/GlobalSettingsContext'
import { useAuth } from '@/context/AuthContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const { settings } = useGlobalSettings()
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // 1. Obtener gastos del mes para validar pagos de gastos fijos
  const { data: expenses = [] } = useQuery({
    queryKey: ['notifications_expenses', user?.id],
    queryFn: async () => {
      if (!user) return []
      const now = new Date()
      const startOfMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startOfMonth)
      if (error) return []
      return data || []
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 mins
  })

  // 2. Obtener pedidos activos para verificar fechas de entrega
  const { data: activeOrders = [] } = useQuery({
    queryKey: ['notifications_orders', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, delivery_date, status, total_amount, paid_amount, terceros(name)')
        .not('status', 'in', '("entregado","cancelado")')
      if (error) return []
      return data || []
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  })

  // 3. Analizar notificaciones de Gastos Fijos
  const fixedExpensesNotifications = useMemo(() => {
    const fixedExpenses = settings?.fixedExpenses || []
    const today = new Date()
    const currentDay = today.getDate()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`

    const activeItems = fixedExpenses.filter(item => item && item.active !== false)

    const overdue = []
    const dueSoon = []
    let totalPendingAmount = 0

    activeItems.forEach(item => {
      const isPaid = (expenses || []).some(exp => {
        if (!exp) return false
        const expDate = exp.date || exp.created_at || ''
        const matchesMonth = expDate.startsWith(monthStr)
        const expCategory = (exp.category_key || exp.categoryKey || '')
        const matchesCat = expCategory === 'GASTOS_FIJOS' || expCategory.toLowerCase() === (item.subcategory || item.category || '').toLowerCase()
        const itemSubcat = (item.subcategory || item.category || '').toLowerCase()
        const itemSpecific = (item.specificItem || item.concept || '').toLowerCase()
        const matchesSubcat = (exp.subcategory || '').toLowerCase() === itemSubcat
        const matchesSpecific = (exp.specific_item || exp.specificItem || '').toLowerCase() === itemSpecific
        const fallbackMatch = itemSpecific && (exp.description || '').toLowerCase().includes(itemSpecific)

        return matchesMonth && matchesCat && ((matchesSubcat && matchesSpecific) || fallbackMatch)
      })

      if (!isPaid) {
        totalPendingAmount += Number(item.amount) || 0
        const daysDiff = item.dueDay - currentDay

        if (currentDay > item.dueDay) {
          overdue.push({
            ...item,
            type: 'fixed_expense_overdue',
            daysOverdue: currentDay - item.dueDay
          })
        } else if (daysDiff >= 0 && daysDiff <= 5) {
          dueSoon.push({
            ...item,
            type: 'fixed_expense_duesoon',
            daysLeft: daysDiff
          })
        }
      }
    })

    return { overdue, dueSoon, totalPendingAmount }
  }, [settings?.fixedExpenses, expenses])

  // 4. Analizar notificaciones de Pedidos
  const orderNotifications = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueOrders = []
    const dueSoonOrders = []

    activeOrders.forEach(ord => {
      if (!ord.delivery_date) return
      const deliv = new Date(ord.delivery_date)
      deliv.setHours(0, 0, 0, 0)

      const diffDays = Math.round((deliv - today) / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        overdueOrders.push({
          ...ord,
          type: 'order_overdue',
          daysOverdue: Math.abs(diffDays)
        })
      } else if (diffDays >= 0 && diffDays <= 3) {
        dueSoonOrders.push({
          ...ord,
          type: 'order_duesoon',
          daysLeft: diffDays
        })
      }
    })

    return { overdueOrders, dueSoonOrders }
  }, [activeOrders])

  const totalAlertsCount = useMemo(() => {
    return (
      fixedExpensesNotifications.overdue.length +
      fixedExpensesNotifications.dueSoon.length +
      orderNotifications.overdueOrders.length +
      orderNotifications.dueSoonOrders.length
    )
  }, [fixedExpensesNotifications, orderNotifications])

  return (
    <NotificationContext.Provider
      value={{
        fixedExpensesNotifications,
        orderNotifications,
        totalAlertsCount,
        mobileModalOpen,
        setMobileModalOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        expenses
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de un NotificationProvider')
  }
  return context
}
