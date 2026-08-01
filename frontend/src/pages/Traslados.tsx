import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import type { Producto } from '../types'

type Traslado = {
  id: number
  producto_nombre: string
  origen_nombre: string
  destino_nombre: string
  cantidad: number
  fecha: string
}

export default function Traslados() {
  const { sucursales, deposito } = useSucursal()
  const [historial, setHistorial] = useState<Traslado[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoId, setProductoId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [cantidad, setCantidad] = useState('1')

  async function load() {
    const prodParams = deposito?.id ? { sucursal_id: deposito.id } : {}
    const [t, p] = await Promise.all([
      api.get<Traslado[]>('/traslados'),
      api.get<Producto[]>('/productos', { params: prodParams }),
    ])
    setHistorial(t.data)
    // Solo productos con stock en depósito
    setProductos(p.data.filter((prod) => Number(prod.stock) > 0))
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar traslados'))
  }, [deposito?.id])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!destinoId) {
      toast.error('Elegí la sucursal destino')
      return
    }
    try {
      await api.post('/traslados', {
        producto_id: Number(productoId),
        sucursal_destino_id: Number(destinoId),
        cantidad: Number(cantidad),
      })
      toast.success('Traslado registrado')
      setProductoId('')
      setDestinoId('')
      setCantidad('1')
      await load()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo trasladar'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Traslados</h2>
        <p className="text-slate-500 text-sm">
          Mové stock del <span className="font-medium text-brand-black">Depósito</span> hacia una
          sucursal de venta.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="bg-white rounded-xl border border-slate-200 p-4 grid md:grid-cols-4 gap-3"
      >
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          required
        >
          <option value="">Producto en depósito…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} (depósito: {p.stock ?? 0})
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={destinoId}
          onChange={(e) => setDestinoId(e.target.value)}
          required
        >
          <option value="">Sucursal destino…</option>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          required
        />
        <button
          type="submit"
          className="md:col-span-4 btn-primary py-2 text-sm font-semibold"
        >
          Trasladar a sucursal
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Origen → Destino</th>
              <th className="px-4 py-2">Cant.</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{new Date(t.fecha).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">{t.producto_nombre}</td>
                <td className="px-4 py-2">
                  {t.origen_nombre} → {t.destino_nombre}
                </td>
                <td className="px-4 py-2 font-semibold">{t.cantidad}</td>
              </tr>
            ))}
            {historial.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Sin traslados todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
