import { useEffect, useState, Fragment } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Eye, History, Pencil, Plus, ShoppingBag, Trash2, WifiOff, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '../services/api'
import { useSucursal } from '../contexts/SucursalContext'
import { useAuth } from '../contexts/AuthContext'
import { money } from '../utils/money'
import type { Producto } from '../types'
import {
  formatCacheSavedAt,
  loadProductosOfflineCache,
  productosOfflineScopeKey,
  saveProductosOfflineCache,
} from '../utils/productosOfflineCache'

type Categoria = { id: number; nombre: string }
type StockSucursal = {
  sucursal_id: number
  sucursal_nombre: string
  cantidad: number
  es_deposito?: boolean
}
type PrecioSucursal = {
  sucursal_id: number
  sucursal_nombre: string
  precio: number
  porcentaje_ganancia: number
}

type FormState = {
  nombre: string
  codigo: string
  precio_costo: string
  categoria_id: string
}

const emptyForm = (): FormState => ({
  nombre: '',
  codigo: '',
  precio_costo: '',
  categoria_id: '',
})

function calcularPrecioVenta(precioCosto: number, porcentajeGanancia: number) {
  return precioCosto * (1 + porcentajeGanancia / 100)
}

function calcularPorcentajeGanancia(precioCosto: number, precioVenta: number) {
  if (precioCosto <= 0) return 0
  return ((precioVenta - precioCosto) / precioCosto) * 100
}

function gananciaColor(pct: number) {
  if (pct > 30) return 'text-emerald-700 bg-emerald-50'
  if (pct >= 25) return 'text-lime-800 bg-lime-50'
  if (pct >= 15) return 'text-amber-700 bg-amber-50'
  return 'text-rose-700 bg-rose-50'
}

function precioDeSucursal(p: Producto, sucursalId: number | null) {
  if (!sucursalId) return Number(p.precio) || 0
  const row = p.precios_por_sucursal?.find((s) => s.sucursal_id === sucursalId)
  return Number(row?.precio ?? p.precio) || 0
}

function stockDeSucursal(p: Producto, sucursalId: number | null) {
  if (!sucursalId) return p.stock_total ?? p.stock ?? 0
  const row = p.stock_por_sucursal?.find((s) => s.sucursal_id === sucursalId)
  return row?.cantidad ?? p.stock ?? 0
}

function PrecioLista({ value }: { value: number | string }) {
  return (
    <span className="inline-block rounded-md bg-brand-black px-2 py-0.5 text-sm font-bold tabular-nums text-brand-lime">
      {money(value)}
    </span>
  )
}

function DetalleOtrasSucursales({
  producto,
  sucursalId,
}: {
  producto: Producto
  sucursalId: number | null
}) {
  const precios = (producto.precios_por_sucursal ?? []).filter(
    (s) => s.sucursal_id !== sucursalId
  )
  const stocks = (producto.stock_por_sucursal ?? []).filter(
    (s) => s.sucursal_id !== sucursalId
  )
  if (precios.length === 0 && stocks.length === 0) {
    return (
      <p className="text-xs text-slate-400 px-3 py-2">Sin datos de otras sucursales</p>
    )
  }
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Otras sucursales
      </p>
      {precios.map((s) => {
        const stock =
          stocks.find((x) => x.sucursal_id === s.sucursal_id)?.cantidad ?? 0
        return (
          <div
            key={`otras-p-${producto.id}-${s.sucursal_id}`}
            className="flex justify-between gap-3"
          >
            <span className="text-slate-600">{s.sucursal_nombre}</span>
            <span className="font-medium tabular-nums">
              {money(Number(s.precio))} · stock {stock}
            </span>
          </div>
        )
      })}
      {stocks
        .filter((s) => s.es_deposito || !precios.some((p) => p.sucursal_id === s.sucursal_id))
        .map((s) => (
          <div
            key={`otras-s-${producto.id}-${s.sucursal_id}`}
            className="flex justify-between gap-3"
          >
            <span className="text-slate-600">
              {s.sucursal_nombre}
              {s.es_deposito ? ' (depósito)' : ''}
            </span>
            <span className="font-medium tabular-nums">stock {s.cantidad}</span>
          </div>
        ))}
    </div>
  )
}

