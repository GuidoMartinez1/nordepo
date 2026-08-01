import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import type { CuentaMp } from '../types'

const empty = { nombre: '', alias: '', sucursal_id: '', activa: true }

export default function CuentasMp() {
  const { sucursales } = useSucursal()
  const [items, setItems] = useState<CuentaMp[]>([])
  const [filtroSucursal, setFiltroSucursal] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CuentaMp | null>(null)
  const [form, setForm] = useState(empty)

  async function load() {
    const params: Record<string, string | number> = { todas: 1 }
    if (filtroSucursal) params.sucursal_id = Number(filtroSucursal)
    const { data } = await api.get<CuentaMp[]>('/cuentas-mp', { params })
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar cuentas MP'))
  }, [filtroSucursal])

  function openCreate() {
    setEditing(null)
    setForm({
      ...empty,
      sucursal_id: filtroSucursal || (sucursales[0] ? String(sucursales[0].id) : ''),
    })
    setShowModal(true)
  }

  function openEdit(c: CuentaMp) {
    setEditing(c)
    setForm({
      nombre: c.nombre || '',
      alias: c.alias || '',
      sucursal_id: String(c.sucursal_id),
      activa: c.activa,
    })
    setShowModal(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.sucursal_id) {
      toast.error('Elegí la sucursal')
      return
    }
    try {
      const payload = {
        nombre: form.nombre.trim(),
        alias: form.alias.trim(),
        sucursal_id: Number(form.sucursal_id),
        activa: form.activa,
      }
      if (editing) {
        await api.put(`/cuentas-mp/${editing.id}`, payload)
        toast.success('Cuenta actualizada')
      } else {
        await api.post('/cuentas-mp', payload)
        toast.success('Cuenta creada')
      }
      setShowModal(false)
      await load()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo guardar'
      toast.error(msg)
    }
  }

  async function onDelete(c: CuentaMp) {
    if (!confirm(`¿Desactivar “${c.nombre}” (${c.alias})?`)) return
    try {
      await api.delete(`/cuentas-mp/${c.id}`)
      toast.success('Cuenta desactivada')
      await load()
    } catch {
      toast.error('No se pudo desactivar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Cuentas MP</h2>
          <p className="text-slate-500 text-sm">
            Alias de Mercado Pago por sucursal. Se eligen al registrar una venta.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Nueva cuenta
        </button>
      </div>

      <div className="flex gap-2">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          value={filtroSucursal}
          onChange={(e) => setFiltroSucursal(e.target.value)}
        >
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Sucursal</th>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Alias</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{c.sucursal_nombre}</td>
                  <td className="px-4 py-2 font-medium">{c.nombre}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.alias}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        c.activa
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil size={16} />
                    </button>
                    {c.activa && (
                      <button
                        type="button"
                        onClick={() => void onDelete(c)}
                        className="p-1.5 rounded text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Todavía no hay cuentas. Creá al menos una por sucursal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {items.map((c) => (
            <div key={c.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold">{c.nombre}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{c.sucursal_nombre}</p>
                  <p className="font-mono text-sm mt-1">{c.alias}</p>
                  <span
                    className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded ${
                      c.activa
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                  >
                    <Pencil size={16} />
                  </button>
                  {c.activa && (
                    <button
                      type="button"
                      onClick={() => void onDelete(c)}
                      className="p-1.5 rounded text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center py-8 text-slate-400 text-sm">
              Todavía no hay cuentas.
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">
                {editing ? 'Editar cuenta' : 'Nueva cuenta'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-slate-600">Sucursal</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.sucursal_id}
                onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
                required
              >
                <option value="">Elegí…</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Nombre</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ej. Caja Norte"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Alias</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                placeholder="Ej. @nordepo.norte"
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                required
              />
            </label>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                />
                Activa
              </label>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button type="submit" className="flex-1 btn-primary py-2.5 text-sm">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
