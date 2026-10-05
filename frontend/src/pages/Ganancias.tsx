import { useEffect, useState } from 'react'
import { Calendar, TrendingUp, DollarSign, Package, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { money } from '../utils/money'

type GananciaDiaria = {
  fecha: string
  cantidad_ventas: number
  unidades: number
  total_venta: number
  total_costo: number
  ganancia_neta: number
}

type GananciaTotales = {
  unidades: number
  total_venta: number
  total_costo: number
  ganancia_neta: number
}

type GananciaProducto = {
  producto_id: number
  producto_nombre: string
  unidades: number
  total_venta: number
  total_costo: number
  ganancia_neta: number
}

const cardClass = 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6'
const inputFieldClass =
  'block w-full max-w-full min-w-0 box-border border border-slate-300 p-2.5 rounded-lg focus:ring-brand-lime focus:border-brand-lime transition text-sm bg-white'
const dateInputClass = `${inputFieldClass} [-webkit-appearance:none] appearance-none`

function getFirstDayOfMonth(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}-01`
}

function todayLocal(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDate(dateString: string) {
  if (!dateString) return '-'
  // Evita el -1 día por timezone: usar solo YYYY-MM-DD
  const day = String(dateString).slice(0, 10)
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return '-'
  return new Date(y, m - 1, d).toLocaleDateString('es-AR')
}

export default function Ganancias() {
  const { sucursalId, sucursal, esTodas } = useSucursal()
  const [fechaDesde, setFechaDesde] = useState(getFirstDayOfMonth())
  const [fechaHasta, setFechaHasta] = useState('')
  const [diarios, setDiarios] = useState<GananciaDiaria[]>([])
  const [detalle, setDetalle] = useState<GananciaProducto[]>([])
  const [totales, setTotales] = useState<GananciaTotales | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false

    const cargar = async () => {
      try {
        setLoading(true)
        const fInicio = fechaDesde || '2000-01-01'
        const fFin = fechaHasta || '2099-12-31'
        const params = {
          desde: fInicio,
          hasta: fFin,
          ...(sucursalId ? { sucursal_id: sucursalId } : {}),
        }
        const [resumenRes, detalleRes] = await Promise.all([
          api.get<{ diarios: GananciaDiaria[]; totales: GananciaTotales }>('/ganancias', {
            params,
          }),
          api.get<GananciaProducto[]>('/ganancias/detalle', { params }),
        ])
        if (cancelado) return
        setDiarios(resumenRes.data.diarios)
        setTotales(resumenRes.data.totales)
        setDetalle(detalleRes.data)
      } catch {
        if (!cancelado) toast.error('Error al cargar ganancias')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [fechaDesde, fechaHasta, sucursalId])

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-2xl tracking-wide text-brand-black">Ganancias</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ganancia neta de productos (precio de venta − costo al momento de la venta)
          {esTodas ? ' · Todas las sucursales' : ` · ${sucursal?.nombre ?? ''}`}
        </p>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <h3 className="text-sm font-semibold text-brand-black mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
          Filtro de fechas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-full">
          <div className="min-w-0 w-full overflow-hidden">
            <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className={dateInputClass}
            />
          </div>
          <div className="min-w-0 w-full overflow-hidden">
            <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className={dateInputClass}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                const hoy = todayLocal()
                setFechaDesde(hoy)
                setFechaHasta(hoy)
              }}
              className="btn-primary w-full px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              Hoy
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Venta productos</p>
                  <p className="text-lg font-bold text-brand-black truncate">
                    {money(totales?.total_venta)}
                  </p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg shrink-0">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Costo</p>
                  <p className="text-lg font-bold text-brand-black truncate">
                    {money(totales?.total_costo)}
                  </p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Ganancia neta</p>
                  <p className="text-lg font-bold text-green-700 truncate">
                    {money(totales?.ganancia_neta)}
                  </p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-lime/20 rounded-lg shrink-0">
                  <DollarSign className="h-5 w-5 text-brand-black" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Unidades</p>
                  <p className="text-lg font-bold text-brand-black">{totales?.unidades ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-brand-black mb-4">Por día</h2>
            {diarios.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                No hay ventas de productos con costo registrado en este período.
              </p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-2 pr-4 font-medium">Fecha</th>
                        <th className="py-2 pr-4 font-medium text-right">Ventas</th>
                        <th className="py-2 pr-4 font-medium text-right">Unidades</th>
                        <th className="py-2 pr-4 font-medium text-right">Venta</th>
                        <th className="py-2 pr-4 font-medium text-right">Costo</th>
                        <th className="py-2 font-medium text-right">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diarios.map((dia) => (
                        <tr key={String(dia.fecha)} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4">{formatDate(String(dia.fecha))}</td>
                          <td className="py-2.5 pr-4 text-right">{dia.cantidad_ventas}</td>
                          <td className="py-2.5 pr-4 text-right">{dia.unidades}</td>
                          <td className="py-2.5 pr-4 text-right">{money(dia.total_venta)}</td>
                          <td className="py-2.5 pr-4 text-right">{money(dia.total_costo)}</td>
                          <td className="py-2.5 text-right font-semibold text-green-700">
                            {money(dia.ganancia_neta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {diarios.map((dia) => (
                    <div
                      key={String(dia.fecha)}
                      className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/60"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-semibold text-brand-black">
                          {formatDate(String(dia.fecha))}
                        </span>
                        <span className="text-base font-bold text-green-700">
                          {money(dia.ganancia_neta)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Ventas</p>
                          <p className="font-semibold text-brand-black">{dia.cantidad_ventas}</p>
                        </div>
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Unid.</p>
                          <p className="font-semibold text-brand-black">{dia.unidades}</p>
                        </div>
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Venta</p>
                          <p className="font-semibold text-brand-black">{money(dia.total_venta)}</p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Costo</p>
                          <p className="font-semibold text-brand-black">{money(dia.total_costo)}</p>
                        </div>
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Ganancia</p>
                          <p className="font-semibold text-green-700">{money(dia.ganancia_neta)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-brand-black mb-4">Por producto</h2>
            {detalle.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Sin detalle en este período.</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-2 pr-4 font-medium">Producto</th>
                        <th className="py-2 pr-4 font-medium text-right">Unidades</th>
                        <th className="py-2 pr-4 font-medium text-right">Venta</th>
                        <th className="py-2 pr-4 font-medium text-right">Costo</th>
                        <th className="py-2 font-medium text-right">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.map((p) => (
                        <tr key={p.producto_id} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4">{p.producto_nombre}</td>
                          <td className="py-2.5 pr-4 text-right">{p.unidades}</td>
                          <td className="py-2.5 pr-4 text-right">{money(p.total_venta)}</td>
                          <td className="py-2.5 pr-4 text-right">{money(p.total_costo)}</td>
                          <td className="py-2.5 text-right font-semibold text-green-700">
                            {money(p.ganancia_neta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-2.5">
                  {detalle.map((p) => (
                    <div
                      key={p.producto_id}
                      className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/60"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-medium text-brand-black text-sm leading-snug">
                          {p.producto_nombre}
                        </p>
                        <span className="shrink-0 text-sm font-bold text-green-700">
                          {money(p.ganancia_neta)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Unid.</p>
                          <p className="font-semibold text-brand-black">{p.unidades}</p>
                        </div>
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Venta</p>
                          <p className="font-semibold text-brand-black">{money(p.total_venta)}</p>
                        </div>
                        <div className="rounded-md bg-white border border-slate-100 py-1.5 px-1">
                          <p className="text-slate-500">Costo</p>
                          <p className="font-semibold text-brand-black">{money(p.total_costo)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
