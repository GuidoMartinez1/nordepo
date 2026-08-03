import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import {
  Calendar,
  Filter,
  Pencil,
  PlusCircle,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import api from '../services/api'
import { money } from '../utils/money'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIAS = [
  { value: 'GASTOS_VARIOS', label: 'Gastos Varios (Papelera, etc.)' },
  { value: 'SERVICIOS_IMPUESTOS', label: 'Servicios/Impuestos' },
  { value: 'OTROS', label: 'Otros' },
]

type Gasto = {
  id: number
  concepto: string
  monto: number
  moneda: 'ARS' | 'USD'
  monto_ars: number
  fecha: string
  categoria: string
}

function num(v: number | string | undefined) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatArs(v: number | string | undefined) {
  return money(v)
}

function formatCurrency(amount: number | string | undefined, currency: 'ARS' | 'USD') {
  if (currency === 'USD') {
    return `u$d ${num(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  }
  return formatArs(amount)
}

function formatDateUTC(dateString: string) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  const day = date.getUTCDate().toString().padStart(2, '0')
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${day}/${month}/${year}`
}

function todayLocal() {
  return new Date().toLocaleDateString('en-CA')
}

function categoriaLabel(value?: string) {
  if (!value) return 'N/A'
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value
}

function CotizacionForm({ onSaved }: { onSaved: () => void }) {
  const [fecha, setFecha] = useState(todayLocal())
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/cotizaciones', { fecha, valor: num(valor) })
      toast.success('Cotización guardada')
      setValor('')
      onSaved()
    } catch {
      toast.error('Error al guardar cotización')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 w-full">
      <h4 className="text-xs font-bold text-amber-900 flex items-center mb-3 uppercase tracking-wide">
        <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
        Actualizar dólar
      </h4>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="w-full sm:flex-1">
          <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase">
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full text-xs rounded border border-amber-300 px-2 py-1.5"
            required
          />
        </div>
        <div className="w-full sm:flex-1">
          <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase">
            Valor ($)
          </label>
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full text-xs rounded border border-amber-300 px-2 py-1.5"
            step="0.01"
            placeholder="0.00"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !valor}
          className="w-full sm:w-auto px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

function GastoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Gasto
  onSave: () => void
  onCancel?: () => void
}) {
  const isEditing = !!initial
  const [concepto, setConcepto] = useState(initial?.concepto || '')
  const [monto, setMonto] = useState(initial ? String(initial.monto) : '')
  const [fecha, setFecha] = useState(
    initial?.fecha ? new Date(initial.fecha).toISOString().split('T')[0] : todayLocal()
  )
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>(initial?.moneda || 'ARS')
  const [categoria, setCategoria] = useState(initial?.categoria || CATEGORIAS[0].value)
  const [cotizacion, setCotizacion] = useState(1)
  const [cotLoading, setCotLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (moneda !== 'USD' || !fecha) {
        setCotizacion(1)
        return
      }
      setCotLoading(true)
      try {
        const { data } = await api.get<{ valor: number }>(`/cotizaciones/fecha/${fecha}`)
        const valor = num(data.valor)
        if (!cancelled) {
          setCotizacion(valor < 1 ? 0 : valor)
          if (valor < 1) toast.error(`Sin cotización USD para ${fecha}`)
        }
      } catch {
        if (!cancelled) setCotizacion(0)
      } finally {
        if (!cancelled) setCotLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [fecha, moneda])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (moneda === 'USD' && (cotizacion < 1 || cotLoading)) {
      toast.error('Falta cotización USD válida para esta fecha')
      return
    }
    const payload = {
      concepto: concepto.trim(),
      monto: num(monto),
      fecha,
      moneda,
      categoria,
    }
    try {
      if (isEditing && initial) {
        await api.put(`/gastos/${initial.id}`, payload)
        toast.success('Gasto actualizado')
      } else {
        await api.post('/gastos', payload)
        toast.success('Gasto registrado')
        setConcepto('')
        setMonto('')
        setMoneda('ARS')
        setCategoria(CATEGORIAS[0].value)
        setFecha(todayLocal())
      }
      onSave()
    } catch {
      toast.error(isEditing ? 'No se pudo actualizar' : 'No se pudo registrar')
    }
  }

  const montoArs = num(monto) * cotizacion

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-brand-black flex items-center gap-2">
          {isEditing ? (
            <>
              <Pencil className="h-5 w-5 text-slate-600" /> Editar gasto #{initial?.id}
            </>
          ) : (
            <>
              <PlusCircle className="h-5 w-5 text-brand-black" /> Registrar gasto
            </>
          )}
        </h3>
        {isEditing && onCancel && (
          <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-slate-100">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Concepto</label>
          <input
            type="text"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ej: Contadora"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-300">
            {(['ARS', 'USD'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMoneda(m)}
                className={`flex-1 py-2 text-xs font-bold transition-colors ${
                  moneda === m
                    ? m === 'ARS'
                      ? 'bg-brand-black text-white'
                      : 'bg-emerald-600 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Monto ({moneda === 'ARS' ? '$' : 'u$d'})
          </label>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            step="0.01"
            required
          />
        </div>
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
              disabled={isEditing}
            />
          </div>
          {moneda === 'USD' && (
            <div
              className={`p-2 rounded-lg text-xs border flex items-center ${
                cotizacion >= 1
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {cotLoading ? (
                <span>Consultando cotización…</span>
              ) : cotizacion >= 1 ? (
                <span>
                  1 USD = ${cotizacion.toFixed(2)} → <b>Total: {formatArs(montoArs)}</b>
                </span>
              ) : (
                <span>Sin cotización registrada</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        {isEditing && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={moneda === 'USD' && cotizacion < 1}
        >
          {isEditing ? 'Actualizar' : 'Guardar gasto'}
        </button>
      </div>
    </form>
  )
}

function GastoRapido({ onSave }: { onSave: () => void }) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [saving, setSaving] = useState(false)
  const conceptoRef = useRef<HTMLInputElement>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const descripcion = concepto.trim()
    const importe = Math.round(num(monto))
    if (!descripcion || !(importe > 0)) {
      toast.error('Completá descripción e importe')
      return
    }
    setSaving(true)
    try {
      await api.post('/gastos', {
        concepto: descripcion,
        monto: importe,
        moneda: 'ARS',
        categoria: 'OTROS',
        fecha: todayLocal(),
      })
      toast.success('Gasto registrado')
      setConcepto('')
      setMonto('')
      onSave()
      conceptoRef.current?.focus()
    } catch {
      toast.error('No se pudo registrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4 max-w-lg"
    >
      <h3 className="font-semibold text-brand-black flex items-center gap-2">
        <PlusCircle className="h-5 w-5" /> Nuevo gasto
      </h3>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
        <input
          ref={conceptoRef}
          type="text"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          placeholder="Ej: Papelera, café, envío…"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Importe</label>
        <input
          type="number"
          min="1"
          step="1"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          placeholder="0"
          required
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full btn-primary py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Registrar gasto'}
      </button>
    </form>
  )
}

export default function Gastos() {
  const { isAdmin } = useAuth()
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Gasto | null>(null)
  const [categoria, setCategoria] = useState('ALL')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [cotKey, setCotKey] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get<Gasto[]>('/gastos')
      setGastos(data)
    } catch {
      toast.error('Error al cargar gastos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [cotKey])

  async function onDelete(id: number) {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      await api.delete(`/gastos/${id}`)
      toast.success('Eliminado')
      await load()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  const filtrados = gastos.filter((g) => {
    if (categoria !== 'ALL' && g.categoria !== categoria) return false
    const d = new Date(g.fecha)
    if (desde && d < new Date(desde)) return false
    if (hasta) {
      const to = new Date(hasta)
      to.setDate(to.getDate() + 1)
      if (d >= to) return false
    }
    return true
  })

  const totalArs = filtrados.reduce((s, g) => s + num(g.monto_ars), 0)

  if (!isAdmin) {
    const recientes = gastos.slice(0, 20)
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <h2 className="page-title">Gastos</h2>
          <p className="text-slate-500 text-sm">Cargá un gasto con descripción e importe</p>
        </div>
        <GastoRapido onSave={() => void load()} />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-sm text-brand-black">Tus últimos gastos</h3>
          {loading && <p className="text-sm text-slate-400">Cargando…</p>}
          {!loading && recientes.length === 0 && (
            <p className="text-sm text-slate-400">Todavía no cargaste gastos</p>
          )}
          <ul className="divide-y divide-slate-100">
            {recientes.map((g) => (
              <li key={g.id} className="py-2.5 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{g.concepto}</p>
                  <p className="text-xs text-slate-500">{formatDateUTC(g.fecha)}</p>
                </div>
                <span className="font-semibold tabular-nums shrink-0">{formatArs(g.monto_ars)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="page-title">Gastos</h2>
          <p className="text-slate-500 text-sm">Registro de egresos y costos operativos</p>
        </div>
        <div className="w-full lg:w-96">
          <CotizacionForm onSaved={() => setCotKey((k) => k + 1)} />
        </div>
      </div>

      {!editing && <GastoForm onSave={() => void load()} />}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl">
            <GastoForm
              initial={editing}
              onSave={() => {
                setEditing(null)
                void load()
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-brand-black border-b border-slate-100 pb-2">
          <Filter className="h-5 w-5 text-slate-500" />
          Filtros y resumen
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ALL">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-5 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">
                Desde
              </label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">
                Hasta
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-center">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                Total filtrado
              </span>
              <span className="text-xl font-bold text-brand-black">{formatArs(totalArs)}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-10 text-slate-400 text-sm">Cargando…</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Detalle</th>
                    <th className="px-4 py-2">Categoría</th>
                    <th className="px-4 py-2 text-center">Monto orig.</th>
                    <th className="px-4 py-2 text-right">Total ARS</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((g) => (
                    <tr key={g.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <div className="font-medium">{g.concepto}</div>
                        <div className="text-xs text-slate-500 flex items-center mt-0.5">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDateUTC(g.fecha)}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                          {categoriaLabel(g.categoria)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={
                            g.moneda === 'USD' ? 'text-emerald-600 font-medium' : 'text-slate-600'
                          }
                        >
                          {formatCurrency(g.monto, g.moneda)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{formatArs(g.monto_ars)}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditing(g)}
                            className="p-1.5 rounded hover:bg-slate-100"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDelete(g.id)}
                            className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No hay gastos con estos filtros
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {filtrados.map((g) => (
                <div key={g.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between gap-2 mb-2">
                    <h3 className="font-bold text-brand-black">{g.concepto}</h3>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                        g.moneda === 'USD'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {g.moneda}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    {formatDateUTC(g.fecha)} · {categoriaLabel(g.categoria)}
                  </p>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-500 font-bold">
                        Total ARS
                      </span>
                      <span className="text-lg font-bold">{formatArs(g.monto_ars)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(g)}
                        className="p-2 rounded hover:bg-slate-100"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(g.id)}
                        className="p-2 rounded hover:bg-rose-50 text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filtrados.length === 0 && (
                <p className="text-center py-8 text-slate-400 text-sm">
                  No hay gastos con estos filtros
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
