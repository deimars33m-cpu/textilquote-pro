-- ==============================================================
-- TextilQuote Pro - Dependientes Schema Migration
-- PostgreSQL / Supabase
-- ==============================================================

-- 1. Modificar la restricción de 'role' en terceros para incluir 'dependiente'
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_role_check;
ALTER TABLE terceros ADD CONSTRAINT terceros_role_check CHECK (role IN ('cliente', 'proveedor', 'dependiente'));

-- 2. Modificar la restricción de 'client_type' en terceros para incluir 'dependiente'
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_client_type_check;
ALTER TABLE terceros ADD CONSTRAINT terceros_client_type_check CHECK (client_type IN (
  'minorista', 'mayorista', 'club_deportivo', 'colegio', 'empresa', 'revendedor', 'otro',
  'proveedor_materia_prima', 'proveedor_insumos', 'proveedor_servicios', 'dependiente'
));
