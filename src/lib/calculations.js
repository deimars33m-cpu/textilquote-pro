/**
 * TextilQuote Pro — Motor de Cálculo de Cotización
 * Implementa las fórmulas A-J del sistema de cotización textil.
 */

/**
 * Convierte gastos fijos a equivalente mensual
 * quincenal × 2, mensual × 1, anual ÷ 12
 */
export function toMonthlyAmount(amount, frequency) {
  const num = parseFloat(amount) || 0
  switch (frequency) {
    case 'quincenal': return round(num * 2)
    case 'mensual': return round(num)
    case 'anual': return round(num / 12)
    default: return round(num)
  }
}

/**
 * Calcula el total mensual de gastos fijos activos
 */
export function calcTotalMonthlyExpenses(expenses) {
  return round(
    expenses
      .filter(e => e.is_active)
      .reduce((sum, e) => sum + toMonthlyAmount(e.amount, e.frequency), 0)
  )
}

/**
 * A. Costo de materiales (sin merma)
 * cantidad_material_por_unidad × precio_unitario × cantidad_de_productos
 */
export function calcMaterialsCost(materials, quantity) {
  return round(
    materials.reduce((sum, m) => {
      const qty = parseFloat(m.quantity_per_unit) || 0
      const price = parseFloat(m.unit_price) || 0
      return sum + (qty * price * quantity)
    }, 0)
  )
}

/**
 * B. Costo de merma por material
 * costo_material × porcentaje_merma / 100
 */
export function calcWasteCost(materials, quantity) {
  return round(
    materials.reduce((sum, m) => {
      const qty = parseFloat(m.quantity_per_unit) || 0
      const price = parseFloat(m.unit_price) || 0
      const wastePct = parseFloat(m.waste_pct) || 0
      const materialCost = qty * price * quantity
      return sum + (materialCost * wastePct / 100)
    }, 0)
  )
}

/**
 * C. Costo de procesos
 * por_hora: (tiempo_min / 60) × costo_hora × cantidad
 * por_unidad: costo × cantidad
 * fijo_por_pedido: costo (flat)
 */
export function calcProcessesCost(processes, quantity) {
  return round(
    processes.reduce((sum, p) => {
      const cost = parseFloat(p.cost) || 0
      const timeMin = parseFloat(p.time_minutes) || 0

      switch (p.cost_type) {
        case 'por_hora':
          return sum + ((timeMin / 60) * cost * quantity)
        case 'por_unidad':
          return sum + (cost * quantity)
        case 'fijo_por_pedido':
          return sum + cost
        default:
          return sum
      }
    }, 0)
  )
}

/**
 * Costo de personalización y embellecimiento (logos, bordados, sublimados, viniles, otros)
 * (costo_unitario × cantidad_por_producto) × cantidad_de_productos
 */
export function calcEmbellishmentsCost(embellishments, quantity) {
  return round(
    (embellishments || []).reduce((sum, e) => {
      const cost = parseFloat(e.cost) || 0
      const qty = parseFloat(e.quantity) || 1
      return sum + (cost * qty * quantity)
    }, 0)
  )
}

/**
 * D. Gasto fijo asignado
 * (total_gastos_fijos_mensuales / capacidad_mensual) × cantidad
 */
export function calcAssignedFixedExpense(totalMonthlyExpenses, monthlyCapacity, quantity) {
  const capacity = monthlyCapacity || 1000
  const perUnit = totalMonthlyExpenses / capacity
  return round(perUnit * quantity)
}

/**
 * Cálculo completo de cotización
 * Retorna un objeto con todos los valores calculados (E-J)
 */
