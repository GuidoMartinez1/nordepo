import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ClipboardList, Eye, Pencil, Plus, Trash2, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '../services/api'
import type { Producto } from '../types'

type Compra = {
  id: number
  total: number
  fecha: string
  proveedor_nombre?: string | null
  sucursal_nombre?: string
}

type Detalle = {
  id: number
  producto_id: number
  producto_nombre?: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

type CompraDetalle = Compra & { detalles: Detalle[] }

type FuturoPedido = {
  id: number
  producto?: string | null
  producto_nombre?: string | null
  producto_id?: number | null
  cantidad: string | number | null
  precio_costo?: number | null
  stock_actual?: number | null
}

type OrdenFuturos = 'agregacion' | 'alfabetico'

function money(n: number) {
  return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export default function Compras() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [detalle, setDetalle] = useState<CompraDetalle | null>(null)

  const [mostrarFuturos, setMostrarFuturos] = useState(false)
  const [futuros, setFuturos] = useState<FuturoPedido[]>([])
  const [cargandoFuturos, setCargandoFuturos] = useState(false)
  const [ordenFuturos, setOrdenFuturos] = useState<OrdenFuturos>('agregacion')
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [productoId, setProductoId] = useState<number | null>(null)
  const [cantidadNueva, setCantidadNueva] = useState('1')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [cantidadEditando, setCantidadEditando] = useState('')

  async function load() {
    const { data } = await api.get<Compra[]>('/compras')
    setCompras(data)
  }

  useEffect(() => {
    void load().catch(() => toast.error('Error al cargar compras'))
  }, [])

  async function verDetalle(id: number) {
    try {
      const { data } = await api.get<CompraDetalle>(`/compras/${id}`)
      setDetalle(data)
    } catch {
      toast.error('No se pudo cargar el detalle')
    }
  }

  async function loadFuturos() {
    setCargandoFuturos(true)
    try {
      const [fp, prod] = await Promise.all([
        api.get<FuturoPedido[]>('/futuros-pedidos'),
        api.get<Producto[]>('/productos'),
      ])
      setFuturos(fp.data)
      setProductos(prod.data)
    } catch {
      toast.error('Error al cargar futuros pedidos')
    } finally {
      setCargandoFuturos(false)
    }
  }

  useEffect(() => {
    if (mostrarFuturos) void loadFuturos()
  }, [mostrarFuturos])

  const futurosOrdenados = useMemo(() => {
    const lista = [...futuros]
    if (ordenFuturos === 'alfabetico') {
      lista.sort((a, b) =>
        (a.producto_nombre || a.producto || '').localeCompare(
          b.producto_nombre || b.producto || '',
          'es'
        )
      )
    }
    return lista
  }, [futuros, ordenFuturos])

  const sugeridos = useMemo(() => {
    const needle = busqueda.trim().toLowerCase()
    if (!needle) return []
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [productos, busqueda])

  const totalEstimado = futuros.reduce((acc, item) => {
    const cant = parseFloat(String(item.cantidad)) || 0
    const costo = Number(item.precio_costo) || 0
    return acc + cant * costo
  }, 0)

  async function agregarFuturo() {
    const cant = cantidadNueva.trim()
    if (!cant) {
      toast.error('Indicá una cantidad')
      return
    }
    const nombre = busqueda.trim()
    if (!productoId && !nombre) {
      toast.error('Elegí o escribí un producto')
      return
    }
    const dup = futuros.some((fp) =>
      productoId
        ? fp.producto_id === productoId
        : (fp.producto_nombre || fp.producto || '').toLowerCase() === nombre.toLowerCase()
    )
    if (dup) {
      toast.error('Ese producto ya está en la lista')
      return
    }
    try {
      await api.post('/futuros-pedidos', {
        producto_id: productoId,
        producto: productoId ? undefined : nombre,
        cantidad: cant,
      })
      toast.success('Agregado a futuros pedidos')
      setBusqueda('')
      setProductoId(null)
      setCantidadNueva('1')
      await loadFuturos()
    } catch {
      toast.error('No se pudo agregar')
    }
  }

  async function guardarEdicion() {
    if (!editandoId) return
    try {
      await api.put(`/futuros-pedidos/${editandoId}`, {
        cantidad: cantidadEditando.trim(),
      })
      setEditandoId(null)
      await loadFuturos()
    } catch {
      toast.error('No se pudo actualizar')
    }
  }

  async function eliminarFuturo(id: number) {
    if (!confirm('¿Quitar este ítem de futuros pedidos?')) return
    try {
      await api.delete(`/futuros-pedidos/${id}`)
      setFuturos((prev) => prev.filter((f) => f.id !== id))
      toast.success('Eliminado')
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  function exportarFuturosExcel() {
    if (!futurosOrdenados.length) {
      toast.error('No hay futuros pedidos para exportar')
      return
    }
    const rows = futurosOrdenados.map((item, index) => {
      const cant = parseFloat(String(item.cantidad)) || 0
      const costo = Number(item.precio_costo) || 0
      return {
        '#': index + 1,
        Producto: item.producto_nombre || item.producto || '',
        Stock: item.stock_actual ?? '',
        Cantidad: item.cantidad ?? '',
        'Costo unitario': costo,
        'Gasto estimado': cant * costo,
      }
    })
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Futuros pedidos')
    XLSX.writeFile(workbook, 'futuros_pedidos.xlsx')
  }

  function stockClass(stock: number | null | undefined) {
    const n = Number(stock) || 0
    if (n <= 0) return 'text-rose-600 font-semibold'
    if (n <= 5) return 'text-amber-600 font-semibold'
    return 'text-slate-700'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Compras</h2>
          <p className="text-slate-500 text-sm">
            Toda compra ingresa al depósito. Después se traslada a las sucursales.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMostrarFuturos(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-50"
          >
            <ClipboardList size={16} /> Futuros pedidos
          </button>
          <Link
            to="/compras/nueva"
            className="btn-primary px-4 py-2 text-sm inline-flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Nueva compra
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay compras. Creá una con varios productos.
                </td>
              </tr>
            )}
            {compras.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{c.id}</td>
                <td className="px-4 py-2">{new Date(c.fecha).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">{c.proveedor_nombre || '—'}</td>
                <td className="px-4 py-2 font-semibold">{money(Number(c.total))}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => void verDetalle(c.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-brand-black"
                  >
                    <Eye size={16} /> Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="md:hidden space-y-3">
          {compras.map((c) => (
            <div key={c.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <h3 className="font-bold">Compra #{c.id}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(c.fecha).toLocaleString('es-AR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void verDetalle(c.id)}
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  <Eye size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-100 pt-2">
                <div>
                  <span className="text-xs text-slate-500 block">Proveedor</span>
                  {c.proveedor_nombre || '—'}
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Total</span>
                  <span className="font-bold">{money(Number(c.total))}</span>
                </div>
              </div>
            </div>
          ))}
          {compras.length === 0 && (
            <p className="text-center py-8 text-slate-400 text-sm">
              Todavía no hay compras.
            </p>
          )}
        </div>
      </div>

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-display text-2xl">Compra #{detalle.id}</h3>
                <p className="text-xs text-slate-500">
                  {new Date(detalle.fecha).toLocaleString('es-AR')}
                  {detalle.proveedor_nombre ? ` · ${detalle.proveedor_nombre}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Producto</th>
                    <th className="pb-2">Cant.</th>
                    <th className="pb-2">Costo</th>
                    <th className="pb-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalle.detalles || []).map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="py-2 pr-2">
                        {d.producto_nombre || `Producto #${d.producto_id}`}
                      </td>
                      <td className="py-2">{d.cantidad}</td>
                      <td className="py-2">{money(Number(d.precio_unitario))}</td>
                      <td className="py-2 text-right font-medium">
                        {money(Number(d.subtotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between font-semibold">
                <span>Total</span>
                <span>{money(Number(detalle.total))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarFuturos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-display text-2xl">Futuros pedidos</h3>
                <p className="text-xs text-slate-500">
                  Lista de reposición. Se suma al vender y se consume al comprar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  value={ordenFuturos}
                  onChange={(e) => setOrdenFuturos(e.target.value as OrdenFuturos)}
                >
                  <option value="agregacion">Orden de carga</option>
                  <option value="alfabetico">A–Z</option>
                </select>
                <button
                  type="button"
                  onClick={exportarFuturosExcel}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold"
                >
                  Exportar Excel
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarFuturos(false)}
                  className="p-1 rounded hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="flex flex-col sm:flex-row gap-2 relative">
                <div className="relative flex-1">
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Buscar producto o escribir custom…"
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value)
                      if (productoId) {
                        const selected = productos.find((p) => p.id === productoId)?.nombre
                        if (selected !== e.target.value) setProductoId(null)
                      }
                    }}
                    onFocus={() => setMostrarSugerencias(true)}
                    onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
                  />
                  {mostrarSugerencias && sugeridos.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                      {sugeridos.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                            onMouseDown={() => {
                              setProductoId(p.id)
                              setBusqueda(p.nombre)
                              setMostrarSugerencias(false)
                            }}
                          >
                            {p.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:w-28"
                  placeholder="Cant."
                  value={cantidadNueva}
                  onChange={(e) => setCantidadNueva(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void agregarFuturo()}
                  className="btn-primary px-4 py-2 text-sm font-semibold"
                >
                  Agregar
                </button>
              </div>

              {totalEstimado > 0 && (
                <div className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 flex justify-between text-sm">
                  <span className="text-sky-800">Gasto estimado de reposición</span>
                  <span className="font-bold text-sky-900">{money(totalEstimado)}</span>
                </div>
              )}

              {cargandoFuturos ? (
                <p className="text-sm text-slate-400 text-center py-8">Cargando…</p>
              ) : futuros.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No hay productos en la lista.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2 text-center">Stock</th>
                        <th className="px-3 py-2 text-center">Cant</th>
                        <th className="px-3 py-2 text-right">Gasto est.</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {futurosOrdenados.map((item, index) => {
                        const cant = parseFloat(String(item.cantidad)) || 0
                        const costo = Number(item.precio_costo) || 0
                        const gasto = cant * costo
                        return (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                            <td className="px-3 py-2 font-medium">
                              {item.producto_nombre || item.producto}
                            </td>
                            <td className={`px-3 py-2 text-center ${stockClass(item.stock_actual)}`}>
                              {item.stock_actual ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {editandoId === item.id ? (
                                <input
                                  className="w-16 text-center rounded border border-slate-300 px-1 py-0.5 text-xs"
                                  value={cantidadEditando}
                                  onChange={(e) => setCantidadEditando(e.target.value)}
                                />
                              ) : (
                                item.cantidad || '—'
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {gasto > 0 ? money(gasto) : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1">
                                {editandoId === item.id ? (
                                  <button
                                    type="button"
                                    onClick={() => void guardarEdicion()}
                                    className="text-xs font-semibold text-emerald-700 px-2"
                                  >
                                    OK
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    title="Editar cantidad"
                                    onClick={() => {
                                      setEditandoId(item.id)
                                      setCantidadEditando(String(item.cantidad ?? ''))
                                    }}
                                    className="p-1 rounded text-slate-600 hover:bg-slate-100"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Eliminar"
                                  onClick={() => void eliminarFuturo(item.id)}
                                  className="p-1 rounded text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
