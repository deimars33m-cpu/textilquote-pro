import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  Card, SearchInput, Button, StatusBadge,
  LoadingSpinner, EmptyState, Select
} from '@/components/ui/index.jsx'
import { formatCurrency, formatPercent, formatDate, formatQuoteNumber } from '@/lib/formatters'

export default function QuoteHistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  useEffect(() => {
    if (user) {
      fetchQuotes()
    }
  }, [user])

  async function fetchQuotes() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          terceros (name),
          quote_items (product_name, quantity, total_price, real_margin)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setQuotes(data || [])
    } catch (err) {
      console.error('Error fetching quotes:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const clientName = q.terceros?.name || ''
      const quoteNum = formatQuoteNumber(q.quote_number)
      const productName = q.quote_items?.[0]?.product_name || ''
      
      const matchesSearch = 
        clientName.toLowerCase().includes(search.toLowerCase()) ||
        quoteNum.toLowerCase().includes(search.toLowerCase()) ||
        productName.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'todos' || q.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [quotes, search, statusFilter])

  const statusCounts = useMemo(() => {
    const counts = { todos: quotes.length }
    quotes.forEach(q => {
      counts[q.status] = (counts[q.status] || 0) + 1
    })
    return counts
  }, [quotes])

  const statusOptions = [
    { value: 'todos', label: `Todos (${statusCounts.todos || 0})` },
    { value: 'borrador', label: `Borrador (${statusCounts.borrador || 0})` },
    { value: 'enviada', label: `Enviada (${statusCounts.enviada || 0})` },
    { value: 'aprobada', label: `Aprobada (${statusCounts.aprobada || 0})` },
    { value: 'rechazada', label: `Rechazada (${statusCounts.rechazada || 0})` },
    { value: 'vencida', label: `Vencida (${statusCounts.vencida || 0})` }
  ]

  if (loading) return <LoadingSpinner />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">Historial de Cotizaciones</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Consulta y gestiona todas tus cotizaciones de producción textil
          </p>
        </div>
        <Button onClick={() => navigate('/quotes/new')}>
          <span className="material-symbols-outlined text-[18px]">calculate</span>
          Nueva Cotización
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente, producto o N°..."
          />
        </div>
        
        <div className="w-full md:w-64">
          <Select
            label="Estado"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Filtrar por estado"
          />
        </div>
      </div>

      {/* Table & Cards */}
      {filteredQuotes.length === 0 ? (
        <EmptyState
          icon="description"
          title="Sin cotizaciones"
          message={search || statusFilter !== 'todos' ? 'No se encontraron cotizaciones con los filtros actuales.' : 'Calcula tu primera cotización textil para verla aquí.'}
          action={!(search || statusFilter !== 'todos') && (
            <Button onClick={() => navigate('/quotes/new')}>
              <span className="material-symbols-outlined text-[18px]">calculate</span>
              Iniciar Cotización
            </Button>
          )}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full zebra-table">
              <thead>
                <tr className="bg-surface-container-high">
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">N°</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Cliente</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Producto</th>
                  <th className="text-left px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Fecha</th>
                  <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Cant.</th>
                  <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Total</th>
                  <th className="text-right px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Margen</th>
                  <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Estado</th>
                  <th className="text-center px-4 py-3 font-mono text-label-caps uppercase tracking-wider text-on-surface-variant">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((q) => {
                  const item = q.quote_items?.[0]
                  return (
                    <tr key={q.id} className="border-t border-outline-variant/30 hover:bg-surface-container/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-primary font-semibold">
                        {formatQuoteNumber(q.quote_number)}
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface font-medium">
                        {q.terceros?.name || 'Cliente general'}
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">
                        {item?.product_name || '—'}
                        {q.quote_items?.length > 1 && (
                          <span className="text-xs text-primary ml-1 font-mono">
                            +{q.quote_items.length - 1} item(s)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant font-mono">
                        {formatDate(q.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-on-surface-variant font-mono">
                        {item?.quantity || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-on-surface font-mono">
                        {formatCurrency(q.total_price)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-tertiary">
                        {formatPercent(q.real_margin)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/quotes/${q.id}`)}
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            Ver
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-outline-variant/30 text-xs text-on-surface-variant font-mono">
            {filteredQuotes.length} cotización{filteredQuotes.length !== 1 ? 'es' : ''} encontrada{filteredQuotes.length !== 1 ? 's' : ''}
          </div>
        </Card>
      )}
    </div>
  )
}
