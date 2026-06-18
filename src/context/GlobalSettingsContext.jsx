import { createContext, useContext, useState, useEffect } from 'react'
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
  salesGoals: []
}

export function GlobalSettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(INITIAL_CATALOG)
  const [isLoaded, setIsLoaded] = useState(false)

  // 1. Cargar localmente al montar
  useEffect(() => {
    const stored = localStorage.getItem('textilquote_global_settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSettings({
          categories: parsed.categories || INITIAL_CATALOG.categories,
          subcategories: parsed.subcategories || INITIAL_CATALOG.subcategories,
          sizes: { ...INITIAL_CATALOG.sizes, ...(parsed.sizes || {}) },
          sizesBySubcategory: parsed.sizesBySubcategory || {},
          panels: { ...INITIAL_CATALOG.panels, ...(parsed.panels || {}) },
          expenseStructure: parsed.expenseStructure || INITIAL_CATALOG.expenseStructure,
          budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
          salesGoals: Array.isArray(parsed.salesGoals) ? parsed.salesGoals : []
        })
      } catch (e) {
        console.error('Error parsing settings from LocalStorage', e)
      }
    }
    setIsLoaded(true)
  }, [])

  // 2. Cargar desde Supabase al iniciar sesión
  useEffect(() => {
    async function loadDbSettings() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('global_settings')
          .select('settings')
          .single()
        if (!error && data?.settings) {
          setSettings(prev => ({
            ...prev,
            ...data.settings,
            expenseStructure: data.settings.expenseStructure || INITIAL_CATALOG.expenseStructure,
            budgets: Array.isArray(data.settings.budgets) ? data.settings.budgets : [],
            salesGoals: Array.isArray(data.settings.salesGoals) ? data.settings.salesGoals : []
          }))
        }
      } catch (e) {
        console.error('Error cargando configuración desde Supabase', e)
      }
    }
    loadDbSettings()
  }, [user])

  // 3. Guardar cambios localmente y en Supabase
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('textilquote_global_settings', JSON.stringify(settings))
      
      const saveDbSettings = async () => {
        if (!user) return
        try {
          await supabase
            .from('global_settings')
            .upsert({ user_id: user.id, settings }, { onConflict: 'user_id' })
        } catch (e) {
          console.error('Error guardando configuración en Supabase', e)
        }
      }
      saveDbSettings()
    }
  }, [settings, isLoaded, user])

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
    const sub = settings.subcategories[categoryId]?.find(s => s.id === subcategoryId)
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

  // --- Guardar Presupuestos y Metas de Ventas Transaccional ---
  const saveBudgetsAndGoals = (newBudgets, newSalesGoals) => {
    setSettings(prev => ({
      ...prev,
      budgets: newBudgets,
      salesGoals: newSalesGoals
    }))
  }

  return (
    <GlobalSettingsContext.Provider value={{
      settings,
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
