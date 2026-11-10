import { createContext, useContext, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useGlobalSettings } from '@/context/GlobalSettingsContext'
import { useAuth } from '@/context/AuthContext'

const NotificationContext = createContext(null)

const cleanText = (str) => {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const { settings } = useGlobalSettings()
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // 1. Obtener gastos del mes actual para validar pagos de gastos fijos
  // Se usa ['expenses', 'notifications', user?.id] para invalidarse automáticamente
  // cuando useCRUD('expenses') registra o actualiza un gasto.
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', 'notifications', user?.id],
    queryFn: async () => {
      if (!user) return []
      const now = new Date()
      const startOfMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startOfMonth)
        .order('date', { ascending: false })
      if (error) {
        console.error('Error fetching expenses for notifications:', error)
        return []
      }
      return data || []
    },
    enabled: !!user,
    staleTime: 1000 * 30, // 30 segundos
    refetchOnWindowFocus: true,
  })

  // 2. Obtener pedidos activos para verificar fechas de entrega
  const { data: activeOrders = [] } = useQuery({
    queryKey: ['orders', 'notifications', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, delivery_date, status, total_amount, paid_amount, terceros(name)')
        .not('status', 'in', '("entregado","cancelado")')
      if (error) {
        console.error('Error fetching orders for notifications:', error)
        return []
      }
      return data || []
    },
    enabled: !!user,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  })

  // 3. Analizar notificaciones de Gastos Fijos (pagos parciales, totales, saldos)
  const fixedExpensesNotifications = useMemo(() => {
    const fixedExpenses = settings?.fixedExpenses || []
    const today = new Date()
    const currentDay = today.getDate()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const monthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`

    const activeItems = fixedExpenses.filter(item => item && item.active !== false)

    // Filtrar gastos del mes actual
    const currentMonthExpenses = (expenses || []).filter(exp => {
      if (!exp) return false
      const expDate = exp.date || exp.created_at || ''
      return expDate.startsWith(monthStr)
    })

    // Mapa de gastos asignados a cada ítem de gasto fijo
    const assignedExpenses = new Map()
    activeItems.forEach(item => assignedExpenses.set(item.id, []))

    currentMonthExpenses.forEach(exp => {
      const expCategory = (exp.category_key || exp.categoryKey || '').toUpperCase()
      const expCatLabel = cleanText(exp.category_label || '')
      const isFixedCat = expCategory === 'GASTOS_FIJOS' || expCatLabel.includes('fijo') || expCatLabel.includes('fijos')

      const expSub = cleanText(exp.subcategory)
      const expSpec = cleanText(exp.specific_item || exp.specificItem)
      const expDesc = cleanText(exp.description)
      const expProv = cleanText(exp.provider)

      let bestItem = null
      let bestScore = 0

      activeItems.forEach(item => {
        const itemSub = cleanText(item.subcategory || item.category)
        const itemSpec = cleanText(item.specificItem)
        const itemConcept = cleanText(item.concept)
        const itemProv = cleanText(item.provider_name)

        let score = 0

        // 1. Direct match por ID si estuviera guardado
        if (exp.fixed_expense_id && String(exp.fixed_expense_id) === String(item.id)) {
          score = 100
        }
        // 2. Coincidencia por subcategoría e ítem específico
        else if (itemSub && expSub && itemSub === expSub) {
          if (itemSpec && expSpec && itemSpec === expSpec) {
            score = 95
          } else if (itemSpec && expSpec && (itemSpec.includes(expSpec) || expSpec.includes(itemSpec))) {
            score = 90
          } else if (itemConcept && expSpec && (itemConcept.includes(expSpec) || expSpec.includes(itemConcept))) {
            score = 85
          } else if (itemConcept && expDesc && (expDesc.includes(itemConcept) || itemConcept.includes(expDesc))) {
            score = 80
          } else if (itemSpec && expDesc && (expDesc.includes(itemSpec) || itemSpec.includes(expDesc))) {
            score = 80
          } else if (
            // Caso genérico: Servicios Básicos
            itemSub.includes('servicio') ||
            itemConcept.includes('servicio') ||
            itemSpec.includes('servicio') ||
            !itemSpec ||
            itemSpec === 'otro' ||
            itemSpec === itemSub
          ) {
            score = 70
          } else {
            // Mismo subcat pero específicos distintos (ej. Luz vs Agua)
            score = 25
          }
        }
        // 3. Coincidencia por concepto / texto libre aunque subcat no sea idéntica
        else if (isFixedCat || itemSub.includes('servicio') || expSub.includes('servicio')) {
          if (itemConcept && (expDesc.includes(itemConcept) || expSpec.includes(itemConcept))) {
            score = 75
          } else if (itemSpec && (expDesc.includes(itemSpec) || expSpec.includes(itemSpec))) {
            score = 75
          } else if (itemProv && expProv && itemProv === expProv) {
            score = 65
          } else {
            // Ver si comparten palabras clave como "luz", "agua", "alquiler", "internet", etc.
            const keywords = ['luz', 'agua', 'gas', 'electricidad', 'energia', 'internet', 'alquiler', 'sueldo', 'salario', 'telefono', 'telefonia']
            const hasCommonKeyword = keywords.some(kw =>
              (itemConcept.includes(kw) || itemSpec.includes(kw) || itemSub.includes(kw)) &&
              (expDesc.includes(kw) || expSpec.includes(kw) || expSub.includes(kw) || expProv.includes(kw))
            )
            if (hasCommonKeyword) {
              score = 60
            }
          }
        }

        if (score > bestScore && score >= 50) {
          bestScore = score
          bestItem = item
        }
      })

      if (bestItem) {
        assignedExpenses.get(bestItem.id).push(exp)
      }
    })

    const overdue = []
    const dueSoon = []
    const completed = []
    let totalPendingAmount = 0
    let totalPaidThisMonth = 0

    activeItems.forEach(item => {
      const itemSub = cleanText(item.subcategory || item.category)
      const itemConcept = cleanText(item.concept)
      const itemSpec = cleanText(item.specificItem)
      const isVariable = item.isVariable !== undefined 
        ? Boolean(item.isVariable) 
        : (itemSub.includes('servicio') || itemConcept.includes('servicio') || itemConcept.includes('luz') || itemConcept.includes('electric') || itemConcept.includes('energia') || itemConcept.includes('agua') || itemConcept.includes('gas') || itemSpec.includes('luz') || itemSpec.includes('agua') || itemSpec.includes('gas'))

      const itemExpenses = assignedExpenses.get(item.id) || []
      const paidAmount = itemExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
      const expectedAmount = Number(item.amount) || 0

      let isFullyPaid = false
      let remainingAmount = 0
      let isPartial = false
      let percentagePaid = 0

      if (isVariable) {
        // En gastos de costo variable (ej. Servicios Básicos / Energía Eléctrica / Luz / Agua),
        // el monto configurado es solamente especulativo o referencial.
        // Al registrar una cancelación en el mes, ésta representa el 100% del costo real del mes.
        if (paidAmount > 0) {
          isFullyPaid = true
          remainingAmount = 0
          isPartial = false
          percentagePaid = 100
        } else {
          isFullyPaid = false
          remainingAmount = expectedAmount
          isPartial = false
          percentagePaid = 0
        }
      } else {
        // Gasto fijo estándar (contrato de monto definido, ej. alquiler, crédito)
        remainingAmount = Math.max(0, expectedAmount - paidAmount)
        isFullyPaid = expectedAmount > 0 ? paidAmount >= expectedAmount : paidAmount > 0
        isPartial = paidAmount > 0 && remainingAmount > 0
        percentagePaid = expectedAmount > 0 ? Math.min(100, Math.round((paidAmount / expectedAmount) * 100)) : (isFullyPaid ? 100 : 0)
      }

      totalPaidThisMonth += paidAmount

      const itemData = {
        ...item,
        isVariable,
        expectedAmount,
        paidAmount,
        remainingAmount,
        isFullyPaid,
        isPartial,
        percentagePaid,
        matchingExpensesCount: itemExpenses.length,
        matchingExpenses: itemExpenses
      }

      if (isFullyPaid) {
        completed.push({
          ...itemData,
          type: 'fixed_expense_completed'
        })
      } else {
        totalPendingAmount += remainingAmount
        const dueDay = Number(item.dueDay) || 1
        const daysDiff = dueDay - currentDay

        if (currentDay > dueDay) {
          overdue.push({
            ...itemData,
            type: 'fixed_expense_overdue',
            daysOverdue: currentDay - dueDay
          })
        } else if (daysDiff >= 0 && (daysDiff <= 5 || isPartial)) {
          dueSoon.push({
            ...itemData,
            type: 'fixed_expense_duesoon',
            daysLeft: daysDiff
          })
        }
      }
    })

    return { overdue, dueSoon, completed, totalPendingAmount, totalPaidThisMonth }
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
