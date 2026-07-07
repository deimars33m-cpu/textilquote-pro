-- ==============================================================
-- MIGRACIÓN COMPLEMENTARIA PARA ENLAZAR ACREEDORES COMO TERCEROS
-- Ejecuta este script en el editor SQL de Supabase
-- ==============================================================

-- 1. Eliminar restricciones check de 'role' y 'client_type' en terceros
-- Esto permite el registro flexible de cualquier tipo de tercero o acreedor sin restricciones de base de datos.
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS clientes_role_check;
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS clients_role_check;
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_role_check;

ALTER TABLE terceros DROP CONSTRAINT IF EXISTS clientes_client_type_check;
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_client_type_check;

-- 2. Agregar la columna 'creditor_id' en la tabla de préstamos (loans)
ALTER TABLE loans ADD COLUMN IF NOT EXISTS creditor_id UUID REFERENCES terceros(id) ON DELETE SET NULL;

-- 3. Crear un índice para optimizar consultas de préstamos por acreedor
CREATE INDEX IF NOT EXISTS idx_loans_creditor_id ON loans(creditor_id);
