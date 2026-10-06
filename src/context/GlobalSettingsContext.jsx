import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const GlobalSettingsContext = createContext(null)

const INITIAL_CATEGORIES = [
  { id: 'produccion_textil', label: 'Producción Textil', icon: 'factory' },
  { id: 'servicios_sublimacion', label: 'Servicios de Sublimación', icon: 'architecture' },
  { id: 'servicios_bordado', label: 'Servicios de Bordado', icon: 'diamond' },
  { id: 'servicios_corte', label: 'Servicios de Corte de vinil', icon: 'content_cut' },
  { id: 'servicios_dtf', label: 'Servicios de Impresión DTF', icon: 'print' },
  { id: 'servicios_uv_dtf', label: 'Servicios de Logos en UV-DTF', icon: 'layers' }
]

const INITIAL_SUBCATEGORIES = {
  produccion_textil: [
    { id: 'camisetas', label: 'Camisetas', icon: 'apparel', description: 'Camisetas, poleras, polos', unit: 'tallas' },
    { id: 'buzos', label: 'Buzos deportivos', icon: 'sports_score', description: 'Buzos y pantalones de deporte', unit: 'tallas' },
    { id: 'mochilas', label: 'Maletines y mochilas', icon: 'backpack', description: 'Mochilas escolares y de viaje', unit: 'unidad', unitPrice: 80 },
    { id: 'ropa_escolar', label: 'Ropa Escolar', icon: 'school', description: 'Uniformes, camisas y faldas', unit: 'tallas' },
    { id: 'promociones', label: 'Promociones textiles', icon: 'percent', description: 'Prendas promocionales de bajo costo', unit: 'tallas' },
    { id: 'accesorios', label: 'Accesorios textiles', icon: 'settings_input_component', description: 'Gorras, bolsas, complementos', unit: 'unidad', unitPrice: 20 }
  ],
  servicios_sublimacion: [
    { id: 'sublimacion_completa', label: 'SUBLIMACION POR METRO', icon: 'texture', description: 'Sublimado total por metros', unit: 'metro', unitPrice: 50 },
    { id: 'sublimacion_localizada', label: 'SUBLIMACION POR PANELES', icon: 'filter_b_and_w', description: 'Estampados específicos en paneles', unit: 'unidad', unitPrice: 20 },
    { id: 'calandrado', label: 'SUBLIMACION CALANDRA', icon: 'roller_shades', description: 'Fijado térmico continuo de telas', unit: 'metro', unitPrice: 50 }
  ],
  servicios_bordado: [
    { id: 'bordado_computarizado', label: 'Bordado Computarizado', icon: 'precision_manufacturing', description: 'Bordado plano digital de logos', unit: '1000_puntadas', unitPrice: 30 },
    { id: 'bordado_3d', label: 'Bordado 3D', icon: 'filter_frames', description: 'Bordado en alto relieve para gorras', unit: '1000_puntadas', unitPrice: 45 },
    { id: 'parches_bordados', label: 'Parches Bordados', icon: 'label', description: 'Parches bordados termoadhesivos', unit: 'unidad', unitPrice: 15 }
  ],
  servicios_corte: [
    { id: 'vinil_textil', label: 'Vinil Textil', icon: 'content_cut', description: 'Corte y pelado de vinil textil', unit: 'unidad', unitPrice: 25 },
    { id: 'vinil_adhesivo', label: 'Vinil Adhesivo', icon: 'sticky_note_2', description: 'Corte de stickers y calcomanías', unit: 'unidad', unitPrice: 20 }
  ],
  servicios_dtf: [
    { id: 'impresion_metro', label: 'Impresión por Metro', icon: 'square_foot', description: 'Impresión DTF en rollo continuo', unit: 'metro', unitPrice: 60 },
    { id: 'estampado_dtf', label: 'Estampado DTF', icon: 'iron', description: 'Estampado y curado en prenda armada', unit: 'unidad', unitPrice: 35 }
  ],
  servicios_uv_dtf: [
    { id: 'logos_adhesivos', label: 'Logos Adhesivos', icon: 'workspace_premium', description: 'Stickers UV-DTF de alta adherencia', unit: 'unidad', unitPrice: 8 },
    { id: 'logos_3d', label: 'Logos 3D', icon: '3d_rotation', description: 'Stickers con relieve UV', unit: 'unidad', unitPrice: 12 }
  ]
}

