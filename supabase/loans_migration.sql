-- ==========================================
-- MIGRACIÓN PARA EL SISTEMA DE PRÉSTAMOS
-- Ejecuta este script en el editor SQL de Supabase
-- ==========================================

-- 1. Crear la tabla de préstamos (loans)
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  creditor_name TEXT NOT NULL,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('banco', 'privado')),
  principal_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (principal_amount >= 0),
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0), -- Tasa de interés (%)
  interest_period TEXT NOT NULL DEFAULT 'mensual' CHECK (interest_period IN ('mensual', 'anual')),
  term_months INT NOT NULL DEFAULT 12 CHECK (term_months > 0), -- Plazo en meses
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  monthly_payment DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (monthly_payment >= 0), -- Cuota pactada
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'pagado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Crear la tabla de cuotas / pagos de préstamos (loan_payments)
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL, -- Vinculación con el egreso registrado
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0), -- Monto total de la cuota pagada
  principal_component DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (principal_component >= 0), -- Fracción amortizada del capital
  interest_component DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (interest_component >= 0), -- Fracción de intereses del periodo
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de RLS para préstamos
DROP POLICY IF EXISTS "Users manage own loans" ON loans;
CREATE POLICY "Users manage own loans" ON loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Crear políticas de RLS para pagos de préstamos
DROP POLICY IF EXISTS "Users manage own loan_payments" ON loan_payments;
CREATE POLICY "Users manage own loan_payments" ON loan_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Trigger para actualizar el campo 'updated_at' en préstamos automáticamente
DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;
CREATE TRIGGER update_loans_updated_at 
  BEFORE UPDATE ON loans 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
