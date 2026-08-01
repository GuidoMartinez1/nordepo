import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, Plus, X } from 'lucide-react'
import api from '../services/api'

type Compra = {
  id: number
  total: number
  fecha: string
  proveedor_nombre?: string | null
  sucursal_nombre?: string
}

type Detalle = {
  id: number
  producto_id: number
  producto_nombre?: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

type CompraDetalle = Compra & { detalles: Detalle[] }

function money(n: number) {
  return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export default function Compras() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [detalle, setDetalle] = useState<CompraDetalle | null>(null)

  async function load() {
    const { data } = await api.get<Compra[]>('/compras')
    setCompras(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar compras'))
  }, [])

  async function verDetalle(id: number) {
    try {
      const { data } = await api.get<CompraDetalle>(`/compras/${id}`)
      setDetalle(data)
    } catch {
      toast.error('No se pudo cargar el detalle')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-brand-black">Compras</h2>
          <p className="text-slate-500 text-sm">
            Toda compra ingresa al depósito. Después se traslada a las sucursales.
          </p>
        </div>
        <Link to="/compras/nueva" className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2">
          <Plus size={16} /> Nueva compra
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay compras. Creá una con varios productos.
                </td>
              </tr>
            )}
            {compras.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{c.id}</td>
                <td className="px-4 py-2">{new Date(c.fecha).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">{c.proveedor_nombre || '—'}</td>
                <td className="px-4 py-2 font-semibold">{money(Number(c.total))}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void verDetalle(c.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-brand-black"
                  >
                    <Eye size={16} /> Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-display text-2xl">Compra #{detalle.id}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(detalle.fecha).toLocaleString('es-AR')}
                  {detalle.proveedor_nombre ? ` · ${detalle.proveedor_nombre}` : ''}
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
                    <th className="pb-2">Costo</th>
                    <th className="pb-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalle.detalles || []).map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="py-2 pr-2">{d.producto_nombre || `Producto #${d.producto_id}`}</td>
                      <td className="py-2">{d.cantidad}</td>
                      <td className="py-2">{money(Number(d.precio_unitario))}</td>
                      <td className="py-2 text-right font-medium">{money(Number(d.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between font-semibold">
                <span>Total</span>
                <span>{money(Number(detalle.total))}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
