-- ==============================================================
-- TextilQuote Pro - Size-Specific Pricing Database Migration
-- PostgreSQL / Supabase
-- ==============================================================

-- 1. Agregar multiplicadores históricos y escalabilidad en Cotizaciones
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS size_multipliers JSONB DEFAULT '{
  "2": 0.50, "4": 0.58, "6": 0.66, "8": 0.74, "10": 0.82, "12": 0.88, "14": 0.94, "16": 1.00,
  "S": 0.90, "M": 0.95, "L": 1.00, "XL": 1.10, "XXL": 1.25, "XXXL": 1.40
}'::jsonb;

ALTER TABLE quote_materials ADD COLUMN IF NOT EXISTS is_scalable BOOLEAN NOT NULL DEFAULT false;

-- 2. Agregar multiplicadores históricos y escalabilidad en Pedidos
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size_multipliers JSONB DEFAULT '{
  "2": 0.50, "4": 0.58, "6": 0.66, "8": 0.74, "10": 0.82, "12": 0.88, "14": 0.94, "16": 1.00,
  "S": 0.90, "M": 0.95, "L": 1.00, "XL": 1.10, "XXL": 1.25, "XXXL": 1.40
}'::jsonb;

ALTER TABLE order_item_materials ADD COLUMN IF NOT EXISTS is_scalable BOOLEAN NOT NULL DEFAULT false;
