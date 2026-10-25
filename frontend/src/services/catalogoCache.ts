import type { Producto } from '../types'

const PREFIX = 'nordepo:catalogo:v1:'
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

type Entrada<T> = { datos: T[]; actualizado: number }

export function catalogoScope(usuarioId: number, role: string, sucursalId: number) {
  return `${apiScope()}:${usuarioId}:${role}:${sucursalId}`
}

function apiScope() {
  return encodeURIComponent(import.meta.env.VITE_API_URL || '/api')
}

export function leerCatalogo<T>(scope: string, recurso: string): Entrada<T> | null {
  try {
    const value = JSON.parse(localStorage.getItem(`${PREFIX}${scope}:${recurso}`) || 'null')
    if (!value || !Array.isArray(value.datos) ||
      !value.datos.every((item: { id?: unknown; nombre?: unknown; precio?: unknown; stock?: unknown }) =>
        item && Number.isInteger(item.id) && typeof item.nombre === 'string' &&
        (recurso !== 'productos' || (Number.isFinite(item.precio) && Number.isFinite(item.stock)))) ||
      !Number.isFinite(value.actualizado) || value.actualizado > Date.now() ||
      Date.now() - value.actualizado > MAX_AGE) return null
    return value
  } catch {
    return null
  }
}

export function guardarCatalogo<T>(scope: string, recurso: string, datos: T[], actualizado = Date.now()) {
  try {
    localStorage.setItem(`${PREFIX}${scope}:${recurso}`, JSON.stringify({ datos, actualizado }))
  } catch {
    // La venta sigue funcionando si el navegador no permite guardar el catálogo.
  }
}

// Guardar únicamente los campos necesarios para vender, sin costos ni márgenes.
export function productosParaVenta(productos: Producto[], sucursalId: number): Producto[] {
  return productos.map((p) => {
    const stockSucursal = p.stock_por_sucursal?.find((s) => s.sucursal_id === sucursalId)
    const precioSucursal = p.precios_por_sucursal?.find((s) => s.sucursal_id === sucursalId)
    return {
      id: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      categoria_id: p.categoria_id,
      precio: Number(precioSucursal?.precio ?? p.precio ?? 0),
      stock: stockSucursal?.cantidad ?? p.stock ?? 0,
      precio_costo: 0,
      porcentaje_ganancia: 0,
    }
  })
}

export function descontarStockCatalogo(scope: string, vendidos: { productoId: number; cantidad: number }[]) {
  const entrada = leerCatalogo<Producto>(scope, 'productos')
  if (!entrada) return
  const cantidades = new Map<number, number>()
  for (const item of vendidos) {
    cantidades.set(item.productoId, (cantidades.get(item.productoId) || 0) + item.cantidad)
  }
  guardarCatalogo(scope, 'productos', entrada.datos.map((p) => ({
    ...p,
    stock: Math.max(0, (p.stock ?? 0) - (cantidades.get(p.id) || 0)),
  })), entrada.actualizado)
}
