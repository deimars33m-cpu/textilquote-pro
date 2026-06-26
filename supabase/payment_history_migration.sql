-- ==============================================================
-- TextilQuote Pro - Payment History JSONB Migration
-- ==============================================================

-- Add payment_history to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;

-- Add payment_history to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;
