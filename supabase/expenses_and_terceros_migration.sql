-- ==============================================================
-- TextilQuote Pro - Expenses & Terceros Schema Migration
-- PostgreSQL / Supabase
-- ==============================================================

-- 1. Renombrar la tabla 'clients' a 'terceros' si existe
ALTER TABLE IF EXISTS clients RENAME TO terceros;

-- 2. Agregar la columna 'role' para diferenciar Clientes de Proveedores
ALTER TABLE terceros ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente', 'proveedor'));

-- 3. Modificar la restricción en 'client_type' para permitir tipos de proveedores
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE terceros DROP CONSTRAINT IF EXISTS terceros_client_type_check;
ALTER TABLE terceros ADD CONSTRAINT terceros_client_type_check CHECK (client_type IN (
  'minorista', 'mayorista', 'club_deportivo', 'colegio', 'empresa', 'revendedor', 'otro',
  'proveedor_materia_prima', 'proveedor_insumos', 'proveedor_servicios'
));

-- 4. Renombrar las columnas de llave foránea de forma segura (idempotente)
DO $$
BEGIN
  -- Renombrar client_id a tercero_id en quotes si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='quotes' AND column_name='client_id'
  ) THEN
    ALTER TABLE quotes RENAME COLUMN client_id TO tercero_id;
  END IF;

  -- Renombrar client_id to tercero_id en orders si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='orders' AND column_name='client_id'
  ) THEN
    ALTER TABLE orders RENAME COLUMN client_id TO tercero_id;
  END IF;
END $$;

-- 5. Crear la tabla de transacciones de Gastos (Expenses)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_key TEXT NOT NULL,
  category_label TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  specific_item TEXT NOT NULL,
  description TEXT,
  provider TEXT,
  provider_id UUID REFERENCES terceros(id) ON DELETE SET NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Habilitar RLS (Row Level Security) en las nuevas tablas / modificadas
ALTER TABLE terceros ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 7. Crear/Actualizar políticas de RLS para Terceros (antes Clientes)
DROP POLICY IF EXISTS "Users manage own clients" ON terceros;
DROP POLICY IF EXISTS "Users manage own terceros" ON terceros;
CREATE POLICY "Users manage own terceros" ON terceros
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Crear políticas de RLS para Gastos
DROP POLICY IF EXISTS "Users manage own expenses" ON expenses;
CREATE POLICY "Users manage own expenses" ON expenses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Triggers para actualizar 'updated_at' automáticamente
DROP TRIGGER IF EXISTS update_clients_updated_at ON terceros;
DROP TRIGGER IF EXISTS update_terceros_updated_at ON terceros;
CREATE TRIGGER update_terceros_updated_at 
  BEFORE UPDATE ON terceros 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at 
  BEFORE UPDATE ON expenses 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
