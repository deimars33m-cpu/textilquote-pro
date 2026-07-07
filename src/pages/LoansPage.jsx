import { useState, useEffect, useMemo } from 'react'
import { Card, Input, Button, AlertBanner, Modal, Select } from '@/components/ui/index.jsx'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

const LOAN_TYPES = [
  { id: 'banco', label: 'Bancario', icon: 'account_balance', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  { id: 'privado', label: 'Privado', icon: 'person', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
]

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { id: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
  { id: 'qr', label: 'QR', icon: 'qr_code_scanner' },
  { id: 'tarjeta', label: 'Tarjeta', icon: 'credit_card' }
]

export default function LoansPage() {
  const { user } = useAuth()
  
  // Data State
  const [loans, setLoans] = useState([])
  const [payments, setPayments] = useState([])
  const [creditors, setCreditors] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // UI Control State
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [activeTab, setActiveTab] = useState('activo') // 'activo' | 'pagado'
  const [searchQuery, setSearchQuery] = useState('')

  // Forms State
  const [newLoan, setNewLoan] = useState({
    creditor_id: '',
    new_creditor_name: '',
    loan_type: 'banco',
    principal_amount: '',
    interest_rate: '',
    interest_period: 'mensual',
    term_months: '',
    start_date: new Date().toISOString().split('T')[0],
    monthly_payment: '',
    notes: ''
  })

  const [newPayment, setNewPayment] = useState({
    amount: '',
    principal_component: '',
    interest_component: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'transferencia',
    notes: ''
  })

  // Fetch Data
  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    setErrorMsg('')
    try {
      // 1. Fetch Loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false })

      if (loansError) throw loansError

      // 2. Fetch Payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('*')
        .order('payment_date', { ascending: false })

      if (paymentsError) throw paymentsError

      // 3. Fetch Creditors (terceros with role 'acreedor')
      const { data: creditorsData, error: creditorsError } = await supabase
        .from('terceros')
        .select('*')
        .eq('role', 'acreedor')
        .order('name', { ascending: true })

      if (creditorsError) throw creditorsError

      setLoans(loansData || [])
      setPayments(paymentsData || [])
      setCreditors(creditorsData || [])

      // Update selected loan reference if active
      if (selectedLoan) {
        const updated = loansData.find(l => l.id === selectedLoan.id)
        setSelectedLoan(updated || null)
      }
    } catch (err) {
      console.error("Error loading loan data:", err)
      setErrorMsg('No se pudieron cargar los datos de préstamos: ' + (err.message || 'Por favor reintenta.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  // --- Calculations & Memos ---
  const loanStats = useMemo(() => {
    const stats = {
      activeCount: 0,
      totalBorrowed: 0,
      totalPaidPrincipal: 0,
      totalPaidInterest: 0,
      remainingDebt: 0,
      expectedMonthlyTotal: 0
    }

    loans.forEach(loan => {
      const loanPayments = payments.filter(p => p.loan_id === loan.id)
      const paidPrincipal = loanPayments.reduce((sum, p) => sum + Number(p.principal_component || 0), 0)
      const paidInterest = loanPayments.reduce((sum, p) => sum + Number(p.interest_component || 0), 0)
      
      stats.totalBorrowed += Number(loan.principal_amount || 0)
      stats.totalPaidPrincipal += paidPrincipal
      stats.totalPaidInterest += paidInterest

      if (loan.status === 'activo') {
        stats.activeCount++
        stats.remainingDebt += Math.max(0, Number(loan.principal_amount || 0) - paidPrincipal)
        stats.expectedMonthlyTotal += Number(loan.monthly_payment || 0)
      }
    })

    return stats
  }, [loans, payments])

  // Processed individual loan metrics for list and details
  const loansWithMetrics = useMemo(() => {
    return loans.map(loan => {
      const loanPayments = payments.filter(p => p.loan_id === loan.id)
      const paidPrincipal = loanPayments.reduce((sum, p) => sum + Number(p.principal_component || 0), 0)
      const paidInterest = loanPayments.reduce((sum, p) => sum + Number(p.interest_component || 0), 0)
      const remainingPrincipal = Math.max(0, Number(loan.principal_amount || 0) - paidPrincipal)
      const progressPercent = Number(loan.principal_amount) > 0 
        ? Math.min(100, Math.round((paidPrincipal / Number(loan.principal_amount)) * 100))
        : 0

      return {
        ...loan,
        paidPrincipal,
        paidInterest,
        remainingPrincipal,
        progressPercent,
        paymentsList: loanPayments
      }
    })
  }, [loans, payments])

  const filteredLoans = useMemo(() => {
    return loansWithMetrics.filter(loan => {
      const matchesTab = loan.status === activeTab
      const matchesSearch = loan.creditor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (loan.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [loansWithMetrics, activeTab, searchQuery])

  // --- Handlers ---
  const handleCreateLoan = async (e) => {
    e.preventDefault()
    
    const isNewCreditor = newLoan.creditor_id === 'new' || !newLoan.creditor_id
    const finalCreditorName = isNewCreditor ? newLoan.new_creditor_name?.trim() : ''
    
    if ((isNewCreditor && !finalCreditorName) || !newLoan.principal_amount || !newLoan.monthly_payment) {
      setErrorMsg('Por favor completa los campos requeridos (*).')
      return
    }

    setSaving(true)
    setErrorMsg('')
    try {
      let creditorId = newLoan.creditor_id
      let creditorName = ''

      if (isNewCreditor) {
        // Create the creditor in terceros table first
        const { data: thirdData, error: thirdError } = await supabase
          .from('terceros')
          .insert({
            user_id: user.id,
            name: finalCreditorName,
            role: 'acreedor',
            client_type: 'acreedor'
          })
          .select()

        if (thirdError) throw thirdError
        creditorId = thirdData[0].id
        creditorName = thirdData[0].name
      } else {
        const selected = creditors.find(c => c.id === newLoan.creditor_id)
        if (!selected) throw new Error('Acreedor seleccionado no encontrado.')
        creditorId = selected.id
        creditorName = selected.name
      }

      const { data, error } = await supabase
        .from('loans')
        .insert({
          user_id: user.id,
          creditor_id: creditorId,
          creditor_name: creditorName,
          loan_type: newLoan.loan_type,
          principal_amount: Number(newLoan.principal_amount),
          interest_rate: Number(newLoan.interest_rate || 0),
          interest_period: newLoan.interest_period,
          term_months: Number(newLoan.term_months || 12),
          start_date: newLoan.start_date,
          monthly_payment: Number(newLoan.monthly_payment),
          notes: newLoan.notes,
          status: 'activo'
        })
        .select()

      if (error) throw error

      setSuccessMsg('Préstamo registrado exitosamente.')
      setShowAddModal(false)
      // Reset form
      setNewLoan({
        creditor_id: '',
        new_creditor_name: '',
        loan_type: 'banco',
        principal_amount: '',
        interest_rate: '',
        interest_period: 'mensual',
        term_months: '',
        start_date: new Date().toISOString().split('T')[0],
        monthly_payment: '',
        notes: ''
      })
      await fetchData()
    } catch (err) {
      console.error("Error creating loan:", err)
      setErrorMsg('No se pudo registrar el préstamo: ' + (err.message || 'Revisa tu conexión.'))
    } finally {
      setSaving(false)
    }
  }

  // Smart amortisation calculator helper
  const handleAmountChange = (val) => {
    const totalPay = Number(val) || 0
    if (!selectedLoan) return

    // Suggest interest component based on current outstanding principal
    const outstanding = selectedLoan.remainingPrincipal
    const rateFraction = (Number(selectedLoan.interest_rate || 0) / 100)
    
    let suggestedInterest = 0
    if (selectedLoan.interest_period === 'mensual') {
      suggestedInterest = Math.min(totalPay, outstanding * rateFraction)
    } else {
      // Annual rate divided by 12
      suggestedInterest = Math.min(totalPay, outstanding * (rateFraction / 12))
    }

    // Round to 2 decimals
    suggestedInterest = Math.round(suggestedInterest * 100) / 100
    const suggestedPrincipal = Math.min(outstanding, Math.max(0, totalPay - suggestedInterest))

    setNewPayment(prev => ({
      ...prev,
      amount: val,
      interest_component: suggestedInterest.toString(),
      principal_component: suggestedPrincipal.toString()
    }))
  }

  const handleCreatePayment = async (e) => {
    e.preventDefault()
    if (!newPayment.amount || !newPayment.principal_component || !newPayment.interest_component) {
      setErrorMsg('Por favor completa todos los importes del pago.')
      return
    }

    const payAmount = Number(newPayment.amount)
    const principalComp = Number(newPayment.principal_component)
    const interestComp = Number(newPayment.interest_component)

    if (Math.abs(payAmount - (principalComp + interestComp)) > 0.05) {
      setErrorMsg('La suma del Capital y los Intereses debe ser igual al Monto Total.')
      return
    }

    setSaving(true)
    setErrorMsg('')
    try {
      // 1. Create financial transaction in 'expenses'
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          date: newPayment.payment_date,
          category_key: 'GASTOS_FIJOS',
          category_label: 'GASTOS FIJOS',
          subcategory: 'Financieros',
          specific_item: `Amortización Préstamo - ${selectedLoan.creditor_name}`,
          description: `Cuota préstamo. Amortización Capital: Bs ${formatCurrency(principalComp, 0)} | Intereses: Bs ${formatCurrency(interestComp, 0)}. ${newPayment.notes || ''}`,
          quantity: 1,
          unit_price: payAmount,
          amount: payAmount,
          payment_method: newPayment.payment_method,
          provider_id: selectedLoan.creditor_id
        })
        .select()

      if (expError) throw expError
      const expenseId = expData[0].id

      // 2. Register loan payment linked to the expense
      const { error: payError } = await supabase
        .from('loan_payments')
        .insert({
          user_id: user.id,
          loan_id: selectedLoan.id,
          expense_id: expenseId,
          payment_date: newPayment.payment_date,
          amount: payAmount,
          principal_component: principalComp,
          interest_component: interestComp,
          notes: newPayment.notes
        })

      if (payError) throw payError

      // 3. Check if loan principal is fully paid
      const updatedPaidPrincipal = selectedLoan.paidPrincipal + principalComp
      const isPaid = updatedPaidPrincipal >= Number(selectedLoan.principal_amount)
      
      if (isPaid) {
        const { error: updateError } = await supabase
          .from('loans')
          .update({ status: 'pagado' })
          .eq('id', selectedLoan.id)

        if (updateError) throw updateError
      }

      setSuccessMsg('Cuota de préstamo amortizada y registrada como egreso financiero.')
      setShowPaymentModal(false)
      
      // Reset form
      setNewPayment({
        amount: '',
        principal_component: '',
        interest_component: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'transferencia',
        notes: ''
      })
      await fetchData()
    } catch (err) {
      console.error("Error creating payment:", err)
      setErrorMsg('No se pudo procesar la amortización: ' + (err.message || 'Verifica la base de datos.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLoan = async (loanId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este préstamo? Esto borrará también sus amortizaciones (los registros de egresos se conservarán).')) return
    
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanId)

      if (error) throw error

      setSuccessMsg('Préstamo eliminado de la base de datos.')
      setSelectedLoan(null)
      await fetchData()
    } catch (err) {
      console.error("Error deleting loan:", err)
      setErrorMsg('No se pudo borrar el préstamo.')
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">account_balance</span>
            Gestión y Seguimiento de Préstamos
          </h1>
          <p className="text-xs text-on-surface-variant">Registra financiamientos, desglosa cuotas y enlaza egresos directamente con tu caja.</p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)} 
          className="btn-3d bg-primary hover:bg-primary/95 text-white flex items-center gap-1.5 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Registrar Préstamo
        </Button>
      </div>

      {/* Messages */}
      {errorMsg && (
        <AlertBanner type="error" onClose={() => setErrorMsg('')}>
          {errorMsg}
        </AlertBanner>
      )}
      {successMsg && (
        <AlertBanner type="success" onClose={() => setSuccessMsg('')}>
          {successMsg}
        </AlertBanner>
      )}

      {/* Dashboard KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Remaining Active Debt */}
        <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(239,68,68,0.05),transparent)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">Deuda Activa Pendiente</span>
            <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-400 text-[16px]">money_off</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-black text-white leading-none block">
              {formatCurrency(loanStats.remainingDebt)}
            </span>
            <p className="text-[9px] text-on-surface-variant mt-1">{loanStats.activeCount} préstamos activos vigentes.</p>
          </div>
        </div>

        {/* KPI 2: Total Borrowed */}
        <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(56,189,248,0.05),transparent)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">Total Financiado</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-sky-400 text-[16px]">savings</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-black text-white leading-none block">
              {formatCurrency(loanStats.totalBorrowed)}
            </span>
            <p className="text-[9px] text-on-surface-variant mt-1">Capital total inyectado históricamente.</p>
          </div>
        </div>

        {/* KPI 3: Total Amortized */}
        <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.05),transparent)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">Total Capital Devuelto</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-400 text-[16px]">price_check</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-black text-white leading-none block">
              {formatCurrency(loanStats.totalPaidPrincipal)}
            </span>
            <p className="text-[9px] text-on-surface-variant mt-1">Interés pagado acumulado: {formatCurrency(loanStats.totalPaidInterest)}</p>
          </div>
        </div>

        {/* KPI 4: Expected Monthly Quotas */}
        <div className="neu-surface p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(245,158,11,0.05),transparent)] pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider">Presupuesto Mensual Cuotas</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-400 text-[16px]">event_repeat</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-black text-white leading-none block">
              {formatCurrency(loanStats.expectedMonthlyTotal)}
            </span>
            <p className="text-[9px] text-on-surface-variant mt-1">Suma de cuotas a pagar este mes.</p>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Loans list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
            {/* Filter Tabs */}
            <div className="flex bg-surface rounded-xl p-1 border border-outline-variant/30 shrink-0">
              <button
                onClick={() => { setActiveTab('activo'); setSelectedLoan(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  activeTab === 'activo'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Activos ({loansWithMetrics.filter(l => l.status === 'activo').length})
              </button>
              <button
                onClick={() => { setActiveTab('pagado'); setSelectedLoan(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  activeTab === 'pagado'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Pagados ({loansWithMetrics.filter(l => l.status === 'pagado').length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:max-w-[240px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant/60 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Buscar acreedor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-outline-variant/40 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary/50 transition-colors h-[34px]"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-2 border-surface-container-high border-t-primary rounded-full animate-spin mb-2" />
              <p className="text-xs text-on-surface-variant italic">Buscando financiamientos...</p>
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="neu-surface p-12 text-center rounded-2xl">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 mb-2 block">account_balance</span>
              <p className="text-xs text-on-surface-variant italic">No se encontraron préstamos en esta pestaña.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredLoans.map(loan => {
                const isSelected = selectedLoan?.id === loan.id
                const lType = LOAN_TYPES.find(t => t.id === loan.loan_type)

                return (
                  <div
                    key={loan.id}
                    onClick={() => setSelectedLoan(loan)}
                    className={`text-left p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[170px] ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-[0_0_12px_rgba(255,92,0,0.1)] scale-[1.01]'
                        : 'bg-surface-container-low border-outline-variant/30 hover:border-primary/45 hover:bg-white/[0.01]'
                    }`}
                  >
                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider font-mono ${lType?.color}`}>
                          {lType?.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase ${
                          loan.status === 'activo'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-on-surface-variant/70 bg-white/5'
                        }`}>
                          {loan.status}
                        </span>
                      </div>

                      {/* Creditor Title */}
                      <h4 className="text-sm font-bold text-white leading-tight line-clamp-1">{loan.creditor_name}</h4>
                      <p className="text-[10px] text-on-surface-variant/80 mt-0.5">Fecha inicio: {formatDate(loan.start_date)}</p>

                      {/* Deuda / Capital */}
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-on-surface-variant/75 font-mono block">Monto Original</span>
                          <span className="font-mono text-xs text-white font-bold">{formatCurrency(loan.principal_amount)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] uppercase tracking-wider text-on-surface-variant/75 font-mono block">Deuda Restante</span>
                          <span className="font-mono text-xs text-white font-bold">{formatCurrency(loan.remainingPrincipal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 pt-3 border-t border-outline-variant/20">
                      <div className="flex justify-between items-center text-[9px] font-mono text-on-surface-variant mb-1">
                        <span>Reembolso Capital</span>
                        <span className="font-bold text-white">{loan.progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden p-[1px] border border-white/[0.02]">
                        <div
                          className="h-full rounded-full bg-primary shadow-[0_0_6px_rgba(255,92,0,0.4)] transition-all duration-500"
                          style={{ width: `${loan.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Loan Details / Actions Panel */}
        <div className="space-y-6">
          {selectedLoan ? (
            <div className="neu-surface p-5 rounded-2xl border border-outline-variant/30 text-left relative overflow-hidden space-y-5 animate-fade-in">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,92,0,0.02),transparent)] pointer-events-none" />

              {/* Title & Actions */}
              <div className="flex items-start justify-between pb-3.5 border-b border-outline-variant/30 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{selectedLoan.creditor_name}</h3>
                  <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-wider">Ficha de Seguimiento</span>
                </div>
                <button
                  onClick={() => handleDeleteLoan(selectedLoan.id)}
                  className="p-1.5 hover:bg-error-container/20 text-on-surface-variant hover:text-error rounded-xl transition-colors shrink-0"
                  title="Eliminar Préstamo"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>

              {/* Progress Detail */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div className="flex justify-between items-center text-[10px] font-mono text-on-surface-variant mb-1.5">
                  <span>Progreso del Reembolso</span>
                  <span className="font-bold text-primary">{selectedLoan.progressPercent}% pagado</span>
                </div>
                <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden p-[1px] border border-white/[0.02] mb-3">
                  <div
                    className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(255,92,0,0.4)]"
                    style={{ width: `${selectedLoan.progressPercent}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[8px] text-on-surface-variant block uppercase">Capital Pagado</span>
                    <span className="text-white font-bold">{formatCurrency(selectedLoan.paidPrincipal)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-on-surface-variant block uppercase">Saldo Pendiente</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(selectedLoan.remainingPrincipal)}</span>
                  </div>
                </div>
              </div>

              {/* Financial parameters grid */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-mono">
                <div>
                  <span className="text-[8px] text-on-surface-variant block uppercase">Tasa de Interés</span>
                  <span className="text-white font-bold">{selectedLoan.interest_rate}% ({selectedLoan.interest_period})</span>
                </div>
                <div>
                  <span className="text-[8px] text-on-surface-variant block uppercase">Plazo Contratado</span>
                  <span className="text-white font-bold">{selectedLoan.term_months} meses</span>
                </div>
                <div>
                  <span className="text-[8px] text-on-surface-variant block uppercase">Cuota Mensual Fija</span>
                  <span className="text-white font-bold">{formatCurrency(selectedLoan.monthly_payment)}</span>
                </div>
                <div>
                  <span className="text-[8px] text-on-surface-variant block uppercase">Total Interés Pagado</span>
                  <span className="text-amber-400 font-bold">{formatCurrency(selectedLoan.paidInterest)}</span>
                </div>
              </div>

              {selectedLoan.notes && (
                <div className="text-xs p-3.5 bg-surface-container-low/50 rounded-xl border border-outline-variant/10 text-on-surface-variant italic leading-relaxed">
                  {selectedLoan.notes}
                </div>
              )}

              {/* Add Payment Action Button */}
              {selectedLoan.status === 'activo' && (
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  className="btn-3d w-full bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-1 text-xs py-2 rounded-xl"
                >
                  <span className="material-symbols-outlined text-[16px]">price_check</span>
                  Registrar Pago de Cuota (Amortizar)
                </Button>
              )}

              {/* Amortization Payment History list */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold text-on-surface-variant uppercase tracking-wider block">Historial de Pagos</span>
                
                {selectedLoan.paymentsList.length === 0 ? (
                  <p className="text-[10px] text-on-surface-variant italic py-3 text-center bg-surface-container-low/30 rounded-xl border border-outline-variant/10">No se han registrado pagos para este préstamo.</p>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {selectedLoan.paymentsList.map(pay => (
                      <div key={pay.id} className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/10 flex items-center justify-between gap-2 text-[11px] font-mono">
                        <div>
                          <span className="text-white font-bold block">{formatCurrency(pay.amount)}</span>
                          <span className="text-[9px] text-on-surface-variant/70 block">{formatDate(pay.payment_date)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-on-surface-variant block">Cap: {formatCurrency(pay.principal_component)}</span>
                          <span className="text-[9px] text-amber-500/80 block">Int: {formatCurrency(pay.interest_component)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="neu-surface p-8 text-center rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center min-h-[300px]">
              <span className="material-symbols-outlined text-[36px] text-on-surface-variant/20 mb-2 block animate-pulse">info</span>
              <h4 className="text-sm font-bold text-on-surface-variant/80">Selecciona un Préstamo</h4>
              <p className="text-xs text-on-surface-variant/60 mt-1 max-w-[200px] mx-auto">Haz clic en cualquier préstamo para ver el detalle de amortización y registrar pagos.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Add New Loan */}
      {showAddModal && (
        <Modal 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)}
          title="Registrar Nuevo Préstamo"
        >
          <form onSubmit={handleCreateLoan} className="space-y-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Acreedor *"
                value={newLoan.creditor_id}
                onChange={e => setNewLoan(prev => ({ ...prev, creditor_id: e.target.value }))}
                options={[
                  { id: '', label: 'Seleccionar...' },
                  ...creditors.map(c => ({ id: c.id, label: c.name })),
                  { id: 'new', label: '+ Registrar Nuevo...' }
                ]}
              />
              
              <Select
                label="Tipo de Préstamo"
                value={newLoan.loan_type}
                onChange={e => setNewLoan(prev => ({ ...prev, loan_type: e.target.value }))}
                options={LOAN_TYPES}
              />
            </div>

            {(newLoan.creditor_id === 'new' || !newLoan.creditor_id) && (
              <Input
                label="Nombre del Nuevo Acreedor *"
                type="text"
                placeholder="Ej. Banco Mercantil o Prestamista Privado"
                value={newLoan.new_creditor_name}
                onChange={e => setNewLoan(prev => ({ ...prev, new_creditor_name: e.target.value }))}
                required
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Monto Principal (Préstamo) *"
                type="number"
                step="0.01"
                placeholder="Bs 0.00"
                value={newLoan.principal_amount}
                onChange={e => setNewLoan(prev => ({ ...prev, principal_amount: e.target.value }))}
                required
              />

              <Input
                label="Cuota Mensual Pactada *"
                type="number"
                step="0.01"
                placeholder="Bs 0.00"
                value={newLoan.monthly_payment}
                onChange={e => setNewLoan(prev => ({ ...prev, monthly_payment: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Tasa Interés (%)"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newLoan.interest_rate}
                onChange={e => setNewLoan(prev => ({ ...prev, interest_rate: e.target.value }))}
              />

              <Select
                label="Frecuencia Interés"
                value={newLoan.interest_period}
                onChange={e => setNewLoan(prev => ({ ...prev, interest_period: e.target.value }))}
                options={[
                  { id: 'mensual', label: 'Mensual' },
                  { id: 'anual', label: 'Anual' }
                ]}
              />

              <Input
                label="Plazo (Meses)"
                type="number"
                placeholder="12"
                value={newLoan.term_months}
                onChange={e => setNewLoan(prev => ({ ...prev, term_months: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1">
              <Input
                label="Fecha de Desembolso"
                type="date"
                value={newLoan.start_date}
                onChange={e => setNewLoan(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase font-mono">Notas del Préstamo</label>
              <textarea
                value={newLoan.notes}
                onChange={e => setNewLoan(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Detalla garantías, número de cuenta bancaria o acuerdos particulares..."
                className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition-colors h-[70px] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/30">
              <Button type="button" onClick={() => setShowAddModal(false)} className="btn-3d-raised text-on-surface-variant hover:text-white">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="btn-3d bg-primary hover:bg-primary/95 text-white">
                {saving ? 'Registrando...' : 'Registrar Préstamo'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Register Payment / Amortise */}
      {showPaymentModal && selectedLoan && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title={`Registrar Pago: ${selectedLoan.creditor_name}`}
        >
          <form onSubmit={handleCreatePayment} className="space-y-4 text-left">
            
            {/* Outstandings warning */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
              <span className="text-on-surface-variant">Deuda Restante:</span>
              <span className="text-white font-bold">{formatCurrency(selectedLoan.remainingPrincipal)}</span>
            </div>

            <div className="grid grid-cols-1">
              <Input
                label="Monto Total Pagado (Bs) *"
                type="number"
                step="0.01"
                placeholder="Bs 0.00"
                value={newPayment.amount}
                onChange={e => handleAmountChange(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amortización a Capital (Bs) *"
                type="number"
                step="0.01"
                placeholder="Bs 0.00"
                value={newPayment.principal_component}
                onChange={e => setNewPayment(prev => ({ ...prev, principal_component: e.target.value }))}
                required
              />

              <Input
                label="Pago de Intereses (Bs) *"
                type="number"
                step="0.01"
                placeholder="Bs 0.00"
                value={newPayment.interest_component}
                onChange={e => setNewPayment(prev => ({ ...prev, interest_component: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha de Pago"
                type="date"
                value={newPayment.payment_date}
                onChange={e => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
              />

              <Select
                label="Método de Pago"
                value={newPayment.payment_method}
                onChange={e => setNewPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                options={PAYMENT_METHODS}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase font-mono">Notas del Pago</label>
              <textarea
                value={newPayment.notes}
                onChange={e => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ej. Transferencia comprobante #10928 o pago de cuota número 3..."
                className="w-full bg-surface-container border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface outline-none focus:border-primary/50 transition-colors h-[60px] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/30">
              <Button type="button" onClick={() => setShowPaymentModal(false)} className="btn-3d-raised text-on-surface-variant hover:text-white">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="btn-3d bg-primary hover:bg-primary/95 text-white">
                {saving ? 'Registrando...' : 'Registrar Amortización'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