export default function Productos() {
  const { sucursalId, sucursal, sucursales, todasSucursales, esTodas } = useSucursal()
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [q, setQ] = useState('')
  const [stockFiltro, setStockFiltro] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [gananciaFiltro, setGananciaFiltro] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [stockPorSucursal, setStockPorSucursal] = useState<StockSucursal[]>([])
  const [preciosPorSucursal, setPreciosPorSucursal] = useState<PrecioSucursal[]>([])
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historialNombre, setHistorialNombre] = useState('')
  const [historialData, setHistorialData] = useState<
    { fecha: string; proveedor: string; cantidad: number; costo: number; costo_anterior?: number }[]
  >([])
  const [showFuture, setShowFuture] = useState(false)
  const [futureProduct, setFutureProduct] = useState<Producto | null>(null)
  const [futureQty, setFutureQty] = useState('1')
  const [verOtrasId, setVerOtrasId] = useState<number | null>(null)
  const [modoOffline, setModoOffline] = useState(false)
  const [cacheGuardadoEn, setCacheGuardadoEn] = useState<string | null>(null)

  function toggleOtras(id: number) {
    setVerOtrasId((prev) => (prev === id ? null : id))
  }

  function scopeKey() {
    return productosOfflineScopeKey(isAdmin, sucursalId)
  }

  function exigirConexion(accion = 'esta acción') {
    if (modoOffline || !navigator.onLine) {
      toast.error(`Sin conexión: no se puede ${accion}. Solo lectura del listado en caché.`)
      return false
    }
    return true
  }

  function aplicarCacheOffline(mensaje?: string) {
    const cache = loadProductosOfflineCache(scopeKey())
    if (cache?.productos?.length) {
      setItems(cache.productos)
      if (cache.categorias?.length) setCategorias(cache.categorias)
      setCacheGuardadoEn(cache.savedAt)
      setModoOffline(true)
      setVerOtrasId(null)
      toast(
        mensaje
          ? `Sin conexión. Mostrando caché (${formatCacheSavedAt(cache.savedAt)}).`
          : `Modo sin conexión — caché del ${formatCacheSavedAt(cache.savedAt)}`,
        { icon: '📴' }
      )
      return true
    }
    setModoOffline(true)
    toast.error(
      mensaje ||
        'Sin conexión y no hay listado en caché para esta sucursal. Entrá una vez con red para guardarlo.'
    )
    return false
  }

  async function load(opts?: { silencioso?: boolean }) {
    try {
      if (isAdmin) {
        const params: Record<string, string | number> = {}
        if (sucursalId) {
          params.sucursal_id = sucursalId
          params.detalle_sucursales = 1
        }
        const [prod, cats] = await Promise.all([
          api.get<Producto[]>('/productos', { params }),
          api.get<Categoria[]>('/categorias'),
        ])
        setItems(prod.data)
        setCategorias(cats.data)
        setVerOtrasId(null)
        saveProductosOfflineCache(scopeKey(), prod.data, cats.data)
        setCacheGuardadoEn(new Date().toISOString())
        setModoOffline(false)
        if (opts?.silencioso) toast.success('Conexión restablecida — listado actualizado')
        return
      }
      // Vendedor: precio + stock (detalle plegado) + filtros
      const [prod, cats] = await Promise.all([
        api.get<Producto[]>('/productos'),
        api.get<Categoria[]>('/categorias'),
      ])
      setItems(prod.data)
      setCategorias(cats.data)
      setVerOtrasId(null)
      saveProductosOfflineCache(scopeKey(), prod.data, cats.data)
      setCacheGuardadoEn(new Date().toISOString())
      setModoOffline(false)
      if (opts?.silencioso) toast.success('Conexión restablecida — listado actualizado')
    } catch {
      aplicarCacheOffline(opts?.silencioso ? undefined : 'No se pudieron cargar productos')
    }
  }

  useEffect(() => {
    void load()

    const onOnline = () => {
      void load({ silencioso: true })
    }
    const onOffline = () => {
      const cache = loadProductosOfflineCache(scopeKey())
      if (cache?.productos?.length) {
        setItems(cache.productos)
        if (cache.categorias?.length) setCategorias(cache.categorias)
        setCacheGuardadoEn(cache.savedAt)
        setModoOffline(true)
        toast('Sin conexión: mostrando listado en caché', { icon: '📴' })
      } else {
        setModoOffline(true)
      }
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga al cambiar sucursal/rol
  }, [sucursalId, isAdmin])

  function emptyPrecios(): PrecioSucursal[] {
    return sucursales.map((s) => ({
      sucursal_id: s.id,
      sucursal_nombre: s.nombre,
      precio: 0,
      porcentaje_ganancia: 30,
    }))
  }

  function emptyStock(): StockSucursal[] {
    return todasSucursales.map((s) => ({
      sucursal_id: s.id,
      sucursal_nombre: s.nombre,
      cantidad: 0,
      es_deposito: !!s.es_deposito,
    }))
  }

  function openCreate() {
    if (!exigirConexion('crear productos')) return
    setEditing(null)
    setForm(emptyForm())
    setStockPorSucursal(emptyStock())
    setPreciosPorSucursal(emptyPrecios())
    setShowModal(true)
  }

  async function openEdit(producto: Producto) {
    if (!exigirConexion('editar productos')) return
    try {
      const { data } = await api.get<
        Producto & {
          stock_por_sucursal: StockSucursal[]
          precios_por_sucursal: PrecioSucursal[]
        }
      >(`/productos/${producto.id}`)
      setEditing(producto)
      setForm({
        nombre: data.nombre || '',
        codigo: data.codigo || '',
        precio_costo: String(data.precio_costo ?? ''),
        categoria_id: data.categoria_id ? String(data.categoria_id) : '',
      })
      setStockPorSucursal(
        data.stock_por_sucursal?.length ? data.stock_por_sucursal : emptyStock()
      )
      setPreciosPorSucursal(
        data.precios_por_sucursal?.length ? data.precios_por_sucursal : emptyPrecios()
      )
      setShowModal(true)
    } catch {
      toast.error('No se pudo cargar el producto')
    }
  }

  function setStockSucursal(sucursal_id: number, cantidad: string) {
    const n = Math.max(0, parseInt(cantidad || '0', 10) || 0)
    setStockPorSucursal((prev) =>
      prev.map((s) => (s.sucursal_id === sucursal_id ? { ...s, cantidad: n } : s))
    )
  }

  function updatePrecioSucursal(
    sucursal_id: number,
    field: 'precio' | 'porcentaje_ganancia',
    value: string
  ) {
    const costo = parseFloat(form.precio_costo) || 0
    setPreciosPorSucursal((prev) =>
      prev.map((row) => {
        if (row.sucursal_id !== sucursal_id) return row
        if (field === 'porcentaje_ganancia') {
          const pct = parseFloat(value)
          const pctFinal = Number.isFinite(pct) ? pct : 30
          const precio = costo > 0 ? calcularPrecioVenta(costo, pctFinal) : row.precio
          return { ...row, porcentaje_ganancia: pctFinal, precio: Number(precio.toFixed(2)) }
        }
        const precio = parseFloat(value) || 0
        const pct = costo > 0 ? calcularPorcentajeGanancia(costo, precio) : row.porcentaje_ganancia
        return { ...row, precio, porcentaje_ganancia: Number(pct.toFixed(2)) }
      })
    )
  }

  function onCostoChange(value: string) {
    setForm((prev) => ({ ...prev, precio_costo: value }))
    const costo = parseFloat(value) || 0
    if (costo <= 0) return
    setPreciosPorSucursal((prev) =>
      prev.map((row) => ({
        ...row,
        precio: Number(calcularPrecioVenta(costo, row.porcentaje_ganancia).toFixed(2)),
      }))
    )
  }

  function aplicarPctATodas(pctStr: string) {
    const pct = parseFloat(pctStr)
    if (!Number.isFinite(pct)) return
    const costo = parseFloat(form.precio_costo) || 0
    setPreciosPorSucursal((prev) =>
      prev.map((row) => ({
        ...row,
        porcentaje_ganancia: pct,
        precio:
          costo > 0
            ? Number(calcularPrecioVenta(costo, pct).toFixed(2))
            : row.precio,
      }))
    )
  }

  async function onDelete(producto: Producto) {
    if (!exigirConexion('eliminar productos')) return
    if (!confirm(`¿Eliminar “${producto.nombre}”?`)) return
    try {
      await api.delete(`/productos/${producto.id}`)
      toast.success('Producto eliminado')
      await load()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!exigirConexion('guardar productos')) return
    setSaving(true)
    try {
      const first = preciosPorSucursal[0]
      const payload = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || null,
        precio_costo: Number(form.precio_costo) || 0,
        precio: first?.precio ?? 0,
        porcentaje_ganancia: first?.porcentaje_ganancia ?? 30,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        stock_por_sucursal: stockPorSucursal.map((s) => ({
          sucursal_id: s.sucursal_id,
          cantidad: s.cantidad,
        })),
        precios_por_sucursal: preciosPorSucursal.map((p) => ({
          sucursal_id: p.sucursal_id,
          precio: p.precio,
          porcentaje_ganancia: p.porcentaje_ganancia,
        })),
      }

      if (editing) {
        await api.put(`/productos/${editing.id}`, payload)
        toast.success('Producto actualizado')
      } else {
        await api.post('/productos', payload)
        toast.success('Producto creado')
      }
      setShowModal(false)
      await load()
    } catch {
      toast.error(editing ? 'No se pudo actualizar' : 'No se pudo crear')
    } finally {
      setSaving(false)
    }
  }

  const filtered = items.filter((p) => {
    const needle = q.trim().toLowerCase()
    if (
      needle &&
      !p.nombre.toLowerCase().includes(needle) &&
      !(p.codigo || '').toLowerCase().includes(needle)
    ) {
      return false
    }

    if (stockFiltro) {
      const stock = isAdmin
        ? (p.stock ?? 0)
        : stockDeSucursal(p, sucursalId)
      if (stockFiltro === '>4') {
        if (stock <= 4) return false
      } else if (stock !== Number(stockFiltro)) {
        return false
      }
    }

    if (categoriaFiltro) {
      if (categoriaFiltro === 'none') {
        if (p.categoria_id) return false
      } else if (String(p.categoria_id ?? '') !== categoriaFiltro) {
        return false
      }
    }

    if (isAdmin && gananciaFiltro) {
      const ganancia = Number(p.porcentaje_ganancia) || 0
      const [minStr, maxStr] = gananciaFiltro.split('-')
      const min = Number(minStr)
      const max = Number(maxStr)
      if (!(ganancia >= min && ganancia < max)) return false
    }

    return true
  })

  const hayFiltros = Boolean(
    q || stockFiltro || categoriaFiltro || (isAdmin && gananciaFiltro)
  )

  function exportarExcel() {
    if (!exigirConexion('exportar Excel')) return
    if (!filtered.length) {
      toast.error('No hay productos para exportar')
      return
    }
    const rows = filtered.map((p) => ({
      Nombre: p.nombre,
      Código: p.codigo || '',
      Categoría: p.categoria_nombre || '',
      Costo: Number(p.precio_costo) || 0,
      'Precio venta': Number(p.precio) || 0,
      '% ganancia': Number(p.porcentaje_ganancia) || 0,
      ...(esTodas
        ? { 'Stock total': p.stock_total ?? p.stock ?? 0 }
        : {
            'Stock sucursal': p.stock ?? 0,
            'Stock total': p.stock_total ?? 0,
          }),
    }))
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos')
    XLSX.writeFile(workbook, 'productos.xlsx')
  }

  function limpiarFiltros() {
    setQ('')
    setStockFiltro('')
    setCategoriaFiltro('')
    setGananciaFiltro('')
  }

  async function verHistorial(producto: Producto) {
    if (!exigirConexion('ver el historial de costos')) return
    try {
      const { data } = await api.get<
        { fecha: string; proveedor: string; cantidad: number; costo: number }[]
      >(`/productos/${producto.id}/historial`)
      setHistorialNombre(producto.nombre)
      setHistorialData(data)
      setShowHistory(true)
    } catch {
      toast.error('No se pudo cargar el historial')
    }
  }

  function openFuture(producto: Producto) {
    if (!exigirConexion('agregar a futuros pedidos')) return
    setFutureProduct(producto)
    setFutureQty('1')
    setShowFuture(true)
  }

  async function addToFuture(e: FormEvent) {
    e.preventDefault()
    if (!exigirConexion('agregar a futuros pedidos')) return
    if (!futureProduct) return
    try {
      const { data: pedidos } = await api.get<{ producto_id: number | null }[]>(
        '/futuros-pedidos'
      )
      if (pedidos.some((p) => p.producto_id === futureProduct.id)) {
        toast.error(`“${futureProduct.nombre}” ya está en futuros pedidos`)
        setShowFuture(false)
        return
      }
      await api.post('/futuros-pedidos', {
        producto_id: futureProduct.id,
        cantidad: futureQty,
      })
      toast.success('Agregado a futuros pedidos')
      setShowFuture(false)
    } catch {
      toast.error('No se pudo agregar a futuros pedidos')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="page-title">Productos</h2>
          <p className="text-slate-500 text-sm">
            {isAdmin ? (
              esTodas ? (
                <>Vista consolidada · precio/stock según sucursal al editar</>
              ) : (
                <>
                  Precio y stock de{' '}
                  <span className="font-medium text-brand-black">{sucursal?.nombre}</span>
                </>
              )
            ) : (
              <>
                Precio y stock de{' '}
                <span className="font-medium text-brand-black">{sucursal?.nombre}</span>
                {' · '}
                otras sucursales con el ojito
              </>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={exportarExcel}
              disabled={modoOffline}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Exportar Excel
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={modoOffline}
              className="btn-primary px-4 py-2 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} /> Nuevo producto
            </button>
          </div>
        )}
      </div>

      {modoOffline && (
        <div
          className="rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 flex gap-3 items-start shadow-sm"
          role="status"
        >
          <WifiOff className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold text-amber-900 text-sm sm:text-base">
              Sin conexión — listado de productos en caché
            </p>
            <p className="text-amber-800 text-xs sm:text-sm mt-1">
              Estás viendo la última copia guardada en este dispositivo
              {cacheGuardadoEn ? ` (${formatCacheSavedAt(cacheGuardadoEn)})` : ''}
              {sucursal?.nombre ? ` · sucursal: ${sucursal.nombre}` : esTodas ? ' · vista consolidada' : ''}
              . Stock y precios pueden estar desactualizados. No podés crear, editar ni eliminar
              hasta recuperar internet.
            </p>
            <button
              type="button"
              onClick={() => void load({ silencioso: true })}
              className="mt-2 text-xs font-semibold text-amber-900 underline hover:no-underline"
            >
              Reintentar conexión
            </button>
          </div>
        </div>
      )}

      {!isAdmin ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              placeholder="Buscar por nombre…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              value={stockFiltro}
              onChange={(e) => setStockFiltro(e.target.value)}
            >
              <option value="">Todos los stocks</option>
              <option value="0">Stock: 0</option>
              <option value="1">Stock: 1</option>
              <option value="2">Stock: 2</option>
              <option value="3">Stock: 3</option>
              <option value="4">Stock: 4</option>
              <option value=">4">Stock: &gt; 4</option>
            </select>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              <option value="none">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
            <p>
              Mostrando <span className="font-semibold text-brand-black">{filtered.length}</span> de{' '}
              {items.length}
            </p>
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-brand-black underline-offset-2 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Producto</th>
                    <th className="px-4 py-2">Precio</th>
                    <th className="px-4 py-2 text-center">Stock</th>
                    <th className="px-4 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const precio = precioDeSucursal(p, sucursalId)
                    const stock = stockDeSucursal(p, sucursalId)
                    const abierto = verOtrasId === p.id
                    return (
                      <Fragment key={p.id}>
                        <tr className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium">{p.nombre}</td>
                          <td className="px-4 py-2">
                            <PrecioLista value={precio} />
                          </td>
                          <td className="px-4 py-2 text-center font-semibold">{stock}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => toggleOtras(p.id)}
                              className={`p-1.5 rounded hover:bg-slate-100 ${
                                abierto ? 'text-brand-black bg-slate-100' : 'text-slate-500'
                              }`}
                              title="Ver otras sucursales"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                        {abierto && (
                          <tr className="border-t border-slate-50">
                            <td colSpan={4} className="px-4 py-2">
                              <DetalleOtrasSucursales producto={p} sucursalId={sucursalId} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Sin productos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {filtered.map((p) => {
                const precio = precioDeSucursal(p, sucursalId)
                const stock = stockDeSucursal(p, sucursalId)
                const abierto = verOtrasId === p.id
                return (
                  <div key={p.id} className="border border-slate-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-brand-black">{p.nombre}</h3>
                      <button
                        type="button"
                        onClick={() => toggleOtras(p.id)}
                        className={`p-1.5 rounded hover:bg-slate-100 shrink-0 ${
                          abierto ? 'text-brand-black bg-slate-100' : 'text-slate-500'
                        }`}
                        title="Ver otras sucursales"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-slate-500 block">Precio</span>
                        <PrecioLista value={precio} />
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">Stock</span>
                        <span className="font-bold">{stock}</span>
                      </div>
                    </div>
                    {abierto && (
                      <div className="mt-3">
                        <DetalleOtrasSucursales producto={p} sucursalId={sucursalId} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          placeholder="Buscar por nombre o código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          value={stockFiltro}
          onChange={(e) => setStockFiltro(e.target.value)}
        >
          <option value="">Todos los stocks</option>
          <option value="0">Stock: 0</option>
          <option value="1">Stock: 1</option>
          <option value="2">Stock: 2</option>
          <option value="3">Stock: 3</option>
          <option value="4">Stock: 4</option>
          <option value=">4">Stock: &gt; 4</option>
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          <option value="none">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          value={gananciaFiltro}
          onChange={(e) => setGananciaFiltro(e.target.value)}
        >
          <option value="">Todas las ganancias</option>
          <option value="0-15">Crítico (&lt; 15%)</option>
          <option value="15-25">Regular (15% – 25%)</option>
          <option value="25-30">Bueno (25% – 30%)</option>
          <option value="30-999">Excelente (&gt; 30%)</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
        <p>
          Mostrando <span className="font-semibold text-brand-black">{filtered.length}</span> de{' '}
          {items.length}
        </p>
        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="text-brand-black underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2">Costo</th>
                <th className="px-4 py-2">{esTodas ? 'Venta (ref.)' : 'Venta'}</th>
                <th className="px-4 py-2">% ganancia</th>
                <th className="px-4 py-2">{esTodas ? 'Stock total' : 'Stock'}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                    No hay productos con esos filtros
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const pct = Number(p.porcentaje_ganancia) || 0
                const abierto = verOtrasId === p.id
                return (
                  <Fragment key={p.id}>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">{p.nombre}</td>
                    <td className="px-4 py-2">{p.categoria_nombre || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{money(Number(p.precio_costo))}</td>
                    <td className="px-4 py-2">
                      <PrecioLista value={Number(p.precio)} />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${gananciaColor(pct)}`}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      {esTodas ? (p.stock_total ?? p.stock ?? 0) : (p.stock ?? 0)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end">
                        {!esTodas && (
                          <button
                            type="button"
                            onClick={() => toggleOtras(p.id)}
                            className={`p-1.5 rounded hover:bg-slate-100 ${
                              abierto ? 'text-brand-black bg-slate-100' : 'text-slate-600'
                            }`}
                            title="Ver otras sucursales"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void verHistorial(p)}
                          disabled={modoOffline}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={modoOffline ? 'Sin conexión' : 'Historial de costos'}
                        >
                          <History size={16} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => openFuture(p)}
                              disabled={modoOffline}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={modoOffline ? 'Sin conexión' : 'Agregar a futuros pedidos'}
                            >
                              <ShoppingBag size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void openEdit(p)}
                              disabled={modoOffline}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={modoOffline ? 'Sin conexión' : 'Editar'}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDelete(p)}
                              disabled={modoOffline}
                              className="p-1.5 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              title={modoOffline ? 'Sin conexión' : 'Eliminar'}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {abierto && !esTodas && (
                    <tr className="border-t border-slate-50">
                      <td colSpan={7} className="px-4 py-2">
                        <DetalleOtrasSucursales producto={p} sucursalId={sucursalId} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {filtered.map((p) => {
            const pct = Number(p.porcentaje_ganancia) || 0
            const stock = esTodas ? (p.stock_total ?? p.stock ?? 0) : (p.stock ?? 0)
            const abierto = verOtrasId === p.id
            return (
              <div
                key={p.id}
                className="border border-slate-200 rounded-lg p-4 shadow-sm bg-slate-50/40"
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-brand-black leading-snug">{p.nombre}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{p.categoria_nombre || 'Sin categoría'}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    {!esTodas && (
                      <button
                        type="button"
                        onClick={() => toggleOtras(p.id)}
                        className={`p-1.5 rounded hover:bg-white ${
                          abierto ? 'text-brand-black bg-white' : 'text-slate-600'
                        }`}
                        title="Ver otras sucursales"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void verHistorial(p)}
                      disabled={modoOffline}
                      className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                      title={modoOffline ? 'Sin conexión' : 'Historial de costos'}
                    >
                      <History size={16} />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openFuture(p)}
                          disabled={modoOffline}
                          className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                          title={modoOffline ? 'Sin conexión' : 'Futuros pedidos'}
                        >
                          <ShoppingBag size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void openEdit(p)}
                          disabled={modoOffline}
                          className="p-1.5 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                          title={modoOffline ? 'Sin conexión' : 'Editar'}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(p)}
                          disabled={modoOffline}
                          className="p-1.5 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={modoOffline ? 'Sin conexión' : 'Eliminar'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Venta</span>
                    <PrecioLista value={Number(p.precio)} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Costo / %</span>
                    <span className="font-medium">{money(Number(p.precio_costo))}</span>
                    <span
                      className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${gananciaColor(pct)}`}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {esTodas ? 'Stock total' : 'Stock'}
                    </span>
                    <span
                      className={`font-bold ${stock <= 4 ? 'text-rose-600' : 'text-emerald-700'}`}
                    >
                      {stock} uds
                    </span>
                  </div>
                </div>
                {abierto && !esTodas && (
                  <div className="mt-3">
                    <DetalleOtrasSucursales producto={p} sucursalId={sucursalId} />
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center py-8 text-slate-400 text-sm">
              No hay productos con esos filtros
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-display text-2xl tracking-wide">
                {editing ? 'Editar producto' : 'Nuevo producto'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <label className="block text-sm">
                <span className="text-slate-600">Nombre (modelo + color + talle)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-600">Código</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">Categoría</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
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
                </label>
              </div>

              <label className="block text-sm max-w-xs">
                <span className="text-slate-600">Costo (igual en todas las sucursales)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.precio_costo}
                  onChange={(e) => onCostoChange(e.target.value)}
                />
              </label>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-sm text-slate-600 font-medium">
                    Precio de venta y % por sucursal
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-black underline"
                    onClick={() => {
                      const pct = prompt('Aplicar este % a todas las sucursales', '30')
                      if (pct != null) aplicarPctATodas(pct)
                    }}
                  >
                    Aplicar % a todas
                  </button>
                </div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Sucursal</th>
                        <th className="px-3 py-2">%</th>
                        <th className="px-3 py-2">Precio venta</th>
                        <th className="px-3 py-2">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockPorSucursal
                        .filter((s) => s.es_deposito)
                        .map((s) => (
                          <tr key={s.sucursal_id} className="border-t border-slate-100 bg-slate-50/80">
                            <td className="px-3 py-2 font-medium" colSpan={3}>
                              {s.sucursal_nombre}
                              <span className="text-xs text-slate-400"> · sin precio de venta</span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                className="w-20 rounded border border-slate-300 px-2 py-1"
                                value={s.cantidad}
                                onChange={(e) => setStockSucursal(s.sucursal_id, e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      {preciosPorSucursal.map((p) => {
                        const stock =
                          stockPorSucursal.find((s) => s.sucursal_id === p.sucursal_id)
                            ?.cantidad ?? 0
                        return (
                          <tr key={p.sucursal_id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium">
                              {p.sucursal_nombre}
                              {p.sucursal_id === sucursalId ? (
                                <span className="text-xs text-slate-400"> · activa</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                className="w-20 rounded border border-slate-300 px-2 py-1"
                                value={p.porcentaje_ganancia}
                                onChange={(e) =>
                                  updatePrecioSucursal(
                                    p.sucursal_id,
                                    'porcentaje_ganancia',
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                className="w-28 rounded border border-slate-300 px-2 py-1"
                                value={p.precio}
                                onChange={(e) =>
                                  updatePrecioSucursal(p.sucursal_id, 'precio', e.target.value)
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                className="w-20 rounded border border-slate-300 px-2 py-1"
                                value={stock}
                                onChange={(e) =>
                                  setStockSucursal(p.sucursal_id, e.target.value)
                                }
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Las compras van al depósito; usá Traslados para mandar stock a sucursales.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary py-2.5 text-sm">
                  {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-display text-2xl">Historial de costos</h3>
                <p className="text-xs text-slate-500">{historialNombre}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {historialData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  Todavía no hay compras registradas para este producto.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="pb-2">Fecha</th>
                      <th className="pb-2">Proveedor</th>
                      <th className="pb-2">Cant.</th>
                      <th className="pb-2 text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialData.map((h, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2">
                          {new Date(h.fecha).toLocaleDateString('es-AR')}
                        </td>
                        <td className="py-2">{h.proveedor}</td>
                        <td className="py-2">{h.cantidad}</td>
                        <td className="py-2 text-right font-semibold">
                          {money(Number(h.costo))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showFuture && futureProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form
            onSubmit={addToFuture}
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Futuros pedidos</h3>
              <button
                type="button"
                onClick={() => setShowFuture(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600">{futureProduct.nombre}</p>
            <label className="block text-sm">
              <span className="text-slate-600">Cantidad a pedir</span>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={futureQty}
                onChange={(e) => setFutureQty(e.target.value)}
                required
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFuture(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button type="submit" className="flex-1 btn-primary py-2.5 text-sm">
                Agregar
              </button>
            </div>
          </form>
        </div>
      )}
        </>
      )}
    </div>
  )
}
