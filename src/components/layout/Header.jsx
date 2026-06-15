import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function Header() {
  const { user } = useAuth()

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-6 h-16 glass-header">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="neu-raised-sm p-2 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary orange-glow text-[18px]">precision_manufacturing</span>
          </div>
          <span className="font-sans text-headline-sm font-bold text-white hidden sm:inline tracking-tight">
            TextilQuote Pro
          </span>
          <span className="font-sans text-headline-sm font-bold text-white sm:hidden">
            TQP
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/quotes/new"
          className="flex items-center gap-1.5 px-4 py-2.5 neu-button-primary text-on-primary rounded-xl font-bold text-sm active:scale-[0.97] transition-transform"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span className="hidden sm:inline tracking-wider uppercase text-xs">Nueva Cotización</span>
        </Link>

        <div className="flex items-center gap-2 pl-3 border-l border-white/5">
          <div className="neu-raised-sm p-2 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary-fixed-dim text-[18px]">person</span>
          </div>
          <span className="text-xs text-on-surface-variant hidden md:inline truncate max-w-[120px]">
            {user?.email}
          </span>
        </div>
      </div>
    </header>
  )
}
