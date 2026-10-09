import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Calendar, Eye, ShoppingCart, Trash2, X } from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { useAuth } from '../contexts/AuthContext'
import { money } from '../utils/money'
import type { Venta } from '../types'

type Detalle = {
  id: number
  producto_id: number | null
  producto_nombre?: string | null
  descripcion?: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

type VentaDetalle = Venta & { detalles: Detalle[] }

function labelPago(v: Venta) {
  if (v.metodo_pago === 'mercadopago') {
    const alias = v.cuenta_mp_alias || v.cuenta_mp_nombre
    return alias ? `MP · ${alias}` : 'Mercado Pago'
  }
  if (v.metodo_pago === 'tarjeta') {
    if (v.tipo_tarjeta === 'credito') return 'Tarjeta · Crédito'
    if (v.tipo_tarjeta === 'debito') return 'Tarjeta · Débito'
    return 'Tarjeta'
  }
  if (v.metodo_pago === 'efectivo') return 'Efectivo'
  return v.metodo_pago
}

function todayLocal() {
  return new Date().toLocaleDateString('en-CA')
}

function AccionesVenta({
  v,
  isAdmin,
  deletingId,
  onVer,
  onEliminar,
}: {
  v: Venta
  isAdmin: boolean
  deletingId: number | null
  onVer: () => void
  onEliminar: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title="Ver productos"
        onClick={onVer}
        className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
      >
        <Eye size={16} />
      </button>
      {isAdmin && (
        <button
          type="button"
          title="Eliminar venta"
          disabled={deletingId === v.id}
          onClick={onEliminar}
          className="p-1.5 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}

export default function Ventas() {
  const { sucursalId, esTodas, sucursal } = useSucursal()
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<Venta[]>([])
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  // Solo una vista montada (tabla O tarjetas): montar ambas en móvil dejaba pantalla en blanco
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [visibleCount, setVisibleCount] = useState(40)

  async function load() {
    const params = sucursalId ? { sucursal_id: sucursalId } : {}
    const { data } = await api.get<Venta[]>('/ventas', { params })
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar ventas'))
  }, [sucursalId])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    setVisibleCount(40)
  }, [fechaDesde, fechaHasta, items])

  const filtradas = useMemo(() => {
    return items.filter((venta) => {
      if (!venta.fecha) return false
      const fechaVenta = new Date(venta.fecha).toLocaleDateString('en-CA')
      if (fechaDesde && fechaVenta < fechaDesde) return false
      if (fechaHasta && fechaVenta > fechaHasta) return false
      return true
    })
  }, [items, fechaDesde, fechaHasta])

  const visibles = filtradas.slice(0, visibleCount)
  const hayMas = visibleCount < filtradas.length

  async function verDetalle(id: number) {
    try {
      const { data } = await api.get<VentaDetalle>(`/ventas/${id}`)
      setDetalle(data)
    } catch {
      toast.error('No se pudo cargar el detalle')
    }
  }

  async function eliminar(venta: Venta) {
    if (
      !confirm(
        `¿Eliminar la venta #${venta.id}?\nSe devolverá el stock a ${venta.sucursal_nombre || 'la sucursal'}.`
      )
    ) {
      return
    }
    setDeletingId(venta.id)
    try {
      await api.delete(`/ventas/${venta.id}`)
      toast.success('Venta eliminada')
      setItems((prev) => prev.filter((v) => v.id !== venta.id))
      if (detalle?.id === venta.id) setDetalle(null)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo eliminar'
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Ventas</h2>
          <p className="text-slate-500 text-sm">
            {esTodas ? 'Todas las sucursales' : sucursal?.nombre}
          </p>
        </div>
        {esTodas ? (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Elegí una sucursal para cargar una venta
          </span>
        ) : (
          <Link to="/ventas/nueva" className="btn-primary px-4 py-2 text-sm font-semibold text-center">
            Nueva venta
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 md:space-y-0 md:grid md:grid-cols-5 md:gap-3 md:items-end">
        <div className="flex gap-3 w-full md:contents">
          <div className="min-w-0 flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="block w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white [-webkit-appearance:none] appearance-none"
            />
          </div>
          <div className="min-w-0 flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="block w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white [-webkit-appearance:none] appearance-none"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full md:col-span-3">
          <button
            type="button"
            onClick={() => {
              const hoy = todayLocal()
              setFechaDesde(hoy)
              setFechaHasta(hoy)
            }}
            className="btn-primary px-3 py-2 text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Calendar className="h-4 w-4" />
            Hoy
          </button>
          <button
            type="button"
            onClick={() => {
              setFechaDesde('')
              setFechaHasta('')
            }}
            className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <X className="h-4 w-4" /> Limpiar
          </button>
          <span className="text-xs text-slate-500 ml-auto">
            {filtradas.length} de {items.length}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        {isMobile ? (
          <div className="space-y-3">
            {visibles.map((v) => (
              <div
                key={v.id}
                className="border border-slate-200 rounded-lg p-4 shadow-sm bg-slate-50/50"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingCart className="h-5 w-5 text-brand-black shrink-0" />
                    <h3 className="font-bold text-brand-black">Venta #{v.id}</h3>
                  </div>
                  <AccionesVenta
                    v={v}
                    isAdmin={isAdmin}
                    deletingId={deletingId}
                    onVer={() => void verDetalle(v.id)}
                    onEliminar={() => void eliminar(v)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-200 pt-2">
                  <div>
                    <span className="text-xs text-slate-500 block">Fecha</span>
                    <span>{new Date(v.fecha).toLocaleDateString('es-AR')}</span>
                  </div>
                  {esTodas && (
                    <div>
                      <span className="text-xs text-slate-500 block">Sucursal</span>
                      <span>{v.sucursal_nombre || '—'}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-slate-500 block">Vendedor</span>
                    <span className="truncate block">{v.usuario_nombre || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Pago</span>
                    <span>{labelPago(v)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-500 block">Total</span>
                    <span className="text-lg font-bold">{money(Number(v.total))}</span>
                  </div>
                </div>
              </div>
            ))}
            {filtradas.length === 0 && (
              <p className="text-center py-8 text-slate-400 text-sm">
                {items.length === 0 ? 'Sin ventas todavía' : 'Sin ventas en ese período'}
              </p>
            )}
            {hayMas && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + 40)}
                className="w-full py-3 text-sm font-semibold text-brand-black bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
              >
                Mostrar más ({filtradas.length - visibleCount} restantes)
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Fecha</th>
                  {esTodas && <th className="px-4 py-2">Sucursal</th>}
                  <th className="px-4 py-2">Vendedor</th>
                  <th className="px-4 py-2">Pago</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((v) => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{v.id}</td>
                    <td className="px-4 py-2">{new Date(v.fecha).toLocaleString('es-AR')}</td>
                    {esTodas && (
                      <td className="px-4 py-2 text-slate-600">{v.sucursal_nombre || '—'}</td>
                    )}
                    <td className="px-4 py-2">{v.usuario_nombre || '—'}</td>
                    <td className="px-4 py-2">{labelPago(v)}</td>
                    <td className="px-4 py-2 font-semibold">{money(Number(v.total))}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end">
                        <AccionesVenta
                          v={v}
                          isAdmin={isAdmin}
                          deletingId={deletingId}
                          onVer={() => void verDetalle(v.id)}
                          onEliminar={() => void eliminar(v)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={esTodas ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
                      {items.length === 0 ? 'Sin ventas todavía' : 'Sin ventas en ese período'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {hayMas && (
              <div className="pt-4 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + 40)}
                  className="w-full py-2 text-sm font-semibold text-brand-black bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                >
                  Mostrar más ({filtradas.length - visibleCount} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-display text-2xl">Venta #{detalle.id}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(detalle.fecha).toLocaleString('es-AR')}
                  {detalle.sucursal_nombre ? ` · ${detalle.sucursal_nombre}` : ''}
                  {detalle.usuario_nombre ? ` · ${detalle.usuario_nombre}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              {detalle.notas && (
                <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Observación
                  </p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                    {detalle.notas}
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {(detalle.detalles || []).map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                  >
                    <p className="text-sm font-medium text-brand-black break-words">
                      {d.producto_nombre ||
                        d.descripcion ||
                        (d.producto_id ? `Producto #${d.producto_id}` : 'Importe directo')}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="block text-slate-400">Cant.</span>
                        <span className="font-medium text-slate-800">{d.cantidad}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400">P. unit.</span>
                        <span className="font-medium text-slate-800">
                          {money(Number(d.precio_unitario))}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-slate-400">Subtotal</span>
                        <span className="font-semibold text-brand-black">
                          {money(Number(d.subtotal))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {(detalle.detalles || []).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Sin productos</p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                <span className="text-sm text-slate-500">{labelPago(detalle)}</span>
                <div className="font-semibold flex gap-4">
                  <span>Total</span>
                  <span>{money(Number(detalle.total))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
