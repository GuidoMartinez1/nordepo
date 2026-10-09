import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Minus,
  Plus,
  RefreshCw,
  Smartphone,
  Store,
  Trash2,
} from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { money } from '../utils/money'
import type { CuentaMp, Producto } from '../types'

type LineaCambio = {
  key: string
  tipo: 'producto' | 'directo'
  producto?: Producto
  descripcion?: string
  cantidad: number
  precioUnitario: string
}

const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'mercadopago', label: 'Mercado Pago', icon: Smartphone },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
]

const RECARGO_TARJETA_DEFAULT_PCT = 15

function totalLineas(lineas: LineaCambio[]) {
  return lineas.reduce(
    (acc, l) => acc + Math.round(Number(l.precioUnitario || 0)) * l.cantidad,
    0
  )
}

export default function Cambios() {
  const { sucursalId, sucursal, esTodas, sucursales, setSucursalId } = useSucursal()
  const navigate = useNavigate()
  const [productos, setProductos] = useState<Producto[]>([])
  const [cuentasMp, setCuentasMp] = useState<CuentaMp[]>([])
  const [q, setQ] = useState('')
  const [devoluciones, setDevoluciones] = useState<LineaCambio[]>([])
  const [entregas, setEntregas] = useState<LineaCambio[]>([])
  const [descripcionDirecta, setDescripcionDirecta] = useState('')
  const [importeDirecto, setImporteDirecto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [cuentaMpId, setCuentaMpId] = useState('')
  const [recargoTarjetaPct, setRecargoTarjetaPct] = useState(String(RECARGO_TARJETA_DEFAULT_PCT))
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!sucursalId) return
    api
      .get<Producto[]>('/productos', { params: { sucursal_id: sucursalId } })
      .then((res) => setProductos(res.data))
      .catch(() => toast.error('Error al cargar productos'))
    api
      .get<CuentaMp[]>('/cuentas-mp', { params: { sucursal_id: sucursalId } })
      .then((res) => setCuentasMp(res.data))
      .catch(() => setCuentasMp([]))
    setCuentaMpId('')
    setDevoluciones([])
    setEntregas([])
  }, [sucursalId])

  const productosVisibles = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return productos.slice(0, 40)
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(needle) ||
          (p.codigo || '').toLowerCase().includes(needle)
      )
      .slice(0, 40)
  }, [productos, q])

  const totalDevuelto = totalLineas(devoluciones)
  const totalEntregado = totalLineas(entregas)
  const diferencia = totalEntregado - totalDevuelto
  const recargoTarjeta =
    diferencia > 0 && metodoPago === 'tarjeta'
      ? Math.round((diferencia * (parseFloat(recargoTarjetaPct) || 0)) / 100)
      : 0
  const totalACobrar = Math.max(0, diferencia) + recargoTarjeta

  if (esTodas || !sucursalId) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="page-title">Cambios</h2>
          <p className="text-slate-500 text-sm mt-1">
            Elegí en qué sucursal se registra el cambio
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sucursales.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSucursalId(s.id)}
              className="group text-left rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm hover:border-brand-lime hover:bg-brand-black transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-brand-lime/20 text-brand-black p-3 group-hover:bg-brand-lime">
                  <Store className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-display text-2xl text-brand-black group-hover:text-white">
                    {s.nombre}
                  </h3>
                  <p className="text-sm text-slate-500 group-hover:text-zinc-400">
                    Stock de esta sucursal
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function addLinea(tipo: 'devolucion' | 'entrega', producto: Producto) {
    const setter = tipo === 'devolucion' ? setDevoluciones : setEntregas
    setter((prev) => {
      const existing = prev.find((l) => l.tipo === 'producto' && l.producto?.id === producto.id)
      if (existing) {
        if (tipo === 'entrega' && existing.cantidad + 1 > (producto.stock ?? 0)) {
          toast.error(`Stock insuficiente. Disponible: ${producto.stock ?? 0}`)
          return prev
        }
        return prev.map((l) =>
          l.tipo === 'producto' && l.producto?.id === producto.id
            ? { ...l, cantidad: l.cantidad + 1 }
            : l
        )
      }
      if (tipo === 'entrega' && (producto.stock ?? 0) <= 0) {
        toast.error('Sin stock en esta sucursal')
        return prev
      }
      return [
        ...prev,
        {
          key: `${tipo}-${producto.id}`,
          tipo: 'producto',
          producto,
          cantidad: 1,
          precioUnitario: String(Math.round(Number(producto.precio || 0))),
        },
      ]
    })
  }

  function addImporteDirecto() {
    const monto = Math.round(Number(importeDirecto))
    if (!monto || monto <= 0) {
      toast.error('Ingresá un importe válido')
      return
    }
    setEntregas((prev) => [
      ...prev,
      {
        key: `directo-${Date.now()}`,
        tipo: 'directo',
        descripcion: descripcionDirecta.trim() || 'Importe directo',
        cantidad: 1,
        precioUnitario: String(monto),
      },
    ])
    setDescripcionDirecta('')
    setImporteDirecto('')
  }

  function setCantidad(tipo: 'devolucion' | 'entrega', key: string, cantidad: number) {
    const setter = tipo === 'devolucion' ? setDevoluciones : setEntregas
    setter((prev) => {
      const linea = prev.find((l) => l.key === key)
      if (!linea) return prev
      if (cantidad <= 0) return prev.filter((l) => l.key !== key)
      if (linea.tipo === 'producto' && tipo === 'entrega' && cantidad > (linea.producto?.stock ?? 0)) {
        toast.error(`Stock insuficiente. Disponible: ${linea.producto?.stock ?? 0}`)
        return prev
      }
      return prev.map((l) => (l.key === key ? { ...l, cantidad } : l))
    })
  }

  function removeLinea(tipo: 'devolucion' | 'entrega', key: string) {
    const setter = tipo === 'devolucion' ? setDevoluciones : setEntregas
    setter((prev) => prev.filter((l) => l.key !== key))
  }

  function setPrecioUnitario(tipo: 'devolucion' | 'entrega', key: string, value: string) {
    const cleaned = value.replace(',', '.').replace(/[^\d.]/g, '')
    const parts = cleaned.split('.')
    const finalValue =
      parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned
    const setter = tipo === 'devolucion' ? setDevoluciones : setEntregas
    setter((prev) =>
      prev.map((l) => (l.key === key ? { ...l, precioUnitario: finalValue } : l))
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sucursalId) return
    if (!devoluciones.length || !entregas.length) {
      toast.error('Agregá productos devueltos y productos entregados')
      return
    }
    if (diferencia > 0 && metodoPago === 'mercadopago' && !cuentaMpId) {
      toast.error('Elegí a qué alias se transfiere')
      return
    }

    setSaving(true)
    try {
      await api.post('/cambios', {
        sucursal_id: sucursalId,
        metodo_pago: diferencia > 0 ? metodoPago : 'efectivo',
        tipo_tarjeta: diferencia > 0 && metodoPago === 'tarjeta' ? 'credito' : null,
        cuenta_mp_id:
          diferencia > 0 && metodoPago === 'mercadopago' ? Number(cuentaMpId) : null,
        notas,
        devoluciones: devoluciones.map((l) => ({
          producto_id: l.producto?.id,
          cantidad: l.cantidad,
          precio_unitario: Math.round(Number(l.precioUnitario || 0)),
        })),
        entregas: entregas.map((l) => ({
          producto_id: l.producto?.id,
          descripcion: l.tipo === 'directo' ? l.descripcion || 'Importe directo' : undefined,
          cantidad: l.cantidad,
          precio_unitario: Math.round(Number(l.precioUnitario || 0)),
        })),
        recargo_tarjeta:
          recargoTarjeta > 0
            ? {
                descripcion: `Recargo tarjeta (${parseFloat(recargoTarjetaPct) || 0}%)`,
                monto: recargoTarjeta,
              }
            : null,
      })
      toast.success('Cambio registrado')
      navigate('/ventas')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo registrar el cambio'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function renderLineas(tipo: 'devolucion' | 'entrega', lineas: LineaCambio[]) {
    const esDevolucion = tipo === 'devolucion'
    return (
      <div className="space-y-2">
        {lineas.length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center">
            {esDevolucion ? 'Sin productos devueltos' : 'Sin productos entregados'}
          </p>
        )}
        {lineas.map((l) => (
          <div key={l.key} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {l.tipo === 'directo' ? l.descripcion : l.producto?.nombre}
                </p>
                <p className="text-xs text-slate-500">
                  {l.tipo === 'directo'
                    ? 'Importe directo'
                    : `Precio actual: ${money(l.producto?.precio)}`}
                  {!esDevolucion && l.tipo === 'producto'
                    ? ` · stock ${l.producto?.stock ?? 0}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeLinea(tipo, l.key)}
                className="p-1 rounded text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCantidad(tipo, l.key, l.cantidad - 1)}
                    className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                  type="number"
                  min={1}
                  max={
                    esDevolucion || l.tipo === 'directo'
                      ? undefined
                      : l.producto?.stock ?? undefined
                  }
                  value={l.cantidad}
                    onChange={(e) => setCantidad(tipo, l.key, Math.round(Number(e.target.value)))}
                    className="w-14 h-8 text-center rounded-lg border border-slate-300 text-sm font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setCantidad(tipo, l.key, l.cantidad + 1)}
                    className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                  $/u
                  <input
                    type="text"
                    inputMode="numeric"
                    value={l.precioUnitario}
                    onChange={(e) => setPrecioUnitario(tipo, l.key, e.target.value)}
                    className="w-24 h-8 rounded-lg border border-slate-300 px-2 text-right text-sm font-semibold text-brand-black"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <span
                  className={`font-bold text-sm tabular-nums ${esDevolucion ? 'text-emerald-700' : 'text-brand-black'}`}
                >
                  {esDevolucion ? '-' : '+'}
                  {money(Math.round(Number(l.precioUnitario || 0)) * l.cantidad)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="page-title">Cambios</h2>
        <p className="text-slate-500 text-sm">
          {sucursal?.nombre} · el producto devuelto vuelve al stock y el nuevo se descuenta
        </p>
      </div>

      <div className="grid xl:grid-cols-[1fr_1.35fr] gap-6">
        <div className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            placeholder="Buscar producto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-[620px] overflow-auto">
            {productosVisibles.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.nombre}</p>
                  <p className="text-xs text-slate-500">
                    Stock {p.stock ?? 0} · {money(p.precio)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => addLinea('devolucion', p)}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    Devuelve
                  </button>
                  <button
                    type="button"
                    onClick={() => addLinea('entrega', p)}
                    className="rounded-lg border border-brand-black bg-brand-black px-2.5 py-2 text-xs font-bold text-brand-lime hover:brightness-110"
                  >
                    Se lleva
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4" /> Devuelve cliente
                </h3>
                <span className="font-bold text-emerald-800">{money(totalDevuelto)}</span>
              </div>
              {renderLineas('devolucion', devoluciones)}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-brand-black flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" /> Se lleva cliente
                </h3>
                <span className="font-bold text-brand-black">{money(totalEntregado)}</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3 space-y-2">
                <p className="text-xs font-bold uppercase text-slate-500">Importe directo</p>
                <input
                  type="text"
                  value={descripcionDirecta}
                  onChange={(e) => setDescripcionDirecta(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  placeholder="Descripción (opcional)"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={importeDirecto}
                    onChange={(e) =>
                      setImporteDirecto(e.target.value.replace(/[^\d]/g, ''))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
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
                    className="btn-primary px-3 py-2 text-sm font-semibold shrink-0"
                  >
                    Agregar
                  </button>
                </div>
              </div>
              {renderLineas('entrega', entregas)}
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-xs text-emerald-700 font-bold uppercase">Devuelve</p>
                <p className="text-lg font-black text-emerald-900">{money(totalDevuelto)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <p className="text-xs text-slate-500 font-bold uppercase">Se lleva</p>
                <p className="text-lg font-black text-brand-black">{money(totalEntregado)}</p>
              </div>
              <div
                className={`rounded-lg border p-3 ${
                  diferencia > 0
                    ? 'bg-brand-lime/15 border-brand-lime/40'
                    : diferencia < 0
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-100'
                }`}
              >
                <p className="text-xs text-slate-600 font-bold uppercase">
                  {diferencia > 0
                    ? 'Diferencia a cobrar'
                    : diferencia < 0
                      ? 'Saldo a favor'
                      : 'Sin diferencia'}
                </p>
                <p className="text-lg font-black text-brand-black">
                  {diferencia > 0 ? money(totalACobrar) : money(Math.abs(diferencia))}
                </p>
                {recargoTarjeta > 0 && (
                  <p className="text-[11px] font-semibold text-slate-600">
                    Incluye recargo {money(recargoTarjeta)}
                  </p>
                )}
              </div>
            </div>

            {diferencia > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-500">Método de pago</span>
                <div className="grid grid-cols-3 gap-2">
                  {METODOS_PAGO.map((opcion) => {
                    const Icon = opcion.icon
                    const activo = metodoPago === opcion.id
                    return (
                      <button
                        key={opcion.id}
                        type="button"
                        onClick={() => {
                          setMetodoPago(opcion.id)
                          if (opcion.id !== 'mercadopago') setCuentaMpId('')
                        }}
                        className={`min-h-[58px] rounded-lg border px-2 py-2 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                          activo
                            ? 'bg-brand-black border-brand-black text-brand-lime shadow-sm'
                            : 'bg-white border-slate-300 text-slate-600 hover:border-brand-lime hover:text-brand-black'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="leading-tight text-center">{opcion.label}</span>
                      </button>
                    )
                  })}
                </div>
                {metodoPago === 'mercadopago' && (
                  <label className="block text-sm">
                    <span className="text-slate-500">Alias / cuenta destino</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={cuentaMpId}
                      onChange={(e) => setCuentaMpId(e.target.value)}
                      required
                    >
                      <option value="">Elegí alias...</option>
                      {cuentasMp.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} ({c.alias})
                        </option>
                      ))}
                    </select>
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
                          placeholder="15"
                        />
                        <span className="text-sm font-semibold text-amber-900">%</span>
                        <span className="text-xs text-amber-800/80">
                          = {money(recargoTarjeta)}
                        </span>
                      </div>
                    </label>
                    <p className="text-xs text-amber-800/70">
                      Se agrega a la diferencia como concepto de recargo.
                    </p>
                  </div>
                )}
              </div>
            )}

            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas del cambio (opcional)"
            />

            <button
              type="submit"
              disabled={saving || !devoluciones.length || !entregas.length}
              className="w-full btn-primary disabled:opacity-50 py-3 font-semibold inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-5 w-5" />
              {saving ? 'Guardando...' : 'Confirmar cambio'}
            </button>
          </section>
        </div>
      </div>
    </form>
  )
}
