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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Proveedores</h2>
        <button type="button" onClick={openCreate} className="btn-primary px-4 py-2 text-sm font-semibold">
          Nuevo proveedor
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
            {items.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{p.nombre}</td>
                <td className="px-4 py-2 text-slate-500">{p.telefono || '—'}</td>
                <td className="px-4 py-2 text-slate-500">{p.email || '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-slate-100">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => void onDelete(p)} className="p-1.5 rounded hover:bg-rose-50 text-rose-600">
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
              <h3 className="font-display text-2xl">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
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
