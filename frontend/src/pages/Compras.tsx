import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import type { Producto } from '../types'

type Compra = {
  id: number
  total: number
  fecha: string
  proveedor_nombre?: string | null
}

type Proveedor = { id: number; nombre: string }

export default function Compras() {
  const { sucursalId } = useSucursal()
  const [compras, setCompras] = useState<Compra[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [costo, setCosto] = useState('')
  const [proveedorId, setProveedorId] = useState('')

  async function load() {
    if (!sucursalId) return
    const [c, p, pr] = await Promise.all([
      api.get<Compra[]>('/compras', { params: { sucursal_id: sucursalId } }),
      api.get<Producto[]>('/productos', { params: { sucursal_id: sucursalId } }),
      api.get<Proveedor[]>('/proveedores'),
    ])
    setCompras(c.data)
    setProductos(p.data)
    setProveedores(pr.data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar compras'))
  }, [sucursalId])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!sucursalId || !productoId) return
    try {
      await api.post('/compras', {
        sucursal_id: sucursalId,
        proveedor_id: proveedorId ? Number(proveedorId) : null,
        items: [
          {
            producto_id: Number(productoId),
            cantidad: Number(cantidad),
            precio_unitario: Number(costo) || 0,
          },
        ],
      })
      toast.success('Compra registrada (stock sumado)')
      setProductoId('')
      setCantidad('1')
      setCosto('')
      await load()
    } catch {
      toast.error('No se pudo registrar la compra')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Compras</h2>
        <p className="text-slate-500 text-sm">Ingresan mercadería al stock de la sucursal activa</p>
      </div>

      <form onSubmit={onCreate} className="bg-white rounded-xl border border-slate-200 p-4 grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          required
        >
          <option value="">Producto…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
        >
          <option value="">Proveedor (opcional)</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          required
        />
        <input
          type="number"
          step="0.01"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Costo unitario"
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
          required
        />
        <button
          type="submit"
          className="md:col-span-2 lg:col-span-5 btn-primary py-2 text-sm font-semibold"
        >
          Registrar compra
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{c.id}</td>
                <td className="px-4 py-2">{new Date(c.fecha).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">{c.proveedor_nombre || '—'}</td>
                <td className="px-4 py-2 font-semibold">
                  {Number(c.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
