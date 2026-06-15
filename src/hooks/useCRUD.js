import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

/**
 * Hook genérico para operaciones CRUD con Supabase
 * @param {string} table - Nombre de la tabla
 * @param {object} options - Opciones adicionales
 */
export function useCRUD(table, options = {}) {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const {
    orderBy = 'created_at',
    orderAsc = false,
    select = '*',
    filters = {},
  } = options

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from(table)
        .select(select)
        .eq('user_id', user.id)
        .order(orderBy, { ascending: orderAsc })

      // Apply additional filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value)
        }
      })

      const { data: result, error: fetchError } = await query

      if (fetchError) throw fetchError
      setData(result || [])
    } catch (err) {
      console.error(`Error fetching ${table}:`, err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, table, select, orderBy, orderAsc, JSON.stringify(filters)])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const create = async (record) => {
    if (!user) throw new Error('Usuario no autenticado')
    const { data: result, error: createError } = await supabase
      .from(table)
      .insert({ ...record, user_id: user.id })
      .select()
      .single()

    if (createError) throw createError
    setData(prev => [result, ...prev])
    return result
  }

  const update = async (id, updates) => {
    const { data: result, error: updateError } = await supabase
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError
    setData(prev => prev.map(item => item.id === id ? result : item))
    return result
  }

  const remove = async (id) => {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    setData(prev => prev.filter(item => item.id !== id))
  }

  return {
    data,
    loading,
    error,
    create,
    update,
    remove,
    refresh: fetchData,
  }
}
