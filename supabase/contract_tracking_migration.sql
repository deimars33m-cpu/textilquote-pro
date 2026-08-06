-- ============================================================
-- MÓDULO: Seguimiento de Contratos Masivos
-- Textil Quote Pro
-- ============================================================

-- Tabla maestra de contratos
CREATE TABLE IF NOT EXISTS contract_tracking (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id          UUID REFERENCES quotes(id) ON DELETE SET NULL,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  contract_name     TEXT NOT NULL,
  client_name       TEXT NOT NULL,
  total_units       INTEGER NOT NULL DEFAULT 1,
  delivery_date     DATE,
  status            TEXT NOT NULL DEFAULT 'en_proceso'
                    CHECK (status IN ('en_proceso','pausado','completado','entregado')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compras de materiales del contrato
CREATE TABLE IF NOT EXISTS contract_material_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       UUID NOT NULL REFERENCES contract_tracking(id) ON DELETE CASCADE,
  material_name     TEXT NOT NULL,
  unit              TEXT NOT NULL DEFAULT 'unidad',
  qty_required      NUMERIC NOT NULL DEFAULT 0,
  qty_purchased     NUMERIC NOT NULL DEFAULT 0,
  supplier_name     TEXT,
  unit_cost         NUMERIC DEFAULT 0,
  purchase_date     DATE,
  receipt_number    TEXT,
  status            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente','parcial','recibido')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avance de corte de materiales por rollo
CREATE TABLE IF NOT EXISTS contract_cutting_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       UUID NOT NULL REFERENCES contract_tracking(id) ON DELETE CASCADE,
  material_name     TEXT NOT NULL,
  roll_number       TEXT,
  roll_meters       NUMERIC DEFAULT 0,
  pieces_planned    INTEGER NOT NULL DEFAULT 0,
  pieces_cut        INTEGER NOT NULL DEFAULT 0,
  pieces_defective  INTEGER NOT NULL DEFAULT 0,
  cut_date          DATE,
  operator_name     TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avance de producción y ensamblaje por fase
CREATE TABLE IF NOT EXISTS contract_production_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       UUID NOT NULL REFERENCES contract_tracking(id) ON DELETE CASCADE,
  phase_name        TEXT NOT NULL,
  units_planned     INTEGER NOT NULL DEFAULT 0,
  units_completed   INTEGER NOT NULL DEFAULT 0,
  units_in_progress INTEGER NOT NULL DEFAULT 0,
  units_defective   INTEGER NOT NULL DEFAULT 0,
  assigned_to       TEXT,
  start_date        DATE,
  end_date_planned  DATE,
  end_date_actual   DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avance de procesos de embellecimiento
CREATE TABLE IF NOT EXISTS contract_embellishment_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       UUID NOT NULL REFERENCES contract_tracking(id) ON DELETE CASCADE,
  process_type      TEXT NOT NULL DEFAULT 'bordado'
                    CHECK (process_type IN ('bordado','sublimado','vinil','serigrafia','otro')),
  process_name      TEXT NOT NULL,
  supplier_name     TEXT,
  units_total       INTEGER NOT NULL DEFAULT 0,
  units_sent        INTEGER NOT NULL DEFAULT 0,
  units_returned    INTEGER NOT NULL DEFAULT 0,
  units_approved    INTEGER NOT NULL DEFAULT 0,
  sent_date         DATE,
  return_date_planned DATE,
  return_date_actual  DATE,
  cost_per_unit     NUMERIC DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE contract_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_cutting_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_production_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_embellishment_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies: contract_tracking
CREATE POLICY "Users manage own contracts" ON contract_tracking
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies: sub-tables via contract_tracking join
CREATE POLICY "Users manage own contract material purchases" ON contract_material_purchases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contract_tracking ct WHERE ct.id = contract_id AND ct.user_id = auth.uid())
  );

CREATE POLICY "Users manage own contract cutting progress" ON contract_cutting_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contract_tracking ct WHERE ct.id = contract_id AND ct.user_id = auth.uid())
  );

CREATE POLICY "Users manage own contract production progress" ON contract_production_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contract_tracking ct WHERE ct.id = contract_id AND ct.user_id = auth.uid())
  );

CREATE POLICY "Users manage own contract embellishment progress" ON contract_embellishment_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contract_tracking ct WHERE ct.id = contract_id AND ct.user_id = auth.uid())
  );

-- Auto-update updated_at trigger for contract_tracking
CREATE OR REPLACE FUNCTION update_contract_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_tracking_updated_at
  BEFORE UPDATE ON contract_tracking
  FOR EACH ROW EXECUTE FUNCTION update_contract_updated_at();
