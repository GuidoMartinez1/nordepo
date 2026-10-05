import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeftRight, Minus, Plus, Trash2 } from 'lucide-react'
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

type CartItem = {
  producto_id: number
  producto_nombre: string
  stock_origen: number
  cantidad: number
}

export default function Traslados() {
  const { sucursales } = useSucursal()
  const [historial, setHistorial] = useState<Traslado[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [origenId, setOrigenId] = useState<string>('')
  const [destinoId, setDestinoId] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)

  // Default: primera → segunda sucursal de venta
  useEffect(() => {
    if (!origenId && sucursales[0]?.id) setOrigenId(String(sucursales[0].id))
    if (!destinoId && sucursales[1]?.id) setDestinoId(String(sucursales[1].id))
    else if (!destinoId && sucursales[0]?.id && origenId && origenId !== String(sucursales[0].id)) {
      setDestinoId(String(sucursales[0].id))
    }
  }, [sucursales, origenId, destinoId])

  async function loadHistorial() {
    const { data } = await api.get<Traslado[]>('/traslados')
    setHistorial(data)
  }

  async function loadProductosOrigen(oid: string) {
    if (!oid) {
      setProductos([])
      return
    }
    const { data } = await api.get<Producto[]>('/productos', {
      params: { sucursal_id: Number(oid) },
    })
    setProductos(data.filter((p) => Number(p.stock) > 0))
  }

  useEffect(() => {
    void loadHistorial().catch(() => toast.error('Error al cargar historial'))
  }, [])

  useEffect(() => {
    setCart([])
    void loadProductosOrigen(origenId).catch(() => toast.error('Error al cargar productos'))
  }, [origenId])

  const origenes = sucursales
  const destinos = sucursales.filter((s) => String(s.id) !== origenId)

  const origenNombre = origenes.find((s) => String(s.id) === origenId)?.nombre || 'Origen'
  const destinoNombre = destinos.find((s) => String(s.id) === destinoId)?.nombre || 'Destino'

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return productos
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(needle) ||
        (p.codigo || '').toLowerCase().includes(needle)
    )
  }, [productos, q])

  function addToCart(p: Producto) {
    const stock = Number(p.stock) || 0
    if (stock <= 0) {
      toast.error('Sin stock en el origen')
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === p.id)
      if (existing) {
        if (existing.cantidad + 1 > stock) {
          toast.error('Stock insuficiente en origen')
          return prev
        }
        return prev.map((i) =>
          i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1, stock_origen: stock } : i
        )
      }
      return [
        {
          producto_id: p.id,
          producto_nombre: p.nombre,
          stock_origen: stock,
          cantidad: 1,
        },
        ...prev,
      ]
    })
  }

  function updateQuantity(productoId: number, cantidad: number) {
    setCart((prev) => {
      const item = prev.find((i) => i.producto_id === productoId)
      if (!item) return prev
      if (cantidad <= 0) return prev.filter((i) => i.producto_id !== productoId)
      if (cantidad > item.stock_origen) {
        toast.error(`Máximo ${item.stock_origen} en origen`)
        return prev.map((i) =>
          i.producto_id === productoId ? { ...i, cantidad: i.stock_origen } : i
        )
      }
      return prev.map((i) => (i.producto_id === productoId ? { ...i, cantidad } : i))
    })
  }

  function removeFromCart(productoId: number) {
    setCart((prev) => prev.filter((i) => i.producto_id !== productoId))
  }

  function swapOrigenDestino() {
    if (!origenId || !destinoId) return
    const prevOrigen = origenId
    setOrigenId(destinoId)
    setDestinoId(prevOrigen)
    setCart([])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!origenId || !destinoId) {
      toast.error('Elegí origen y destino')
      return
    }
    if (origenId === destinoId) {
      toast.error('Origen y destino deben ser distintos')
      return
    }
    if (cart.length === 0) {
      toast.error('Agregá productos al traslado')
      return
    }
    setSaving(true)
    try {
      await api.post('/traslados', {
        sucursal_origen_id: Number(origenId),
        sucursal_destino_id: Number(destinoId),
        items: cart.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
        })),
      })
      toast.success(`Traslado confirmado: ${origenNombre} → ${destinoNombre}`)
      setCart([])
      await Promise.all([loadHistorial(), loadProductosOrigen(origenId)])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo trasladar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const totalUnidades = cart.reduce((acc, i) => acc + i.cantidad, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Traslados</h2>
        <p className="text-slate-500 text-sm">
          Mové stock entre sucursales de venta.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <label className="flex-1 block text-sm">
            <span className="text-slate-500">Origen</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
            >
              <option value="">Elegí origen…</option>
              {origenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={swapOrigenDestino}
            className="self-center sm:mb-0.5 p-2.5 rounded-full border border-slate-200 hover:bg-slate-50 text-brand-black"
            title="Intercambiar origen y destino"
          >
            <ArrowLeftRight size={18} />
          </button>

          <label className="flex-1 block text-sm">
            <span className="text-slate-500">Destino</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
            >
              <option value="">Elegí destino…</option>
              {destinos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        {origenId && destinoId && (
          <p className="mt-3 text-xs text-slate-500">
            Trayecto:{' '}
            <span className="font-semibold text-brand-black">
              {origenNombre} → {destinoNombre}
            </span>
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={`Buscar en ${origenNombre}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={!origenId}
            />
            {!origenId ? (
              <p className="text-sm text-slate-400 text-center py-10">
                Elegí un origen para ver el stock disponible
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-slate-200 p-3 hover:border-brand-lime/50 transition"
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.nombre}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Stock en origen: <span className="font-semibold">{p.stock ?? 0}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        className="shrink-0 btn-primary p-2"
                        title="Agregar al traslado"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-slate-400 sm:col-span-2 py-8 text-center">
                    No hay productos con stock en este origen
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 h-fit lg:sticky lg:top-4">
          <h3 className="font-semibold flex items-center justify-between gap-2">
            <span>Carrito de traslado</span>
            <span className="text-xs font-normal text-slate-500">{cart.length} ítems</span>
          </h3>

          {cart.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Tocá + en los productos para armar el traslado
            </p>
          ) : (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto">
              {cart.map((item) => (
                <li
                  key={item.producto_id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex justify-between gap-2 mb-2">
                    <p className="text-sm font-medium leading-snug">{item.producto_nombre}</p>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.producto_id)}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Disponible: {item.stock_origen}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full bg-white border border-slate-300 grid place-items-center"
                      onClick={() => updateQuantity(item.producto_id, item.cantidad - 1)}
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={item.stock_origen}
                      className="w-14 text-center rounded border border-slate-300 py-1 text-sm"
                      value={item.cantidad}
                      onChange={(e) =>
                        updateQuantity(item.producto_id, Number(e.target.value) || 1)
                      }
                    />
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full bg-white border border-slate-300 grid place-items-center"
                      onClick={() => updateQuantity(item.producto_id, item.cantidad + 1)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-sm">
            <span className="text-slate-600">Unidades</span>
            <span className="font-bold text-brand-black">{totalUnidades}</span>
          </div>

          <button
            type="submit"
            disabled={saving || cart.length === 0 || !origenId || !destinoId}
            className="w-full btn-primary py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? 'Trasladando…' : `Confirmar traslado (${totalUnidades})`}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-sm">Historial reciente</h3>
        </div>
        <div className="hidden md:block overflow-x-auto">
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
        <div className="md:hidden p-3 space-y-2">
          {historial.map((t) => (
            <div key={t.id} className="border border-slate-200 rounded-lg p-3 text-sm">
              <p className="font-medium">{t.producto_nombre}</p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(t.fecha).toLocaleString('es-AR')}
              </p>
              <p className="mt-1">
                {t.origen_nombre} → {t.destino_nombre} ·{' '}
                <span className="font-semibold">{t.cantidad}</span>
              </p>
            </div>
          ))}
          {historial.length === 0 && (
            <p className="text-center py-6 text-slate-400 text-sm">Sin traslados todavía</p>
          )}
        </div>
      </div>
    </div>
  )
}
