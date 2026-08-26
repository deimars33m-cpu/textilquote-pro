-- ==============================================================
-- TextilQuote Pro - Atomic quote and contract creation
-- PostgreSQL / Supabase
-- ==============================================================

-- The application already consumes this table. Keeping its definition here
-- makes the transactional functions deployable on a fresh database as well.
CREATE TABLE IF NOT EXISTS quote_embellishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id UUID NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'otro',
  name TEXT NOT NULL,
  cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE quote_embellishments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quote_embellishments" ON quote_embellishments;
CREATE POLICY "Users manage own quote_embellishments" ON quote_embellishments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM quote_items qi
      JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_embellishments.quote_item_id
        AND q.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM quote_items qi
      JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_embellishments.quote_item_id
        AND q.user_id = auth.uid()
    )
  );

-- Preserve the first occurrence of any existing duplicate number and move only
-- subsequent duplicates above the current maximum for that user.
WITH ranked AS (
  SELECT
    id,
    user_id,
    quote_number,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, quote_number
      ORDER BY created_at, id
    ) AS duplicate_position
  FROM quotes
),
max_numbers AS (
  SELECT user_id, COALESCE(MAX(quote_number), 0) AS max_number
  FROM quotes
  GROUP BY user_id
),
renumbered AS (
  SELECT
    r.id,
    (m.max_number + ROW_NUMBER() OVER (
      PARTITION BY r.user_id
      ORDER BY r.quote_number, r.id
    ))::INTEGER AS new_number
  FROM ranked r
  JOIN max_numbers m ON m.user_id = r.user_id
  WHERE r.duplicate_position > 1
)
UPDATE quotes q
SET quote_number = r.new_number
FROM renumbered r
WHERE q.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_user_quote_number_unique
  ON quotes(user_id, quote_number);

