import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Building,
  Calendar,
  Check,
  Percent,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { money } from '../utils/money'

type PrecioSucursal = {
  sucursal_id: number
  sucursal_nombre: string
  precio: number
  porcentaje_ganancia: number
}

type Actualizacion = {
  id: number
  producto_id: number
  producto_nombre: string
  costo_anterior: number
  costo_nuevo: number
  precio_venta_actual: number
  porcentaje_ganancia?: number
  precios_por_sucursal?: PrecioSucursal[]
  fecha_detectado: string
  sucursal_nombre?: string | null
  proveedor_nombre?: string | null
}

type Alcance = 'todas' | 'una'

export default function Actualizaciones() {
  const { sucursales } = useSucursal()
  const [pendientes, setPendientes] = useState<Actualizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Actualizacion | null>(null)
  const [nuevoPrecioVenta, setNuevoPrecioVenta] = useState('')
  const [porcentajeManual, setPorcentajeManual] = useState('')
  const [margenProyectado, setMargenProyectado] = useState(0)
  const [alcance, setAlcance] = useState<Alcance>('todas')
  const [sucursalDestinoId, setSucursalDestinoId] = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<Actualizacion[]>('/actualizaciones-precios')
      setPendientes(data)
    } catch {
      toast.error('Error al cargar actualizaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function precioBaseParaSugerencia(item: Actualizacion, sucursalId?: string) {
    if (sucursalId) {
      const row = item.precios_por_sucursal?.find((p) => String(p.sucursal_id) === sucursalId)
      if (row) return Number(row.precio) || 0
    }
    return Number(item.precio_venta_actual) || 0
  }

  function calcMargen(precioVenta: number, costo: number) {
    if (!costo) return 0
    return ((precioVenta - costo) / costo) * 100
  }

  function sugerirPrecio(item: Actualizacion, ventaActual: number) {
    const ant = Number(item.costo_anterior) || 0
    const neu = Number(item.costo_nuevo) || 0
    const margenAnterior = ant > 0 ? (ventaActual - ant) / ant : 0.3
    return Math.ceil(neu * (1 + margenAnterior))
  }

  function handlePriceChange(val: string) {
    setNuevoPrecioVenta(val)
    if (!selected) return
    setMargenProyectado(calcMargen(parseFloat(val) || 0, Number(selected.costo_nuevo)))
  }

  function openResolver(item: Actualizacion) {
    setSelected(item)
    setAlcance('todas')
    setSucursalDestinoId('')
    const venta = precioBaseParaSugerencia(item)
    const sugerido = sugerirPrecio(item, venta)
    setNuevoPrecioVenta(String(sugerido))
    setPorcentajeManual('')
    setMargenProyectado(calcMargen(sugerido, Number(item.costo_nuevo)))
  }

  function onAlcanceChange(next: Alcance) {
    if (!selected) return
    setAlcance(next)
    if (next === 'todas') {
      setSucursalDestinoId('')
      const venta = precioBaseParaSugerencia(selected)
      const sugerido = sugerirPrecio(selected, venta)
      handlePriceChange(String(sugerido))
    }
  }

  function onSucursalDestinoChange(id: string) {
    if (!selected) return
    setSucursalDestinoId(id)
    const venta = precioBaseParaSugerencia(selected, id)
    const sugerido = sugerirPrecio(selected, venta)
    handlePriceChange(String(sugerido))
  }

  function aplicarPorcentaje() {
    if (!selected) return
    const pct = parseFloat(porcentajeManual) || 0
    const nuevo = Math.ceil(Number(selected.costo_nuevo) * (1 + pct / 100))
    handlePriceChange(String(nuevo))
    toast.success(`Precio calculado al ${pct}%`)
  }

  async function confirmar() {
    if (!selected) return
    if (alcance === 'una' && !sucursalDestinoId) {
      toast.error('Elegí la sucursal a actualizar')
      return
    }
    const precioVentaNum = parseFloat(nuevoPrecioVenta) || 0
    const costoNuevo = Number(selected.costo_nuevo) || 0
    const nuevoPorcentaje =
      costoNuevo > 0 ? ((precioVentaNum - costoNuevo) / costoNuevo) * 100 : 0
    try {
      await api.post(`/actualizaciones-precios/${selected.id}/resolver`, {
        precio: precioVentaNum,
        porcentaje_ganancia: Number(nuevoPorcentaje.toFixed(2)),
        ...(alcance === 'una' ? { sucursal_id: Number(sucursalDestinoId) } : {}),
      })
      toast.success(
        alcance === 'una'
          ? 'Precio actualizado en la sucursal elegida'
          : 'Precio actualizado en todas las sucursales'
      )
      setPendientes((prev) => prev.filter((p) => p.id !== selected.id))
      setSelected(null)
    } catch {
      toast.error('Error al actualizar')
    }
  }

  async function descartar(id: number) {
    if (!confirm('¿Descartar esta alerta? El precio de venta no cambiará.')) return
    try {
      await api.delete(`/actualizaciones-precios/${id}`)
      setPendientes((prev) => prev.filter((p) => p.id !== id))
      toast.success('Alerta descartada')
    } catch {
      toast.error('Error al descartar')
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando actualizaciones…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-brand-lime/20">
          <TrendingUp className="h-7 w-7 text-brand-black" />
        </div>
        <div>
          <h2 className="page-title">Actualizaciones</h2>
          <p className="text-slate-500 text-sm">
            Revisión de cambios de costo detectados en compras
          </p>
        </div>
      </div>

      {pendientes.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <Check className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-emerald-800">Todo al día</h3>
          <p className="text-emerald-700 text-sm">No hay cambios de costo pendientes.</p>
        </div>
      )}

      <div className="space-y-3">
        {pendientes.map((item) => {
          const ant = Number(item.costo_anterior)
          const neu = Number(item.costo_nuevo)
          const diferencia = neu - ant
          const esAumento = diferencia > 0
          const pctCambio = ant > 0 ? Math.abs((diferencia / ant) * 100).toFixed(1) : '0'
          const margenHoy =
            neu > 0
              ? (((Number(item.precio_venta_actual) - neu) / neu) * 100).toFixed(1)
              : '0'

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border border-slate-200 border-l-4 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 ${
                esAumento ? 'border-l-orange-500' : 'border-l-emerald-500'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-semibold text-brand-black">{item.producto_nombre}</h3>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                      esAumento ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {esAumento ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {esAumento ? '+' : '-'}
                    {pctCambio}% costo
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={14} /> {new Date(item.fecha_detectado).toLocaleDateString('es-AR')}
                  </span>
                  {item.sucursal_nombre && <span>{item.sucursal_nombre}</span>}
                  {item.proveedor_nombre && (
                    <span className="inline-flex items-center gap-1">
                      <Building size={14} /> {item.proveedor_nombre}
                    </span>
                  )}
                </div>
                {item.precios_por_sucursal && item.precios_por_sucursal.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {item.precios_por_sucursal
                      .map((p) => `${p.sucursal_nombre}: ${money(Number(p.precio))}`)
                      .join(' · ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 font-bold">Costo ant.</p>
                  <p className="line-through text-slate-500 text-sm">{money(ant)}</p>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-600">Nuevo</p>
                  <p className="font-bold text-brand-black">{money(neu)}</p>
                </div>
              </div>

              <div className="md:text-right">
                <p className="text-[10px] uppercase text-slate-500 font-bold">Venta (hoy)</p>
                <p className="font-bold text-lg">{money(Number(item.precio_venta_actual))}</p>
                <p className={`text-xs font-medium ${esAumento ? 'text-rose-600' : 'text-emerald-600'}`}>
                  Margen hoy: {margenHoy}%
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => openResolver(item)}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {esAumento ? 'Actualizar precio' : 'Revisar precio'}
                </button>
                <button
                  type="button"
                  onClick={() => void descartar(item.id)}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Ignorar alerta
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-2xl">Actualizar precio</h3>
              <button type="button" onClick={() => setSelected(null)} className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm font-medium text-brand-black">{selected.producto_nombre}</p>

            <div className="space-y-2">
              <p className="text-sm text-slate-600 font-medium">¿Dónde aplicar el precio?</p>
              <label className="flex items-center gap-2 text-sm rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="alcance"
                  checked={alcance === 'todas'}
                  onChange={() => onAlcanceChange('todas')}
                />
                Todas las sucursales
              </label>
              <label className="flex items-center gap-2 text-sm rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="alcance"
                  checked={alcance === 'una'}
                  onChange={() => onAlcanceChange('una')}
                />
                Solo una sucursal
              </label>
              {alcance === 'una' && (
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={sucursalDestinoId}
                  onChange={(e) => onSucursalDestinoChange(e.target.value)}
                  required
                >
                  <option value="">Elegí sucursal…</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                      {selected.precios_por_sucursal?.find((p) => p.sucursal_id === s.id)
                        ? ` · hoy ${money(
                            Number(
                              selected.precios_por_sucursal.find((p) => p.sucursal_id === s.id)
                                ?.precio
                            )
                          )}`
                        : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
              <p className="text-xs font-bold uppercase text-sky-700 mb-1">Mantener margen</p>
              <button
                type="button"
                className="text-lg font-bold text-sky-900 hover:underline"
                onClick={() => {
                  const venta = precioBaseParaSugerencia(
                    selected,
                    alcance === 'una' ? sucursalDestinoId : undefined
                  )
                  handlePriceChange(String(sugerirPrecio(selected, venta)))
                }}
              >
                {money(
                  sugerirPrecio(
                    selected,
                    precioBaseParaSugerencia(
                      selected,
                      alcance === 'una' ? sucursalDestinoId : undefined
                    )
                  )
                )}
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Calcular por % de ganancia</label>
              <div className="flex">
                <div className="relative flex-1">
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-l-lg text-sm"
                    value={porcentajeManual}
                    onChange={(e) => setPorcentajeManual(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={aplicarPorcentaje}
                  className="px-4 py-2 bg-brand-black text-brand-lime rounded-r-lg text-sm font-bold"
                >
                  Calcular
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1 text-center">Precio final a aplicar</label>
              <input
                type="number"
                className="w-full rounded-lg border-2 border-brand-lime/40 px-3 py-3 text-2xl font-black text-center"
                value={nuevoPrecioVenta}
                onChange={(e) => handlePriceChange(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center bg-slate-50 rounded-lg border border-dashed border-slate-300 px-3 py-2">
              <span className="text-sm text-slate-600">Margen proyectado</span>
              <span
                className={`text-xl font-bold ${margenProyectado < 20 ? 'text-rose-600' : 'text-emerald-600'}`}
              >
                {margenProyectado.toFixed(1)}%
              </span>
            </div>

            <button type="button" onClick={() => void confirmar()} className="w-full btn-primary py-3 text-base inline-flex items-center justify-center gap-2">
              <Check size={20} /> Confirmar cambio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
