-- =============================================
-- TextilQuote Pro - Sizes Schema Extension
-- PostgreSQL / Supabase
-- =============================================

-- 1. Agregar campos de ropa y multiplicadores de tallas en Plantillas
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS is_clothing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS size_multipliers JSONB DEFAULT '{
  "2": 0.50, "4": 0.58, "6": 0.66, "8": 0.74, "10": 0.82, "12": 0.88, "14": 0.94, "16": 1.00,
  "S": 0.90, "M": 0.95, "L": 1.00, "XL": 1.10, "XXL": 1.25, "XXXL": 1.40
}'::jsonb;

-- 2. Agregar indicador de escalabilidad de material en la tabla de unión
ALTER TABLE product_template_materials ADD COLUMN IF NOT EXISTS is_scalable BOOLEAN NOT NULL DEFAULT false;

-- 3. Agregar distribución de tallas en ítems de cotizaciones
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS size_distribution JSONB DEFAULT '{}'::jsonb;

-- 4. Agregar distribución de tallas en ítems de pedidos
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size_distribution JSONB DEFAULT '{}'::jsonb;
