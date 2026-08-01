import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, Trash2, X } from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { useAuth } from '../contexts/AuthContext'
import type { Venta } from '../types'

type Detalle = {
  id: number
  producto_id: number
  producto_nombre?: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

type VentaDetalle = Venta & { detalles: Detalle[] }

function money(n: number) {
  return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export default function Ventas() {
  const { sucursalId, esTodas, sucursal } = useSucursal()
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<Venta[]>([])
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function load() {
    const params = sucursalId ? { sucursal_id: sucursalId } : {}
    const { data } = await api.get<Venta[]>('/ventas', { params })
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar ventas'))
  }, [sucursalId])

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-brand-black">Ventas</h2>
          <p className="text-slate-500 text-sm">
            {esTodas ? 'Todas las sucursales' : sucursal?.nombre}
          </p>
        </div>
        {esTodas ? (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Elegí una sucursal para cargar una venta
          </span>
        ) : (
          <Link
            to="/ventas/nueva"
            className="btn-primary px-4 py-2 text-sm font-semibold"
          >
            Nueva venta
          </Link>
        )}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Fecha</th>
              {esTodas && <th className="px-4 py-2">Sucursal</th>}
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Pago</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{v.id}</td>
                <td className="px-4 py-2">{new Date(v.fecha).toLocaleString('es-AR')}</td>
                {esTodas && (
                  <td className="px-4 py-2 text-slate-600">{v.sucursal_nombre || '—'}</td>
                )}
                <td className="px-4 py-2">{v.cliente_nombre || '—'}</td>
                <td className="px-4 py-2 capitalize">{v.metodo_pago}</td>
                <td className="px-4 py-2 font-semibold">{money(Number(v.total))}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      title="Ver productos"
                      onClick={() => void verDetalle(v.id)}
                      className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                    >
                      <Eye size={16} />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        title="Eliminar venta"
                        disabled={deletingId === v.id}
                        onClick={() => void eliminar(v)}
                        className="p-1.5 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={esTodas ? 7 : 6}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Sin ventas todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-display text-2xl">Venta #{detalle.id}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(detalle.fecha).toLocaleString('es-AR')}
                  {detalle.sucursal_nombre ? ` · ${detalle.sucursal_nombre}` : ''}
                  {detalle.cliente_nombre ? ` · ${detalle.cliente_nombre}` : ''}
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
            <div className="p-5">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Producto</th>
                    <th className="pb-2">Cant.</th>
                    <th className="pb-2">Precio</th>
                    <th className="pb-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalle.detalles || []).map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="py-2 pr-2">
                        {d.producto_nombre || `Producto #${d.producto_id}`}
                      </td>
                      <td className="py-2">{d.cantidad}</td>
                      <td className="py-2">{money(Number(d.precio_unitario))}</td>
                      <td className="py-2 text-right font-medium">
                        {money(Number(d.subtotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm text-slate-500 capitalize">
                  {detalle.metodo_pago}
                </span>
                <div className="font-semibold flex gap-6">
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
