import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

/**
 * Hook genérico para operaciones CRUD con Supabase optimizado con React Query
 * @param {string} table - Nombre de la tabla
 * @param {object} options - Opciones adicionales
 */
export function useCRUD(table, options = {}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    orderBy = 'created_at',
    orderAsc = false,
    select = '*',
    filters = {},
  } = options

  // Serializar filtros para incluirlos en la Query Key y evitar recargas infinitas si cambia la referencia
  const serializedFilters = JSON.stringify(filters)

  const queryKey = [table, user?.id, { orderBy, orderAsc, select, serializedFilters }]

  // Query para obtener los datos con cache
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return []
      let q = supabase
        .from(table)
        .select(select)
        .eq('user_id', user.id)
        .order(orderBy, { ascending: orderAsc })

      // Aplicar filtros adicionales
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          q = q.eq(key, value)
        }
      })

      const { data, error: fetchError } = await q
      if (fetchError) throw fetchError
      return data || []
    },
    enabled: !!user,
  })

  // Mutación para crear registros
  const createMutation = useMutation({
    mutationFn: async (record) => {
      if (!user) throw new Error('Usuario no autenticado')
      const { data, error } = await supabase
        .from(table)
        .insert({ ...record, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
    },
  })

  // Mutación para actualizar registros
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from(table)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
    },
  })

  // Mutación para eliminar registros
  const removeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
    },
  })

  // Wrapper para mantener la firma original update(id, updates)
  const handleUpdate = useCallback(async (id, updates) => {
    return updateMutation.mutateAsync({ id, updates })
  }, [updateMutation])

  return {
    data: query.data || [],
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    create: createMutation.mutateAsync,
    update: handleUpdate,
    remove: removeMutation.mutateAsync,
    refresh: query.refetch,
  }
}