CREATE OR REPLACE FUNCTION create_quote_transactional(
  p_tercero_id UUID,
  p_template_id UUID,
  p_product_name TEXT,
  p_quantity INTEGER,
  p_margin_pct NUMERIC,
  p_discount_pct NUMERIC,
  p_tax_pct NUMERIC,
  p_notes TEXT,
  p_valid_until DATE,
  p_total_cost NUMERIC,
  p_total_price NUMERIC,
  p_total_profit NUMERIC,
  p_real_margin NUMERIC,
  p_unit_cost NUMERIC,
  p_unit_price NUMERIC,
  p_materials JSONB,
  p_processes JSONB,
  p_embellishments JSONB
)
RETURNS TABLE (id UUID, quote_number INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quote quotes%ROWTYPE;
  v_quote_item quote_items%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero';
  END IF;

  IF p_tercero_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM terceros t
    WHERE t.id = p_tercero_id AND t.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'El cliente no pertenece al usuario autenticado';
  END IF;

  IF p_template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM product_templates pt
    WHERE pt.id = p_template_id AND pt.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'La plantilla no pertenece al usuario autenticado';
  END IF;

  -- Serialize number allocation only for this user. The unique index remains a
  -- final safeguard against writes made outside this function.
  PERFORM pg_advisory_xact_lock(
    hashtext('textilquote_quote_number'),
    hashtext(v_user_id::TEXT)
  );

  INSERT INTO quotes (
    user_id,
    tercero_id,
    quote_number,
    status,
    discount_pct,
    tax_pct,
    notes,
    valid_until,
    total_cost,
    total_price,
    total_profit,
    real_margin
  )
  SELECT
    v_user_id,
    p_tercero_id,
    COALESCE(MAX(q.quote_number), 0) + 1,
    'borrador',
    COALESCE(p_discount_pct, 0),
    COALESCE(p_tax_pct, 0),
    p_notes,
    p_valid_until,
    COALESCE(p_total_cost, 0),
    COALESCE(p_total_price, 0),
    COALESCE(p_total_profit, 0),
    COALESCE(p_real_margin, 0)
  FROM quotes q
  WHERE q.user_id = v_user_id
  RETURNING * INTO v_quote;

  INSERT INTO quote_items (
    quote_id,
    template_id,
    product_name,
    quantity,
    margin_pct,
    fixed_expense_per_unit,
    unit_cost,
    unit_price,
    total_cost,
    total_price,
    profit,
    real_margin
  ) VALUES (
    v_quote.id,
    p_template_id,
    COALESCE(NULLIF(BTRIM(p_product_name), ''), 'Producto personalizado'),
    p_quantity,
    COALESCE(p_margin_pct, 0),
    0,
    COALESCE(p_unit_cost, 0),
    COALESCE(p_unit_price, 0),
    COALESCE(p_total_cost, 0),
    COALESCE(p_total_price, 0),
    COALESCE(p_total_profit, 0),
    COALESCE(p_real_margin, 0)
  )
  RETURNING * INTO v_quote_item;

  INSERT INTO quote_materials (
    quote_item_id,
    material_id,
    material_name,
    quantity_per_unit,
    unit_price,
    waste_pct,
    total_cost
  )
  SELECT
    v_quote_item.id,
    material_id,
    material_name,
    quantity_per_unit,
    unit_price,
    waste_pct,
    total_cost
  FROM jsonb_to_recordset(COALESCE(p_materials, '[]'::JSONB)) AS material_rows (
    material_id UUID,
    material_name TEXT,
    quantity_per_unit NUMERIC,
    unit_price NUMERIC,
    waste_pct NUMERIC,
    total_cost NUMERIC
  );

  INSERT INTO quote_processes (
    quote_item_id,
    process_id,
    process_name,
    cost_type,
    cost,
    time_minutes,
    total_cost
  )
  SELECT
    v_quote_item.id,
    process_id,
    process_name,
    cost_type,
    cost,
    time_minutes,
    total_cost
  FROM jsonb_to_recordset(COALESCE(p_processes, '[]'::JSONB)) AS process_rows (
    process_id UUID,
    process_name TEXT,
    cost_type TEXT,
    cost NUMERIC,
    time_minutes NUMERIC,
    total_cost NUMERIC
  );

  INSERT INTO quote_embellishments (
    quote_item_id,
    type,
    name,
    cost,
    quantity,
    total_cost
  )
  SELECT
    v_quote_item.id,
    type,
    name,
    cost,
    quantity,
    total_cost
  FROM jsonb_to_recordset(COALESCE(p_embellishments, '[]'::JSONB)) AS embellishment_rows (
    type TEXT,
    name TEXT,
    cost NUMERIC,
    quantity NUMERIC,
    total_cost NUMERIC
  );

  RETURN QUERY SELECT v_quote.id, v_quote.quote_number;
END;
$$;

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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_contract contract_tracking%ROWTYPE;
  v_quote_item_id UUID;
  v_quote_status TEXT;
  v_order_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NULLIF(BTRIM(p_contract_name), '') IS NULL
     OR NULLIF(BTRIM(p_client_name), '') IS NULL THEN
    RAISE EXCEPTION 'Nombre y cliente son requeridos';
  END IF;

  IF p_total_units IS NULL OR p_total_units <= 0 THEN
    RAISE EXCEPTION 'Las unidades totales deben ser mayores que cero';
  END IF;

  IF p_quote_id IS NOT NULL THEN
    SELECT q.status
    INTO v_quote_status
    FROM quotes q
    WHERE q.id = p_quote_id
      AND q.user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La cotización no pertenece al usuario autenticado';
    END IF;

    IF v_quote_status <> 'aprobada' THEN
      RAISE EXCEPTION 'Solo se pueden convertir cotizaciones aprobadas';
    END IF;

    SELECT qi.id
    INTO v_quote_item_id
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
    ORDER BY qi.id
    LIMIT 1;

    IF v_quote_item_id IS NULL THEN
      RAISE EXCEPTION 'La cotización no contiene un producto';
    END IF;

    SELECT o.id
    INTO v_order_id
    FROM orders o
    WHERE o.quote_id = p_quote_id
      AND o.user_id = v_user_id
    ORDER BY o.created_at
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
    notes,
    status
  ) VALUES (
    v_user_id,
    p_quote_id,
    v_order_id,
    BTRIM(p_contract_name),
    BTRIM(p_client_name),
    p_total_units,
    p_delivery_date,
    NULLIF(BTRIM(p_notes), ''),
    'en_proceso'
  )
  RETURNING * INTO v_contract;

  IF v_quote_item_id IS NOT NULL THEN
    INSERT INTO contract_material_purchases (
      contract_id,
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

  IF v_order_id IS NOT NULL THEN
    INSERT INTO contract_material_purchases (
      contract_id,
      material_name,
      unit,
      qty_required,
      qty_purchased,
      unit_cost,
      status,
      supplier_name,
      notes
    )
    SELECT
      v_contract.id,
      format('[%s] %s', e.subcategory, e.specific_item),
      e.category_label,
      COALESCE(e.quantity, 1),
      COALESCE(e.quantity, 1),
      COALESCE(e.unit_price, 0),
      'recibido',
      COALESCE(e.provider, ''),
      format(
        'Gasto importado (%s › %s): %s',
        e.category_label,
        e.subcategory,
        COALESCE(NULLIF(e.description, ''), e.specific_item)
      )
    FROM expenses e
    WHERE e.order_id = v_order_id
      AND e.user_id = v_user_id;
  END IF;

  RETURN NEXT v_contract;
END;
$$;

REVOKE ALL ON FUNCTION create_quote_transactional(
  UUID, UUID, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_quote_transactional(
  UUID, UUID, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION create_contract_transactional(
  UUID, TEXT, TEXT, INTEGER, DATE, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_contract_transactional(
  UUID, TEXT, TEXT, INTEGER, DATE, TEXT
) TO authenticated;
