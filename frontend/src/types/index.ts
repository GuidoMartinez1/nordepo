export type Sucursal = {
  id: number
  nombre: string
  codigo: string
  activa: boolean
  es_deposito?: boolean
}

export type Cliente = {
  id: number
  nombre: string
  email?: string | null
  telefono?: string | null
  direccion?: string | null
}

export type Venta = {
  id: number
  sucursal_id: number
  sucursal_nombre?: string
  cliente_nombre?: string | null
  total: number
  fecha: string
  estado: string
  metodo_pago: string
  cuenta_mp_id?: number | null
  cuenta_mp_nombre?: string | null
  cuenta_mp_alias?: string | null
  usuario_id?: number | null
  usuario_nombre?: string | null
}

export type StockSucursalItem = {
  sucursal_id: number
  sucursal_nombre: string
  es_deposito?: boolean
  cantidad: number
  precio?: number
}

export type Producto = {
  id: number
  nombre: string
  descripcion?: string | null
  precio: number
  precio_costo: number
  porcentaje_ganancia: number
  categoria_id?: number | null
  categoria_nombre?: string | null
  codigo?: string | null
  stock?: number
  stock_total?: number
  stock_por_sucursal?: StockSucursalItem[]
  precios_por_sucursal?: StockSucursalItem[]
}

export type CuentaMp = {
  id: number
  sucursal_id: number
  sucursal_nombre?: string
  nombre: string
  alias: string
  activa: boolean
}
