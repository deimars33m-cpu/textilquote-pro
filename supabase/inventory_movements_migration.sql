-- ============================================================
-- MÓDULO: Control de Inventarios y Movimientos de Materiales
-- Vinculación con Contratos y Catálogo de Materiales
-- ============================================================

-- 1. Agregar columna material_id a contract_material_purchases si no existe
ALTER TABLE contract_material_purchases
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id) ON DELETE SET NULL;

-- 2. Tabla de Movimientos de Inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  material_id   UUID REFERENCES materials(id) ON DELETE CASCADE NOT NULL,
  contract_id   UUID REFERENCES contract_tracking(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('compra', 'asignacion', 'devolucion', 'ajuste')),
  quantity      NUMERIC(12,4) NOT NULL, -- Cantidad positiva
  unit_cost     NUMERIC(12,4) DEFAULT 0,
  total_cost    NUMERIC(12,2) DEFAULT 0,
  reference     TEXT,                    -- Factura, recibo, remisión
  supplier_name TEXT,
  notes         TEXT,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_inventory_movements_material ON inventory_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_contract ON inventory_movements(contract_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_user ON inventory_movements(user_id);

-- 3. Habilitar RLS
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own inventory movements" ON inventory_movements;
CREATE POLICY "Users manage own inventory movements" ON inventory_movements
  FOR ALL USING (auth.uid() = user_id);

-- 4. Trigger para sincronizar automáticamente current_stock en materials
CREATE OR REPLACE FUNCTION update_material_current_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_material_id UUID;
  v_calc_stock NUMERIC(12,4);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_material_id := OLD.material_id;
  ELSE
    v_material_id := NEW.material_id;
  END IF;

  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type IN ('compra', 'devolucion') THEN quantity
      WHEN movement_type = 'asignacion' THEN -quantity
      WHEN movement_type = 'ajuste' THEN quantity
      ELSE 0
    END
  ), 0)
  INTO v_calc_stock
  FROM inventory_movements
  WHERE material_id = v_material_id;

  UPDATE materials
  SET current_stock = v_calc_stock,
      updated_at = NOW()
  WHERE id = v_material_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_material_current_stock ON inventory_movements;
CREATE TRIGGER trg_update_material_current_stock
AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION update_material_current_stock();

-- 5. Actualización de create_contract_transactional:
-- - Guarda material_id en contract_material_purchases
-- - Elimina la importación duplicada desde expenses
CREATE OR REPLACE FUNCTION create_contract_transactional(
  p_quote_id UUID,
  p_contract_name TEXT,
  p_client_name TEXT,
  p_total_units INTEGER,
  p_delivery_date DATE,
  p_notes TEXT
)
RETURNS SETOF contract_tracking
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_quote quotes%ROWTYPE;
  v_order_id UUID;
  v_quote_item_id UUID;
  v_contract contract_tracking%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NULLIF(BTRIM(p_contract_name), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre del contrato es obligatorio';
  END IF;

  IF NULLIF(BTRIM(p_client_name), '') IS NULL THEN
    RAISE EXCEPTION 'El cliente es obligatorio';
  END IF;

  IF p_total_units IS NULL OR p_total_units <= 0 THEN
    RAISE EXCEPTION 'El total de unidades debe ser mayor a 0';
  END IF;

  IF p_quote_id IS NOT NULL THEN
    SELECT *
    INTO v_quote
    FROM quotes
    WHERE id = p_quote_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cotización no encontrada para este usuario';
    END IF;

    IF v_quote.status <> 'aprobada' THEN
      RAISE EXCEPTION 'Solo se pueden crear contratos desde cotizaciones aprobadas';
    END IF;

    SELECT id
    INTO v_order_id
    FROM orders
    WHERE quote_id = p_quote_id
      AND user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT id
    INTO v_quote_item_id
    FROM quote_items
    WHERE quote_id = p_quote_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  INSERT INTO contract_tracking (
    user_id,
    quote_id,
    order_id,
    contract_name,
    client_name,
    total_units,
    delivery_date,
    status,
    notes
  ) VALUES (
    v_user_id,
    p_quote_id,
    v_order_id,
    BTRIM(p_contract_name),
    BTRIM(p_client_name),
    p_total_units,
    p_delivery_date,
    'en_proceso',
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING * INTO v_contract;

  -- Importar materiales requeridos vinculando material_id
  IF v_quote_item_id IS NOT NULL THEN
    INSERT INTO contract_material_purchases (
      contract_id,
      material_id,
      material_name,
      unit,
      qty_required,
      qty_purchased,
      unit_cost,
      status,
      notes
    )
    SELECT
      v_contract.id,
      source.material_id,
      source.material_name,
      source.pack_unit,
      source.to_buy,
      0,
      source.pack_quantity * source.unit_price,
      'pendiente',
      format(
        'Al por mayor: %s %s(s) [%s %s/%s] → cubre %s %s c/merma',
        source.to_buy,
        source.pack_unit,
        source.pack_quantity,
        source.usage_unit,
        source.pack_unit,
        ROUND(source.total_required, 2),
        source.usage_unit
      )
    FROM (
      SELECT
        qm.material_id,
        qm.material_name,
        COALESCE(m.purchase_unit, m.usage_unit, 'unidad') AS pack_unit,
        COALESCE(m.usage_unit, 'unidad') AS usage_unit,
        GREATEST(COALESCE(m.purchase_quantity, 1), 1) AS pack_quantity,
        COALESCE(qm.unit_price, 0) AS unit_price,
        COALESCE(qm.quantity_per_unit, 0)
          * p_total_units
          * (1 + COALESCE(qm.waste_pct, 0) / 100) AS total_required,
        CEIL(
          (
            COALESCE(qm.quantity_per_unit, 0)
            * p_total_units
            * (1 + COALESCE(qm.waste_pct, 0) / 100)
          ) / GREATEST(COALESCE(m.purchase_quantity, 1), 1)
        ) AS to_buy
      FROM quote_materials qm
      LEFT JOIN materials m ON m.id = qm.material_id
      WHERE qm.quote_item_id = v_quote_item_id
    ) AS source;

    INSERT INTO contract_embellishment_progress (
      contract_id,
      process_type,
      process_name,
      units_total,
      units_sent,
      units_returned,
      units_approved
    )
    SELECT
      v_contract.id,
      CASE
        WHEN qe.type IN ('bordado', 'sublimado', 'vinil', 'serigrafia', 'otro') THEN qe.type
        ELSE 'otro'
      END,
      COALESCE(NULLIF(BTRIM(qe.name), ''), 'Embellecimiento'),
      p_total_units,
      0,
      0,
      0
    FROM quote_embellishments qe
    WHERE qe.quote_item_id = v_quote_item_id;

    INSERT INTO contract_production_progress (
      contract_id,
      phase_name,
      units_planned,
      units_completed,
      units_in_progress
    ) VALUES (
      v_contract.id,
      'Producción General',
      p_total_units,
      0,
      0
    );
  END IF;

  RETURN NEXT v_contract;
END;
$$;
