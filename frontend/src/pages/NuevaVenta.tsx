import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import type { Producto } from '../types'

type Linea = { producto: Producto; cantidad: number }

export default function NuevaVenta() {
  const { sucursalId, sucursal, esTodas } = useSucursal()
  const navigate = useNavigate()
  const [productos, setProductos] = useState<Producto[]>([])
  const [q, setQ] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!sucursalId) return
    api
      .get<Producto[]>('/productos', { params: { sucursal_id: sucursalId } })
      .then((res) => setProductos(res.data))
      .catch(() => toast.error('Error al cargar productos'))
  }, [sucursalId])

  if (esTodas || !sucursalId) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Nueva venta</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">
          Seleccioná una sucursal concreta arriba para vender (el stock y el precio son por sucursal).
        </div>
      </div>
    )
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return productos.slice(0, 30)
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(needle) ||
          (p.codigo || '').toLowerCase().includes(needle)
      )
      .slice(0, 30)
  }, [productos, q])

  const total = lineas.reduce((acc, l) => acc + Number(l.producto.precio) * l.cantidad, 0)

  function addProducto(p: Producto) {
    if ((p.stock ?? 0) <= 0) {
      toast.error('Sin stock en esta sucursal')
      return
    }
    setLineas((prev) => {
      const existing = prev.find((l) => l.producto.id === p.id)
      if (existing) {
        if (existing.cantidad + 1 > (p.stock ?? 0)) {
          toast.error('Stock insuficiente')
          return prev
        }
        return prev.map((l) =>
          l.producto.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l
        )
      }
      return [...prev, { producto: p, cantidad: 1 }]
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sucursalId || lineas.length === 0) return
    setSaving(true)
    try {
      await api.post('/ventas', {
        sucursal_id: sucursalId,
        metodo_pago: metodoPago,
        items: lineas.map((l) => ({
          producto_id: l.producto.id,
          cantidad: l.cantidad,
          precio_unitario: Number(l.producto.precio),
        })),
      })
      toast.success('Venta registrada')
      navigate('/ventas')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo registrar la venta'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Nueva venta</h2>
        <p className="text-slate-500 text-sm">{sucursal?.nombre}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            placeholder="Buscar producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-[420px] overflow-auto">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => addProducto(p)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between gap-3"
                >
                  <span>
                    <span className="font-medium block">{p.nombre}</span>
                    <span className="text-xs text-slate-500">
                      Stock {p.stock ?? 0} ·{' '}
                      {Number(p.precio).toLocaleString('es-AR', {
                        style: 'currency',
                        currency: 'ARS',
                      })}
                    </span>
                  </span>
                  <span className="text-brand-lime bg-brand-black rounded px-1.5 text-sm font-bold">+</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h3 className="font-semibold">Ticket</h3>
          {lineas.length === 0 && <p className="text-sm text-slate-400">Sin ítems</p>}
          <ul className="space-y-2">
            {lineas.map((l) => (
              <li key={l.producto.id} className="flex justify-between text-sm gap-2">
                <span>
                  {l.producto.nombre} × {l.cantidad}
                </span>
                <span className="font-medium">
                  {(Number(l.producto.precio) * l.cantidad).toLocaleString('es-AR', {
                    style: 'currency',
                    currency: 'ARS',
                  })}
                </span>
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            <span className="text-slate-500">Método de pago</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </label>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-brand-black">
              {total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </span>
          </div>
          <button
            type="submit"
            disabled={saving || lineas.length === 0}
            className="w-full btn-primary disabled:opacity-50 py-2.5 font-semibold"
          >
            {saving ? 'Guardando…' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </form>
  )
}