const INITIAL_SIZES = {
  '2': 40, '4': 40, '6': 40,
  '8': 45, '10': 45, '12': 45,
  '14': 50, '16': 50,
  'S': 55, 'M': 60, 'L': 65,
  'XL': 70, 'XXL': 75, 'XXXL': 80
}

const INITIAL_PANELS = {
  '1 PANEL': 20, '2 PANELES': 40,
  '3 PANELES': 60, '4 PANELES': 80,
  '5 PANELES': 100, '6 PANELES': 120
}

const INITIAL_EXPENSE_STRUCTURE = {
  PRODUCCION: {
    label: 'PRODUCCIÓN',
    subcategories: {
      'Materia Prima': ['Tela', 'Accesorios', 'Cierres', 'Otro'],
      'Embellecimientos': ['Pago Bordado', 'Pago Sublimación', 'Otro'],
      'Pagos a destajo': ['Mano de obra externa', 'Otro'],
      'Comisiones': ['Comisiones por Ventas', 'Otro']
    }
  },
  INSUMOS: {
    label: 'INSUMOS',
    subcategories: {
      'Sublimación': ['Tintas', 'Papel de Sublimación', 'Otro'],
      'Bordado': ['Hilos', 'Pellón', 'Agujas', 'Otro'],
      'Vinil': ['Vinil Textil', 'Cuchillas de corte', 'Otro'],
      'DTF': ['Tintas DTF', 'Lámina (Film)', 'Polvo Poliamida', 'Otro']
    }
  },
  GASTOS_FIJOS: {
    label: 'GASTOS FIJOS',
    subcategories: {
      'Alquileres': ['Alquiler Taller', 'Alquiler Tienda', 'Otro'],
      'Dependientes': ['Sueldos', 'Anticipos', 'Otro'],
      'Financieros': ['Cuota Banco', 'Intereses', 'Otro'],
      'Servicios Básicos': ['Luz', 'Agua', 'Gas', 'Otro'],
      'Telecomunicaciones': ['Internet', 'Telefonía Móvil', 'Otro'],
      'Viáticos': ['Alimentación', 'Transporte', 'Otro'],
      'Impuestos': ['IVA', 'IT', 'Otro']
    }
  },
  INDIRECTOS: {
    label: 'INDIRECTOS',
    subcategories: {
      'Publicidad': ['Facebook Ads', 'Impresos', 'Otro'],
      'Transporte': ['Fletes', 'Envíos', 'Otro'],
      'Mantenimientos': ['Mantenimiento Máquinas', 'Repuestos', 'Limpieza', 'Otro']
    }
  },
  PERSONAL: {
    label: 'PERSONAL',
    subcategories: {
      'Alimentación': ['Comida Diaria', 'Supermercado', 'Otro'],
      'Crecimiento personal': ['Cursos', 'Libros', 'Otro'],
      'Esparcimiento': ['Salidas', 'Suscripciones', 'Otro'],
      'Compras': ['Ropa', 'Electrónicos', 'Otro'],
      'Deudas': ['Tarjetas', 'Préstamos', 'Otro']
    }
  },
  CASA_FAMILIA: {
    label: 'CASA-FAMILIA',
    subcategories: {
      'Compras': ['Supermercado', 'Limpieza', 'Otro'],
      'Internet': ['Internet Casa', 'Otro'],
      'Pensión Familiar': ['Pensión', 'Otro'],
      'Colegiaturas': ['Colegio', 'Universidad', 'Otro']
    }
  }
}

