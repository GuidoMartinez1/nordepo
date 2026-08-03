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

const TODAS_VALUE = 'all'

type SucursalContextValue = {
  /** Solo sucursales de venta (sin depósito) — para el selector del header */
  sucursales: Sucursal[]
  /** Incluye el depósito */
  todasSucursales: Sucursal[]
  deposito: Sucursal | null
  /** null = Todas las sucursales de venta (solo admin) */
  sucursalId: number | null
  sucursal: Sucursal | null
  esTodas: boolean
  /** Si true, el selector está bloqueado (vendedor) */
  sucursalFija: boolean
  setSucursalId: (id: number | null) => void
  loading: boolean
  refresh: () => Promise<void>
}

const SucursalContext = createContext<SucursalContextValue | null>(null)

function readStoredSucursalId(): number | null {
  const stored = localStorage.getItem(SUCURSAL_KEY)
  if (!stored || stored === TODAS_VALUE) return null
  const n = Number(stored)
  return Number.isFinite(n) ? n : null
}

export function SucursalProvider({ children }: { children: ReactNode }) {
  const { token, user, isAdmin } = useAuth()
  const [todasSucursales, setTodasSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalIdState] = useState<number | null>(() => readStoredSucursalId())
  const [loading, setLoading] = useState(false)

  const sucursalFija = !isAdmin && !!user?.sucursal_id

  const sucursales = useMemo(
    () => todasSucursales.filter((s) => !s.es_deposito),
    [todasSucursales]
  )

  const deposito = useMemo(
    () => todasSucursales.find((s) => s.es_deposito) ?? null,
    [todasSucursales]
  )

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const { data } = await api.get<Sucursal[]>('/sucursales')
      const activas = data.filter((s) => s.activa)
      setTodasSucursales(activas)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) void refresh()
    else {
      setTodasSucursales([])
      setSucursalIdState(null)
    }
  }, [token, refresh])

  // Vendedor: forzar su sucursal. Admin: validar selección guardada.
  useEffect(() => {
    if (!user) return
    if (!isAdmin && user.sucursal_id) {
      setSucursalIdState(user.sucursal_id)
      localStorage.setItem(SUCURSAL_KEY, String(user.sucursal_id))
      return
    }
    if (isAdmin && sucursales.length) {
      setSucursalIdState((current) => {
        if (current === null) return null
        if (sucursales.some((s) => s.id === current)) return current
        localStorage.setItem(SUCURSAL_KEY, TODAS_VALUE)
        return null
      })
    }
  }, [user, isAdmin, sucursales])

  const setSucursalId = useCallback(
    (id: number | null) => {
      if (!isAdmin) return
      if (id === null) localStorage.setItem(SUCURSAL_KEY, TODAS_VALUE)
      else localStorage.setItem(SUCURSAL_KEY, String(id))
      setSucursalIdState(id)
    },
    [isAdmin]
  )

  const sucursal = useMemo(() => {
    if (sucursalId == null) return null
    return (
      sucursales.find((s) => s.id === sucursalId) ??
      todasSucursales.find((s) => s.id === sucursalId) ??
      null
    )
  }, [sucursales, todasSucursales, sucursalId])

  const esTodas = isAdmin && sucursalId === null

  const value = useMemo(
    () => ({
      sucursales,
      todasSucursales,
      deposito,
      sucursalId,
      sucursal,
      esTodas,
      sucursalFija,
      setSucursalId,
      loading,
      refresh,
    }),
    [
      sucursales,
      todasSucursales,
      deposito,
      sucursalId,
      sucursal,
      esTodas,
      sucursalFija,
      setSucursalId,
      loading,
      refresh,
    ]
  )

  return <SucursalContext.Provider value={value}>{children}</SucursalContext.Provider>
}

export function useSucursal() {
  const ctx = useContext(SucursalContext)
  if (!ctx) throw new Error('useSucursal debe usarse dentro de SucursalProvider')
  return ctx
}
