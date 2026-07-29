import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import type { Venta } from '../types'

export default function Ventas() {
  const { sucursalId } = useSucursal()
  const [items, setItems] = useState<Venta[]>([])

  useEffect(() => {
    if (!sucursalId) return
    api
      .get<Venta[]>('/ventas', { params: { sucursal_id: sucursalId } })
      .then((res) => setItems(res.data))
      .catch(() => toast.error('Error al cargar ventas'))
  }, [sucursalId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Ventas</h2>
        <Link
          to="/ventas/nueva"
          className="btn-primary px-4 py-2 text-sm font-semibold"
        >
          Nueva venta
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Pago</th>
              <th className="px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{v.id}</td>
                <td className="px-4 py-2">{new Date(v.fecha).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">{v.cliente_nombre || '—'}</td>
                <td className="px-4 py-2 capitalize">{v.metodo_pago}</td>
                <td className="px-4 py-2 font-semibold">
                  {Number(v.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
