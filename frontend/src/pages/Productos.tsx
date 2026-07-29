import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import type { Producto } from '../types'

type Categoria = { id: number; nombre: string }

export default function Productos() {
  const { sucursalId } = useSucursal()
  const [items, setItems] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    precio: '',
    precio_costo: '',
    categoria_id: '',
    stock_inicial: '0',
  })

  async function load() {
    if (!sucursalId) return
    const [prod, cats] = await Promise.all([
      api.get<Producto[]>('/productos', { params: { sucursal_id: sucursalId } }),
      api.get<Categoria[]>('/categorias'),
    ])
    setItems(prod.data)
    setCategorias(cats.data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('No se pudieron cargar productos'))
  }, [sucursalId])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    try {
      await api.post('/productos', {
        nombre: form.nombre,
        codigo: form.codigo || null,
        precio: Number(form.precio) || 0,
        precio_costo: Number(form.precio_costo) || 0,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        stock_inicial: Number(form.stock_inicial) || 0,
        sucursal_id: sucursalId,
      })
      toast.success('Producto creado')
      setForm({
        nombre: '',
        codigo: '',
        precio: '',
        precio_costo: '',
        categoria_id: '',
        stock_inicial: '0',
      })
      await load()
    } catch {
      toast.error('No se pudo crear el producto')
    }
  }

  const filtered = items.filter((p) => {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return (
      p.nombre.toLowerCase().includes(needle) ||
      (p.codigo || '').toLowerCase().includes(needle)
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Productos</h2>
        <p className="text-slate-500 text-sm">
          Una fila por talle/color. Ej: “Remera Nike Negra M”
        </p>
      </div>

      <form onSubmit={onCreate} className="bg-white rounded-xl border border-slate-200 p-4 grid md:grid-cols-3 gap-3">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nombre (modelo + color + talle)"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Código"
          value={form.codigo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.categoria_id}
          onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Precio venta"
          type="number"
          step="0.01"
          value={form.precio}
          onChange={(e) => setForm({ ...form, precio: e.target.value })}
        />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Costo"
          type="number"
          step="0.01"
          value={form.precio_costo}
          onChange={(e) => setForm({ ...form, precio_costo: e.target.value })}
        />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Stock inicial (esta sucursal)"
          type="number"
          value={form.stock_inicial}
          onChange={(e) => setForm({ ...form, stock_inicial: e.target.value })}
        />
        <button
          type="submit"
          className="md:col-span-3 btn-primary py-2 text-sm font-semibold"
        >
          Agregar producto
        </button>
      </form>

      <input
        className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        placeholder="Buscar por nombre o código…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Categoría</th>
              <th className="px-4 py-2">Precio</th>
              <th className="px-4 py-2">Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{p.nombre}</td>
                <td className="px-4 py-2 text-slate-500">{p.codigo || '—'}</td>
                <td className="px-4 py-2">{p.categoria_nombre || '—'}</td>
                <td className="px-4 py-2">
                  {Number(p.precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </td>
                <td className="px-4 py-2 font-semibold">{p.stock ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
