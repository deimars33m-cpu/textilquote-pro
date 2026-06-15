import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const DEFAULT_SETTINGS = {
  company_name: 'Mi Empresa Textil',
  currency: 'Bs',
  tax_percentage: 0,
  min_margin: 15,
  default_margin: 30,
  monthly_capacity_units: 1000,
  monthly_capacity_hours: 160,
  quote_validity_days: 15,
}

export function useCompanySettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error)
    }

    if (data) {
      setSettings(data)
    } else {
      // Create default settings for new user
      const { data: newSettings, error: createError } = await supabase
        .from('company_settings')
        .insert({ ...DEFAULT_SETTINGS, user_id: user.id })
        .select()
        .single()

      if (!createError && newSettings) {
        setSettings(newSettings)
      }
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updates) => {
    if (!settings.id) return

    const { data, error } = await supabase
      .from('company_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', settings.id)
      .select()
      .single()

    if (error) throw error
    setSettings(data)
    return data
  }

  return { settings, loading, updateSettings, refresh: fetchSettings }
}
