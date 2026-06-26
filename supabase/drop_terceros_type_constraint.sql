-- ==============================================================
-- TextilQuote Pro - Drop Terceros Client Type Constraint
-- PostgreSQL / Supabase Migration
-- ==============================================================

-- Eliminar las restricciones check de tipo de cliente en terceros/clients
-- Esto permite el registro flexible de cualquier tipo de dependiente o contratista sin restricciones de base de datos.
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_client_type_check;
