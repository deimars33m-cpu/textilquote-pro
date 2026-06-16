-- =============================================
-- TextilQuote Pro - Orders Schema Extension
-- PostgreSQL / Supabase
-- =============================================

-- 1. Tabla de Pedidos (Orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_number SERIAL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('pedido_cotizado', 'servicio_diario')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado')),
  payment_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'adelanto', 'pagado')),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  delivery_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ítems del Pedido (Order Items)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'otro', -- ej: 'sublimacion', 'bordado', 'vinil', 'serigrafia', 'confeccion', 'otro'
  product_category TEXT, -- ej: 'ropa_deportiva', 'ropa_institucional', etc.
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  description TEXT, -- Especificaciones particulares del pedido
  -- Parámetros de costeo recolectados (Fase 1):
  production_time_minutes DECIMAL(8,2) DEFAULT 0,
  materials_cost DECIMAL(12,4) DEFAULT 0,
  processes_cost DECIMAL(12,4) DEFAULT 0,
  estimated_unit_cost DECIMAL(12,4) DEFAULT 0
);

-- 3. Materiales Consumidos en el Ítem (Order Item Materials)
CREATE TABLE IF NOT EXISTS order_item_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  material_name TEXT NOT NULL,
  quantity_per_unit DECIMAL(10,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  waste_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2)
);

-- 4. Procesos Aplicados en el Ítem (Order Item Processes)
CREATE TABLE IF NOT EXISTS order_item_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  process_id UUID REFERENCES processes(id) ON DELETE SET NULL,
  process_name TEXT NOT NULL,
  cost_type TEXT NOT NULL,
  cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  time_minutes DECIMAL(8,2),
  total_cost DECIMAL(12,2)
);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_processes ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si existen antes de crearlas
DROP POLICY IF EXISTS "Users manage own orders" ON orders;
DROP POLICY IF EXISTS "Users manage own order_items" ON order_items;
DROP POLICY IF EXISTS "Users manage own order_item_materials" ON order_item_materials;
DROP POLICY IF EXISTS "Users manage own order_item_processes" ON order_item_processes;

-- Políticas de RLS
CREATE POLICY "Users manage own orders" ON orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own order_items" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own order_item_materials" ON order_item_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_materials.order_item_id
      AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_materials.order_item_id
      AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own order_item_processes" ON order_item_processes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_processes.order_item_id
      AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_processes.order_item_id
      AND o.user_id = auth.uid()
    )
  );

-- Trigger para updated_at en la tabla orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
