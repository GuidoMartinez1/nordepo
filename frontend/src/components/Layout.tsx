import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  Users,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  Factory,
  TrendingUp,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSucursal } from '../contexts/SucursalContext'
import type { ReactNode } from 'react'
import type { UserRole } from '../contexts/AuthContext'

type NavItem = {
  to: string
  label: string
  icon: typeof Package
  end?: boolean
  roles: UserRole[]
}

/**
 * admin: acceso completo (estado actual del sistema)
 * vendedor: operativo de caja (se habilitará después; menú ya filtrado)
 */
const links: NavItem[] = [
  { to: '/', label: 'Panel de Control', icon: LayoutDashboard, end: true, roles: ['admin'] },
  { to: '/productos', label: 'Productos', icon: Package, roles: ['admin', 'vendedor'] },
  { to: '/categorias', label: 'Categorías', icon: Tags, roles: ['admin'] },
  { to: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'vendedor'] },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
  { to: '/compras', label: 'Compras', icon: Truck, roles: ['admin'] },
  { to: '/traslados', label: 'Traslados', icon: ArrowLeftRight, roles: ['admin'] },
  { to: '/proveedores', label: 'Proveedores', icon: Factory, roles: ['admin'] },
  { to: '/actualizaciones', label: 'Actualizaciones', icon: TrendingUp, roles: ['admin'] },
]

export default function Layout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth()
  const { sucursales, sucursalId, setSucursalId } = useSucursal()
  const role = user?.role ?? 'admin'
  const visibleLinks = links.filter((l) => l.roles.includes(role))

  return (
    <div className="min-h-screen flex bg-[#e8e8e8]">
      <aside className="w-64 shrink-0 bg-brand-black text-white flex flex-col border-r border-white/5">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="NORDEPO"
            className="h-12 w-12 rounded-full object-cover shadow-lime"
          />
          <div>
            <p className="font-display text-2xl tracking-wide leading-none">NORDEPO</p>
            <p className="text-[11px] text-brand-mute mt-1">Artículos deportivos</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-brand-lime text-brand-black font-semibold'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-sm">
          <p className="text-brand-mute truncate">{user?.username}</p>
          <p className="text-[11px] text-brand-lime/80 uppercase tracking-wide mt-0.5">
            {role === 'admin' ? 'Administrador' : 'Vendedor'}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 inline-flex items-center gap-2 text-zinc-300 hover:text-brand-lime"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-brand-black text-white border-b border-brand-lime/30 px-6 flex items-center justify-between">
          <h1 className="font-display text-xl tracking-wide">Gestión de ventas</h1>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-brand-mute">Sucursal</span>
            <select
              className="rounded-md border border-white/15 bg-brand-ink text-white px-3 py-1.5 font-medium focus:outline-none focus:border-brand-lime"
              value={sucursalId ?? 'all'}
              onChange={(e) => {
                const v = e.target.value
                setSucursalId(v === 'all' ? null : Number(v))
              }}
            >
              <option value="all">Todas</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children ?? <Outlet />}</main>
      </div>
    </div>
  )
}
