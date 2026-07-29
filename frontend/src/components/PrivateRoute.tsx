import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { token, ready } = useAuth()
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500">
        Cargando…
      </div>
    )
  }
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}
