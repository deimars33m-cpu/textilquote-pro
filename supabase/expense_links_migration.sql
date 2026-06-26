-- ==============================================================
-- TextilQuote Pro - Expense Links to Orders and Materials
-- PostgreSQL / Supabase Migration
-- ==============================================================

-- 1. Agregar columnas de llave foránea opcionales a la tabla de gastos (expenses)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id) ON DELETE SET NULL;
