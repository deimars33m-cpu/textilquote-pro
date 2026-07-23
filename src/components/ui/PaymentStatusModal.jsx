import { useState, useEffect } from 'react'
import { Modal, Input, Select, Button } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/formatters'

export default function PaymentStatusModal({ isOpen, onClose, entityType, entityData, onSave }) {
  const [history, setHistory] = useState([])
  const [newAmount, setNewAmount] = useState('')
  const [newMethod, setNewMethod] = useState('efectivo')
  const [newNote, setNewNote] = useState('')
  const [isDeleting, setIsDeleting] = useState(null)
  
  const paymentMethods = [
    { value: 'efectivo', label: 'Efectivo / Caja' },
    { value: 'transferencia', label: 'Transferencia / Banco' },
    { value: 'qr', label: 'Código QR' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'otro', label: 'Otro' }
  ]

  useEffect(() => {
    if (isOpen && entityData) {
      setHistory(Array.isArray(entityData.payment_history) ? entityData.payment_history : [])
      setIsDeleting(null)
      
      const total = Number(entityData.total_amount || entityData.amount || 0)
      const paid = Number(entityData.paid_amount || entityData.advance_amount || 0)
      if (total > paid) {
        setNewAmount((total - paid).toFixed(2))
      } else {
        setNewAmount('')
      }
      setNewNote('')
      setNewMethod('efectivo')
    }
  }, [isOpen, entityData])

  if (!isOpen || !entityData) return null

  const totalAmount = Number(entityData.total_amount || entityData.amount || 0)
  const paidAmount = history.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = totalAmount - paidAmount

  const handleAddPayment = () => {
    const amount = Number(newAmount)
    if (isNaN(amount) || amount <= 0) {
      alert("Ingrese un monto válido")
      return
    }
    
    const payment = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      amount,
      method: newMethod,
      note: newNote.trim()
    }
    
    const updatedHistory = [...history, payment]
    setHistory(updatedHistory)
    setNewAmount((totalAmount - (paidAmount + amount)).toFixed(2))
    setNewNote('')
    onSave(updatedHistory)
  }

  const handleDeleteClick = (id) => {
    setIsDeleting(id)
  }

  const confirmDelete = (id) => {
    const updatedHistory = history.filter(p => p.id !== id)
    setHistory(updatedHistory)
    setIsDeleting(null)
    onSave(updatedHistory)
  }

  const title = entityType === 'order' 
    ? `Pagos del Pedido ${entityData.order_number}`
    : `Pagos: ${entityData.specific_item || entityData.category_label}`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-6">
        
        {/* Resumen Financiero */}
        <div className="grid grid-cols-3 gap-3 bg-surface-container p-4 rounded-xl border border-outline-variant/30">
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Total</p>
            <p className="text-lg font-bold font-mono text-on-surface">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Abonado</p>
            <p className="text-lg font-bold font-mono text-emerald-400">{formatCurrency(paidAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Saldo</p>
            <p className={`text-lg font-bold font-mono ${balance > 0 ? 'text-red-400' : 'text-primary'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {/* Historial de Pagos */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">history</span>
            Historial Cronológico
          </h4>
          
          {history.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic p-4 text-center bg-surface-container-low rounded-lg border border-outline-variant/20">
              No hay pagos registrados
            </p>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
              {[...history].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((payment, i) => (
                <div key={payment.id} className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/30 flex justify-between items-center group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-emerald-400">{formatCurrency(payment.amount)}</span>
                      <span className="text-[10px] text-on-surface-variant px-1.5 py-0.5 rounded bg-surface border border-outline-variant/30">{payment.method}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                      <span className="font-mono">{formatDate(payment.date)}</span>
                      {payment.note && <span className="truncate">- {payment.note}</span>}
                    </div>
                  </div>
                  
                  {isDeleting === payment.id ? (
                    <div className="flex items-center gap-2 ml-3 animate-fade-in">
                      <span className="text-[10px] text-red-400 font-bold whitespace-nowrap">¿Eliminar?</span>
                      <button onClick={() => confirmDelete(payment.id)} className="w-7 h-7 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      </button>
                      <button onClick={() => setIsDeleting(null)} className="w-7 h-7 rounded bg-surface border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleDeleteClick(payment.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all ml-2"
                      title="Eliminar pago"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nuevo Pago */}
        {balance > 0 && (
          <div className="bg-surface-container p-4 rounded-xl border border-primary/20 space-y-4">
            <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">add_circle</span>
              Registrar Nuevo Abono
            </h4>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setNewAmount(balance.toFixed(2))}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-outline-variant/30 text-on-surface hover:border-primary hover:text-primary transition-colors"
              >
                Pagar Todo
              </button>
              <button
                type="button"
                onClick={() => setNewAmount((balance / 2).toFixed(2))}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-outline-variant/30 text-on-surface hover:border-secondary hover:text-secondary transition-colors"
              >
                Pagar 50%
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Monto (Bs)"
                type="number"
                min="0"
                step="0.01"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                className="font-mono"
              />
              <Select
                label="Método"
                options={paymentMethods}
                value={newMethod}
                onChange={e => setNewMethod(e.target.value)}
              />
            </div>
            
            <Input
              label="Nota (opcional)"
              placeholder="Ej. Transferencia bancaria"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            
            <Button 
              onClick={handleAddPayment}
              disabled={!newAmount || Number(newAmount) <= 0}
              variant="primary" 
              className="w-full bg-emerald-500 hover:bg-emerald-600 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <span className="material-symbols-outlined text-[18px]">done</span>
              Guardar Abono
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
