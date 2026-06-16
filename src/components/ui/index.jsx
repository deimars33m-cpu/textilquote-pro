import { useState } from 'react'
import { createPortal } from 'react-dom'

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative neu-surface w-full ${sizes[size]} max-h-[90vh] overflow-y-auto animate-scale-in`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container/95 backdrop-blur-sm rounded-t-[1.5rem] z-10">
          <h2 className="text-headline-sm font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="neu-raised-sm p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative neu-surface w-full max-w-sm animate-scale-in p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full neu-pressed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
          <div>
            <h3 className="text-body-lg font-semibold text-white">{title}</h3>
            <p className="text-body-md text-on-surface-variant mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl neu-raised-sm text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 rounded-xl bg-error text-on-error font-bold text-sm hover:brightness-110 transition-all shadow-[0_4px_12px_rgba(255,180,171,0.2)]"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function Input({ label, suffix, error, className = '', ...props }) {
  const isNumber = props.type === 'number'
  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          className={`w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none transition-all duration-200
            ${error ? 'ring-1 ring-error' : 'focus:ring-1 focus:ring-primary/50'}
            ${suffix ? 'pr-12' : ''}
            ${isNumber ? 'font-mono' : ''}`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary/40 font-mono">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  )
}

export function Select({ label, options = [], error, className = '', placeholder, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface outline-none transition-all duration-200 appearance-none cursor-pointer
            ${error ? 'ring-1 ring-error' : 'focus:ring-1 focus:ring-primary/50'}`}
          {...props}
        >
          {placeholder && <option value="" className="bg-surface text-on-surface">{placeholder}</option>}
          {options.map(opt => (
            opt.options ? (
              <optgroup key={opt.label} label={opt.label} className="bg-surface text-on-surface">
                {opt.options.map(subOpt => (
                  <option key={subOpt.value} value={subOpt.value} className="bg-surface text-on-surface">
                    {subOpt.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={opt.value} value={opt.value} className="bg-surface text-on-surface">
                {opt.label}
              </option>
            )
          ))}
        </select>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary-fixed-dim/40 pointer-events-none text-[18px]">keyboard_arrow_down</span>
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5 ml-1">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-3 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none transition-all duration-200 resize-y min-h-[80px]
          ${error ? 'ring-1 ring-error' : 'focus:ring-1 focus:ring-primary/50'}`}
        {...props}
      />
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  )
}

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }) {
  const variants = {
    primary: 'neu-button-primary text-on-primary font-bold',
    secondary: 'neu-raised-sm text-on-surface hover:text-white font-medium',
    ghost: 'text-on-surface-variant hover:bg-white/[0.03] hover:text-on-surface',
    danger: 'bg-error text-on-error font-bold shadow-[0_4px_12px_rgba(255,180,171,0.2),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:shadow-[0_8px_20px_rgba(255,180,171,0.3)]',
    success: 'bg-tertiary-container text-on-tertiary font-bold shadow-[0_4px_12px_rgba(86,229,169,0.2),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:shadow-[0_8px_20px_rgba(86,229,169,0.3)]',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-2xl',
  }

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] active:translate-y-[1px] disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`neu-surface p-6 relative overflow-hidden ${className}`}
      {...props}
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
      {children}
    </div>
  )
}

export function Skeleton({ className = '', variant = 'text', ...props }) {
  const variants = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'w-full rounded-lg',
  }
  return (
    <div
      className={`skeleton ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function StatusBadge({ status }) {
  const styles = {
    borrador: 'bg-white/5 text-on-surface-variant border border-white/10',
    enviada: 'bg-primary/10 text-primary border border-primary/20',
    aprobada: 'bg-tertiary/10 text-tertiary border border-tertiary/20',
    rechazada: 'bg-error-container/20 text-error border border-error/20',
    vencida: 'bg-outline-variant/20 text-on-surface-variant border border-outline-variant',
  }

  const labels = {
    borrador: 'Borrador',
    enviada: 'Enviada',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    vencida: 'Vencida',
  }

  return (
    <span className={`status-badge rounded-full ${styles[status] || styles.borrador}`}>
      {labels[status] || status}
    </span>
  )
}

export function AlertBanner({ type = 'warning', children, onClose }) {
  const styles = {
    warning: 'bg-primary/5 border-primary/10 border-l-primary text-primary',
    error: 'bg-error/5 border-error/10 border-l-error text-error',
    info: 'bg-secondary/5 border-secondary/10 border-l-secondary text-secondary',
    success: 'bg-tertiary/5 border-tertiary/10 border-l-tertiary text-tertiary',
  }

  const icons = {
    warning: 'warning',
    error: 'error',
    info: 'info',
    success: 'check_circle',
  }

  return (
    <div className={`p-3 rounded-xl border border-l-4 flex items-center gap-3 ${styles[type]}`}>
      <span className="material-symbols-outlined text-[20px]">{icons[type]}</span>
      <div className="flex-1 text-sm font-medium">{children}</div>
      {onClose && (
        <button onClick={onClose} className="p-0.5 hover:opacity-70 transition-opacity">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  )
}

export function LoadingSpinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${sizes[size]} border-2 border-surface-container-high border-t-primary rounded-full animate-spin`} />
    </div>
  )
}

export function EmptyState({ icon = 'inbox', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center w-full">
      <div className="w-16 h-16 neu-pressed rounded-2xl flex items-center justify-center mb-4 shrink-0">
        <span className="material-symbols-outlined text-on-surface-variant text-[32px]">{icon}</span>
      </div>
      <h3 className="text-body-lg font-semibold text-white mb-1 px-4">{title}</h3>
      <p className="text-body-md text-on-surface-variant max-w-sm w-full px-4">{message}</p>
      {action && <div className="mt-4 px-4 w-full flex justify-center">{action}</div>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="relative flex-1 max-w-sm">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary-fixed-dim/40 text-[18px]">search</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 neu-pressed bg-transparent border-none rounded-xl text-sm text-on-surface placeholder-on-surface-variant/40 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all duration-200 ${checked ? 'bg-primary shadow-[0_0_8px_rgba(255,154,61,0.4)]' : 'neu-pressed'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${checked ? 'translate-x-5 bg-white' : 'bg-on-surface-variant'}`} />
      </button>
      {label && <span className="text-sm text-on-surface-variant">{label}</span>}
    </label>
  )
}
