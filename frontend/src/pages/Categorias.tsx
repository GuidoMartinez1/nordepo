import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Trash2, X } from 'lucide-react'
import api from '../services/api'

type Categoria = { id: number; nombre: string; descripcion?: string | null }

export default function Categorias() {
  const [items, setItems] = useState<Categoria[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')

  async function load() {
    const { data } = await api.get<Categoria[]>('/categorias')
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar categorías'))
  }, [])

  function openCreate() {
    setEditing(null)
    setNombre('')
    setDescripcion('')
    setShowModal(true)
  }

  function openEdit(c: Categoria) {
    setEditing(c)
    setNombre(c.nombre)
    setDescripcion(c.descripcion || '')
    setShowModal(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const payload = { nombre: nombre.trim(), descripcion: descripcion.trim() || null }
      if (editing) {
        await api.put(`/categorias/${editing.id}`, payload)
        toast.success('Categoría actualizada')
      } else {
        await api.post('/categorias', payload)
        toast.success('Categoría creada')
      }
      setShowModal(false)
      await load()
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  async function onDelete(c: Categoria) {
    if (!confirm(`¿Eliminar “${c.nombre}”?`)) return
    try {
      await api.delete(`/categorias/${c.id}`)
      toast.success('Categoría eliminada')
      await load()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Categorías</h2>
        <button type="button" onClick={openCreate} className="btn-primary px-4 py-2 text-sm font-semibold">
          Nueva categoría
        </button>
      </div>

      <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 grid md:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <li key={c.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3 border-slate-100">
            <div>
              <p className="font-medium">{c.nombre}</p>
              {c.descripcion && <p className="text-slate-500 text-xs mt-0.5">{c.descripcion}</p>}
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-slate-100">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={() => void onDelete(c)} className="p-1.5 rounded hover:bg-rose-50 text-rose-600">
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form onSubmit={onSubmit} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{editing ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Descripción (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
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
