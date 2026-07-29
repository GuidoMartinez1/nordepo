export type Sucursal = {
  id: number
  nombre: string
  codigo: string
  activa: boolean
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
}
