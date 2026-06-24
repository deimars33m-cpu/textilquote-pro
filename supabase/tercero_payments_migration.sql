-- ==============================================================
-- TextilQuote Pro - Tercero Payments & Chronological Allocations
-- PostgreSQL / Supabase Migration
-- ==============================================================

-- 1. Agregar columna de control a orders para abonos directos
ALTER TABLE orders ADD COLUMN IF NOT EXISTS direct_paid_amount DECIMAL(12,2) DEFAULT 0;

-- Sincronizar inicialmente direct_paid_amount con paid_amount para pedidos existentes
UPDATE orders SET direct_paid_amount = paid_amount WHERE direct_paid_amount = 0 OR direct_paid_amount IS NULL;

-- 2. Crear tabla de pagos generales/adelantos de terceros
CREATE TABLE IF NOT EXISTS tercero_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tercero_id UUID REFERENCES terceros(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Crear tabla de asignaciones de pagos a pedidos
CREATE TABLE IF NOT EXISTS order_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  tercero_payment_id UUID REFERENCES tercero_payments(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE tercero_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payment_allocations ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para tercero_payments
DROP POLICY IF EXISTS "Users manage own tercero_payments" ON tercero_payments;
CREATE POLICY "Users manage own tercero_payments" ON tercero_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas de seguridad para order_payment_allocations
DROP POLICY IF EXISTS "Users manage own order_payment_allocations" ON order_payment_allocations;
CREATE POLICY "Users manage own order_payment_allocations" ON order_payment_allocations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Función de Reconciliación Principal
CREATE OR REPLACE FUNCTION reconcile_tercero_payments(p_tercero_id UUID)
RETURNS VOID AS $$
DECLARE
  r_order RECORD;
  r_payment RECORD;
  v_needed DECIMAL(12,2);
  v_available DECIMAL(12,2);
  v_allocated DECIMAL(12,2);
  v_user_id UUID;
BEGIN
  -- Establecer bandera de reconciliación local para la sesión
  PERFORM set_config('app.reconciling', 'true', true);

  -- Obtener el user_id del tercero
  SELECT user_id INTO v_user_id FROM terceros WHERE id = p_tercero_id;
  IF v_user_id IS NULL THEN
    PERFORM set_config('app.reconciling', 'false', true);
    RETURN;
  END IF;

  -- Eliminar asignaciones actuales para este tercero
  DELETE FROM order_payment_allocations 
  WHERE user_id = v_user_id 
    AND order_id IN (SELECT id FROM orders WHERE tercero_id = p_tercero_id);

  -- Restaurar pagos acumulados a direct_paid_amount
  UPDATE orders 
  SET 
    paid_amount = direct_paid_amount,
    payment_status = CASE 
      WHEN direct_paid_amount >= total_amount THEN 'pagado'
      WHEN direct_paid_amount > 0 THEN 'adelanto'
      ELSE 'pendiente'
    END
  WHERE tercero_id = p_tercero_id;

  -- Distribuir adelantos cronológicamente
  FOR r_payment IN 
    SELECT id, amount 
    FROM tercero_payments 
    WHERE tercero_id = p_tercero_id 
    ORDER BY date ASC, created_at ASC
  LOOP
    v_available := r_payment.amount;

    FOR r_order IN 
      SELECT id, total_amount, paid_amount 
      FROM orders 
      WHERE tercero_id = p_tercero_id 
        AND paid_amount < total_amount
        AND status != 'cancelado'
      ORDER BY created_at ASC
    LOOP
      EXIT WHEN v_available <= 0;

      v_needed := r_order.total_amount - r_order.paid_amount;
      IF v_needed > 0 THEN
        v_allocated := LEAST(v_available, v_needed);

        -- Registrar asignación de saldo
        INSERT INTO order_payment_allocations (user_id, order_id, tercero_payment_id, amount)
        VALUES (v_user_id, r_order.id, r_payment.id, v_allocated);

        -- Actualizar saldo pagado y estado del pedido
        UPDATE orders 
        SET 
          paid_amount = paid_amount + v_allocated,
          payment_status = CASE 
            WHEN (paid_amount + v_allocated) >= total_amount THEN 'pagado'
            ELSE 'adelanto'
          END
        WHERE id = r_order.id;

        v_available := v_available - v_allocated;
      END IF;
    END LOOP;
  END LOOP;

  -- Limpiar bandera de reconciliación
  PERFORM set_config('app.reconciling', 'false', true);
END;
$$ LANGUAGE plpgsql;

-- 5. Triggers de Reconciliación

-- A. Antes de insertar un pedido (inicializar abono directo)
CREATE OR REPLACE FUNCTION fn_before_insert_order()
RETURNS TRIGGER AS $$
BEGIN
  NEW.direct_paid_amount := NEW.paid_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_insert_order ON orders;
CREATE TRIGGER trg_before_insert_order
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_before_insert_order();

-- B. Antes de actualizar un pedido (sincronizar abono directo si viene de la app)
CREATE OR REPLACE FUNCTION fn_before_update_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Si estamos reconciliando, omitir actualización de direct_paid_amount
  IF COALESCE(current_setting('app.reconciling', true), 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
    NEW.direct_paid_amount := NEW.paid_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_update_order ON orders;
CREATE TRIGGER trg_before_update_order
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_before_update_order();

-- C. Después de insertar/actualizar/borrar un pedido
CREATE OR REPLACE FUNCTION fn_after_order_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Evitar bucles cuando la actualización ocurre dentro de la reconciliación
  IF COALESCE(current_setting('app.reconciling', true), 'false') = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.tercero_id IS NOT NULL THEN
      PERFORM reconcile_tercero_payments(OLD.tercero_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.tercero_id IS NOT NULL THEN
      PERFORM reconcile_tercero_payments(NEW.tercero_id);
    END IF;
    
    -- Si cambió de tercero_id en un UPDATE, reconciliar también al cliente anterior
    IF TG_OP = 'UPDATE' AND OLD.tercero_id IS DISTINCT FROM NEW.tercero_id AND OLD.tercero_id IS NOT NULL THEN
      PERFORM reconcile_tercero_payments(OLD.tercero_id);
    END IF;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_order_change ON orders;
CREATE TRIGGER trg_after_order_change
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_after_order_change();

-- D. Después de insertar/actualizar/borrar un pago de tercero
CREATE OR REPLACE FUNCTION fn_after_payment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM reconcile_tercero_payments(OLD.tercero_id);
    RETURN OLD;
  ELSE
    PERFORM reconcile_tercero_payments(NEW.tercero_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_payment_change ON tercero_payments;
CREATE TRIGGER trg_after_payment_change
AFTER INSERT OR UPDATE OR DELETE ON tercero_payments
FOR EACH ROW
EXECUTE FUNCTION fn_after_payment_change();
