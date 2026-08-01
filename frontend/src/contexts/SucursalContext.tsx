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
  /** null = Todas las sucursales de venta */
  sucursalId: number | null
  sucursal: Sucursal | null
  esTodas: boolean
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
  const { token } = useAuth()
  const [todasSucursales, setTodasSucursales] = useState<Sucursal[]>([])
  const [sucursalId, setSucursalIdState] = useState<number | null>(() => readStoredSucursalId())
  const [loading, setLoading] = useState(false)

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
      const venta = activas.filter((s) => !s.es_deposito)
      setSucursalIdState((current) => {
        if (current === null) return null
        if (venta.some((s) => s.id === current)) return current
        localStorage.setItem(SUCURSAL_KEY, TODAS_VALUE)
        return null
      })
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

  const setSucursalId = useCallback((id: number | null) => {
    if (id === null) localStorage.setItem(SUCURSAL_KEY, TODAS_VALUE)
    else localStorage.setItem(SUCURSAL_KEY, String(id))
    setSucursalIdState(id)
  }, [])

  const sucursal = useMemo(
    () => (sucursalId == null ? null : sucursales.find((s) => s.id === sucursalId) ?? null),
    [sucursales, sucursalId]
  )

  const esTodas = sucursalId === null

  const value = useMemo(
    () => ({
      sucursales,
      todasSucursales,
      deposito,
      sucursalId,
      sucursal,
      esTodas,
      setSucursalId,
      loading,
      refresh,
    }),
    [sucursales, todasSucursales, deposito, sucursalId, sucursal, esTodas, setSucursalId, loading, refresh]
  )

  return <SucursalContext.Provider value={value}>{children}</SucursalContext.Provider>
}

export function useSucursal() {
  const ctx = useContext(SucursalContext)
  if (!ctx) throw new Error('useSucursal debe usarse dentro de SucursalProvider')
  return ctx
}
