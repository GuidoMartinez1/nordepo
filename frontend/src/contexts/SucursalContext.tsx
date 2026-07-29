import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import api, { SUCURSAL_KEY } from '../services/api'
import type { Sucursal } from '../types'
import { useAuth } from './AuthContext'

type SucursalContextValue = {
  sucursales: Sucursal[]
  sucursalId: number | null
  sucursal: Sucursal | null
  setSucursalId: (id: number) => void
  loading: boolean
  refresh: () => Promise<void>
}

const SucursalContext = createContext<SucursalContextValue | null>(null)

export function SucursalProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(SUCURSAL_KEY)
    return stored ? Number(stored) : null
  })
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const { data } = await api.get<Sucursal[]>('/sucursales')
      const activas = data.filter((s) => s.activa)
      setSucursales(activas)
      setSucursalIdState((current) => {
        if (current && activas.some((s) => s.id === current)) return current
        const first = activas[0]?.id ?? null
        if (first) localStorage.setItem(SUCURSAL_KEY, String(first))
        else localStorage.removeItem(SUCURSAL_KEY)
        return first
      })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) void refresh()
    else {
      setSucursales([])
      setSucursalIdState(null)
    }
  }, [token, refresh])

  const setSucursalId = useCallback((id: number) => {
    localStorage.setItem(SUCURSAL_KEY, String(id))
    setSucursalIdState(id)
  }, [])

  const sucursal = useMemo(
    () => sucursales.find((s) => s.id === sucursalId) ?? null,
    [sucursales, sucursalId]
  )

  const value = useMemo(
    () => ({ sucursales, sucursalId, sucursal, setSucursalId, loading, refresh }),
    [sucursales, sucursalId, sucursal, setSucursalId, loading, refresh]
  )

  return <SucursalContext.Provider value={value}>{children}</SucursalContext.Provider>
}

export function useSucursal() {
  const ctx = useContext(SucursalContext)
  if (!ctx) throw new Error('useSucursal debe usarse dentro de SucursalProvider')
  return ctx
}
