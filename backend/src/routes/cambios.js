import express from 'express'
import pool from '../db.js'
import { sumarAFuturosPedidos, restarAFuturosPedidos } from '../utils/futurosPedidosHelper.js'

const router = express.Router()

function normalizarLineas(items = [], { permiteDirecto = false } = {}) {
  return items.map((it) => {
    const productoId = it.producto_id ? Number(it.producto_id) : null
    const cantidad = Math.round(Number(it.cantidad))
    const precio = Math.round(Number(it.precio_unitario))
    const descripcion = (it.descripcion || '').trim()
    if (!(cantidad > 0) || !(precio >= 0)) {
      throw Object.assign(new Error('Item inválido'), { status: 400 })
    }
    if (!productoId && (!permiteDirecto || precio <= 0)) {
      throw Object.assign(new Error('Item inválido'), { status: 400 })
    }
    return {
      producto_id: productoId,
      cantidad,
      precio_unitario: precio,
      subtotal: cantidad * precio,
      descripcion: productoId ? null : descripcion || 'Importe directo',
    }
  })
}

async function precioCostoUnitario(client, productoId) {
  if (!productoId) return null
  const { rows } = await client.query(
    `SELECT precio_costo FROM productos WHERE id = $1`,
    [productoId]
  )
  return rows[0]?.precio_costo ?? null
}

async function insertarDetalle(client, ventaId, linea, signo, descripcion) {
  const cantidad = signo * linea.cantidad
  const subtotal = signo * linea.subtotal
  const costo = await precioCostoUnitario(client, linea.producto_id)

  await client.query(
    `INSERT INTO detalles_venta
       (venta_id, producto_id, cantidad, precio_unitario, subtotal, descripcion, precio_costo_unitario)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      ventaId,
      linea.producto_id,
      cantidad,
      linea.precio_unitario,
      subtotal,
      linea.descripcion || descripcion,
      costo,
    ]
  )
}

/**
 * Registra un cambio como venta neta:
 * - devoluciones: vuelven al stock y se guardan con cantidad/subtotal negativo
 * - entregas: descuentan stock y se guardan positivo
 */
router.post('/', async (req, res) => {
  let {
    sucursal_id,
    metodo_pago,
    tipo_tarjeta,
    cuenta_mp_id,
    notas,
    recargo_tarjeta,
    devoluciones = [],
    entregas = [],
  } = req.body || {}

  if (req.user?.role === 'vendedor') {
    if (!req.user.sucursal_id) {
      return res.status(403).json({ error: 'Vendedor sin sucursal asignada' })
    }
    sucursal_id = Number(req.user.sucursal_id)
  }

  if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es obligatorio' })

  const lineasDevueltas = normalizarLineas(devoluciones)
  const lineasEntregadas = normalizarLineas(entregas, { permiteDirecto: true })

  if (!lineasDevueltas.length || !lineasEntregadas.length) {
    return res.status(400).json({
      error: 'Agregá al menos un producto devuelto y uno entregado',
    })
  }

  const totalDevuelto = lineasDevueltas.reduce((acc, l) => acc + l.subtotal, 0)
  const totalEntregado = lineasEntregadas.reduce((acc, l) => acc + l.subtotal, 0)
  const recargoTarjetaMonto = Math.max(0, Math.round(Number(recargo_tarjeta?.monto) || 0))
  const recargoTarjetaDescripcion =
    (recargo_tarjeta?.descripcion || '').trim() || 'Recargo tarjeta'
  const total = totalEntregado - totalDevuelto + recargoTarjetaMonto
  const metodo = metodo_pago || 'efectivo'
  const tipoTarjeta =
    metodo === 'tarjeta' && ['credito', 'debito'].includes(String(tipo_tarjeta || ''))
      ? String(tipo_tarjeta)
      : metodo === 'tarjeta'
        ? 'credito'
        : null
  let cuentaMpId = null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const sucursalOk = await client.query(
      `SELECT id FROM sucursales
       WHERE id = $1 AND activa = TRUE AND COALESCE(es_deposito, FALSE) = FALSE`,
      [sucursal_id]
    )
    if (!sucursalOk.rows.length) {
      throw Object.assign(new Error('Sucursal inválida'), { status: 400 })
    }

    if (metodo === 'mercadopago' && total > 0) {
      if (!cuenta_mp_id) {
        throw Object.assign(new Error('Elegí la cuenta / alias de Mercado Pago'), {
          status: 400,
        })
      }
      const cuenta = await client.query(
        `SELECT id FROM cuentas_mp
         WHERE id = $1 AND sucursal_id = $2 AND activa = TRUE`,
        [cuenta_mp_id, sucursal_id]
      )
      if (!cuenta.rows.length) {
        throw Object.assign(new Error('Cuenta Mercado Pago inválida para esta sucursal'), {
          status: 400,
        })
      }
      cuentaMpId = Number(cuenta_mp_id)
    }

    const usuarioId = req.user?.id ? Number(req.user.id) : null
    const textoNotas = [
      'Cambio de producto',
      notas ? String(notas).trim() : '',
      `Devuelto: ${totalDevuelto}`,
      `Entregado: ${totalEntregado}`,
      recargoTarjetaMonto > 0 ? `Recargo tarjeta: ${recargoTarjetaMonto}` : '',
    ]
      .filter(Boolean)
      .join(' · ')

    const { rows: ventaRows } = await client.query(
      `INSERT INTO ventas
         (sucursal_id, cliente_id, total, estado, metodo_pago, tipo_tarjeta, cuenta_mp_id, notas, usuario_id)
       VALUES ($1, NULL, $2, 'cambio', $3, $4, $5, $6, $7)
       RETURNING *`,
      [sucursal_id, total, metodo, tipoTarjeta, cuentaMpId, textoNotas, usuarioId]
    )
    const venta = ventaRows[0]

    for (const linea of lineasDevueltas) {
      await insertarDetalle(client, venta.id, linea, -1, 'Cambio - devolución')
      await client.query(
        `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
         VALUES ($1, $2, $3)
         ON CONFLICT (producto_id, sucursal_id)
         DO UPDATE SET cantidad = stock_sucursal.cantidad + EXCLUDED.cantidad`,
        [linea.producto_id, sucursal_id, linea.cantidad]
      )
      await restarAFuturosPedidos(client, linea.producto_id, linea.cantidad)
    }

    for (const linea of lineasEntregadas) {
      await insertarDetalle(client, venta.id, linea, 1, 'Cambio - producto entregado')
      if (!linea.producto_id) continue
      const upd = await client.query(
        `UPDATE stock_sucursal
         SET cantidad = cantidad - $1
         WHERE producto_id = $2 AND sucursal_id = $3 AND cantidad >= $1
         RETURNING cantidad`,
        [linea.cantidad, linea.producto_id, sucursal_id]
      )
      if (!upd.rows.length) {
        throw Object.assign(
          new Error(`Stock insuficiente para producto ${linea.producto_id}`),
          { status: 400 }
        )
      }
      await sumarAFuturosPedidos(client, linea.producto_id, linea.cantidad)
    }

    if (recargoTarjetaMonto > 0) {
      await client.query(
        `INSERT INTO detalles_venta
           (venta_id, producto_id, cantidad, precio_unitario, subtotal, descripcion, precio_costo_unitario)
         VALUES ($1, NULL, 1, $2, $2, $3, NULL)`,
        [venta.id, recargoTarjetaMonto, recargoTarjetaDescripcion]
      )
    }

    await client.query('COMMIT')
    res.status(201).json(venta)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Error al registrar cambio' })
  } finally {
    client.release()
  }
})

export default router
