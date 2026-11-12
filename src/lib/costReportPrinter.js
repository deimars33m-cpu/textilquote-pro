/**
 * Generador e impresor formal del Estado de Costos de Producción Textil
 * Diseñado con formato contable estándar para presentación, auditoría y toma de decisiones.
 */

export function printProductionCostStatement({
  companyName = 'TEXTILQUOTE PRO',
  periodLabel = '',
  scopeTitle = 'Resumen Consolidado de Producción',
  isGlobal = true,
  order = null,
  totalGarments = 0,
  totalRevenue = 0,
  directCosts = {
    mpCost: 0,
    embCost: 0,
    destajoCost: 0,
    comisionCost: 0,
    otrosDirectCost: 0,
    subtotal: 0
  },
  indirectCosts = {
    gifCost: 0,
    subtotal: 0
  },
  totalContractCost = 0,
  costPerUnit = 0,
  pricePerUnit = 0,
  netProfit = 0,
  profitMargin = 0,
  productRows = [],
  formatCurrency = (v) => `Bs ${(Number(v) || 0).toFixed(2)}`
}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita las ventanas emergentes (popups) en su navegador para imprimir o exportar el reporte en PDF.');
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const clientName = order?.terceros?.name || (isGlobal ? 'Consolidado General de Clientes' : 'Cliente General');
  const orderNumber = order?.order_number ? `#${String(order.order_number).padStart(4, '0')}` : 'Múltiples Contratos';

  // Subtotales contables
  const subtotalDirecto = directCosts.subtotal || (directCosts.mpCost + directCosts.embCost + directCosts.destajoCost + directCosts.comisionCost + directCosts.otrosDirectCost);
  const subtotalIndirecto = indirectCosts.subtotal || indirectCosts.gifCost;

  // Porcentajes
  const mpPct = totalContractCost > 0 ? ((directCosts.mpCost / totalContractCost) * 100).toFixed(1) : '0.0';
  const embPct = totalContractCost > 0 ? ((directCosts.embCost / totalContractCost) * 100).toFixed(1) : '0.0';
  const destajoPct = totalContractCost > 0 ? ((directCosts.destajoCost / totalContractCost) * 100).toFixed(1) : '0.0';
  const comisionPct = totalContractCost > 0 ? (((directCosts.comisionCost + directCosts.otrosDirectCost) / totalContractCost) * 100).toFixed(1) : '0.0';
  const directPct = totalContractCost > 0 ? ((subtotalDirecto / totalContractCost) * 100).toFixed(1) : '0.0';
  const gifPct = totalContractCost > 0 ? ((subtotalIndirecto / totalContractCost) * 100).toFixed(1) : '0.0';

  // Filas de productos para la tabla analítica
  const productsHtml = productRows.length > 0 ? `
    <div class="section-title">
      <h3>4.0 DESGLOSE Y ANÁLISIS DE RENDIMIENTO POR TIPO DE PRODUCTO</h3>
      <span class="section-badge">Control de Rentabilidad Unitaria</span>
    </div>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 25%;">Línea / Producto</th>
          <th style="width: 10%; text-align: right;">Uds.</th>
          <th style="width: 14%; text-align: right;">Ingresos</th>
          <th style="width: 14%; text-align: right;">Costo Asignado</th>
          <th style="width: 12%; text-align: right;">Costo / Ud</th>
          <th style="width: 12%; text-align: right;">Precio / Ud</th>
          <th style="width: 13%; text-align: center;">Margen (%)</th>
        </tr>
      </thead>
      <tbody>
        ${productRows.map(row => {
          const marginColor = row.ptMargin >= 25 ? '#166534' : row.ptMargin >= 10 ? '#854d0e' : '#991b1b';
          const marginBg = row.ptMargin >= 25 ? '#dcfce7' : row.ptMargin >= 10 ? '#fef9c3' : '#fee2e2';
          return `
            <tr>
              <td><strong>${row.label}</strong></td>
              <td style="text-align: right;">${row.units}</td>
              <td style="text-align: right; color: #047857;">${formatCurrency(row.revenue)}</td>
              <td style="text-align: right; color: #b91c1c;">${formatCurrency(row.ptCost)}</td>
              <td style="text-align: right;">${formatCurrency(row.ptCostPerUnit)}</td>
              <td style="text-align: right;">${formatCurrency(row.ptPricePerUnit)}</td>
              <td style="text-align: center;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; background: ${marginBg}; color: ${marginColor};">
                  ${row.ptMargin.toFixed(1)}%
                </span>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <div class="note-box">
      * Los costos por producto se distribuyen mediante costeo por absorción proporcional al volumen de ingresos de cada línea en el período/contrato.
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Estado de Costo de Producción - ${companyName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          background: #f8fafc;
          margin: 0;
          padding: 24px;
          font-size: 12px;
          line-height: 1.45;
        }
        .container {
          max-width: 820px;
          margin: 0 auto;
          background: #ffffff;
          padding: 32px 36px;
          border-radius: 8px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.06);
          border: 1px solid #e2e8f0;
        }

        /* Toolbar para pantalla */
        .no-print {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          background: #0f172a;
          color: #ffffff;
          padding: 12px 20px;
          border-radius: 8px;
        }
        .no-print-btn {
          cursor: pointer;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .no-print-btn:hover {
          background: #1d4ed8;
        }
        .no-print-btn.close-btn {
          background: #475569;
        }
        .no-print-btn.close-btn:hover {
          background: #334155;
        }

        /* Encabezado */
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .company-name {
          font-size: 20px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          letter-spacing: 0.5px;
        }
        .company-sub {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
          margin-top: 2px;
        }
        .report-badge {
          text-align: right;
          font-size: 10px;
          color: #475569;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .report-title-box {
          margin-top: 12px;
          text-align: center;
          background: #f1f5f9;
          padding: 10px 14px;
          border-radius: 6px;
          border-left: 4px solid #2563eb;
        }
        .report-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #0f172a;
          margin: 0;
          text-transform: uppercase;
        }
        .report-subtitle {
          font-size: 11px;
          color: #475569;
          margin-top: 3px;
          font-style: italic;
        }

        /* Metadatos */
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 11px;
        }
        .meta-item span.label {
          display: block;
          text-transform: uppercase;
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 2px;
        }
        .meta-item span.value {
          font-weight: 600;
          color: #0f172a;
        }

        /* KPI Cards */
        .kpi-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .kpi-card {
          padding: 10px 12px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          text-align: left;
        }
        .kpi-card.highlight {
          background: #eff6ff;
          border-color: #93c5fd;
        }
        .kpi-card .kpi-label {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.5px;
        }
        .kpi-card .kpi-val {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 4px;
          font-family: ui-monospace, monospace;
        }
        .kpi-card .kpi-sub {
          font-size: 10px;
          color: #475569;
          margin-top: 2px;
        }

        /* Títulos de sección */
        .section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 18px;
          margin-bottom: 8px;
          border-bottom: 1.5px solid #0f172a;
          padding-bottom: 4px;
        }
        .section-title h3 {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
          margin: 0;
        }
        .section-badge {
          font-size: 10px;
          color: #64748b;
          font-style: italic;
        }

        /* Tablas Contables */
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          font-size: 11px;
        }
        .report-table th {
          background: #0f172a;
          color: #ffffff;
          text-transform: uppercase;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 6px 10px;
          border: 1px solid #0f172a;
        }
        .report-table td {
          padding: 6px 10px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }
        .report-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .report-table tr.subtotal-row td {
          background: #f1f5f9;
          font-weight: 700;
          border-top: 1.5px solid #94a3b8;
          border-bottom: 1.5px solid #94a3b8;
        }
        .report-table tr.total-row td {
          background: #e2e8f0;
          font-weight: 800;
          font-size: 12px;
          border-top: 2px solid #0f172a;
          border-bottom: 3px double #0f172a;
          color: #0f172a;
        }

        /* Resumen Estado de Resultados */
        .income-summary-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 16px;
          margin-top: 14px;
          margin-bottom: 18px;
        }
        .income-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .income-table td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .income-table td.label-col {
          color: #334155;
          font-weight: 600;
        }
        .income-table td.value-col {
          text-align: right;
          font-family: ui-monospace, monospace;
          font-weight: 700;
        }
        .income-table tr.highlight-income td {
          background: #f0fdf4;
          color: #166534;
          font-size: 12px;
          font-weight: 800;
          border-top: 1.5px solid #86efac;
          border-bottom: 2px solid #166534;
        }

        .decision-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-left: 4px solid #0f172a;
          padding: 10px 14px;
          border-radius: 4px;
          font-size: 10.5px;
          color: #334155;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .decision-box h4 {
          margin: 0 0 6px 0;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
        }

        .note-box {
          font-size: 9.5px;
          color: #64748b;
          font-style: italic;
          margin-top: 4px;
          margin-bottom: 16px;
        }

        /* Firmas */
        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 36px;
          padding-top: 10px;
          page-break-inside: avoid;
        }
        .sig-block {
          text-align: center;
        }
        .sig-line {
          border-top: 1.5px solid #0f172a;
          margin-bottom: 6px;
          width: 80%;
          margin-left: auto;
          margin-right: auto;
        }
        .sig-name {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #0f172a;
        }
        .sig-role {
          font-size: 10px;
          color: #64748b;
        }

        /* Footer */
        .footer-note {
          margin-top: 24px;
          text-align: center;
          font-size: 9px;
          color: #94a3b8;
          border-top: 1px solid #f1f5f9;
          padding-top: 8px;
        }

        @media print {
          body {
            background: #ffffff;
            padding: 0;
          }
          .container {
            box-shadow: none;
            border: none;
            padding: 0;
            max-width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Barra de herramientas (solo en pantalla) -->
        <div class="no-print">
          <div>
            <strong>DOCUMENTO CONTABLE FORMAL</strong>
            <span style="font-size: 11px; color: #94a3b8; margin-left: 10px;">Vista previa de impresión</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="no-print-btn" onclick="window.print()">
              🖨️ Imprimir / Guardar como PDF
            </button>
            <button class="no-print-btn close-btn" onclick="window.close()">
              ✖️ Cerrar
            </button>
          </div>
        </div>

        <!-- Encabezado Membretado -->
        <div class="header">
          <div class="header-top">
            <div>
              <div class="company-name">${companyName}</div>
              <div class="company-sub">SISTEMA INTEGRADO DE GESTIÓN Y COSTOS DE PRODUCCIÓN TEXTIL</div>
            </div>
            <div class="report-badge">
              <div><strong>EMISIÓN:</strong> ${currentDate}</div>
              <div><strong>HORA:</strong> ${currentTime}</div>
              <div><strong>MONEDA:</strong> BOLIVIANOS (Bs)</div>
            </div>
          </div>
          <div class="report-title-box">
            <h1 class="report-title">Estado de Costos de Producción y Rendimiento Operativo</h1>
            <div class="report-subtitle">Informe de Auditoría y Control de Rentabilidad de Manufactura</div>
          </div>
        </div>

        <!-- Ficha de Alcance del Informe -->
        <div class="meta-grid">
          <div class="meta-item">
            <span class="label">Alcance del Informe</span>
            <span class="value">${scopeTitle}</span>
          </div>
          <div class="meta-item">
            <span class="label">Contrato / Pedido</span>
            <span class="value">${orderNumber}</span>
          </div>
          <div class="meta-item">
            <span class="label">Cliente / Destino</span>
            <span class="value">${clientName}</span>
          </div>
          <div class="meta-item">
            <span class="label">Prendas Producidas</span>
            <span class="value" style="font-family: monospace; font-size: 12px; color: #2563eb;">${totalGarments} unidades</span>
          </div>
        </div>

        <!-- Tablero Resumen Ejecutivo -->
        <div class="kpi-row">
          <div class="kpi-card highlight">
            <div class="kpi-label">Ingresos por Ventas</div>
            <div class="kpi-val" style="color: #047857;">${formatCurrency(totalRevenue)}</div>
            <div class="kpi-sub">Facturación neta del lote</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Costo Total Producción</div>
            <div class="kpi-val" style="color: #b91c1c;">${formatCurrency(totalContractCost)}</div>
            <div class="kpi-sub">Costos directos + GIF</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Costo Unitario Medio</div>
            <div class="kpi-val" style="color: #b45309;">${totalGarments > 0 ? formatCurrency(costPerUnit) : '—'}</div>
            <div class="kpi-sub">Precio Venta: ${formatCurrency(pricePerUnit)}</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-label">Utilidad Bruta Lote</div>
            <div class="kpi-val" style="color: ${netProfit >= 0 ? '#047857' : '#b91c1c'};">
              ${formatCurrency(netProfit)}
            </div>
            <div class="kpi-sub" style="font-weight: 700; color: #047857;">Margen: ${profitMargin.toFixed(1)}%</div>
          </div>
        </div>

        <!-- 1.0 y 2.0 Tabla de Costos de Fabricación -->
        <div class="section-title">
          <h3>1.0 ESTRUCTURA Y SEGREGACIÓN DEL COSTO DE FABRICACIÓN</h3>
          <span class="section-badge">Cuentas Contables Normalizadas</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 10%;">Cód.</th>
              <th style="width: 48%;">Cuenta / Concepto Contable</th>
              <th style="width: 16%; text-align: right;">Monto Total</th>
              <th style="width: 14%; text-align: right;">Costo / Prenda</th>
              <th style="width: 12%; text-align: center;">% Costo</th>
            </tr>
          </thead>
          <tbody>
            <!-- Costos Directos -->
            <tr>
              <td style="font-family: monospace; font-weight: 700;">1.1</td>
              <td><strong>Materia Prima Directa (MPD)</strong>: Telas, cuellos rib, cierres, botones, hilos y forros</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(directCosts.mpCost)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency(directCosts.mpCost / totalGarments) : '—'}</td>
              <td style="text-align: center;">${mpPct}%</td>
            </tr>
            <tr>
              <td style="font-family: monospace; font-weight: 700;">1.2</td>
              <td><strong>Mano de Obra Directa (MOD)</strong>: Talleres externos, costura, corte y confección a destajo</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(directCosts.destajoCost)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency(directCosts.destajoCost / totalGarments) : '—'}</td>
              <td style="text-align: center;">${destajoPct}%</td>
            </tr>
            <tr>
              <td style="font-family: monospace; font-weight: 700;">1.3</td>
              <td><strong>Servicios Directos de Transformación</strong>: Bordado computarizado, sublimación y DTF</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(directCosts.embCost)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency(directCosts.embCost / totalGarments) : '—'}</td>
              <td style="text-align: center;">${embPct}%</td>
            </tr>
            <tr>
              <td style="font-family: monospace; font-weight: 700;">1.4</td>
              <td><strong>Otros Costos Directos Vinculados</strong>: Comisiones de venta y gastos de logística</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(directCosts.comisionCost + directCosts.otrosDirectCost)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency((directCosts.comisionCost + directCosts.otrosDirectCost) / totalGarments) : '—'}</td>
              <td style="text-align: center;">${comisionPct}%</td>
            </tr>
            <tr class="subtotal-row">
              <td style="font-family: monospace;">I</td>
              <td>SUBTOTAL COSTOS DIRECTOS DE FABRICACIÓN (COSTO PRIMO)</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(subtotalDirecto)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency(subtotalDirecto / totalGarments) : '—'}</td>
              <td style="text-align: center;">${directPct}%</td>
            </tr>

            <!-- Costos Indirectos -->
            <tr>
              <td style="font-family: monospace; font-weight: 700;">2.1</td>
              <td><strong>Gastos Indirectos de Fabricación (GIF / CIF)</strong>: Prorrateo de alquileres, energía y planta</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(subtotalIndirecto)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency(subtotalIndirecto / totalGarments) : '—'}</td>
              <td style="text-align: center;">${gifPct}%</td>
            </tr>
            <tr class="subtotal-row">
              <td style="font-family: monospace;">II</td>
              <td>SUBTOTAL GASTOS INDIRECTOS DE FABRICACIÓN (GIF)</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(subtotalIndirecto)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency(subtotalIndirecto / totalGarments) : '—'}</td>
              <td style="text-align: center;">${gifPct}%</td>
            </tr>

            <!-- Total Costo -->
            <tr class="total-row">
              <td style="font-family: monospace;">III</td>
              <td>TOTAL COSTO DE PRODUCCIÓN (I + II)</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(totalContractCost)}</td>
              <td style="text-align: right; font-family: monospace;">${totalGarments > 0 ? formatCurrency(costPerUnit) : '—'}</td>
              <td style="text-align: center;">100.0%</td>
            </tr>
          </tbody>
        </table>

        <!-- 3.0 Estado de Resultados Operativo del Lote -->
        <div class="section-title">
          <h3>2.0 ESTADO DE RESULTADOS OPERATIVO Y RENDIMIENTO</h3>
          <span class="section-badge">Para Toma de Decisiones Estratégicas</span>
        </div>
        <div class="income-summary-grid">
          <table class="income-table">
            <tbody>
              <tr>
                <td class="label-col">(+) Valor de Venta / Facturación Total</td>
                <td class="value-col" style="color: #047857;">${formatCurrency(totalRevenue)}</td>
              </tr>
              <tr>
                <td class="label-col">(-) Costo Total de Producción (Absorción)</td>
                <td class="value-col" style="color: #b91c1c;">${formatCurrency(totalContractCost)}</td>
              </tr>
              <tr class="highlight-income">
                <td class="label-col">(=) UTILIDAD BRUTA OPERATIVA</td>
                <td class="value-col">${formatCurrency(netProfit)}</td>
              </tr>
              <tr>
                <td class="label-col">Margen Bruto de Utilidad sobre Ventas</td>
                <td class="value-col" style="color: ${profitMargin >= 25 ? '#166534' : '#b45309'};">${profitMargin.toFixed(1)}%</td>
              </tr>
              <tr>
                <td class="label-col">Margen de Contribución por Prenda</td>
                <td class="value-col">${totalGarments > 0 ? formatCurrency(pricePerUnit - costPerUnit) : '—'}</td>
              </tr>
            </tbody>
          </table>

          <div class="decision-box">
            <h4>Diagnóstico de Control de Gestión</h4>
            <p style="margin: 0 0 6px 0;">
              ${profitMargin >= 30 ? '✅ <strong>Excelente Rentabilidad:</strong> El margen supera el 30%, cubriendo ampliamente la estructura y generando sólida utilidad neta.' :
                profitMargin >= 18 ? '🟡 <strong>Rentabilidad Aceptable:</strong> El margen se encuentra dentro del rango operativo normal (18% - 30%). Monitorear costos de materia prima.' :
                '⚠️ <strong>Rentabilidad Crítica:</strong> Margen inferior al 18%. Se recomienda revisar precios de venta o renegociar costos de destajo y materiales directos.'}
            </p>
            <p style="margin: 0; font-size: 10px; color: #64748b;">
              Markup obtenido: <strong>${totalContractCost > 0 ? ((totalRevenue / totalContractCost)).toFixed(2) : '1.00'}x</strong> sobre el costo de fabricación.
            </p>
          </div>
        </div>

        <!-- 4.0 Desglose por Producto (si existe) -->
        ${productsHtml}

        <!-- Firmas Institucionales -->
        <div class="signatures-grid">
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-name">Responsable de Costos y Presupuestos</div>
            <div class="sig-role">Elaborado y Verificado</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-name">Gerencia de Operaciones / Finanzas</div>
            <div class="sig-role">Revisado y Aprobado</div>
          </div>
        </div>

        <div class="footer-note">
          Documento contable de uso interno y gerencial emitido por ${companyName}.
          Página 1 de 1.
        </div>
      </div>

      <script>
        window.onload = function() {
          // Si el usuario abrió para imprimir, disparar diálogo automáticamente
          setTimeout(function() {
            window.print();
          }, 350);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
