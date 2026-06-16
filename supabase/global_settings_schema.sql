-- ==============================================================
-- TextilQuote Pro - Global Settings Database Schema
-- PostgreSQL / Supabase
-- ==============================================================

CREATE TABLE IF NOT EXISTS global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  settings JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si existen
DROP POLICY IF EXISTS "Users manage own global_settings" ON global_settings;

-- Políticas de RLS
CREATE POLICY "Users manage own global_settings" ON global_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Función y trigger para updated_at
DROP TRIGGER IF EXISTS update_global_settings_updated_at ON global_settings;
CREATE TRIGGER update_global_settings_updated_at 
  BEFORE UPDATE ON global_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
