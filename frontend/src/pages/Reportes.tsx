import { useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  CreditCard,
  Calendar,
  User,
  ChevronDown,
  Search,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { money } from '../utils/money'
import type { CuentaMp, Venta } from '../types'

type Compra = {
  id: number
  total: number
  fecha: string
  proveedor_nombre?: string | null
}

type Gasto = {
  id: number
  concepto: string
  monto: number
  moneda: 'ARS' | 'USD'
  monto_ars: number
  fecha: string
  categoria: string
}

type ReporteDiario = {
  fecha: string
  total_ventas: number
  total_compras: number
  cantidad_ventas: number
  cantidad_compras: number
  utilidad_neta: number
}

type ProductoVendido = {
  nombre: string
  categoria: string | null
  cantidad_total: number
}

const cardClass = 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6'
const inputFieldClass =
  'w-full border border-slate-300 p-2 rounded-lg focus:ring-brand-lime focus:border-brand-lime transition text-sm bg-white'

function getFirstDayOfMonth(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}-01`
}

function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

export default function Reportes() {
  const { sucursalId, sucursal, esTodas } = useSucursal()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [refrescandoResumen, setRefrescandoResumen] = useState(false)

  const [fechaDesde, setFechaDesde] = useState(getFirstDayOfMonth())
  const [fechaHasta, setFechaHasta] = useState('')
  const [fechaDesdeResumen, setFechaDesdeResumen] = useState(getFirstDayOfMonth())
  const [fechaHastaResumen, setFechaHastaResumen] = useState('')

  const [filtroMetodoPago, setFiltroMetodoPago] = useState('')
  const [filtroCuentaMp, setFiltroCuentaMp] = useState('')
  const [cuentasMp, setCuentasMp] = useState<CuentaMp[]>([])
  const [reporteActivo, setReporteActivo] = useState<'ventas' | 'compras' | 'resumen'>('ventas')
  const [datosDiarios, setDatosDiarios] = useState<ReporteDiario[]>([])
  const [productosVendidos, setProductosVendidos] = useState<ProductoVendido[]>([])
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<string[]>([])

  useEffect(() => {
    let cancelado = false
    const cargarInicial = async () => {
      try {
        setLoading(true)
        const params = sucursalId ? { sucursal_id: sucursalId } : {}
        const [ventasRes, comprasRes, gastosRes, cuentasRes] = await Promise.all([
          api.get<Venta[]>('/ventas', { params }),
          api.get<Compra[]>('/compras'),
          api.get<Gasto[]>('/gastos'),
          api.get<CuentaMp[]>('/cuentas-mp', { params: { ...params, todas: '1' } }),
        ])
        if (cancelado) return
        setVentas(ventasRes.data)
        setCompras(comprasRes.data)
        setGastos(Array.isArray(gastosRes.data) ? gastosRes.data : [])
        setCuentasMp(cuentasRes.data)
        setFiltroCuentaMp('')

        const fInicio = fechaDesdeResumen || '2000-01-01'
        const fFin = fechaHastaResumen || '2099-12-31'
        const reportParams = {
          desde: fInicio,
          hasta: fFin,
          ...(sucursalId ? { sucursal_id: sucursalId } : {}),
        }
        const [productosRes, diariosRes] = await Promise.all([
          api.get<ProductoVendido[]>('/reportes/productos-vendidos', { params: reportParams }),
          api.get<ReporteDiario[]>('/reportes/diarios', { params: reportParams }),
        ])
        if (cancelado) return
        setProductosVendidos(productosRes.data)
        setDatosDiarios(diariosRes.data)
      } catch {
        if (!cancelado) toast.error('Error al cargar reportes')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    void cargarInicial()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montaje + cambio sucursal
  }, [sucursalId])

  useEffect(() => {
    if (loading) return
    let cancelado = false
    const refrescarResumen = async () => {
      try {
        setRefrescandoResumen(true)
        const fInicio = fechaDesdeResumen || '2000-01-01'
        const fFin = fechaHastaResumen || '2099-12-31'
        const reportParams = {
          desde: fInicio,
          hasta: fFin,
          ...(sucursalId ? { sucursal_id: sucursalId } : {}),
        }
        const [productosRes, diariosRes] = await Promise.all([
          api.get<ProductoVendido[]>('/reportes/productos-vendidos', { params: reportParams }),
          api.get<ReporteDiario[]>('/reportes/diarios', { params: reportParams }),
        ])
        if (cancelado) return
        setProductosVendidos(productosRes.data)
        setDatosDiarios(diariosRes.data)
      } catch {
        if (!cancelado) toast.error('Error al actualizar el resumen por fecha')
      } finally {
        if (!cancelado) setRefrescandoResumen(false)
      }
    }
    void refrescarResumen()
    return () => {
      cancelado = true
    }
  }, [fechaDesdeResumen, fechaHastaResumen, loading, sucursalId])

  const filtrarPorFecha = <T extends { fecha?: string }>(
    items: T[],
    desde: string,
    hasta: string
  ) => {
    return items.filter((item) => {
      if (!item.fecha) return false
      const fechaStr = new Date(item.fecha).toLocaleDateString('en-CA')
      if (desde && fechaStr < desde) return false
      if (hasta && fechaStr > hasta) return false
      return true
    })
  }

  const calcularTotalVentas = (arr: Venta[]) =>
    arr.reduce((total, venta) => total + Number(venta.total || 0), 0)
  const calcularTotalCompras = (arr: Compra[]) =>
    arr.reduce((total, compra) => total + Number(compra.total || 0), 0)

  const ventasResumen = filtrarPorFecha(ventas, fechaDesdeResumen, fechaHastaResumen)
  const comprasResumen = filtrarPorFecha(compras, fechaDesdeResumen, fechaHastaResumen)
  const gastosResumenList = filtrarPorFecha(gastos, fechaDesdeResumen, fechaHastaResumen)
  const ingresosResumen = calcularTotalVentas(ventasResumen)
  const egresosComprasMercaderia = calcularTotalCompras(comprasResumen)
  const egresosGastosOperativos = gastosResumenList.reduce(
    (acc, g) => acc + Number(g.monto_ars || 0),
    0
  )
  const egresosTotalesResumen = egresosComprasMercaderia + egresosGastosOperativos
  const balanceResumen = ingresosResumen - egresosTotalesResumen

  const ventasFiltradas = (() => {
    let list = filtrarPorFecha(ventas, fechaDesde, fechaHasta)
    if (filtroMetodoPago) {
      list = list.filter((v) => v.metodo_pago === filtroMetodoPago)
    }
    if (filtroCuentaMp) {
      const cuentaId = Number(filtroCuentaMp)
      list = list.filter((v) => Number(v.cuenta_mp_id) === cuentaId)
    }
    return list
  })()
  const comprasFiltradas = filtrarPorFecha(compras, fechaDesde, fechaHasta)
  const esResumen = reporteActivo === 'resumen'

  function labelMetodo(v: Venta) {
    if (v.metodo_pago === 'mercadopago') {
      const alias = v.cuenta_mp_alias || v.cuenta_mp_nombre
      return alias ? `MP · ${alias}` : 'mercadopago'
    }
    return v.metodo_pago
  }

  function exportToExcel(
    data: Record<string, unknown>[],
    filename: string,
    type: 'ventas' | 'compras' | 'diarios' | 'productos'
  ) {
    if (!data.length) {
      toast.error('No hay datos para exportar')
      return
    }
    const exportData = data.map((v) => {
      if (type === 'ventas') {
        const venta = v as Venta
        return {
          'ID Venta': venta.id,
          Sucursal: venta.sucursal_nombre || '',
          Vendedor: venta.usuario_nombre || '',
          'Total ($)': venta.total,
          'Método de Pago': venta.metodo_pago,
          'Alias MP': venta.cuenta_mp_alias || '',
          Fecha: new Date(String(venta.fecha || '')).toLocaleDateString(),
        }
      }
      if (type === 'compras') {
        return {
          'ID Compra': v.id,
          Proveedor: (v as Compra).proveedor_nombre || 'Sin proveedor',
          'Total ($)': v.total,
          Fecha: new Date(String(v.fecha || '')).toLocaleDateString(),
        }
      }
      if (type === 'productos') {
        const p = v as unknown as ProductoVendido
        return {
          Producto: p.nombre,
          Categoría: p.categoria || 'Sin Categoría',
          'Unidades vendidas': Number(p.cantidad_total),
        }
      }
      const d = v as unknown as ReporteDiario
      return {
        Fecha: new Date(d.fecha).toLocaleDateString(),
        'Ventas ($)': d.total_ventas,
        'Compras ($)': d.total_compras,
        'Cant. Ventas': d.cantidad_ventas,
        'Utilidad ($)': d.utilidad_neta,
      }
    })
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte')
    XLSX.writeFile(workbook, filename)
  }

  function handleSetHoy() {
    const hoy = todayLocal()
    if (esResumen) {
      setFechaDesdeResumen(hoy)
      setFechaHastaResumen(hoy)
    } else {
      setFechaDesde(hoy)
      setFechaHasta(hoy)
    }
  }

  function handleLimpiar() {
    if (esResumen) {
      setFechaDesdeResumen('')
      setFechaHastaResumen('')
    } else {
      setFechaDesde('')
      setFechaHasta('')
      setFiltroMetodoPago('')
      setFiltroCuentaMp('')
    }
  }

  function getMetodoBadge(metodo?: string) {
    if (metodo === 'efectivo') return 'bg-emerald-100 text-emerald-800'
    if (metodo === 'mercadopago') return 'bg-sky-100 text-sky-800'
    return 'bg-violet-100 text-violet-800'
  }

  function toggleCategoria(categoria: string) {
    setCategoriasAbiertas((prev) =>
      prev.includes(categoria) ? prev.filter((c) => c !== categoria) : [...prev, categoria]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-black" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Reportes</h2>
        <p className="text-slate-500 text-sm sm:text-base">
          Análisis y estadísticas
          {esTodas ? ' · Todas las sucursales' : ` · ${sucursal?.nombre ?? ''}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ventas', 'compras', 'resumen'] as const).map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => setReporteActivo(tipo)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors w-full sm:w-auto capitalize ${
              reporteActivo === tipo
                ? 'bg-brand-black text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {tipo === 'ventas' && <ShoppingCart className="h-4 w-4 inline mr-2" />}
            {tipo === 'compras' && <ShoppingBag className="h-4 w-4 inline mr-2" />}
            {tipo === 'resumen' && <BarChart3 className="h-4 w-4 inline mr-2" />}
            {tipo}
          </button>
        ))}
      </div>

      <div className={cardClass}>
        <h3 className="text-lg font-semibold text-brand-black mb-4 flex items-center flex-wrap gap-2">
          <Calendar className="h-5 w-5 mr-1" />
          Filtro de Fechas ({esResumen ? 'Resumen' : 'Listados'})
          {esResumen && refrescandoResumen && (
            <span className="inline-flex items-center text-xs font-medium text-slate-600">
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-brand-black border-t-transparent mr-1.5" />
              Actualizando…
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Desde</label>
            <input
              type="date"
              className={inputFieldClass}
              value={esResumen ? fechaDesdeResumen : fechaDesde}
              onChange={(e) =>
                esResumen ? setFechaDesdeResumen(e.target.value) : setFechaDesde(e.target.value)
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Hasta</label>
            <input
              type="date"
              className={inputFieldClass}
              value={esResumen ? fechaHastaResumen : fechaHasta}
              onChange={(e) =>
                esResumen ? setFechaHastaResumen(e.target.value) : setFechaHasta(e.target.value)
              }
            />
          </div>
          {!esResumen && reporteActivo === 'ventas' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Método de Pago</label>
                <select
                  value={filtroMetodoPago}
                  onChange={(e) => {
                    const v = e.target.value
                    setFiltroMetodoPago(v)
                    if (v && v !== 'mercadopago') setFiltroCuentaMp('')
                  }}
                  className={inputFieldClass}
                >
                  <option value="">Todos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="mercadopago">MercadoPago</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Alias MP</label>
                <select
                  value={filtroCuentaMp}
                  onChange={(e) => {
                    const v = e.target.value
                    setFiltroCuentaMp(v)
                    if (v) setFiltroMetodoPago('mercadopago')
                  }}
                  className={inputFieldClass}
                  disabled={filtroMetodoPago !== '' && filtroMetodoPago !== 'mercadopago'}
                >
                  <option value="">Todos los alias</option>
                  {cuentasMp.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.alias}
                      {esTodas ? ` · ${c.sucursal_nombre}` : ''}
                      {!c.activa ? ' (inactiva)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          <div className="flex items-end gap-2 col-span-2 md:col-span-1">
            <button
              type="button"
              onClick={handleSetHoy}
              className="btn-primary px-3 py-2 text-sm font-semibold w-full"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleLimpiar}
              className="px-3 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 w-full text-sm font-semibold"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {reporteActivo === 'ventas' && (
        <div className={cardClass}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-brand-black flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2" /> Reporte de Ventas
            </h3>
            <button
              type="button"
              onClick={() =>
                exportToExcel(
                  ventasFiltradas as unknown as Record<string, unknown>[],
                  'reporte_ventas.xlsx',
                  'ventas'
                )
              }
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold"
            >
              Exportar Excel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="bg-sky-50 p-4 rounded-lg flex items-center">
              <ShoppingCart className="h-8 w-8 text-sky-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm text-sky-600">Total Ventas</p>
                <p className="text-2xl font-bold text-sky-900">{ventasFiltradas.length}</p>
              </div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg flex items-center">
              <DollarSign className="h-8 w-8 text-emerald-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm text-emerald-600">Monto Total</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {money(calcularTotalVentas(ventasFiltradas))}
                </p>
              </div>
            </div>
            <div className="bg-violet-50 p-4 rounded-lg flex items-center">
              <CreditCard className="h-8 w-8 text-violet-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm text-violet-600">Promedio</p>
                <p className="text-2xl font-bold text-violet-900">
                  {money(
                    ventasFiltradas.length > 0
                      ? calcularTotalVentas(ventasFiltradas) / ventasFiltradas.length
                      : 0
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Vendedor
                  </th>
                  {esTodas && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Sucursal
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Método
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {ventasFiltradas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">#{v.id}</td>
                    <td className="px-4 py-3">{v.usuario_nombre || '—'}</td>
                    {esTodas && (
                      <td className="px-4 py-3 text-slate-500">{v.sucursal_nombre || '—'}</td>
                    )}
                    <td className="px-4 py-3 font-medium text-emerald-600">
                      {money(v.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getMetodoBadge(v.metodo_pago)}`}
                      >
                        {labelMetodo(v)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(v.fecha || '').toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {ventasFiltradas.length === 0 && (
                  <tr>
                    <td
                      colSpan={esTodas ? 6 : 5}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      Sin ventas en el período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {ventasFiltradas.map((v) => (
              <div key={v.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold">Venta #{v.id}</h3>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm border-t pt-2">
                  <div>
                    <span className="text-xs text-slate-500 block">Vendedor</span>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1 text-slate-400" />
                      <span className="font-medium truncate">
                        {v.usuario_nombre || '—'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Fecha</span>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-slate-400" />
                      <span className="font-medium">
                        {new Date(v.fecha || '').toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Método</span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${getMetodoBadge(v.metodo_pago)}`}
                    >
                      {labelMetodo(v)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Total</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {money(v.total)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {ventasFiltradas.length === 0 && (
              <p className="text-center py-8 text-slate-400 text-sm">Sin ventas en el período</p>
            )}
          </div>
        </div>
      )}

      {reporteActivo === 'compras' && (
        <div className={cardClass}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-brand-black flex items-center">
              <ShoppingBag className="h-5 w-5 mr-2" /> Reporte de Compras
            </h3>
            <button
              type="button"
              onClick={() =>
                exportToExcel(
                  comprasFiltradas as unknown as Record<string, unknown>[],
                  'reporte_compras.xlsx',
                  'compras'
                )
              }
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold"
            >
              Exportar Excel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-amber-50 p-4 rounded-lg flex items-center">
              <ShoppingBag className="h-8 w-8 text-amber-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm text-amber-600">Total Compras</p>
                <p className="text-2xl font-bold text-amber-900">{comprasFiltradas.length}</p>
              </div>
            </div>
            <div className="bg-rose-50 p-4 rounded-lg flex items-center">
              <DollarSign className="h-8 w-8 text-rose-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm text-rose-600">Monto Total</p>
                <p className="text-2xl font-bold text-rose-900">
                  {money(calcularTotalCompras(comprasFiltradas))}
                </p>
              </div>
            </div>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Proveedor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {comprasFiltradas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">#{c.id}</td>
                    <td className="px-4 py-3">{c.proveedor_nombre || 'Sin proveedor'}</td>
                    <td className="px-4 py-3 font-medium text-rose-600">
                      {money(c.total)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(c.fecha || '').toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {comprasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Sin compras en el período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {comprasFiltradas.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold">Compra #{c.id}</h3>
                  <span className="text-lg font-bold text-rose-600">{money(c.total)}</span>
                </div>
                <p className="text-sm text-slate-600">{c.proveedor_nombre || 'Sin proveedor'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(c.fecha || '').toLocaleDateString()}
                </p>
              </div>
            ))}
            {comprasFiltradas.length === 0 && (
              <p className="text-center py-8 text-slate-400 text-sm">Sin compras en el período</p>
            )}
          </div>
        </div>
      )}

      {reporteActivo === 'resumen' && (
        <div
          className={`space-y-6 transition-opacity duration-200 ${
            refrescandoResumen ? 'opacity-60' : 'opacity-100'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cardClass}>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" /> Resumen Financiero
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between p-3 bg-emerald-50 rounded-lg">
                  <span className="text-emerald-700 font-medium">Ingresos Totales</span>
                  <span className="text-emerald-900 font-bold">{money(ingresosResumen)}</span>
                </div>
                <div className="flex justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="text-orange-700 font-medium">
                    Egresos por compra de mercadería
                  </span>
                  <span className="text-orange-900 font-bold">
                    {money(egresosComprasMercaderia)}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-amber-50 rounded-lg">
                  <span className="text-amber-700 font-medium">Gastos operativos</span>
                  <span className="text-amber-900 font-bold">
                    {money(egresosGastosOperativos)}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-rose-50 rounded-lg">
                  <span className="text-rose-700 font-medium">Egresos totales</span>
                  <span className="text-rose-900 font-bold">{money(egresosTotalesResumen)}</span>
                </div>
                <div className="flex justify-between p-3 bg-violet-50 rounded-lg">
                  <span className="text-violet-700 font-medium">Balance Neto</span>
                  <span
                    className={`font-bold ${
                      balanceResumen >= 0 ? 'text-emerald-900' : 'text-rose-900'
                    }`}
                  >
                    {money(balanceResumen)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${cardClass} h-80`}>
            <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-800">
              <TrendingUp className="h-5 w-5 mr-2 text-brand-black" />
              Rendimiento Diario (Ventas vs. Gastos)
            </h3>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={datosDiarios.slice().reverse()}>
                <defs>
                  <linearGradient id="colorVenta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(str) =>
                    new Date(str).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                  }
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(val) => money(Number(val))}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value) => money(Number(value))}
                  labelFormatter={(label) =>
                    new Date(String(label)).toLocaleDateString('es-AR', { dateStyle: 'long' })
                  }
                />
                <Legend verticalAlign="top" align="right" height={36} />
                <Area
                  type="monotone"
                  dataKey="total_ventas"
                  name="Ventas"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVenta)"
                />
                <Area
                  type="monotone"
                  dataKey="total_compras"
                  name="Gastos/Compras"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={cardClass}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center text-slate-800">
                  <ShoppingCart className="h-5 w-5 mr-2" /> Reposición por Categoría
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Hacé clic en una categoría para ver el detalle de unidades vendidas
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:items-center">
                <div className="relative w-full md:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={busquedaProducto}
                    onChange={(e) => setBusquedaProducto(e.target.value)}
                    className={`${inputFieldClass} pl-10 h-10`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const q = busquedaProducto.trim().toLowerCase()
                    const data = productosVendidos.filter(
                      (p) => !q || p.nombre.toLowerCase().includes(q)
                    )
                    exportToExcel(
                      data as unknown as Record<string, unknown>[],
                      'reporte_productos_vendidos.xlsx',
                      'productos'
                    )
                  }}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold shrink-0"
                >
                  Exportar Excel
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {Array.from(
                new Set(productosVendidos.map((p) => p.categoria || 'Sin Categoría'))
              ).map((cat) => {
                const productosFiltrados = productosVendidos.filter(
                  (p) =>
                    (p.categoria || 'Sin Categoría') === cat &&
                    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
                )
                if (productosFiltrados.length === 0) return null
                const isOpen = busquedaProducto.length > 0 || categoriasAbiertas.includes(cat)
                return (
                  <div
                    key={cat}
                    className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategoria(cat)}
                      className={`w-full flex items-center justify-between p-4 transition-all ${
                        isOpen
                          ? 'bg-slate-100 text-brand-black'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-bold uppercase tracking-wide text-xs md:text-sm flex items-center">
                        <span
                          className={`w-2 h-2 rounded-full mr-3 ${
                            isOpen ? 'bg-brand-lime' : 'bg-slate-300'
                          }`}
                        />
                        {cat}
                        <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">
                          {productosFiltrados.length} items
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-white">
                        {productosFiltrados.map((prod, index) => (
                          <div
                            key={`${prod.nombre}-${index}`}
                            className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-brand-lime/40 hover:bg-white transition-all group"
                          >
                            <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium truncate pr-2">
                              {prod.nombre}
                            </span>
                            <div className="flex flex-col items-end">
                              <span className="text-brand-black font-black text-base">
                                {prod.cantidad_total}
                              </span>
                              <span className="text-[9px] text-slate-400 uppercase font-bold leading-none">
                                Unid.
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {productosVendidos.length === 0 && (
                <p className="text-center py-8 text-slate-400 text-sm">
                  Sin productos vendidos en el período
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
