import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'

type Proveedor = { id: number; nombre: string; telefono?: string | null }

export default function Proveedores() {
  const [items, setItems] = useState<Proveedor[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')

  async function load() {
    const { data } = await api.get<Proveedor[]>('/proveedores')
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar proveedores'))
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    try {
      await api.post('/proveedores', { nombre, telefono: telefono || null })
      setNombre('')
      setTelefono('')
      toast.success('Proveedor creado')
      await load()
    } catch {
      toast.error('No se pudo crear')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl tracking-wide text-brand-black">Proveedores</h2>
      <form onSubmit={onCreate} className="flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-w-[200px]"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-w-[160px]"
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <button type="submit" className="btn-primary px-4 py-2 text-sm font-semibold">
          Agregar
        </button>
      </form>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{p.nombre}</td>
                <td className="px-4 py-2 text-slate-500">{p.telefono || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
