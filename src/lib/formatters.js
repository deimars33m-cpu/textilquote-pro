/**
 * Formateo de moneda, fechas y utilidades para TextilQuote Pro
 */

/**
 * Formatea un número como moneda boliviana
 */
export function formatCurrency(amount, decimals = 2) {
  const num = parseFloat(amount) || 0
  return `Bs ${num.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Formatea un porcentaje
 */
export function formatPercent(value, decimals = 1) {
  const num = parseFloat(value) || 0
  return `${num.toFixed(decimals)}%`
}

/**
 * Retorna la fecha local en formato YYYY-MM-DD sin desfasamiento de zona horaria UTC
 */
export function getTodayStr(dateInput = new Date()) {
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parsea cualquier formato de fecha (ISO con UTC/Z, timestamptz con espacio, YYYY-MM-DD o Date)
 * y retorna la fecha local normalizada en formato 'YYYY-MM-DD' sin desfasamiento de zona horaria.
 */
export function parseDateToLocalYMD(val) {
  if (!val) return ''
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const year = val.getFullYear()
    const month = String(val.getMonth() + 1).padStart(2, '0')
    const day = String(val.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return ''
}

/**
 * Parsea un string de fecha asegurando hora local sin desfasamiento
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null
  if (dateStr instanceof Date) return dateStr
  const s = String(dateStr).trim()
  if (!s) return null

  // Coincide con YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch.map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(s)
}

/**
 * Formatea una fecha en formato corto español sin desfasamiento
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const date = parseLocalDate(dateStr)
  if (!date || isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Formatea una fecha con hora
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const date = parseLocalDate(dateStr)
  if (!date || isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Calcula días desde una fecha
 */
export function daysSince(dateStr) {
  if (!dateStr) return Infinity
  const date = parseLocalDate(dateStr)
  if (!date || isNaN(date.getTime())) return Infinity
  const now = new Date()
  const diff = now - date
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Verifica si un precio necesita actualización (>30 días)
 */
export function isPriceOutdated(dateStr, days = 30) {
  return daysSince(dateStr) > days
}

/**
 * Genera un número de cotización formateado
 */
export function formatQuoteNumber(num) {
  return `COT-${String(num).padStart(4, '0')}`
}

/**
 * Mapas de traducción para categorías
 */
export const materialCategories = {
  tela: 'Tela',
  hilo: 'Hilo',
  cierre: 'Cierre',
  tinta: 'Tinta',
  papel_sublimatico: 'Papel Sublimático',
  etiqueta: 'Etiqueta',
  bolsa: 'Bolsa',
  avio: 'Avío',
  servicio_externo: 'Servicio Externo',
  tintas_sublimacion: 'Tintas de Sublimación',
  vinil: 'Vinil',
  materiales_acolchado: 'Materiales de Acolchado',
  forros: 'Forros',
  otro: 'Otro',
}

export const processCategories = {
  por_hora: 'Por Hora',
  por_unidad: 'Por Unidad',
  fijo_por_pedido: 'Fijo por Pedido',
}

export const expenseCategories = {
  alquiler: 'Alquiler',
  servicios: 'Servicios',
  sueldos: 'Sueldos',
  mantenimiento: 'Mantenimiento',
  marketing: 'Marketing',
  software: 'Software',
  transporte: 'Transporte',
  administracion: 'Administración',
  caja_chica: 'Caja Chica',
  otro: 'Otro',
}

export const expenseFrequencies = {
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  anual: 'Anual',
}

export const expenseStructure = {
  PRODUCCION: {
    label: 'PRODUCCIÓN',
    macroType: 'COSTOS DE PRODUCCION TEXTIL',
    subcategories: {
      'Materia Prima': ['Tela', 'Accesorios', 'Cierres', 'Otro'],
      'Embellecimiento': ['Pago Bordado', 'Pago Sublimación', 'Otro'],
      'Pagos a destajo MOD': ['Mano de obra externa', 'Costura Destajo', 'Otro'],
      'Comisiones': ['Comisiones por Ventas', 'Otro']
    }
  },
  INSUMOS: {
    label: 'INSUMOS',
    macroType: 'COSTOS DE SERVICIOS',
    subcategories: {
      'Sublimación': ['Tintas', 'Papel de Sublimación', 'Otro'],
      'Bordado': ['Hilos', 'Pellón', 'Agujas', 'Otro'],
      'Vinil': ['Vinil Textil', 'Cuchillas de corte', 'Otro'],
      'DTF': ['Tintas DTF', 'Lámina (Film)', 'Polvo Poliamida', 'Otro']
    }
  },
  GASTOS_FIJOS: {
    label: 'GASTOS FIJOS',
    macroType: 'GASTOS GENERALES',
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
    macroType: 'GASTOS GENERALES',
    subcategories: {
      'Publicidad': ['Facebook Ads', 'Impresos', 'Otro'],
      'Transporte': ['Fletes', 'Envíos', 'Otro'],
      'Mantenimiento': ['Mantenimiento Máquinas', 'Repuestos', 'Limpieza', 'Otro']
    }
  },
  PERSONAL: {
    label: 'PERSONAL',
    macroType: 'CAJA CHICA',
    subcategories: {
      'Alimentación': ['Comida Diaria', 'Supermercado', 'Otro'],
      'Crecimiento personal': ['Cursos', 'Libros', 'Otro'],
      'Esparcimiento': ['Salidas', 'Suscripciones', 'Otro'],
      'Compras': ['Ropa', 'Electrónicos', 'Otro'],
      'Deudas': ['Tarjetas', 'Préstamos', 'Otro'],
      'Entretenimiento': ['Cine', 'Streaming', 'Otro'],
      'Vivienda': ['Reparaciones', 'Servicios Casa', 'Otro']
    }
  },
  CASA_FAMILIA: {
    label: 'CASA-FAMILIA',
    macroType: 'CAJA CHICA',
    subcategories: {
      'Compras': ['Supermercado', 'Limpieza', 'Otro'],
      'Internet': ['Internet Casa', 'Otro'],
      'Pensión Familiar': ['Pensión', 'Otro'],
      'Colegiaturas': ['Colegio', 'Universidad', 'Otro']
    }
  }
}

export const clientTypes = {
  minorista: 'Minorista',
  mayorista: 'Mayorista',
  club_deportivo: 'Club Deportivo',
  colegio: 'Colegio',
  empresa: 'Empresa',
  revendedor: 'Revendedor',
  otro: 'Otro',
}

export const terceroTypes = {
  minorista: 'Minorista',
  mayorista: 'Mayorista',
  club_deportivo: 'Club Deportivo',
  colegio: 'Colegio',
  empresa: 'Empresa',
  revendedor: 'Revendedor',
  proveedor_materia_prima: 'Materia Prima',
  proveedor_insumos: 'Insumos',
  proveedor_servicios: 'Servicios Externos',
  dependiente: 'Empleado Interno / Dependiente',
  taller_externo_costura: 'Taller Externo / Costura',
  disenador_grafico_externo: 'Diseñador Gráfico / Externo',
  taller_externo_corte: 'Taller Externo / Corte Industrial',
  contabilidad_externo: 'Contabilidad / Externo',
  comercializador_ventas: 'Comercializador / Ventas',
  acreedor: 'Acreedor / Entidad Financiera',
  otro: 'Otro',
}

export const quoteStatuses = {
  borrador: { label: 'Borrador', color: 'bg-surface-variant text-on-surface-variant' },
  enviada: { label: 'Enviada', color: 'bg-primary text-on-primary' },
  aprobada: { label: 'Aprobada', color: 'bg-tertiary-container text-on-tertiary-container' },
  rechazada: { label: 'Rechazada', color: 'bg-error-container text-on-error-container' },
  vencida: { label: 'Vencida', color: 'bg-outline-variant text-on-surface-variant' },
}

export const usageUnits = {
  metro: 'Metro',
  kg: 'Kg',
  unidad: 'Unidad',
}

export const purchaseUnits = {
  rollo: 'Rollo',
  caja: 'Caja',
  paquete: 'Paquete',
}

/**
 * Retorna las clases CSS de color y color hexadecimal para una categoría de material
 */
export function getCategoryColor(nameOrCode) {
  const clean = (nameOrCode || '').toLowerCase().trim()
  if (clean.includes('tela')) return {
    bg: 'bg-red-500/10 border-red-500/20 text-red-500',
    badge: 'bg-red-500/20 text-red-500',
    border: 'border-red-500/30',
    text: 'text-red-500',
    hex: '#ef4444'
  }
  if (clean.includes('forro')) return {
    bg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
    badge: 'bg-amber-500/20 text-amber-500',
    border: 'border-amber-500/30',
    text: 'text-amber-500',
    hex: '#f59e0b'
  }
  if (clean.includes('cinta') || clean.includes('correa') || clean.includes('avio')) return {
    bg: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
    badge: 'bg-blue-500/20 text-blue-500',
    border: 'border-blue-500/30',
    text: 'text-blue-500',
    hex: '#3b82f6'
  }
  if (clean.includes('cierre')) return {
    bg: 'bg-orange-500/10 border-orange-500/20 text-orange-500',
    badge: 'bg-orange-500/20 text-orange-500',
    border: 'border-orange-500/30',
    text: 'text-orange-500',
    hex: '#f97316'
  }
  if (clean.includes('hilo')) return {
    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    badge: 'bg-emerald-500/20 text-emerald-500',
    border: 'border-emerald-500/30',
    text: 'text-emerald-500',
    hex: '#10b981'
  }
  if (clean.includes('tinta')) return {
    bg: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
    badge: 'bg-purple-500/20 text-purple-500',
    border: 'border-purple-500/30',
    text: 'text-purple-500',
    hex: '#a855f7'
  }
  if (clean.includes('papel')) return {
    bg: 'bg-pink-500/10 border-pink-500/20 text-pink-500',
    badge: 'bg-pink-500/20 text-pink-500',
    border: 'border-pink-500/30',
    text: 'text-pink-500',
    hex: '#ec4899'
  }
  if (clean.includes('etiqueta')) return {
    bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500',
    badge: 'bg-cyan-500/20 text-cyan-500',
    border: 'border-cyan-500/30',
    text: 'text-cyan-500',
    hex: '#06b6d4'
  }
  if (clean.includes('bolsa')) return {
    bg: 'bg-teal-500/10 border-teal-500/20 text-teal-500',
    badge: 'bg-teal-500/20 text-teal-500',
    border: 'border-teal-500/30',
    text: 'text-teal-500',
    hex: '#14b8a6'
  }
  if (clean.includes('servicio')) return {
    bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500',
    badge: 'bg-indigo-500/20 text-indigo-500',
    border: 'border-indigo-500/30',
    text: 'text-indigo-500',
    hex: '#6366f1'
  }
  if (clean.includes('vinil')) return {
    bg: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
    badge: 'bg-rose-500/20 text-rose-500',
    border: 'border-rose-500/30',
    text: 'text-rose-500',
    hex: '#f43f5e'
  }
  if (clean.includes('acolchado')) return {
    bg: 'bg-sky-500/10 border-sky-500/20 text-sky-500',
    badge: 'bg-sky-500/20 text-sky-500',
    border: 'border-sky-500/30',
    text: 'text-sky-500',
    hex: '#0ea5e9'
  }
  
  // Default fallbacks
  const colors = [
    { bg: 'bg-slate-500/10 border-slate-500/20 text-slate-500', badge: 'bg-slate-500/20 text-slate-500', border: 'border-slate-500/30', text: 'text-slate-500', hex: '#64748b' },
    { bg: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500', badge: 'bg-zinc-500/20 text-zinc-500', border: 'border-zinc-500/30', text: 'text-zinc-500', hex: '#71717a' },
    { bg: 'bg-neutral-500/10 border-neutral-500/20 text-neutral-500', badge: 'bg-neutral-500/20 text-neutral-500', border: 'border-neutral-500/30', text: 'text-neutral-500', hex: '#737373' },
  ]
  let hash = 0
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * Parsea la metadata de un dependiente (modalidad de pago, sueldo base, cargo, notas)
 */
export function parseDependienteMeta(item) {
  if (!item) return { modality: 'quincenal', salary: 0, jobTitle: '', rawNotes: '' }
  let modality = item.payment_modality || item.modalidad_pago || 'quincenal'
  let salary = item.base_salary !== undefined ? item.base_salary : ''
  let jobTitle = item.job_title || ''
  let rawNotes = item.notes || ''

  if (rawNotes && typeof rawNotes === 'string') {
    const trimmed = rawNotes.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.modality) modality = parsed.modality
        if (parsed.salary !== undefined) salary = parsed.salary
        if (parsed.jobTitle) jobTitle = parsed.jobTitle
        rawNotes = parsed.rawNotes || ''
      } catch {}
    } else {
      const matchMod = rawNotes.match(/\[Modalidad:\s*(quincenal|mensual)\]/i)
      if (matchMod) modality = matchMod[1].toLowerCase()
      const matchSal = rawNotes.match(/\[Salario:\s*([\d\.]+)\]/i)
      if (matchSal) salary = matchSal[1]
      const matchCargo = rawNotes.match(/\[Cargo:\s*([^\]]+)\]/i)
      if (matchCargo) jobTitle = matchCargo[1]
    }
  }

  return {
    modality: modality === 'mensual' ? 'mensual' : 'quincenal',
    salary: salary ? Number(salary) : 0,
    jobTitle: jobTitle || '',
    rawNotes: rawNotes || ''
  }
}

/**
 * Codifica las notas de un dependiente con su metadata
 */
export function formatDependienteNotes({ modality = 'quincenal', salary = 0, jobTitle = '', rawNotes = '' }) {
  return JSON.stringify({
    modality: modality === 'mensual' ? 'mensual' : 'quincenal',
    salary: Number(salary) || 0,
    jobTitle: (jobTitle || '').trim(),
    rawNotes: (rawNotes || '').trim()
  })
}

/**
 * Normaliza y limita un array de historial a un máximo estricto de 5 registros ordenados de reciente a antiguo
 */
export function normalizeAndCapPriceHistory(rawList) {
  if (!Array.isArray(rawList)) return []
  const valid = rawList
    .map(item => ({
      date: item.date ? String(item.date).split('T')[0] : '',
      price: parseFloat(item.price) || 0
    }))
    .filter(item => item.date && item.price > 0)

  // Ordenar por fecha descendente (más reciente primero)
  valid.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Eliminar duplicados de fecha dejando el precio más reciente
  const uniqueByDate = []
  const seenDates = new Set()
  for (const item of valid) {
    if (!seenDates.has(item.date)) {
      seenDates.add(item.date)
      uniqueByDate.push(item)
    }
  }

  return uniqueByDate.slice(0, 5)
}

/**
 * Obtiene el historial de precios de un material (máximo 5 registros)
 * Soporta campo en base de datos (array/json) y fallback en localStorage
 */
export function getMaterialPriceHistory(material) {
  if (!material) return []

  // 1. Verificar en el objeto material de Supabase
  if (Array.isArray(material.price_history) && material.price_history.length > 0) {
    return normalizeAndCapPriceHistory(material.price_history)
  }
  if (typeof material.price_history === 'string' && material.price_history.trim()) {
    try {
      const parsed = JSON.parse(material.price_history)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeAndCapPriceHistory(parsed)
      }
    } catch (_) {}
  }

  // 2. Verificar fallback en localStorage
  if (material.id && typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(`mat_price_hist_${material.id}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeAndCapPriceHistory(parsed)
        }
      }
    } catch (_) {}
  }

  // 3. Fallback con el precio actual si no hay historial previo
  const curPrice = parseFloat(material.unit_price) || 0
  if (curPrice > 0) {
    const curDate = (material.price_updated_at || material.created_at || new Date().toISOString()).split('T')[0]
    return [{ date: curDate, price: curPrice }]
  }

  return []
}