const INITIAL_CATALOG = {
  categories: INITIAL_CATEGORIES,
  subcategories: INITIAL_SUBCATEGORIES,
  sizes: INITIAL_SIZES,
  sizesBySubcategory: {}, // Nuevo
  panels: INITIAL_PANELS,
  expenseStructure: INITIAL_EXPENSE_STRUCTURE,
  // Presupuestos de gastos: [{id, categoryKey, limitAmount, period}]
  budgets: [],
  // Metas de ventas: [{id, categoryId, period, targetAmount}]
  salesGoals: [],
  // Gastos Fijos Mensuales configurables
  fixedExpenses: [
    { id: 'fe_1', concept: 'Alquiler de Taller / Local', category: 'Alquileres', amount: 1500, dueDay: 5, active: true, notes: 'Pago mensual alquiler' },
    { id: 'fe_2', concept: 'Servicio de Luz (DELAPAZ/CRE/ENDE)', category: 'Servicios Básicos', amount: 350, dueDay: 10, active: true, notes: 'Consumo eléctrico de taller' },
    { id: 'fe_3', concept: 'Servicio de Agua Potable', category: 'Servicios Básicos', amount: 80, dueDay: 12, active: true, notes: 'Factura mensual de agua' },
    { id: 'fe_4', concept: 'Internet Fibra Óptica', category: 'Servicios Básicos', amount: 220, dueDay: 15, active: true, notes: 'Conexión para taller y diseño' },
    { id: 'fe_5', concept: 'Sueldos y Salarios Personal Fijo', category: 'Sueldos y Salarios', amount: 4500, dueDay: 30, active: true, notes: 'Planilla mensual operarios/admin' },
    { id: 'fe_6', concept: 'Mantenimiento Preventivo Maquinaria', category: 'Mantenimiento', amount: 300, dueDay: 20, active: true, notes: 'Lubricación y revisión de máquinas' },
    { id: 'fe_7', concept: 'Licencias de Software y Sistemas', category: 'Software y Sistemas', amount: 150, dueDay: 1, active: true, notes: 'Suscripciones y herramientas digital' }
  ]
}

function mergeSettings(saved = {}) {
  return {
    ...INITIAL_CATALOG,
    ...saved,
    categories: Array.isArray(saved.categories) ? saved.categories : INITIAL_CATALOG.categories,
    subcategories: saved.subcategories || INITIAL_CATALOG.subcategories,
    sizes: { ...INITIAL_CATALOG.sizes, ...(saved.sizes || {}) },
    sizesBySubcategory: saved.sizesBySubcategory || {},
    panels: { ...INITIAL_CATALOG.panels, ...(saved.panels || {}) },
    expenseStructure: saved.expenseStructure || INITIAL_CATALOG.expenseStructure,
    budgets: Array.isArray(saved.budgets) ? saved.budgets : [],
    salesGoals: Array.isArray(saved.salesGoals) ? saved.salesGoals : [],
    fixedExpenses: Array.isArray(saved.fixedExpenses) ? saved.fixedExpenses : INITIAL_CATALOG.fixedExpenses,
  }
}

