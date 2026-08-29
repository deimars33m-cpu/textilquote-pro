-- ============================================================
-- MÓDULO: Lotes de Confección y Seguimiento por Operario (MOD)
-- Textil Quote Pro
-- ============================================================

CREATE TABLE IF NOT EXISTS contract_labor_batches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       UUID NOT NULL REFERENCES contract_tracking(id) ON DELETE CASCADE,
  operator_id       UUID REFERENCES terceros(id) ON DELETE SET NULL,
  operator_name     TEXT NOT NULL,
  batch_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity          INTEGER NOT NULL DEFAULT 0,
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_delivered      BOOLEAN NOT NULL DEFAULT true,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contract_labor_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users manage their contract labor batches
DROP POLICY IF EXISTS "Users manage own contract labor batches" ON contract_labor_batches;
CREATE POLICY "Users manage own contract labor batches" ON contract_labor_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contract_tracking ct WHERE ct.id = contract_id AND ct.user_id = auth.uid())
  );