/**
 * Agrega o actualiza un registro de precio en el historial respetando un máximo estricto de 5 fechas
 */
export function updatePriceHistory(existingHistory, newPrice, dateStr) {
  const price = parseFloat(newPrice)
  if (isNaN(price) || price <= 0) return normalizeAndCapPriceHistory(existingHistory)

  const date = dateStr ? String(dateStr).split('T')[0] : new Date().toISOString().split('T')[0]
  const currentHistory = normalizeAndCapPriceHistory(existingHistory)

  // Si ya existe la fecha, actualiza; si no, añade al inicio
  const existingIdx = currentHistory.findIndex(h => h.date === date)
  let updated
  if (existingIdx >= 0) {
    updated = [...currentHistory]
    updated[existingIdx] = { date, price }
  } else {
    updated = [{ date, price }, ...currentHistory]
  }

  return normalizeAndCapPriceHistory(updated)
}

/**
 * Guarda en localStorage el historial de precios como fallback
 */
export function saveMaterialPriceHistoryLocal(materialId, history) {
  if (!materialId || typeof window === 'undefined' || !window.localStorage) return
  try {
    const capped = normalizeAndCapPriceHistory(history)
    localStorage.setItem(`mat_price_hist_${materialId}`, JSON.stringify(capped))
  } catch (_) {}
}

