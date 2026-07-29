import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'

type DashboardData = {
  ventas_hoy: { total: number; cantidad: number }
  total_productos: number
  total_clientes: number
  bajo_stock: { id: number; nombre: string; stock: number }[]
}

export default function Dashboard() {
  const { sucursalId, sucursal } = useSucursal()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    if (!sucursalId) return
    api
      .get<DashboardData>('/stats/dashboard', { params: { sucursal_id: sucursalId } })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
  }, [sucursalId])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-brand-black">Dashboard</h2>
        <p className="text-slate-500">{sucursal?.nombre ?? 'Seleccioná una sucursal'}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Ventas hoy" value={formatMoney(data?.ventas_hoy.total ?? 0)} hint={`${data?.ventas_hoy.cantidad ?? 0} tickets`} />
        <Card title="Productos" value={String(data?.total_productos ?? '—')} />
        <Card title="Clientes" value={String(data?.total_clientes ?? '—')} />
        <Card title="Bajo stock" value={String(data?.bajo_stock.length ?? 0)} hint="≤ 5 unidades" />
      </div>

      <div className="flex gap-3">
        <Link
          to="/ventas/nueva"
          className="btn-primary px-4 py-2 text-sm font-semibold"
        >
          Nueva venta
        </Link>
        <Link
          to="/traslados"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
        >
          Trasladar stock
        </Link>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold">Stock bajo en esta sucursal</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Stock</th>
            </tr>
          </thead>
          <tbody>
            {(data?.bajo_stock ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={2}>
                  Sin alertas
                </td>
              </tr>
            )}
            {data?.bajo_stock.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{p.nombre}</td>
                <td className="px-4 py-2 font-semibold text-amber-700">{p.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-brand-black">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function formatMoney(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}
