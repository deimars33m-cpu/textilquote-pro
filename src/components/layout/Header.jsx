import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { path: '/', icon: 'dashboard', label: 'Dashboard' },
  { path: '/materials', icon: 'inventory_2', label: 'Materiales' },
  { path: '/processes', icon: 'precision_manufacturing', label: 'Procesos' },
  { path: '/expenses', icon: 'account_balance_wallet', label: 'Gastos y Presup.' },
  { path: '/templates', icon: 'category', label: 'Plantillas' },
  { path: '/terceros', icon: 'groups', label: 'Terceros' },
  { path: '/quotes/new', icon: 'calculate', label: 'Cotizador' },
  { path: '/quotes', icon: 'description', label: 'Historial' },
  { path: '/orders', icon: 'shopping_bag', label: 'Pedidos' },
  { path: '/settings/global', icon: 'admin_panel_settings', label: 'Configuración Global' },
]

const bottomItems = [
  { path: '/settings', icon: 'settings', label: 'Configuración' },
]

export default function Header() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-6 h-16 glass-header">
        <div className="flex items-center gap-3">
          {/* Botón de Menú Hamburguesa para Móviles */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2 rounded-xl text-on-surface-variant hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            title="Abrir menú"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

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

      {/* Drawer Overlay Móvil */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex flex-col w-[260px] max-w-xs h-full bg-[#11192d] p-6 shadow-2xl z-50 border-r border-white/5">
            {/* Header del Drawer */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">precision_manufacturing</span>
                <span className="text-sm font-bold text-white uppercase tracking-wider">Menú de Navegación</span>
              </div>
              <button 
                onClick={() => setMenuOpen(false)} 
                className="p-1 text-on-surface-variant hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Links de Navegación */}
            <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200
                    ${isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(255,92,0,0.1)]'
                      : 'text-on-surface-variant hover:bg-white/[0.03] hover:text-white'
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Bottom Config & Logout */}
            <div className="border-t border-white/5 pt-4 flex flex-col gap-1 mt-auto">
              {bottomItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200
                    ${isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(255,92,0,0.1)]'
                      : 'text-on-surface-variant hover:bg-white/[0.03] hover:text-white'
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  signOut()
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide text-on-surface-variant hover:bg-error/5 hover:text-error transition-all duration-200 w-full text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
