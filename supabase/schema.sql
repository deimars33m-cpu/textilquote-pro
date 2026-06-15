-- =============================================
-- TextilQuote Pro - Database Schema
-- PostgreSQL / Supabase
-- =============================================

-- 1. Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'Mi Empresa Textil',
  currency TEXT NOT NULL DEFAULT 'Bs',
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  min_margin DECIMAL(5,2) NOT NULL DEFAULT 15,
  default_margin DECIMAL(5,2) NOT NULL DEFAULT 30,
  monthly_capacity_units INTEGER NOT NULL DEFAULT 1000,
  monthly_capacity_hours DECIMAL(10,2) NOT NULL DEFAULT 160,
  quote_validity_days INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Materials
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'tela','hilo','cierre','tinta','papel_sublimatico','etiqueta',
    'bolsa','avio','servicio_externo','tintas_sublimacion',
    'vinil','materiales_acolchado','forros','otro'
  )),
  usage_unit TEXT NOT NULL DEFAULT 'unidad' CHECK (usage_unit IN ('metro','kg','unidad')),
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  purchase_quantity DECIMAL(10,2) DEFAULT 1,
  purchase_unit TEXT CHECK (purchase_unit IN ('rollo','caja','paquete')),
  price_updated_at DATE DEFAULT CURRENT_DATE,
  default_waste_pct DECIMAL(5,2) NOT NULL DEFAULT 5,
  current_stock DECIMAL(12,2),
  min_stock DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Processes
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('por_hora','por_unidad','fijo_por_pedido')),
  cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  avg_time_minutes DECIMAL(8,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Fixed Expenses
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'alquiler','servicios','sueldos','mantenimiento','marketing',
    'software','transporte','administracion','caja_chica','otro'
  )),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'mensual' CHECK (frequency IN ('quincenal','mensual','anual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Product Templates
CREATE TABLE IF NOT EXISTS product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  suggested_margin DECIMAL(5,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Product Template Materials (join table)
CREATE TABLE IF NOT EXISTS product_template_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES product_templates(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE NOT NULL,
  quantity_per_unit DECIMAL(10,4) NOT NULL DEFAULT 1,
  waste_pct_override DECIMAL(5,2)
);

-- 7. Product Template Processes (join table)
CREATE TABLE IF NOT EXISTS product_template_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES product_templates(id) ON DELETE CASCADE NOT NULL,
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE NOT NULL,
  time_minutes_per_unit DECIMAL(8,2) NOT NULL DEFAULT 0
);

-- 8. Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'otro' CHECK (client_type IN (
    'minorista','mayorista','club_deportivo','colegio',
    'empresa','revendedor','otro'
  )),
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quote_number SERIAL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN (
    'borrador','enviada','aprobada','rechazada','vencida'
  )),
  discount_pct DECIMAL(5,2) DEFAULT 0,
  tax_pct DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  valid_until DATE,
  total_cost DECIMAL(12,2),
  total_price DECIMAL(12,2),
  total_profit DECIMAL(12,2),
  real_margin DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Quote Items
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES product_templates(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  margin_pct DECIMAL(5,2) NOT NULL DEFAULT 30,
  fixed_expense_per_unit DECIMAL(12,4),
  unit_cost DECIMAL(12,4),
  unit_price DECIMAL(12,4),
  total_cost DECIMAL(12,2),
  total_price DECIMAL(12,2),
  profit DECIMAL(12,2),
  real_margin DECIMAL(5,2)
);

-- 11. Quote Materials
CREATE TABLE IF NOT EXISTS quote_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id UUID REFERENCES quote_items(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  material_name TEXT NOT NULL,
  quantity_per_unit DECIMAL(10,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  waste_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2)
);

-- 12. Quote Processes
CREATE TABLE IF NOT EXISTS quote_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id UUID REFERENCES quote_items(id) ON DELETE CASCADE NOT NULL,
  process_id UUID REFERENCES processes(id) ON DELETE SET NULL,
  process_name TEXT NOT NULL,
  cost_type TEXT NOT NULL,
  cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  time_minutes DECIMAL(8,2),
  total_cost DECIMAL(12,2)
);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_template_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_template_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_processes ENABLE ROW LEVEL SECURITY;

-- Policies for user-owned tables
CREATE POLICY "Users manage own company_settings" ON company_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own materials" ON materials
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own processes" ON processes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own fixed_expenses" ON fixed_expenses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own product_templates" ON product_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own clients" ON clients
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own quotes" ON quotes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for child tables (join through parent to user_id)
CREATE POLICY "Users manage own template_materials" ON product_template_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM product_templates pt
      WHERE pt.id = product_template_materials.template_id
      AND pt.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_templates pt
      WHERE pt.id = product_template_materials.template_id
      AND pt.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own template_processes" ON product_template_processes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM product_templates pt
      WHERE pt.id = product_template_processes.template_id
      AND pt.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_templates pt
      WHERE pt.id = product_template_processes.template_id
      AND pt.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own quote_items" ON quote_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id
      AND q.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id
      AND q.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own quote_materials" ON quote_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quote_items qi
      JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_materials.quote_item_id
      AND q.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote_items qi
      JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_materials.quote_item_id
      AND q.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own quote_processes" ON quote_processes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quote_items qi
      JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_processes.quote_item_id
      AND q.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote_items qi
      JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_processes.quote_item_id
      AND q.user_id = auth.uid()
    )
  );

-- =============================================
-- Auto-update updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all relevant tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'company_settings', 'materials', 'processes', 'fixed_expenses',
    'product_templates', 'clients', 'quotes'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %I; CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;
