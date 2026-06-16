import { NavLink } from 'react-router-dom'

const items = [
  { path: '/orders', icon: 'shopping_bag', label: 'Pedidos' },
  { path: '/expenses', icon: 'account_balance_wallet', label: 'Gastos' },
  { path: '/terceros', icon: 'groups', label: 'Terceros' },
  { path: '/quotes/new', icon: 'calculate', label: 'Cotizar' },
  { path: '/settings/global', icon: 'admin_panel_settings', label: 'Global' },
]

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center bg-surface-container/95 backdrop-blur-md border-t border-outline-variant px-1 py-2 safe-area-pb">
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 rounded-xl transition-all duration-200 min-w-[56px]
            ${isActive
              ? 'bg-primary/15 text-primary scale-95'
              : 'text-on-surface-variant hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider mt-0.5">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
