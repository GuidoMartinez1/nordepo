import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { UserRole } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

/** Protege rutas por rol. Hoy todo el panel admin usa role="admin". */
export default function RoleRoute({
  roles,
  children,
}: {
  roles: UserRole[]
  children: ReactNode
}) {
  const { user, ready } = useAuth()
  if (!ready) {
    return <div className="p-8 text-center text-slate-500">Cargando…</div>
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={user?.role === 'vendedor' ? '/ventas' : '/'} replace />
  }
  return <>{children}</>
}