export function calculateQuote({
  materials = [],
  processes = [],
  embellishments = [],
  quantity = 1,
  marginPct = 30,
  discountPct = 0,
  taxPct = 0,
  totalMonthlyExpenses = 0,
  monthlyCapacity = 1000,
  minMargin = 15,
  isClothing = false,
  sizeDistribution = null,
  sizeMultipliers = null,
  negotiatedPrice = null,
}) {
  const qty = Math.max(1, parseInt(quantity) || 1)
  const margin = Math.max(0, Math.min(99.99, parseFloat(marginPct) || 0))

  // Escalamiento por tallas si aplica
  let adjustedMaterials = materials
  let sizeMultiplier = 1.0

  if (isClothing && sizeDistribution && Object.keys(sizeDistribution).length > 0) {
    let totalSizeQty = 0
    let weightedSum = 0
    Object.entries(sizeDistribution).forEach(([size, sizeQtyVal]) => {
      const sizeQty = parseFloat(sizeQtyVal) || 0
      const multiplier = parseFloat(sizeMultipliers?.[size]) || 1.0
      weightedSum += sizeQty * multiplier
      totalSizeQty += sizeQty
    })
    
    if (totalSizeQty > 0) {
      sizeMultiplier = weightedSum / totalSizeQty
      adjustedMaterials = materials.map(m => {
        if (m.is_scalable) {
          return {
            ...m,
            quantity_per_unit: (parseFloat(m.quantity_per_unit) || 0) * sizeMultiplier
          }
        }
        return m
      })
    }
  }

  // A. Costo de materiales
  const materialsCost = calcMaterialsCost(adjustedMaterials, qty)

  // B. Merma
  const wasteCost = calcWasteCost(adjustedMaterials, qty)

  // C. Costo de procesos
  const processesCost = calcProcessesCost(processes, qty)

  // D. Costo de personalización
  const embellishmentsCost = calcEmbellishmentsCost(embellishments, qty)

  // E. Gasto fijo asignado (Eliminado del motor de costeo)
  const fixedExpensePerUnit = 0
  const assignedFixedExpense = 0

  // F. Costo total
  const totalCost = round(materialsCost + wasteCost + processesCost + embellishmentsCost)

  // Total production time in minutes
  const totalProductionTimeMinutes = processes.reduce((sum, p) => {
    const timeMin = parseFloat(p.time_minutes) || 0
    return sum + (timeMin * qty)
  }, 0)

  // F. Costo unitario
  const unitCost = round(totalCost / qty)

  // G. Precio unitario con margen
  const unitPrice = margin >= 100 ? unitCost : round(unitCost / (1 - margin / 100))

  // H. Precio total (antes de descuento e impuesto)
  const subtotal = round(unitPrice * qty)

  // Descuento
  const discountAmount = round(subtotal * (parseFloat(discountPct) || 0) / 100)
  const afterDiscount = round(subtotal - discountAmount)

  // Impuesto
  const taxAmount = round(afterDiscount * (parseFloat(taxPct) || 0) / 100)
  const totalPrice = round(afterDiscount + taxAmount)

  // I. Utilidad estimada
  const estimatedProfit = round(totalPrice - totalCost)

  // J. Margen real
  const realMargin = totalPrice > 0 ? round((estimatedProfit / totalPrice) * 100) : 0

  // Alertas
  const alerts = []

  if (realMargin < 0) {
    alerts.push({ type: 'error', message: 'El margen es negativo. El precio no cubre los costos.' })
  } else if (realMargin < minMargin) {
    alerts.push({
      type: 'warning',
      message: `El margen real (${realMargin}%) está por debajo del mínimo configurado (${minMargin}%).`
    })
  }

  const materialsWithoutPrice = materials.filter(m => !m.unit_price || parseFloat(m.unit_price) <= 0)
  if (materialsWithoutPrice.length > 0) {
    alerts.push({
      type: 'error',
      message: `${materialsWithoutPrice.length} material(es) sin precio: ${materialsWithoutPrice.map(m => m.material_name || m.name).join(', ')}`
    })
  }

  // --- Desglose Detallado por Talla ---
  const sizeBreakdown = {}
  if (isClothing) {
    const sizesToCalculate = sizeMultipliers && Object.keys(sizeMultipliers).length > 0
      ? Object.keys(sizeMultipliers)
      : ['2', '4', '6', '8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

    let totalCalculatedSales = 0

    // Primera pasada: Calcular precios unitarios y totales sugeridos por talla
    sizesToCalculate.forEach((size) => {
      const sizeQty = sizeDistribution ? (parseFloat(sizeDistribution[size]) || 0) : 0
      const multiplier = parseFloat(sizeMultipliers?.[size]) || 1.0

      // 1. Costo unitario de materiales específicos para esta talla
      const matCostUnit = materials.reduce((sum, m) => {
        const qtyPerUnit = (parseFloat(m.quantity_per_unit) || 0) * (m.is_scalable ? multiplier : 1.0)
        const price = parseFloat(m.unit_price) || 0
        return sum + (qtyPerUnit * price)
      }, 0)

      // 2. Costo unitario de merma para esta talla
      const wasteCostUnit = materials.reduce((sum, m) => {
        const qtyPerUnit = (parseFloat(m.quantity_per_unit) || 0) * (m.is_scalable ? multiplier : 1.0)
        const price = parseFloat(m.unit_price) || 0
        const wastePct = parseFloat(m.waste_pct) || 0
        return sum + (qtyPerUnit * price * wastePct / 100)
      }, 0)

      // 3. Costo unitario de procesos (prorrateado por cantidad)
      const procCostUnit = processes.reduce((sum, p) => {
        const cost = parseFloat(p.cost) || 0
        const timeMin = parseFloat(p.time_minutes) || 0
        switch (p.cost_type) {
          case 'por_hora':
            return sum + ((timeMin / 60) * cost)
          case 'por_unidad':
            return sum + cost
          case 'fijo_por_pedido':
            return sum + (cost / (qty > 0 ? qty : 1))
          default:
            return sum
        }
      }, 0)

      // 4. Costo unitario de estampados/logos
      const embCostUnit = (embellishments || []).reduce((sum, e) => {
        const cost = parseFloat(e.cost) || 0
        const embQty = parseFloat(e.quantity) || 1
        return sum + (cost * embQty)
      }, 0)

      const unitCostSize = round(matCostUnit + wasteCostUnit + procCostUnit + embCostUnit)
      const unitPriceSize = margin >= 100 ? unitCostSize : round(unitCostSize / (1 - margin / 100))

      // Aplicar descuento e impuesto al precio unitario sugerido de la talla
      const discAmtSize = round(unitPriceSize * (parseFloat(discountPct) || 0) / 100)
      const afterDiscSize = round(unitPriceSize - discAmtSize)
      const taxAmtSize = round(afterDiscSize * (parseFloat(taxPct) || 0) / 100)
      const unitPriceFinalSize = round(afterDiscSize + taxAmtSize)

      const totalPriceSize = round(unitPriceFinalSize * sizeQty)
      totalCalculatedSales += totalPriceSize

      sizeBreakdown[size] = {
        size,
        multiplier,
        quantity: sizeQty,
        matCostUnit: round(matCostUnit),
        wasteCostUnit: round(wasteCostUnit),
        procCostUnit: round(procCostUnit),
        embCostUnit: round(embCostUnit),
        unitCost: unitCostSize,
        totalCost: round(unitCostSize * sizeQty),
        unitPrice: unitPriceSize,               // precio base antes de impuestos y descuentos
        unitPriceFinal: unitPriceFinalSize,     // precio sugerido final facturado por unidad
        totalPrice: totalPriceSize,             // total sugerido facturado
        negotiatedUnitPrice: unitPriceFinalSize, // por defecto igual al sugerido
        negotiatedTotalPrice: totalPriceSize     // por defecto igual al sugerido
      }
    })

    // Segunda pasada: Distribuir proporcionalmente el precio negociado global si existe (solo en las tallas activas con cantidad > 0)
    const negPrice = parseFloat(negotiatedPrice) || 0
    if (negPrice > 0 && totalCalculatedSales > 0) {
      const k = negPrice / totalCalculatedSales
      let runningNegTotal = 0
      const activeSizeKeys = Object.keys(sizeBreakdown).filter(size => sizeBreakdown[size].quantity > 0)

      activeSizeKeys.forEach((size, idx) => {
        const item = sizeBreakdown[size]
        if (idx === activeSizeKeys.length - 1) {
          // Último item activo: ajustar la diferencia de redondeo decimal
          const exactTotal = round(negPrice - runningNegTotal)
          item.negotiatedTotalPrice = exactTotal
          item.negotiatedUnitPrice = round(exactTotal / item.quantity)
        } else {
          const rawTotal = item.totalPrice * k
          const roundedTotal = round(rawTotal)
          item.negotiatedTotalPrice = roundedTotal
          item.negotiatedUnitPrice = round(roundedTotal / item.quantity)
          runningNegTotal += roundedTotal
        }
      })
    }
  }

  return {
    // Desglose
    materialsCost,
    wasteCost,
    processesCost,
    embellishmentsCost,
    fixedExpensePerUnit,
    assignedFixedExpense,
    totalProductionTimeMinutes,

    // Totales
    totalCost,
    unitCost,
    unitPrice,
    subtotal,
    discountAmount,
    afterDiscount,
    taxAmount,
    totalPrice,

    // Utilidad
    estimatedProfit,
    realMargin,
    marginPct: margin,

    // Tallas
    sizeMultiplier,
    adjustedMaterials,
    sizeBreakdown, // mapa detallado por talla

    // Alertas
    alerts,
    hasErrors: alerts.some(a => a.type === 'error'),
    hasWarnings: alerts.some(a => a.type === 'warning'),
  }
}


/**
 * Formatea un tiempo de producción en un texto legible
 */
export function formatProductionTime(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0 minutos'
  const mins = Math.round(totalMinutes)
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  if (hours <= 0) {
    return `${mins} min`
  }
  if (hours < 8) {
    return `${hours}h ${remainingMins}m`
  }
  const workDays = Math.floor(hours / 8)
  const remainingHours = hours % 8
  
  let result = `${workDays} día${workDays > 1 ? 's' : ''}`
  if (remainingHours > 0 || remainingMins > 0) {
    result += ` y ${remainingHours}h ${remainingMins}m`
  }
  return result
}

/**
 * Redondea al precio sugerido hacia arriba (al siguiente entero)
 */
export function roundUpPrice(price) {
  return Math.ceil(parseFloat(price) || 0)
}

/**
 * Helper parser for contract duration (divisor is 30 days, where 1 month equals 30 days)
 */
export function parseContractDurationToMonths(durationStr) {
  if (!durationStr) return 0
  const clean = durationStr.toLowerCase().trim()
  const match = clean.match(/(\d+(?:\.\d+)?)\s*(mes|di|dí|seman|week|month|day)/)
  
  let days = 0
  if (!match) {
    const numMatch = clean.match(/(\d+(?:\.\d+)?)/)
    days = numMatch ? parseFloat(numMatch[1]) : 0
  } else {
    const val = parseFloat(match[1])
    const unit = match[2]
    if (unit.startsWith('di') || unit.startsWith('dí') || unit.startsWith('day')) {
      days = val
    } else if (unit.startsWith('seman') || unit.startsWith('week')) {
      days = val * 7
    } else {
      // 1 month equals 30 contract days
      days = val * 30
    }
  }
  
  // Divisor is 30 contract days to get the proportion of monthly expenses
  return days / 30
}

/**
 * Redondea a 2 decimales
 */
function round(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

// ─── Inteligencia de Precios ────────────────────────────────────────────────

/**
 * Rangos de cantidad con márgenes sugeridos para cotización por volumen.
 * Cada tier define: min, max (null = sin límite), margen sugerido, y etiqueta.
 */
export const VOLUME_TIERS = [
  { min: 1,   max: 5,    marginPct: 50, label: '1 – 5 uds' },
  { min: 6,   max: 20,   marginPct: 40, label: '6 – 20 uds' },
  { min: 21,  max: 50,   marginPct: 35, label: '21 – 50 uds' },
  { min: 51,  max: 100,  marginPct: 30, label: '51 – 100 uds' },
  { min: 101, max: 300,  marginPct: 25, label: '101 – 300 uds' },
  { min: 301, max: null, marginPct: 20, label: '301+ uds' },
]

/**
 * Retorna el margen sugerido según la cantidad del pedido.
 */
export function getVolumeTierMargin(quantity) {
  const qty = Math.max(1, parseInt(quantity) || 1)
  for (const tier of VOLUME_TIERS) {
    if (tier.max === null && qty >= tier.min) return tier.marginPct
    if (qty >= tier.min && qty <= tier.max) return tier.marginPct
  }
  return VOLUME_TIERS[0].marginPct
}

/**
 * Calcula los 3 niveles de precio (mínimo, sugerido, premium) a partir del costo unitario.
 * 
 * - Mínimo:   margen mínimo configurado (ej. 15%) — cubre costos y utilidad mínima
 * - Sugerido: margen según escala de volumen actual — precio recomendado normal
 * - Premium:  margen sugerido × 1.5 (ej. 30% → 45%) — clientes exigentes/urgentes
 * 
 * @param {number} unitCost - Costo unitario de producción
 * @param {number} quantity - Cantidad del pedido
 * @param {number} minMarginPct - Margen mínimo configurado en settings
 * @param {number} totalMonthlyExpenses - Total mensual de gastos fijos
 * @param {string} contractDuration - Duración del contrato (ej. "15 días")
 * @param {number} discountPct - Porcentaje de descuento
 * @param {boolean} applyTax - Si se aplican impuestos
 * @param {number} taxPct - Porcentaje de impuesto
 * @param {number} totalCost - Costo total del pedido
 */
export function calculatePricingTiers({
  unitCost,
  quantity,
  minMarginPct = 15,
  totalMonthlyExpenses = 0,
  contractDuration = '',
  discountPct = 0,
  applyTax = false,
  taxPct = 0,
  totalCost = 0,
}) {
  const qty = Math.max(1, parseInt(quantity) || 1)
  const volumeMargin = getVolumeTierMargin(qty)

  // Premium multiplier: suggested margin × 1.5, capped at 70%
  const premiumMargin = Math.min(70, round(volumeMargin * 1.5))

  const tiers = [
    { key: 'minimum',   label: 'Precio Mínimo',   marginPct: minMarginPct, description: 'Cubres costos y utilidad mínima', icon: 'shield', color: 'error' },
    { key: 'suggested', label: 'Precio Sugerido',  marginPct: volumeMargin, description: 'Precio recomendado para este volumen', icon: 'recommend', color: 'primary' },
    { key: 'premium',   label: 'Precio Premium',   marginPct: premiumMargin, description: 'Clientes exigentes, urgentes o personalizados', icon: 'diamond', color: 'tertiary' },
  ]

  const months = parseContractDurationToMonths(contractDuration)
  const proratedFixed = totalMonthlyExpenses * months

  return tiers.map(tier => {
    const margin = tier.marginPct
    const tierUnitPrice = margin >= 100 ? unitCost : round(unitCost / (1 - margin / 100))
    const tierSubtotal = round(tierUnitPrice * qty)
    const tierDiscount = round(tierSubtotal * (discountPct || 0) / 100)
    const afterDiscount = round(tierSubtotal - tierDiscount)
    const tierTax = applyTax ? round(afterDiscount * (taxPct || 0) / 100) : 0
    const tierTotalSales = round(afterDiscount + tierTax)
    const tierGrossProfit = round(tierTotalSales - totalCost)
    const tierNetProfit = round(tierGrossProfit - proratedFixed)
    const tierNetMargin = tierTotalSales > 0 ? round((tierNetProfit / tierTotalSales) * 100) : 0

    return {
      ...tier,
      unitPrice: tierUnitPrice,
      totalSales: tierTotalSales,
      grossProfit: tierGrossProfit,
      netProfit: tierNetProfit,
      netMargin: tierNetMargin,
    }
  })
}

