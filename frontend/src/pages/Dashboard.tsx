import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, X } from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import type { Venta } from '../types'

type BajoStock = {
  id: number
  nombre: string
  stock: number
  sucursal_nombre?: string
}

type StatsMeta = {
  total_productos: number
  bajo_stock: BajoStock[]
}

function firstDayOfMonth() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}-01`
}

function todayLocal() {
  const hoy = new Date()
  const yyyy = hoy.getFullYear()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toDateStr(raw: string) {
  const d = new Date(raw)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMoney(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export default function Dashboard() {
  const { sucursalId, sucursal, esTodas } = useSucursal()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [meta, setMeta] = useState<StatsMeta | null>(null)
  const [fechaDesde, setFechaDesde] = useState(firstDayOfMonth())
  const [fechaHasta, setFechaHasta] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = sucursalId ? { sucursal_id: sucursalId } : {}
      try {
        const [ventasRes, statsRes] = await Promise.all([
          api.get<Venta[]>('/ventas', { params }),
          api.get<StatsMeta>('/stats/dashboard', { params }),
        ])
        if (cancelled) return
        setVentas(ventasRes.data)
        setMeta(statsRes.data)
      } catch {
        if (!cancelled) {
          setVentas([])
          setMeta(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sucursalId])

  const ventasFiltradas = ventas.filter((item) => {
    if (!item.fecha) return false
    const fechaStr = toDateStr(item.fecha)
    if (fechaDesde && fechaStr < fechaDesde) return false
    if (fechaHasta && fechaStr > fechaHasta) return false
    return true
  })

  const totalVentas = ventasFiltradas.length
  const totalIngresos = ventasFiltradas.reduce((acc, v) => acc + Number(v.total || 0), 0)

  const cards = [
    { title: 'Total ventas', value: String(totalVentas) },
    { title: 'Ingresos', value: formatMoney(totalIngresos) },
    {
      title: 'Productos',
      value: String(meta?.total_productos ?? '—'),
      hint: 'catálogo',
    },
    {
      title: 'Bajo stock',
      value: String(meta?.bajo_stock.length ?? 0),
      hint: '≤ 5 unidades',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="page-title">Panel de Control</h2>
          <p className="text-slate-500 text-sm sm:text-base">
            {esTodas ? 'Todas las sucursales' : sucursal?.nombre ?? 'Seleccioná una sucursal'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
          <label className="hidden sm:inline-flex items-center text-slate-500">
            <Calendar className="h-5 w-5" />
          </label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full sm:w-36 rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white"
          />
          <span className="hidden sm:inline text-slate-400">–</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full sm:w-36 rounded-lg border border-slate-300 px-2 py-2 text-sm bg-white"
          />
          <div className="col-span-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const hoy = todayLocal()
                setFechaDesde(hoy)
                setFechaHasta(hoy)
              }}
              className="btn-primary px-3 py-2 text-sm font-semibold w-full sm:w-auto"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                setFechaDesde('')
                setFechaHasta('')
              }}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <X className="h-4 w-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm py-8 text-center">Cargando…</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {cards.map((c) => (
            <Card key={c.title} title={c.title} value={c.value} hint={c.hint} />
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
        <Link to="/ventas/nueva" className="btn-primary px-4 py-2 text-sm font-semibold text-center">
          Nueva venta
        </Link>
        <Link
          to="/traslados"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-center"
        >
          Trasladar stock
        </Link>
        <Link
          to="/gastos"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-center"
        >
          Registrar gasto
        </Link>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="font-semibold text-sm sm:text-base mb-3">
          Stock bajo {esTodas ? '(consolidado)' : 'en esta sucursal'}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Producto</th>
                {esTodas && <th className="px-4 py-2">Detalle</th>}
                <th className="px-4 py-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {(meta?.bajo_stock ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-400" colSpan={esTodas ? 3 : 2}>
                    Sin alertas
                  </td>
                </tr>
              )}
              {(meta?.bajo_stock ?? []).map((p) => (
                <tr key={`${p.id}-${p.sucursal_nombre ?? 't'}`} className="border-t border-slate-100">
                  <td className="px-4 py-2">{p.nombre}</td>
                  {esTodas && (
                    <td className="px-4 py-2 text-slate-500 text-xs">
                      {p.sucursal_nombre || 'Total'}
                    </td>
                  )}
                  <td className="px-4 py-2 font-semibold text-amber-700">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2">
          {(meta?.bajo_stock ?? []).map((p) => (
            <div
              key={`${p.id}-${p.sucursal_nombre ?? 't'}`}
              className="border border-slate-200 rounded-lg p-3 flex justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{p.nombre}</p>
                {esTodas && (
                  <p className="text-xs text-slate-500">{p.sucursal_nombre || 'Total'}</p>
                )}
              </div>
              <span className="font-semibold text-amber-700 shrink-0">{p.stock}</span>
            </div>
          ))}
          {(meta?.bajo_stock ?? []).length === 0 && (
            <p className="text-slate-400 text-sm text-center py-4">Sin alertas</p>
          )}
        </div>
      </section>
    </div>
  )
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold text-brand-black break-words">
        {value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}
