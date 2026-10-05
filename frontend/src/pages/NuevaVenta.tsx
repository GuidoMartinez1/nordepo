import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  DollarSign,
  MapPin,
  Minus,
  Plus,
  Store,
  Trash2,
  Trophy,
} from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { money } from '../utils/money'
import { getCategoryIcon } from '../utils/categoryIcons'
import type { CuentaMp, Producto } from '../types'

type Categoria = { id: number; nombre: string }

const SIN_CATEGORIA_ID = -1

type LineaProducto = {
  tipo: 'producto'
  key: string
  producto: Producto
  cantidad: number
}

type LineaDirecto = {
  tipo: 'directo'
  key: string
  descripcion: string
  monto: number
}

type LineaRecargo = {
  tipo: 'recargo_tarjeta'
  key: string
  descripcion: string
  monto: number
}

type Linea = LineaProducto | LineaDirecto | LineaRecargo

const RECARGO_KEY = 'recargo-tarjeta'
const RECARGO_DEFAULT_PCT = 10

export default function NuevaVenta() {
  const { sucursalId, sucursal, esTodas, sucursales, setSucursalId } = useSucursal()
  const navigate = useNavigate()
  const montoRef = useRef<HTMLInputElement>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cuentasMp, setCuentasMp] = useState<CuentaMp[]>([])
  const [q, setQ] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [cuentaMpId, setCuentaMpId] = useState('')
  const [importeDirecto, setImporteDirecto] = useState('')
  const [descripcionDirecta, setDescripcionDirecta] = useState('')
  const [recargoTarjetaPct, setRecargoTarjetaPct] = useState(String(RECARGO_DEFAULT_PCT))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!sucursalId) return
    api
      .get<Producto[]>('/productos', { params: { sucursal_id: sucursalId } })
      .then((res) => setProductos(res.data))
      .catch(() => toast.error('Error al cargar productos'))
    api
      .get<Categoria[]>('/categorias')
      .then((res) => setCategorias(res.data))
      .catch(() => setCategorias([]))
    api
      .get<CuentaMp[]>('/cuentas-mp', { params: { sucursal_id: sucursalId } })
      .then((res) => setCuentasMp(res.data))
      .catch(() => setCuentasMp([]))
    setCuentaMpId('')
    setLineas([])
    setCategoriaSeleccionada(null)
    setQ('')
  }, [sucursalId])

  const categoriasConProductos = useMemo(() => {
    const counts = new Map<number, number>()
    let sinCat = 0
    for (const p of productos) {
      if (p.categoria_id == null) sinCat += 1
      else counts.set(p.categoria_id, (counts.get(p.categoria_id) || 0) + 1)
    }
    const list = categorias
      .map((c) => ({ ...c, count: counts.get(c.id) || 0 }))
      .filter((c) => c.count > 0)
    if (sinCat > 0) {
      list.push({ id: SIN_CATEGORIA_ID, nombre: 'Sin categoría', count: sinCat })
    }
    return list
  }, [categorias, productos])

  const productosVisibles = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle) {
      return productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(needle) ||
          (p.codigo || '').toLowerCase().includes(needle)
      )
    }
    if (categoriaSeleccionada === null) return []
    if (categoriaSeleccionada === SIN_CATEGORIA_ID) {
      return productos.filter((p) => p.categoria_id == null)
    }
    return productos.filter((p) => p.categoria_id === categoriaSeleccionada)
  }, [productos, q, categoriaSeleccionada])

  const total = lineas.reduce((acc, l) => {
    if (l.tipo === 'directo' || l.tipo === 'recargo_tarjeta') return acc + l.monto
    return acc + Math.round(Number(l.producto.precio)) * l.cantidad
  }, 0)

  const baseSinRecargo = useMemo(
    () =>
      lineas.reduce((acc, l) => {
        if (l.tipo === 'recargo_tarjeta') return acc
        if (l.tipo === 'directo') return acc + l.monto
        return acc + Math.round(Number(l.producto.precio)) * l.cantidad
      }, 0),
    [lineas]
  )

  useEffect(() => {
    setLineas((prev) => {
      const sinRecargo = prev.filter((l) => l.tipo !== 'recargo_tarjeta')
      const pctParsed = parseFloat(recargoTarjetaPct.replace(',', '.'))
      const pct =
        Number.isFinite(pctParsed) && pctParsed >= 0 ? pctParsed : RECARGO_DEFAULT_PCT
      const base = sinRecargo.reduce((acc, l) => {
        if (l.tipo === 'directo') return acc + l.monto
        return acc + Math.round(Number(l.producto.precio)) * l.cantidad
      }, 0)
      const monto = Math.round((base * pct) / 100)
      const debeTener = metodoPago === 'tarjeta' && sinRecargo.length > 0 && monto > 0

      if (!debeTener) {
        return sinRecargo.length === prev.length ? prev : sinRecargo
      }

      const descripcion = `Recargo tarjeta (${pct}%)`
      const actual = prev.find((l): l is LineaRecargo => l.tipo === 'recargo_tarjeta')
      if (actual && actual.monto === monto && actual.descripcion === descripcion) {
        return prev
      }

      return [
        ...sinRecargo,
        {
          tipo: 'recargo_tarjeta' as const,
          key: RECARGO_KEY,
          descripcion,
          monto,
        },
      ]
    })
  }, [metodoPago, recargoTarjetaPct, baseSinRecargo])

  if (esTodas || !sucursalId) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="page-title">Nueva venta</h2>
          <p className="text-slate-500 text-sm mt-1">
            Elegí en qué sucursal se registra esta venta
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sucursales.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSucursalId(s.id)}
              className="group text-left rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm
                hover:border-brand-lime hover:shadow-md hover:bg-brand-black transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-brand-lime focus:ring-offset-2"
            >
              <div className="flex items-start gap-4">
                <div
                  className="rounded-xl bg-brand-lime/20 text-brand-black p-3
                    group-hover:bg-brand-lime transition-colors"
                >
                  <Store className="h-7 w-7" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl tracking-wide text-brand-black group-hover:text-white transition-colors">
                    {s.nombre}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 group-hover:text-zinc-400 flex items-center gap-1.5 transition-colors">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    Stock y precios de esta sucursal
                  </p>
                </div>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-brand-black/60 group-hover:text-brand-lime transition-colors">
                Tocar para continuar →
              </p>
            </button>
          ))}
          {sucursales.length === 0 && (
            <p className="text-sm text-slate-400 col-span-full py-8 text-center">
              No hay sucursales de venta disponibles
            </p>
          )}
        </div>
      </div>
    )
  }

  function addProducto(p: Producto) {
    if ((p.stock ?? 0) <= 0) {
      toast.error('Sin stock en esta sucursal')
      return
    }
    setLineas((prev) => {
      const existing = prev.find(
        (l): l is LineaProducto => l.tipo === 'producto' && l.producto.id === p.id
      )
      if (existing) {
        if (existing.cantidad + 1 > (p.stock ?? 0)) {
          toast.error('Stock insuficiente')
          return prev
        }
        return prev.map((l) =>
          l.tipo === 'producto' && l.producto.id === p.id
            ? { ...l, cantidad: l.cantidad + 1 }
            : l
        )
      }
      return [
        ...prev,
        { tipo: 'producto', key: `p-${p.id}`, producto: p, cantidad: 1 },
      ]
    })
  }

  function addImporteDirecto() {
    const monto = Math.round(Number(importeDirecto))
    if (!monto || monto <= 0) {
      toast.error('Ingresá un importe válido')
      return
    }
    setLineas((prev) => [
      {
        tipo: 'directo',
        key: `d-${Date.now()}`,
        descripcion: descripcionDirecta.trim() || 'Importe directo',
        monto,
      },
      ...prev,
    ])
    setImporteDirecto('')
    setDescripcionDirecta('')
    montoRef.current?.focus()
  }

  function removeLinea(key: string) {
    if (key === RECARGO_KEY) return
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  function setCantidadProducto(key: string, cantidad: number) {
    setLineas((prev) => {
      const linea = prev.find((l) => l.key === key)
      if (!linea || linea.tipo !== 'producto') return prev
      if (cantidad <= 0) return prev.filter((l) => l.key !== key)
      const stock = linea.producto.stock ?? 0
      if (cantidad > stock) {
        toast.error(`Stock insuficiente. Disponible: ${stock}`)
        return prev
      }
      return prev.map((l) => (l.key === key && l.tipo === 'producto' ? { ...l, cantidad } : l))
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sucursalId || lineas.length === 0) return
    if (metodoPago === 'mercadopago' && !cuentaMpId) {
      toast.error('Elegí a qué alias se transfiere')
      return
    }
    setSaving(true)
    try {
      await api.post('/ventas', {
        sucursal_id: sucursalId,
        metodo_pago: metodoPago,
        cuenta_mp_id: metodoPago === 'mercadopago' ? Number(cuentaMpId) : null,
        items: lineas.map((l) => {
          if (l.tipo === 'directo' || l.tipo === 'recargo_tarjeta') {
            return {
              cantidad: 1,
              precio_unitario: l.monto,
              descripcion: l.descripcion,
            }
          }
          return {
            producto_id: l.producto.id,
            cantidad: l.cantidad,
            precio_unitario: Math.round(Number(l.producto.precio)),
          }
        }),
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
        <p className="text-slate-500 text-sm">
          {sucursal?.nombre} · productos o cobro de importes directos
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            placeholder="Buscar producto…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              if (e.target.value.trim()) setCategoriaSeleccionada(null)
            }}
          />

          {!q.trim() && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categoriasConProductos.map((cat) => {
                const isActive = categoriaSeleccionada === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setCategoriaSeleccionada(isActive ? null : cat.id)
                    }
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isActive
                        ? 'bg-brand-lime/20 border-brand-black ring-1 ring-brand-black shadow-sm text-brand-black'
                        : 'bg-white border-slate-200 hover:border-brand-lime text-slate-600 hover:text-brand-black'
                    }`}
                  >
                    {getCategoryIcon(cat.nombre)}
                    <span
                      className={`text-xs font-bold text-center leading-tight ${
                        isActive ? 'text-brand-black' : 'text-slate-700'
                      }`}
                    >
                      {cat.nombre}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({cat.count})
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {(q.trim() || categoriaSeleccionada !== null) && (
            <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-[420px] overflow-auto">
              {productosVisibles.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-400">
                  No hay productos con ese filtro
                </li>
              ) : (
                productosVisibles.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProducto(p)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between gap-3"
                    >
                      <span>
                        <span className="font-medium block">{p.nombre}</span>
                        <span className="text-xs text-slate-500">
                          Stock {p.stock ?? 0} · {money(p.precio)}
                        </span>
                      </span>
                      <span className="text-brand-lime bg-brand-black rounded px-1.5 text-sm font-bold self-center">
                        +
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {!q.trim() && categoriaSeleccionada === null && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 px-4 text-center text-slate-400">
              <Trophy className="h-9 w-9 mx-auto text-slate-300 mb-2" />
              <p className="text-sm">Seleccioná una categoría para ver los productos</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <h3 className="font-semibold">Ticket</h3>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-black">
              <DollarSign className="h-4 w-4" />
              Importe directo
            </div>
            <input
              type="text"
              value={descripcionDirecta}
              onChange={(e) => setDescripcionDirecta(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              placeholder="Descripción (opcional)"
            />
            <div className="flex gap-2">
              <input
                ref={montoRef}
                type="number"
                step="1"
                min="1"
                value={importeDirecto}
                onChange={(e) => setImporteDirecto(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                placeholder="Monto"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addImporteDirecto()
                  }
                }}
              />
              <button
                type="button"
                onClick={addImporteDirecto}
                className="btn-primary px-4 py-2 text-sm font-semibold shrink-0"
              >
                Agregar
              </button>
            </div>
          </div>

          {lineas.length === 0 && <p className="text-sm text-slate-400">Sin ítems</p>}
          <ul className="space-y-2">
            {lineas.map((l) => (
              <li
                key={l.key}
                className={`border rounded-lg p-2.5 space-y-2 ${
                  l.tipo === 'recargo_tarjeta'
                    ? 'border-amber-200 bg-amber-50/80'
                    : 'border-slate-100'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    {l.tipo === 'recargo_tarjeta' ? (
                      <>
                        <span className="font-medium block truncate text-sm">{l.descripcion}</span>
                        <span className="text-xs text-amber-800/80">Recargo por tarjeta</span>
                      </>
                    ) : l.tipo === 'directo' ? (
                      <>
                        <span className="font-medium block truncate text-sm">{l.descripcion}</span>
                        <span className="text-xs text-slate-500">Importe directo</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium block truncate text-sm">{l.producto.nombre}</span>
                        <span className="text-xs text-slate-500">
                          {money(Math.round(Number(l.producto.precio)))} c/u
                        </span>
                      </>
                    )}
                  </div>
                  {l.tipo !== 'recargo_tarjeta' && (
                    <button
                      type="button"
                      onClick={() => removeLinea(l.key)}
                      className="p-1 rounded text-rose-600 hover:bg-rose-50 shrink-0"
                      title="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {l.tipo === 'producto' ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCantidadProducto(l.key, l.cantidad - 1)}
                        className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-brand-black"
                        title="Restar"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={l.producto.stock ?? undefined}
                        value={l.cantidad}
                        onChange={(e) => {
                          const n = Math.round(Number(e.target.value))
                          if (!Number.isFinite(n)) return
                          setCantidadProducto(l.key, n)
                        }}
                        className="w-14 h-8 text-center rounded-lg border border-slate-300 text-sm font-semibold bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setCantidadProducto(l.key, l.cantidad + 1)}
                        className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-brand-black"
                        title="Sumar"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="font-semibold text-sm tabular-nums">
                      {money(Math.round(Number(l.producto.precio)) * l.cantidad)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <span className="font-semibold text-sm tabular-nums">{money(l.monto)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            <span className="text-slate-500">Método de pago</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={metodoPago}
              onChange={(e) => {
                setMetodoPago(e.target.value)
                if (e.target.value !== 'mercadopago') setCuentaMpId('')
              }}
            >
              <option value="efectivo">Efectivo</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </label>
          {metodoPago === 'mercadopago' && (
            <label className="block text-sm">
              <span className="text-slate-500">Alias / cuenta destino</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={cuentaMpId}
                onChange={(e) => setCuentaMpId(e.target.value)}
                required
              >
                <option value="">Elegí alias…</option>
                {cuentasMp.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.alias})
                  </option>
                ))}
              </select>
              {cuentasMp.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  No hay cuentas MP activas en esta sucursal. Pedile al admin que las cargue.
                </p>
              )}
            </label>
          )}
          {metodoPago === 'tarjeta' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <label className="block text-sm">
                <span className="text-amber-900 font-medium">Recargo tarjeta (%)</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={recargoTarjetaPct}
                    onChange={(e) => {
                      const v = e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
                      const parts = v.split('.')
                      const cleaned =
                        parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : v
                      setRecargoTarjetaPct(cleaned)
                    }}
                    className="w-24 rounded-lg border border-amber-300 px-3 py-2 text-sm bg-white"
                    placeholder="10"
                  />
                  <span className="text-sm font-semibold text-amber-900">%</span>
                  <span className="text-xs text-amber-800/80">
                    ={' '}
                    {money(
                      Math.round(
                        (baseSinRecargo * (parseFloat(recargoTarjetaPct) || 0)) / 100
                      )
                    )}
                  </span>
                </div>
              </label>
              <p className="text-xs text-amber-800/70">
                Se agrega solo al ticket como concepto (tipo importe directo).
              </p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-brand-black">{money(total)}</span>
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
