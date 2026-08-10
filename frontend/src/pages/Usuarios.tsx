import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import PasswordInput from '../components/PasswordInput'

type Usuario = {
  id: number
  username: string
  role: 'admin' | 'vendedor'
  activo: boolean
  sucursal_id?: number | null
  sucursal_nombre?: string | null
  created_at?: string
}

const empty = {
  username: '',
  password: '',
  role: 'vendedor' as 'admin' | 'vendedor',
  sucursal_id: '',
  activo: true,
}

export default function Usuarios() {
  const { sucursales } = useSucursal()
  const [items, setItems] = useState<Usuario[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [form, setForm] = useState(empty)

  async function load() {
    const { data } = await api.get<Usuario[]>('/empleados')
    setItems(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar usuarios'))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({
      ...empty,
      sucursal_id: sucursales[0] ? String(sucursales[0].id) : '',
    })
    setShowModal(true)
  }

  function openEdit(e: Usuario) {
    setEditing(e)
    setForm({
      username: e.username,
      password: '',
      role: e.role,
      sucursal_id: e.sucursal_id ? String(e.sucursal_id) : '',
      activo: e.activo,
    })
    setShowModal(true)
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (form.role === 'vendedor' && !form.sucursal_id) {
      toast.error('Elegí la sucursal del vendedor')
      return
    }
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        role: form.role,
        activo: form.activo,
        sucursal_id: form.role === 'vendedor' ? Number(form.sucursal_id) : null,
      }
      if (form.password.trim()) payload.password = form.password
      if (editing) {
        await api.put(`/empleados/${editing.id}`, payload)
        toast.success('Usuario actualizado')
      } else {
        if (!form.password.trim()) {
          toast.error('Ingresá una contraseña')
          return
        }
        payload.password = form.password
        await api.post('/empleados', payload)
        toast.success('Usuario creado')
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

  async function onDelete(e: Usuario) {
    if (
      !confirm(
        `¿Desactivar a “${e.username}”?${
          e.role === 'vendedor'
            ? '\nPodés crear después otro registro del mismo usuario en otra sucursal.'
            : ''
        }`
      )
    ) {
      return
    }
    try {
      await api.delete(`/empleados/${e.id}`)
      toast.success('Usuario desactivado')
      await load()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo desactivar'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Usuarios</h2>
          <p className="text-slate-500 text-sm">
            El vendedor queda atado a una sucursal. Para cambiarlo: desactivá el registro y creá
            uno nuevo.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Sucursal</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{e.username}</td>
                  <td className="px-4 py-2 capitalize">{e.role}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {e.role === 'vendedor' ? e.sucursal_nombre || '—' : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        e.activo
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {e.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="p-1.5 rounded hover:bg-slate-100"
                      >
                        <Pencil size={16} />
                      </button>
                      {e.activo && (
                        <button
                          type="button"
                          onClick={() => void onDelete(e)}
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Sin usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {items.map((e) => (
            <div key={e.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-bold">{e.username}</h3>
                  <p className="text-sm text-slate-500 capitalize mt-1">{e.role}</p>
                  {e.role === 'vendedor' && (
                    <p className="text-sm text-slate-600 mt-0.5">{e.sucursal_nombre || '—'}</p>
                  )}
                  <p className="text-xs mt-1">{e.activo ? 'Activo' : 'Inactivo'}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(e)}
                    className="p-1.5 rounded hover:bg-slate-100"
                  >
                    <Pencil size={16} />
                  </button>
                  {e.activo && (
                    <button
                      type="button"
                      onClick={() => void onDelete(e)}
                      className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
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
                {editing ? 'Editar' : 'Nuevo'} usuario
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
              placeholder="Usuario"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="off"
            />
            <PasswordInput
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder={
                editing
                  ? 'Nueva contraseña (opcional — restablecer acceso)'
                  : 'Contraseña'
              }
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
              autoComplete="new-password"
            />
            {editing && (
              <p className="text-xs text-slate-500 -mt-2">
                Si el usuario olvidó la clave, cargá una temporal acá y pasásela. No se puede ver la
                anterior.
              </p>
            )}
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as 'admin' | 'vendedor'
                setForm({
                  ...form,
                  role,
                  sucursal_id:
                    role === 'vendedor'
                      ? form.sucursal_id || (sucursales[0] ? String(sucursales[0].id) : '')
                      : '',
                })
              }}
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
            {form.role === 'vendedor' && (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.sucursal_id}
                onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
                required
              >
                <option value="">Elegí sucursal…</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              Activo
            </label>
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
