-- ==============================================================
-- MIGRACIÓN COMPLEMENTARIA PARA ENLAZAR ACREEDORES COMO TERCEROS
-- Ejecuta este script en el editor SQL de Supabase
-- ==============================================================

-- 1. Modificar la restricción de 'role' en terceros para incluir 'acreedor'
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_role_check;
ALTER TABLE terceros ADD CONSTRAINT terceros_role_check CHECK (role IN ('cliente', 'proveedor', 'dependiente', 'acreedor'));

-- 2. Modificar la restricción de 'client_type' en terceros para incluir 'acreedor'
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_client_type_check;
ALTER TABLE terceros ADD CONSTRAINT terceros_client_type_check CHECK (client_type IN (
  'minorista', 'mayorista', 'club_deportivo', 'colegio', 'empresa', 'revendedor', 'otro',
  'proveedor_materia_prima', 'proveedor_insumos', 'proveedor_servicios', 'dependiente', 'acreedor'
));

-- 3. Agregar la columna 'creditor_id' en la tabla de préstamos (loans)
ALTER TABLE loans ADD COLUMN IF NOT EXISTS creditor_id UUID REFERENCES terceros(id) ON DELETE SET NULL;

-- 4. Crear un índice para optimizar consultas de préstamos por acreedor
CREATE INDEX IF NOT EXISTS idx_loans_creditor_id ON loans(creditor_id);
