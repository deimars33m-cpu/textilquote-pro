---
name: textilquote-expense-flow
description: Guía canónica del flujo de registro, clasificación, almacenamiento e imputación de gastos, insumos y producción en TextilQuote Pro según la matriz oficial de la empresa.
---

# Flujo Canónico de Gastos, Producción e Inventario - TextilQuote Pro

Esta skill define la arquitectura oficial de datos para todo registro financiero, de materiales, insumos y asignación a contratos en la aplicación.

---

## 1. Matriz Canónica de Gastos

| Categoría Principal | Subcategorías Oficiales | Tipo de Gasto (Macro) | Puntos de Ingreso | Tabla DB Primaria | Visualización Principal | ¿Asignable a Contrato? | Dónde se visualiza la Asignación |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **PRODUCCIÓN** | Materia prima, Embellecimiento, Pagos a destajo MOD, Comisiones | **COSTOS DE PRODUCCIÓN TEXTIL** | Hoja de Gastos + Hoja de Materiales (Nuevo/Compra) | `expenses` | Hoja de Gastos + Hoja de Materiales | **SÍ** | Materiales / Inventario y Stock + Contratos / Compras |
| **INSUMOS** | Sublimación, Bordado, Vinil, DTF | **COSTOS DE SERVICIOS** | Hoja de Gastos + Hoja de Materiales (Nuevo/Compra) | `expenses` | Hoja de Gastos + Hoja de Materiales | **SÍ** | Materiales / Inventario y Stock + Contratos / Compras |
| **GASTOS FIJOS** | Alquileres, Dependientes, Financieros, Servicios básicos, Telecomunicaciones, Viáticos, Impuestos | **GASTOS GENERALES** | Hoja de Gastos | `expenses` | Hoja de Gastos | **NO** | No aplica |
| **G. INDIRECTOS** | Publicidad, Transporte, Mantenimiento | **GASTOS GENERALES** | Hoja de Gastos | `expenses` | Hoja de Gastos | **NO** | No aplica |
| **G. PERSONALES** | Alimentación, Crecimiento personal, Esparcimiento, Compras, Deudas, Entretenimiento, Vivienda | **CAJA CHICA** | Hoja de Gastos | `expenses` | Hoja de Gastos | **NO** | No aplica |
| **G. CASA-FAMILIA** | Compras, Internet, Pensión familiar, Colegiaturas | **CAJA CHICA** | Hoja de Gastos | `expenses` | Hoja de Gastos | **NO** | No aplica |

---

## 2. Reglas de Negocio Estrictas

1. **DB Única de Gastos (`expenses`):**
   - Todo desembolso económico o compra de material DEBE existir en la tabla `expenses`.
   - No deben existir transacciones de compra en tablas secundarias que no tengan su respectivo registro en `expenses`.

2. **Doble Entrada Sincronizada para Producción e Insumos:**
   - Si se ingresa una compra desde la **Hoja de Materiales** (Compra / Ingreso Almacén):
     - Inserta en `expenses` (con `category_key = 'PRODUCCION'` o `'INSUMOS'`, según corresponda).
     - Inserta en `inventory_movements` (`movement_type = 'compra'`).
     - Incrementa el `current_stock` en `materials`.
   - Si se ingresa una compra desde la **Hoja de Gastos** vinculada a un material de catálogo:
     - Inserta en `expenses`.
     - Inserta en `inventory_movements` (`movement_type = 'compra'`).
     - Incrementa el `current_stock` en `materials`.

3. **Restricción de Asignabilidad a Contratos:**
   - La opción de asignación a Contrato / Pedido en la interfaz SOLO debe estar habilitada para `PRODUCCION` e `INSUMOS`.
   - Para `GASTOS_FIJOS`, `INDIRECTOS`, `PERSONAL` y `CASA_FAMILIA`, la asignación está deshabilitada (es gasto de estructura u operativo no imputable a cliente).

4. **Flujo de Asignación y Consumo en Contratos:**
   - Cuando se asigna material/insumo a un Contrato:
     - Se registra en `inventory_movements` con `movement_type = 'asignacion'` y `contract_id`.
     - Descuenta el stock disponible en `materials` (`current_stock = current_stock - qty`).
     - Se refleja inmediatamente en el tablero del Contrato (Pestaña Compras/Materiales) para monitorear el avance de aprovisionamiento.