export function GlobalSettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(INITIAL_CATALOG)
  const hydrationRequestRef = useRef(0)
  const [hydration, setHydration] = useState({
    userId: null,
    requestId: 0,
    dbWriteReady: false,
  })

  // Cargar una copia local aislada por usuario y luego reconciliarla con Supabase.
  // El estado de hidratación evita exponer o persistir la sesión anterior.
  useEffect(() => {
    let cancelled = false
    const userId = user?.id
    const requestId = ++hydrationRequestRef.current

    if (!userId) {
      return () => {
        cancelled = true
      }
    }

    const storageKey = `textilquote_global_settings_${userId}`
    let localSettings = INITIAL_CATALOG
    const stored = localStorage.getItem(storageKey)

    if (stored) {
      try {
        localSettings = mergeSettings(JSON.parse(stored))
      } catch (e) {
        console.error('Error parsing settings from LocalStorage', e)
      }
    }

    async function hydrateSettings() {
      let nextSettings = localSettings
      let dbWriteReady = false

      try {
        const { data, error } = await supabase
          .from('global_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) throw error
        nextSettings = data?.settings ? mergeSettings(data.settings) : localSettings
        dbWriteReady = true
      } catch (e) {
        if (!cancelled) {
          console.error('Error cargando configuración desde Supabase', e)
        }
      }

      if (!cancelled && requestId === hydrationRequestRef.current) {
        setSettings(nextSettings)
        setHydration({ userId, requestId, dbWriteReady })
      }
    }

    hydrateSettings()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Persistir únicamente después de hidratar la cuenta activa. Un fallo de lectura
  // desactiva la escritura remota para no reemplazar datos con una copia obsoleta.
  useEffect(() => {
    const userId = user?.id
    const isCurrentHydration = hydration.userId === userId
      && hydration.requestId === hydrationRequestRef.current
    if (!userId || !isCurrentHydration) return undefined

    localStorage.setItem(`textilquote_global_settings_${userId}`, JSON.stringify(settings))
    if (!hydration.dbWriteReady) return undefined

    const timeoutId = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('global_settings')
          .upsert({ user_id: userId, settings }, { onConflict: 'user_id' })
        if (error) throw error
      } catch (e) {
        console.error('Error guardando configuración en Supabase', e)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [settings, hydration, user?.id])

  const isLoaded = !user?.id || hydration.userId === user.id
  const activeSettings = user?.id && isLoaded ? settings : INITIAL_CATALOG

  // --- CRUD Categories ---
  const addCategory = (category) => {
    setSettings(prev => ({
      ...prev,
      categories: [...prev.categories, category]
    }))
  }

  const updateCategory = (id, updatedCategory) => {
    setSettings(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === id ? updatedCategory : c)
    }))
  }

  const deleteCategory = (id) => {
    setSettings(prev => {
      const nextSubcategories = { ...prev.subcategories }
      delete nextSubcategories[id]
      return {
        ...prev,
        categories: prev.categories.filter(c => c.id !== id),
        subcategories: nextSubcategories
      }
    })
  }

  // --- CRUD Subcategories ---
  const addSubcategory = (categoryId, subcategory) => {
    setSettings(prev => ({
      ...prev,
      subcategories: {
        ...prev.subcategories,
        [categoryId]: [...(prev.subcategories[categoryId] || []), subcategory]
      }
    }))
  }

  const updateSubcategory = (categoryId, subId, updatedSubcategory) => {
    setSettings(prev => ({
      ...prev,
      subcategories: {
        ...prev.subcategories,
        [categoryId]: prev.subcategories[categoryId].map(s => s.id === subId ? updatedSubcategory : s)
      }
    }))
  }

  const deleteSubcategory = (categoryId, subId) => {
    setSettings(prev => ({
      ...prev,
      subcategories: {
        ...prev.subcategories,
        [categoryId]: prev.subcategories[categoryId].filter(s => s.id !== subId)
      }
    }))
  }

  // --- Update Prices ---
  const updateSizePrice = (sizeKey, newPrice) => {
    setSettings(prev => ({
      ...prev,
      sizes: {
        ...prev.sizes,
        [sizeKey]: Math.max(0, parseFloat(newPrice) || 0)
      }
    }))
  }

  const updateSizePriceForSubcategory = (subcategoryId, sizeKey, newPrice) => {
    setSettings(prev => ({
      ...prev,
      sizesBySubcategory: {
        ...prev.sizesBySubcategory,
        [subcategoryId]: {
          ...(prev.sizesBySubcategory[subcategoryId] || prev.sizes),
          [sizeKey]: Math.max(0, parseFloat(newPrice) || 0)
        }
      }
    }))
  }

  const updateMultipleSizePricesForSubcategory = (subcategoryId, newSizesObj) => {
    setSettings(prev => ({
      ...prev,
      sizesBySubcategory: {
        ...prev.sizesBySubcategory,
        [subcategoryId]: {
          ...(prev.sizesBySubcategory[subcategoryId] || prev.sizes),
          ...newSizesObj
        }
      }
    }))
  }

  const updatePanelPrice = (panelKey, newPrice) => {
    setSettings(prev => ({
      ...prev,
      panels: {
        ...prev.panels,
        [panelKey]: Math.max(0, parseFloat(newPrice) || 0)
      }
    }))
  }

  const resetToDefaults = () => {
    setSettings(INITIAL_CATALOG)
  }

  const getServicePrice = (categoryId, subcategoryId) => {
    const sub = activeSettings.subcategories[categoryId]?.find(s => s.id === subcategoryId)
    return sub?.unitPrice || 50
  }

  // --- CRUD Estructura de Gastos ---
  const addExpenseCategory = (key, label) => {
    setSettings(prev => ({
      ...prev,
      expenseStructure: {
        ...prev.expenseStructure,
        [key]: {
          label: label,
          subcategories: {}
        }
      }
    }))
  }

  const updateExpenseCategory = (key, newLabel) => {
    setSettings(prev => {
      if (!prev.expenseStructure[key]) return prev
      return {
        ...prev,
        expenseStructure: {
          ...prev.expenseStructure,
          [key]: {
            ...prev.expenseStructure[key],
            label: newLabel
          }
        }
      }
    })
  }

  const deleteExpenseCategory = (key) => {
    setSettings(prev => {
      const nextStructure = { ...prev.expenseStructure }
      delete nextStructure[key]
      return {
        ...prev,
        expenseStructure: nextStructure
      }
    })
  }

  const addExpenseSubcategory = (categoryKey, subcategoryName) => {
    setSettings(prev => {
      const cat = prev.expenseStructure[categoryKey]
      if (!cat) return prev
      return {
        ...prev,
        expenseStructure: {
          ...prev.expenseStructure,
          [categoryKey]: {
            ...cat,
            subcategories: {
              ...cat.subcategories,
              [subcategoryName]: []
            }
          }
        }
      }
    })
  }

  const deleteExpenseSubcategory = (categoryKey, subcategoryName) => {
    setSettings(prev => {
      const cat = prev.expenseStructure[categoryKey]
      if (!cat) return prev
      const nextSubcategories = { ...cat.subcategories }
      delete nextSubcategories[subcategoryName]
      return {
        ...prev,
        expenseStructure: {
          ...prev.expenseStructure,
          [categoryKey]: {
            ...cat,
            subcategories: nextSubcategories
          }
        }
      }
    })
  }

  const addExpenseSpecificItem = (categoryKey, subcategoryName, itemName) => {
    setSettings(prev => {
      const cat = prev.expenseStructure[categoryKey]
      if (!cat) return prev
      const sub = cat.subcategories[subcategoryName]
      if (!sub) return prev
      if (sub.includes(itemName)) return prev
      return {
        ...prev,
        expenseStructure: {
          ...prev.expenseStructure,
          [categoryKey]: {
            ...cat,
            subcategories: {
              ...cat.subcategories,
              [subcategoryName]: [...sub, itemName]
            }
          }
        }
      }
    })
  }

  const deleteExpenseSpecificItem = (categoryKey, subcategoryName, itemName) => {
    setSettings(prev => {
      const cat = prev.expenseStructure[categoryKey]
      if (!cat) return prev
      const sub = cat.subcategories[subcategoryName]
      if (!sub) return prev
      return {
        ...prev,
        expenseStructure: {
          ...prev.expenseStructure,
          [categoryKey]: {
            ...cat,
            subcategories: {
              ...cat.subcategories,
              [subcategoryName]: sub.filter(item => item !== itemName)
            }
          }
        }
      }
    })
  }

  // --- CRUD Presupuestos de Gastos ---
  const addBudget = (budget) => {
    setSettings(prev => ({
      ...prev,
      budgets: [...prev.budgets, { ...budget, id: Date.now().toString() }]
    }))
  }

  const updateBudget = (id, updates) => {
    setSettings(prev => ({
      ...prev,
      budgets: prev.budgets.map(b => b.id === id ? { ...b, ...updates } : b)
    }))
  }

  const deleteBudget = (id) => {
    setSettings(prev => ({
      ...prev,
      budgets: prev.budgets.filter(b => b.id !== id)
    }))
  }

  const saveBudgetsAndGoals = (newBudgets, newGoals) => {
    setSettings(prev => ({
      ...prev,
      budgets: newBudgets,
      salesGoals: newGoals
    }))
  }

  const getWeeklySalesGoal = () => {
    const goals = Array.isArray(activeSettings?.salesGoals) ? activeSettings.salesGoals : []
    const goal = goals.find(g => g.period === 'semanal' && (g.categoryId === 'global' || !g.categoryId))
    return goal ? Number(goal.targetAmount) : (Number(activeSettings?.weeklySalesGoal) || 6000)
  }

  const updateWeeklySalesGoal = (amount) => {
    const targetAmount = parseFloat(amount) || 0
    const currentGoals = Array.isArray(activeSettings?.salesGoals) ? [...activeSettings.salesGoals] : []
    const idx = currentGoals.findIndex(g => g.period === 'semanal' && (g.categoryId === 'global' || !g.categoryId))
    let newGoals
    if (idx >= 0) {
      newGoals = currentGoals.map((g, i) => i === idx ? { ...g, targetAmount } : g)
    } else {
      newGoals = [...currentGoals, { id: 'goal_weekly_global', categoryId: 'global', period: 'semanal', targetAmount }]
    }
    saveBudgetsAndGoals(activeSettings.budgets || [], newGoals)
  }

  // --- Métodos de Gastos Fijos Mensuales ---
  const addFixedExpense = (item) => {
    setSettings(prev => ({
      ...prev,
      fixedExpenses: [...(prev.fixedExpenses || []), { ...item, id: Date.now().toString() }]
    }))
  }

  const updateFixedExpense = (id, updates) => {
    setSettings(prev => ({
      ...prev,
      fixedExpenses: (prev.fixedExpenses || []).map(item => item.id === id ? { ...item, ...updates } : item)
    }))
  }

  const deleteFixedExpense = (id) => {
    setSettings(prev => ({
      ...prev,
      fixedExpenses: (prev.fixedExpenses || []).filter(item => item.id !== id)
    }))
  }

  const saveFixedExpenses = (newFixedExpenses) => {
    setSettings(prev => ({
      ...prev,
      fixedExpenses: newFixedExpenses
    }))
  }

  return (
    <GlobalSettingsContext.Provider value={{
      settings: activeSettings,
      addCategory,
      updateCategory,
      deleteCategory,
      addSubcategory,
      updateSubcategory,
      deleteSubcategory,
      updateSizePrice,
      updateSizePriceForSubcategory,
      updateMultipleSizePricesForSubcategory,
      updatePanelPrice,
      resetToDefaults,
      getServicePrice,
      addExpenseCategory,
      updateExpenseCategory,
      deleteExpenseCategory,
      addExpenseSubcategory,
      deleteExpenseSubcategory,
      addExpenseSpecificItem,
      deleteExpenseSpecificItem,
      saveBudgetsAndGoals,
      getWeeklySalesGoal,
      updateWeeklySalesGoal,
      addFixedExpense,
      updateFixedExpense,
      deleteFixedExpense,
      saveFixedExpenses,
      isLoaded
    }}>
      {children}
    </GlobalSettingsContext.Provider>
  )
}

export function useGlobalSettings() {
  const context = useContext(GlobalSettingsContext)
  if (!context) {
    throw new Error('useGlobalSettings debe usarse dentro de un GlobalSettingsProvider')
  }
  return context
}
