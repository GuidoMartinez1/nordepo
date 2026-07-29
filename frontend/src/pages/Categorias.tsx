import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'

type Categoria = { id: number; nombre: string; descripcion?: string | null }

export default function Categorias() {
  const [items, setItems] = useState<Categoria[]>([])
  const [nombre, setNombre] = useState('')

  async function load() {
    const { data } = await api.get<Categoria[]>('/categorias')
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar categorías'))
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    try {
      await api.post('/categorias', { nombre })
      setNombre('')
      toast.success('Categoría creada')
      await load()
    } catch {
      toast.error('No se pudo crear')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="font-display text-3xl tracking-wide text-brand-black">Categorías</h2>
      <form onSubmit={onCreate} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          placeholder="Ej: Calzado, Indumentaria, Accesorios…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary px-4 py-2 text-sm font-semibold">
          Agregar
        </button>
      </form>
      <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {items.map((c) => (
          <li key={c.id} className="px-4 py-3 text-sm font-medium">
            {c.nombre}
          </li>
        ))}
      </ul>
    </div>
  )
}
