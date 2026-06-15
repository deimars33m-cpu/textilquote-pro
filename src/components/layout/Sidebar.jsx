import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { path: '/', icon: 'dashboard', label: 'Dashboard' },
  { path: '/materials', icon: 'inventory_2', label: 'Materiales' },
  { path: '/processes', icon: 'precision_manufacturing', label: 'Procesos' },
  { path: '/expenses', icon: 'account_balance', label: 'Gastos Fijos' },
  { path: '/templates', icon: 'category', label: 'Plantillas' },
  { path: '/clients', icon: 'groups', label: 'Clientes' },
  { path: '/quotes/new', icon: 'calculate', label: 'Cotizador' },
  { path: '/quotes', icon: 'description', label: 'Historial' },
  { path: '/orders', icon: 'shopping_bag', label: 'Pedidos' },
]

const bottomItems = [
  { path: '/settings', icon: 'settings', label: 'Configuración' },
]

export default function Sidebar() {
  const { signOut } = useAuth()

  return (
    <aside className="hidden md:flex fixed left-0 top-16 h-[calc(100vh-64px)] w-[220px] bg-[#11192d] border-r border-white/5 flex-col py-4 z-40">
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group nav-glow-item
              ${isActive
                ? 'active text-primary'
                : 'text-on-surface-variant hover:bg-white/[0.03] hover:text-white hover:translate-x-1'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 mx-3 pt-2 flex flex-col gap-1 px-3 pb-2">
        {bottomItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group nav-glow-item
              ${isActive
                ? 'active text-primary'
                : 'text-on-surface-variant hover:bg-white/[0.03] hover:text-white hover:translate-x-1'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-error/5 hover:text-error transition-all duration-200 w-full text-left group"
        >
          <span className="material-symbols-outlined text-[20px] group-hover:translate-x-0.5 transition-transform duration-200">logout</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
