import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'

type DashboardData = {
  ventas_hoy: { total: number; cantidad: number }
  total_productos: number
  total_clientes: number
  bajo_stock: { id: number; nombre: string; stock: number; sucursal_nombre?: string }[]
}

export default function Dashboard() {
  const { sucursalId, sucursal, esTodas } = useSucursal()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    const params = sucursalId ? { sucursal_id: sucursalId } : {}
    api
      .get<DashboardData>('/stats/dashboard', { params })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
  }, [sucursalId])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Panel de Control</h2>
        <p className="text-slate-500 text-sm sm:text-base">
          {esTodas ? 'Todas las sucursales' : sucursal?.nombre ?? 'Seleccioná una sucursal'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card
          title="Ventas hoy"
          value={formatMoney(data?.ventas_hoy.total ?? 0)}
          hint={`${data?.ventas_hoy.cantidad ?? 0} tickets`}
        />
        <Card title="Productos" value={String(data?.total_productos ?? '—')} />
        <Card title="Clientes" value={String(data?.total_clientes ?? '—')} />
        <Card title="Bajo stock" value={String(data?.bajo_stock.length ?? 0)} hint="≤ 5 unidades" />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
        <Link to="/ventas/nueva" className="btn-primary px-4 py-2 text-sm font-semibold text-center">
          Nueva venta
        </Link>
        <Link
          to="/traslados"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-center"
        >
          Trasladar stock
        </Link>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="font-semibold text-sm sm:text-base mb-3">
          Stock bajo {esTodas ? '(consolidado)' : 'en esta sucursal'}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Producto</th>
                {esTodas && <th className="px-4 py-2">Detalle</th>}
                <th className="px-4 py-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {(data?.bajo_stock ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-400" colSpan={esTodas ? 3 : 2}>
                    Sin alertas
                  </td>
                </tr>
              )}
              {data?.bajo_stock.map((p) => (
                <tr key={`${p.id}-${p.sucursal_nombre ?? 't'}`} className="border-t border-slate-100">
                  <td className="px-4 py-2">{p.nombre}</td>
                  {esTodas && (
                    <td className="px-4 py-2 text-slate-500 text-xs">
                      {p.sucursal_nombre || 'Total'}
                    </td>
                  )}
                  <td className="px-4 py-2 font-semibold text-amber-700">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-2">
          {(data?.bajo_stock ?? []).map((p) => (
            <div
              key={`${p.id}-${p.sucursal_nombre ?? 't'}`}
              className="border border-slate-200 rounded-lg p-3 flex justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{p.nombre}</p>
                {esTodas && (
                  <p className="text-xs text-slate-500">{p.sucursal_nombre || 'Total'}</p>
                )}
              </div>
              <span className="font-semibold text-amber-700 shrink-0">{p.stock}</span>
            </div>
          ))}
          {(data?.bajo_stock ?? []).length === 0 && (
            <p className="text-slate-400 text-sm text-center py-4">Sin alertas</p>
          )}
        </div>
      </section>
    </div>
  )
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold text-brand-black break-words">
        {value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function formatMoney(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}
