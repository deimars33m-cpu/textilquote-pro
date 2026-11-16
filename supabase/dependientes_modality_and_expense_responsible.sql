-- ==============================================================
-- TextilQuote Pro - Dependientes Modalidad & Gasto Responsable
-- PostgreSQL / Supabase Migration
-- ==============================================================

-- 1. Soporte de modalidad de pago y sueldo para dependientes en tabla 'terceros'
ALTER TABLE terceros ADD COLUMN IF NOT EXISTS payment_modality TEXT DEFAULT 'quincenal';
ALTER TABLE terceros ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0;
ALTER TABLE terceros ADD COLUMN IF NOT EXISTS job_title TEXT;

-- 2. Soporte de responsable de la compra en tabla 'expenses'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS responsible TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES terceros(id) ON DELETE SET NULL;