/**
 * Calcula las variaciones y comparativa de cambio de precio en el tiempo (hasta 5 fechas)
 */
export function calculatePriceVariation(history) {
  const list = normalizeAndCapPriceHistory(history)
  if (list.length === 0) {
    return {
      currentPrice: 0,
      previousPrice: null,
      diffVsPrevious: 0,
      diffPctVsPrevious: 0,
      oldestPrice: 0,
      diffTotal: 0,
      diffPctTotal: 0,
      minPrice: 0,
      maxPrice: 0,
      trend: 'single',
      count: 0,
      list: []
    }
  }

  const currentPrice = list[0].price
  const previousPrice = list.length >= 2 ? list[1].price : null
  const oldestPrice = list[list.length - 1].price

  const diffVsPrevious = previousPrice !== null ? currentPrice - previousPrice : 0
  const diffPctVsPrevious = previousPrice ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0

  const diffTotal = currentPrice - oldestPrice
  const diffPctTotal = oldestPrice ? ((currentPrice - oldestPrice) / oldestPrice) * 100 : 0

  const prices = list.map(h => h.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  let trend = 'single'
  if (previousPrice !== null) {
    if (Math.abs(diffVsPrevious) < 0.001) trend = 'flat'
    else if (diffVsPrevious > 0) trend = 'up'
    else trend = 'down'
  }

  return {
    currentPrice,
    previousPrice,
    diffVsPrevious,
    diffPctVsPrevious,
    oldestPrice,
    diffTotal,
    diffPctTotal,
    minPrice,
    maxPrice,
    trend,
    count: list.length,
    list
  }
}
