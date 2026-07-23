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
