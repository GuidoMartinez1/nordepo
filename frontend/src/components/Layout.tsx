import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  Wallet,
  Receipt,
  BarChart3,
  LogOut,
  Menu,
  X,
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

const links: NavItem[] = [
  { to: '/', label: 'Panel de Control', icon: LayoutDashboard, end: true, roles: ['admin'] },
  { to: '/productos', label: 'Productos', icon: Package, roles: ['admin', 'vendedor'] },
  { to: '/categorias', label: 'Categorías', icon: Tags, roles: ['admin'] },
  { to: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'vendedor'] },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
  { to: '/compras', label: 'Compras', icon: Truck, roles: ['admin'] },
  { to: '/traslados', label: 'Traslados', icon: ArrowLeftRight, roles: ['admin'] },
  { to: '/proveedores', label: 'Proveedores', icon: Factory, roles: ['admin'] },
  { to: '/gastos', label: 'Gastos', icon: Receipt, roles: ['admin'] },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin'] },
  { to: '/cuentas-mp', label: 'Cuentas MP', icon: Wallet, roles: ['admin'] },
  { to: '/actualizaciones', label: 'Actualizaciones', icon: TrendingUp, roles: ['admin'] },
]

export default function Layout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth()
  const { sucursales, sucursalId, setSucursalId } = useSucursal()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const role = user?.role ?? 'admin'
  const visibleLinks = links.filter((l) => l.roles.includes(role))

  return (
    <div className="flex h-screen bg-[#e8e8e8]">
      {/* Overlay mobile — mismo patrón que AliMar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar: fixed + translate en mobile, relative en md+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-black text-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-brand-lime/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.png"
              alt="NORDEPO"
              className="h-9 w-9 shrink-0 rounded-full object-cover shadow-lime"
            />
            <div className="min-w-0">
              <h1 className="font-display text-xl tracking-wide text-white truncate leading-none">
                NORDEPO
              </h1>
              <p className="text-[10px] text-brand-mute mt-0.5 truncate">Artículos deportivos</p>
            </div>
          </div>
          <button
            type="button"
            className="md:hidden text-white p-1 rounded hover:bg-white/10 focus:outline-none"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-3 flex-1 min-h-0 overflow-auto px-3 space-y-1 pb-3">
          {visibleLinks.map(({ to, label, icon: Icon, end }) => {
            const isActive =
              end
                ? location.pathname === to
                : location.pathname === to || location.pathname.startsWith(`${to}/`)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-lime text-brand-black'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10 text-sm shrink-0">
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        <header className="flex shrink-0 items-center justify-between gap-2 h-14 px-3 sm:px-5 bg-brand-black text-white border-b border-brand-lime/30">
          <div className="flex items-center shrink-0 w-10">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 focus:outline-none"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 min-w-0 flex justify-center md:justify-start">
            <h1 className="font-display text-base sm:text-lg tracking-wide truncate">
              Gestión de ventas
            </h1>
          </div>

          <div className="flex items-center justify-end shrink-0">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-brand-mute hidden sm:inline">Sucursal</span>
              <select
                className="max-w-[38vw] sm:max-w-[11rem] rounded-md border border-white/15 bg-brand-ink text-white px-2 sm:px-3 py-1.5 font-medium focus:outline-none focus:border-brand-lime"
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
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-[1920px] w-full mx-auto overflow-x-auto">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}
