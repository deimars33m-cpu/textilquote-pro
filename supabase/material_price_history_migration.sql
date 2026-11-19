-- ==============================================================
-- TextilQuote Pro - Material Price History Migration (Max 5 records)
-- ==============================================================

-- Agregar columna price_history para almacenar hasta 5 registros históricos de precios y fechas
ALTER TABLE materials ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::jsonb;

-- Comentario descriptivo de la columna
COMMENT ON COLUMN materials.price_history IS 'Historial de hasta 5 actualizaciones de precio y fecha: [{"date":"YYYY-MM-DD","price":12.50}]';
