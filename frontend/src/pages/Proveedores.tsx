import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Trash2, X } from 'lucide-react'
import api from '../services/api'

type Proveedor = {
  id: number
  nombre: string
  telefono?: string | null
  email?: string | null
  direccion?: string | null
}

const empty = { nombre: '', telefono: '', email: '', direccion: '' }

export default function Proveedores() {
  const [items, setItems] = useState<Proveedor[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [form, setForm] = useState(empty)

  async function load() {
    const { data } = await api.get<Proveedor[]>('/proveedores')
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar proveedores'))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setShowModal(true)
  }

  function openEdit(p: Proveedor) {
    setEditing(p)
    setForm({
      nombre: p.nombre || '',
      telefono: p.telefono || '',
      email: p.email || '',
      direccion: p.direccion || '',
    })
    setShowModal(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        direccion: form.direccion.trim() || null,
      }
      if (editing) {
        await api.put(`/proveedores/${editing.id}`, payload)
        toast.success('Proveedor actualizado')
      } else {
        await api.post('/proveedores', payload)
        toast.success('Proveedor creado')
      }
      setShowModal(false)
      await load()
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  async function onDelete(p: Proveedor) {
    if (!confirm(`¿Eliminar “${p.nombre}”?`)) return
    try {
      await api.delete(`/proveedores/${p.id}`)
      toast.success('Proveedor eliminado')
      await load()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  const q = busqueda.trim().toLowerCase()
  const filtrados = !q
    ? items
    : items.filter(
        (p) =>
          (p.nombre || '').toLowerCase().includes(q) ||
          (p.telefono || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.direccion || '').toLowerCase().includes(q)
      )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="page-title">Proveedores</h2>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary px-4 py-2 text-sm font-semibold"
        >
          Nuevo proveedor
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre, teléfono, email o dirección…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full md:w-1/2 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Teléfono</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{p.nombre}</td>
                  <td className="px-4 py-2 text-slate-500">{p.telefono || '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{p.email || '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded hover:bg-slate-100"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(p)}
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
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    {q ? 'Sin resultados' : 'Sin proveedores'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {filtrados.map((p) => (
            <div key={p.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold">{p.nombre}</h3>
                  <p className="text-sm text-slate-500 mt-1">{p.telefono || 'Sin teléfono'}</p>
                  <p className="text-sm text-slate-500 truncate">{p.email || 'Sin email'}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="p-1.5 rounded hover:bg-slate-100"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(p)}
                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="text-center py-8 text-slate-400 text-sm">
              {q ? 'Sin resultados' : 'Sin proveedores'}
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <form
            onSubmit={onSubmit}
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">
                {editing ? 'Editar' : 'Nuevo'} proveedor
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Teléfono"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Dirección"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
            <div className="flex gap-2">
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
