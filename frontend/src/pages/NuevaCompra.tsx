import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { money } from '../utils/money'
import type { Producto } from '../types'

type Proveedor = { id: number; nombre: string }
type Categoria = { id: number; nombre: string }

type CartItem = {
  producto_id: number
  producto_nombre: string
  cantidad: number
  cantidadTexto?: string
  precio_unitario: string
  subtotal: number
}

export default function NuevaCompra() {
  const { sucursales } = useSucursal()
  const navigate = useNavigate()
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [sucursalDestinoId, setSucursalDestinoId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [q, setQ] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNuevoProducto, setShowNuevoProducto] = useState(false)
  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: '',
    codigo: '',
    precio: '',
    precio_costo: '',
    porcentaje_ganancia: '100',
    categoria_id: '',
  })

  useEffect(() => {
    if (!sucursalDestinoId && sucursales[0]?.id) {
      setSucursalDestinoId(String(sucursales[0].id))
    }
  }, [sucursales, sucursalDestinoId])

  async function load() {
    const params = sucursalDestinoId ? { sucursal_id: Number(sucursalDestinoId) } : {}
    const [p, pr, cats] = await Promise.all([
      api.get<Producto[]>('/productos', { params }),
      api.get<Proveedor[]>('/proveedores'),
      api.get<Categoria[]>('/categorias'),
    ])
    setProductos(p.data)
    setProveedores(pr.data)
    setCategorias(cats.data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar datos'))
  }, [sucursalDestinoId])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return productos.filter((p) => {
      if (categoriaFiltro && String(p.categoria_id ?? '') !== categoriaFiltro) return false
      if (!needle) return true
      return (
        p.nombre.toLowerCase().includes(needle) ||
        (p.codigo || '').toLowerCase().includes(needle)
      )
    })
  }, [productos, q, categoriaFiltro])

  const total = cart.reduce((acc, i) => acc + i.subtotal, 0)

  function addToCart(producto: Producto) {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === producto.id)
      if (existing) {
        const cantidad = existing.cantidad + 1
        return prev.map((i) =>
          i.producto_id === producto.id
            ? { ...i, cantidad, cantidadTexto: String(cantidad), subtotal: cantidad * Number(i.precio_unitario) }
            : i
        )
      }
      const precio = Number(producto.precio_costo) || 0
      return [
        {
          producto_id: producto.id,
          producto_nombre: producto.nombre,
          cantidad: 1,
          precio_unitario: String(precio),
          subtotal: precio,
        },
        ...prev,
      ]
    })
  }

  function updateQuantity(productoId: number, cantidad: number) {
    if (cantidad <= 0) {
      setCart((prev) => prev.filter((i) => i.producto_id !== productoId))
      return
    }
    setCart((prev) =>
      prev.map((i) =>
        i.producto_id === productoId
          ? { ...i, cantidad, cantidadTexto: String(cantidad), subtotal: cantidad * Number(i.precio_unitario) }
          : i
      )
    )
  }

  function editQuantity(productoId: number, value: string) {
    if (!/^\d*$/.test(value) || !Number.isSafeInteger(Number(value))) return
    const cantidad = Number(value)
    setCart((prev) => prev.map((i) => i.producto_id === productoId
      ? { ...i, cantidad, cantidadTexto: value, subtotal: cantidad * Number(i.precio_unitario) }
      : i))
  }

  function updatePrecio(productoId: number, precio: string) {
    const precio_unitario = precio.replace(',', '.')
    if (!/^\d*(\.\d*)?$/.test(precio_unitario)) return
    if (!Number.isFinite(Number(precio_unitario))) return
    setCart((prev) =>
      prev.map((i) =>
        i.producto_id === productoId
          ? { ...i, precio_unitario, subtotal: i.cantidad * Number(precio_unitario) }
          : i
      )
    )
  }

  function removeFromCart(productoId: number) {
    setCart((prev) => prev.filter((i) => i.producto_id !== productoId))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sucursalDestinoId) {
      toast.error('Elegí la sucursal destino')
      return
    }
    if (cart.length === 0) {
      toast.error('Agregá al menos un producto')
      return
    }
    if (cart.some((i) => i.precio_unitario.trim() === '' || !Number.isFinite(Number(i.precio_unitario)) || Number(i.precio_unitario) < 0)) {
      toast.error('Ingresá un costo unitario válido para cada producto')
      return
    }
    if (cart.some((i) => !Number.isSafeInteger(i.cantidad) || i.cantidad <= 0)) {
      toast.error('Ingresá una cantidad entera mayor que cero para cada producto')
      return
    }
    setSaving(true)
    try {
      await api.post('/compras', {
        sucursal_id: Number(sucursalDestinoId),
        proveedor_id: proveedorId ? Number(proveedorId) : null,
        items: cart.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario: Number(i.precio_unitario),
        })),
      })
      const destNombre =
        sucursales.find((s) => String(s.id) === sucursalDestinoId)?.nombre || 'la sucursal'
      toast.success(`Compra registrada. Stock ingresado en ${destNombre}.`)
      navigate('/compras')
    } catch {
      toast.error('No se pudo registrar la compra')
    } finally {
      setSaving(false)
    }
  }

  function calcPrecioDesdeCosto(costoVal: string, pctVal: string) {
    const c = parseFloat(costoVal) || 0
    const pct = parseFloat(pctVal)
    const pctFinal = Number.isFinite(pct) ? pct : 100
    if (c > 0) return (c * (1 + pctFinal / 100)).toFixed(2)
    return ''
  }

  function calcPctDesdePrecio(costoVal: string, precioVal: string) {
    const c = parseFloat(costoVal) || 0
    const precio = parseFloat(precioVal) || 0
    if (c <= 0) return '100'
    return String(Number((((precio - c) / c) * 100).toFixed(2)))
  }

  async function crearProducto(e: FormEvent) {
    e.preventDefault()
    try {
      const { data } = await api.post<Producto>('/productos', {
        nombre: nuevoProducto.nombre.trim(),
        codigo: nuevoProducto.codigo.trim() || null,
        precio: Number(nuevoProducto.precio) || 0,
        precio_costo: Number(nuevoProducto.precio_costo) || 0,
        porcentaje_ganancia: Number(nuevoProducto.porcentaje_ganancia) || 100,
        categoria_id: nuevoProducto.categoria_id ? Number(nuevoProducto.categoria_id) : null,
        stock_inicial: 0,
      })
      toast.success('Producto creado')
      setShowNuevoProducto(false)
      setNuevoProducto({
        nombre: '',
        codigo: '',
        precio: '',
        precio_costo: '',
        porcentaje_ganancia: '100',
        categoria_id: '',
      })
      await load()
      addToCart({
        ...data,
        stock: 0,
        precio_costo: Number(data.precio_costo) || 0,
      })
    } catch {
      toast.error('No se pudo crear el producto')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-brand-black">Nueva compra</h2>
          <p className="text-slate-500 text-sm">
            Elegí proveedor y la sucursal donde ingresa el stock.
          </p>
        </div>
        <Link to="/compras" className="text-sm font-semibold text-slate-600 hover:underline">
          ← Volver al listado
        </Link>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar por nombre o código…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-48"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNuevoProducto(true)}
                className="btn-primary px-3 py-2 text-sm inline-flex items-center justify-center gap-1"
              >
                <Plus size={16} /> Producto
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-200 p-3 hover:border-brand-lime/50 transition"
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.nombre}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Stock: {p.stock ?? 0} · Costo {money(Number(p.precio_costo))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToCart(p)}
                      className="shrink-0 btn-primary p-2"
                      title="Agregar al carrito"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-slate-400 sm:col-span-2 py-8 text-center">
                  No hay productos con ese filtro
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 h-fit lg:sticky lg:top-4">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart size={18} /> Carrito ({cart.length})
          </h3>

          <label className="block text-sm">
            <span className="text-slate-600">Sucursal destino</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={sucursalDestinoId}
              onChange={(e) => setSucursalDestinoId(e.target.value)}
              required
            >
              <option value="">Elegí sucursal…</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-slate-600">Proveedor</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {cart.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sin productos todavía</p>
          ) : (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto">
              {cart.map((item) => (
                <li key={item.producto_id} className="rounded-xl border border-lime-200 bg-lime-50/40 p-3">
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
                  <div className="grid grid-cols-[112px_minmax(0,160px)] justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-600 font-medium block mb-1 text-center">Cantidad</span>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="w-7 h-7 shrink-0 rounded-lg bg-white border border-lime-300 text-lime-800 hover:bg-lime-100 grid place-items-center"
                          onClick={() => updateQuantity(item.producto_id, item.cantidad - 1)}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Cantidad de ${item.producto_nombre}`}
                          className="w-12 text-center rounded border border-slate-300 py-1"
                          value={item.cantidadTexto ?? String(item.cantidad)}
                          onChange={(e) => editQuantity(item.producto_id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault()
                          }}
                        />
                        <button
                          type="button"
                          className="w-7 h-7 shrink-0 rounded-lg bg-white border border-lime-300 text-lime-800 hover:bg-lime-100 grid place-items-center"
                          onClick={() => updateQuantity(item.producto_id, item.cantidad + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <label className="block min-w-0">
                      <span className="text-slate-600 font-medium block mb-1 text-center">Costo unit.</span>
                      <div className="relative flex items-center h-7 rounded-lg border border-lime-300 bg-white focus-within:border-lime-600 focus-within:ring-1 focus-within:ring-lime-600">
                        <span className="absolute left-2 text-lime-700 pointer-events-none" aria-hidden="true">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          aria-label={`Costo unitario de ${item.producto_nombre}`}
                          className="w-full min-w-0 bg-transparent pl-5 pr-2 text-base font-semibold tabular-nums outline-none"
                          value={item.precio_unitario}
                          onChange={(e) => updatePrecio(item.producto_id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault()
                          }}
                        />
                      </div>
                    </label>
                  </div>
                  <p className="text-right text-sm font-bold text-green-600 tabular-nums mt-2">{money(item.subtotal)}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-brand-black">{money(total)}</span>
          </div>

          <button
            type="submit"
            disabled={saving || cart.length === 0}
            className="w-full btn-primary py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? 'Registrando…' : 'Confirmar compra'}
          </button>
        </div>
      </form>

      {showNuevoProducto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form
            onSubmit={crearProducto}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Nuevo producto</h3>
              <button
                type="button"
                onClick={() => setShowNuevoProducto(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Se crea con stock 0 y se agrega al carrito. Al confirmar la compra suman las unidades en la sucursal destino.
            </p>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre (modelo + color + talle)"
              value={nuevoProducto.nombre}
              onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Código"
                value={nuevoProducto.codigo}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, codigo: e.target.value })}
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={nuevoProducto.categoria_id}
                onChange={(e) =>
                  setNuevoProducto({ ...nuevoProducto, categoria_id: e.target.value })
                }
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                step="0.01"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Costo"
                value={nuevoProducto.precio_costo}
                onChange={(e) => {
                  const precio_costo = e.target.value
                  setNuevoProducto((prev) => ({
                    ...prev,
                    precio_costo,
                    precio: calcPrecioDesdeCosto(precio_costo, prev.porcentaje_ganancia),
                  }))
                }}
              />
              <input
                type="number"
                step="0.01"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="% ganancia"
                value={nuevoProducto.porcentaje_ganancia}
                onChange={(e) => {
                  const porcentaje_ganancia = e.target.value
                  setNuevoProducto((prev) => ({
                    ...prev,
                    porcentaje_ganancia,
                    precio: calcPrecioDesdeCosto(prev.precio_costo, porcentaje_ganancia),
                  }))
                }}
              />
              <input
                type="number"
                step="0.01"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Venta"
                value={nuevoProducto.precio}
                onChange={(e) => {
                  const precio = e.target.value
                  setNuevoProducto((prev) => ({
                    ...prev,
                    precio,
                    porcentaje_ganancia: calcPctDesdePrecio(prev.precio_costo, precio),
                  }))
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNuevoProducto(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button type="submit" className="flex-1 btn-primary py-2 text-sm">
                Crear y agregar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
