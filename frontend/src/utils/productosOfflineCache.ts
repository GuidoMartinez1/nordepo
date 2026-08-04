import type { Producto } from '../types'

const CACHE_PREFIX = 'nordepo_productos_offline_v1'

export type ProductosOfflineCache = {
  savedAt: string
  scopeKey: string
  productos: Producto[]
  categorias: { id: number; nombre: string }[]
}

export function productosOfflineScopeKey(
  isAdmin: boolean,
  sucursalId: number | null
): string {
  const role = isAdmin ? 'admin' : 'vendedor'
  const suc = sucursalId == null ? 'todas' : String(sucursalId)
  return `${role}:${suc}`
}

function storageKey(scopeKey: string): string {
  return `${CACHE_PREFIX}:${scopeKey}`
}

/** Snapshot para lectura offline: nombre, stock, precios, costo (+ detalle sucursales si vino del API) */
export function slimProductoForCache(p: Producto): Producto {
  return {
    id: p.id,
    nombre: p.nombre,
    codigo: p.codigo ?? null,
    precio: Number(p.precio) || 0,
    precio_costo: Number(p.precio_costo) || 0,
    porcentaje_ganancia: Number(p.porcentaje_ganancia) || 0,
    categoria_id: p.categoria_id ?? null,
    categoria_nombre: p.categoria_nombre ?? null,
    stock: p.stock,
    stock_total: p.stock_total,
    stock_por_sucursal: p.stock_por_sucursal?.map((s) => ({
      sucursal_id: s.sucursal_id,
      sucursal_nombre: s.sucursal_nombre,
      es_deposito: s.es_deposito,
      cantidad: Number(s.cantidad) || 0,
      precio: s.precio != null ? Number(s.precio) : undefined,
    })),
    precios_por_sucursal: p.precios_por_sucursal?.map((s) => ({
      sucursal_id: s.sucursal_id,
      sucursal_nombre: s.sucursal_nombre,
      es_deposito: s.es_deposito,
      cantidad: Number(s.cantidad) || 0,
      precio: s.precio != null ? Number(s.precio) : undefined,
    })),
  }
}

export function saveProductosOfflineCache(
  scopeKey: string,
  productos: Producto[],
  categorias: { id: number; nombre: string }[]
): void {
  try {
    const payload: ProductosOfflineCache = {
      savedAt: new Date().toISOString(),
      scopeKey,
      productos: productos.map(slimProductoForCache),
      categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre })),
    }
    localStorage.setItem(storageKey(scopeKey), JSON.stringify(payload))
  } catch (err) {
    console.warn('No se pudo guardar caché offline de productos (Nordepo)', err)
  }
}

export function loadProductosOfflineCache(scopeKey: string): ProductosOfflineCache | null {
  try {
    const raw = localStorage.getItem(storageKey(scopeKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProductosOfflineCache
    if (!parsed?.productos || !Array.isArray(parsed.productos)) return null
    return parsed
  } catch {
    return null
  }
}

export function formatCacheSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}
