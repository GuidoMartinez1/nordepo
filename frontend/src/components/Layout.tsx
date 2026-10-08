import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  RefreshCw,
  Truck,
  ArrowLeftRight,
  Factory,
  TrendingUp,
  Wallet,
  Receipt,
  BarChart3,
  UserCog,
  LogOut,
  Menu,
  X,
  Plus,
  CircleDollarSign,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSucursal } from '../contexts/SucursalContext'
import ChangePasswordModal, { ChangePasswordButton } from './ChangePasswordModal'
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
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
  { to: '/cambios', label: 'Cambios', icon: RefreshCw, roles: ['admin', 'vendedor'] },
  { to: '/compras', label: 'Compras', icon: Truck, roles: ['admin'] },
  { to: '/traslados', label: 'Traslados', icon: ArrowLeftRight, roles: ['admin'] },
  { to: '/proveedores', label: 'Proveedores', icon: Factory, roles: ['admin'] },
  { to: '/gastos', label: 'Gastos', icon: Receipt, roles: ['admin', 'vendedor'] },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin'] },
  { to: '/ganancias', label: 'Ganancias', icon: CircleDollarSign, roles: ['admin'] },
  { to: '/cuentas-mp', label: 'Cuentas MP', icon: Wallet, roles: ['admin'] },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, roles: ['admin'] },
  { to: '/actualizaciones', label: 'Actualizaciones', icon: TrendingUp, roles: ['admin'] },
]

export default function Layout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth()
  const { sucursales, sucursalId, setSucursalId, sucursal, sucursalFija } = useSucursal()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const role = user?.role ?? 'admin'
  const visibleLinks = links.filter((l) => l.roles.includes(role))
  const enNuevaVenta = location.pathname.startsWith('/ventas/nueva')
  const puedeVender = role === 'admin' || role === 'vendedor'

  function irANuevaVenta() {
    setSidebarOpen(false)
    navigate('/ventas/nueva')
  }

  return (
    <div className="flex h-screen bg-[#e8e8e8]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-black text-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0`}
      >
        <div className="shrink-0 border-b border-brand-lime/30">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/nordepo-logo.png"
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

          <div className="px-3 pb-3">
            <label className="block text-[10px] uppercase tracking-wide text-brand-mute mb-1 px-0.5">
              Sucursal
            </label>
            {sucursalFija ? (
              <div className="w-full rounded-lg border border-brand-lime/40 bg-brand-ink px-3 py-2 text-sm font-medium text-brand-lime truncate">
                {sucursal?.nombre || user?.sucursal_nombre || 'Sucursal'}
              </div>
            ) : (
              <select
                className="w-full rounded-lg border border-white/15 bg-brand-ink text-white px-3 py-2 text-sm font-medium focus:outline-none focus:border-brand-lime"
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
            )}
          </div>
        </div>

        <nav className="mt-3 flex-1 min-h-0 overflow-auto px-3 space-y-1 pb-3 scrollbar-dark">
          {visibleLinks.map(({ to, label, icon: Icon, end }) => {
            const isActive = end
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

        {puedeVender && !enNuevaVenta && (
          <div className="px-3 pb-4 shrink-0">
            <button
              type="button"
              onClick={irANuevaVenta}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-brand-lime text-brand-black px-4 py-3.5 text-base font-bold shadow-lime hover:brightness-95 transition active:scale-[0.98]"
            >
              <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} />
              Nueva Venta
            </button>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        <header className="flex shrink-0 items-center justify-between gap-2 h-14 px-3 sm:px-5 bg-brand-black text-white border-b border-brand-lime/30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 focus:outline-none shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="font-display text-base sm:text-lg tracking-wide truncate">
              Gestión de ventas
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-sm text-white truncate max-w-[10rem]">{user?.username}</p>
              <p className="text-[10px] text-brand-lime/80 uppercase tracking-wide">
                {role === 'admin' ? 'Administrador' : 'Vendedor'}
              </p>
            </div>
            {role === 'admin' && (
              <ChangePasswordButton onClick={() => setShowChangePassword(true)} />
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-brand-ink px-3 py-2 text-sm font-semibold text-zinc-200 hover:border-brand-lime/50 hover:text-brand-lime transition"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Salir</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          <div className="max-w-[1920px] w-full mx-auto">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      {puedeVender && !enNuevaVenta && (
        <button
          type="button"
          onClick={irANuevaVenta}
          className="md:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-brand-lime text-brand-black px-5 py-3.5 text-sm font-bold shadow-lg shadow-black/25 active:scale-95"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          Nueva Venta
        </button>
      )}

      <ChangePasswordModal
        open={showChangePassword && role === 'admin'}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  )
}
