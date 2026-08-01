import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Trash2, X } from 'lucide-react'
import api from '../services/api'
import type { Cliente } from '../types'

const empty = { nombre: '', telefono: '', email: '', direccion: '' }

export default function Clientes() {
  const [items, setItems] = useState<Cliente[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState(empty)

  async function load() {
    const { data } = await api.get<Cliente[]>('/clientes')
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar clientes'))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setShowModal(true)
  }

  function openEdit(c: Cliente) {
    setEditing(c)
    setForm({
      nombre: c.nombre || '',
      telefono: c.telefono || '',
      email: c.email || '',
      direccion: c.direccion || '',
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
        await api.put(`/clientes/${editing.id}`, payload)
        toast.success('Cliente actualizado')
      } else {
        await api.post('/clientes', payload)
        toast.success('Cliente creado')
      }
      setShowModal(false)
      await load()
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  async function onDelete(c: Cliente) {
    if (!confirm(`¿Eliminar “${c.nombre}”?`)) return
    try {
      await api.delete(`/clientes/${c.id}`)
      toast.success('Cliente eliminado')
      await load()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Clientes</h2>
        <button type="button" onClick={openCreate} className="btn-primary px-4 py-2 text-sm font-semibold">
          Nuevo cliente
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
            {items.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{c.nombre}</td>
                <td className="px-4 py-2 text-slate-500">{c.telefono || '—'}</td>
                <td className="px-4 py-2 text-slate-500">{c.email || '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-slate-100">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => void onDelete(c)} className="p-1.5 rounded hover:bg-rose-50 text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form onSubmit={onSubmit} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Teléfono"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Dirección"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-semibold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 btn-primary py-2 text-sm">
                {editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
