import express from 'express'
import pool from '../db.js'
import { restarAFuturosPedidos } from '../utils/futurosPedidosHelper.js'

const router = express.Router()

async function validarSucursalVenta(client, sucursalId) {
  const { rows } = await client.query(
    `SELECT id FROM sucursales
     WHERE id = $1 AND activa = TRUE AND COALESCE(es_deposito, FALSE) = FALSE`,
    [sucursalId]
  )
  return rows.length > 0
}

router.get('/', async (req, res) => {
  try {
    const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
    const params = []
    let where = ''
    if (sucursalId) {
      params.push(sucursalId)
      where = `WHERE c.sucursal_id = $${params.length}`
    }
    const { rows } = await pool.query(
      `SELECT c.*, s.nombre AS sucursal_nombre, p.nombre AS proveedor_nombre
       FROM compras c
       JOIN sucursales s ON s.id = c.sucursal_id
       LEFT JOIN proveedores p ON p.id = c.proveedor_id
       ${where}
       ORDER BY c.fecha DESC
       LIMIT 5000`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar compras' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, s.nombre AS sucursal_nombre, p.nombre AS proveedor_nombre
       FROM compras c
       JOIN sucursales s ON s.id = c.sucursal_id
       LEFT JOIN proveedores p ON p.id = c.proveedor_id
       WHERE c.id = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Compra no encontrada' })
    const detalles = await pool.query(
      `SELECT d.*, pr.nombre AS producto_nombre
       FROM detalles_compra d
       LEFT JOIN productos pr ON pr.id = d.producto_id
       WHERE d.compra_id = $1`,
      [req.params.id]
    )
    res.json({ ...rows[0], detalles: detalles.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener compra' })
  }
})

/**
 * body: { sucursal_id, proveedor_id?, notas?, items: [{ producto_id, cantidad, precio_unitario }] }
 * El stock ingresa en la sucursal elegida.
 */
router.post('/', async (req, res) => {
  const { sucursal_id, proveedor_id, notas, items } = req.body || {}
  if (!sucursal_id) {
    return res.status(400).json({ error: 'sucursal_id es obligatorio' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es obligatorio' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const sucursalId = Number(sucursal_id)
    if (!(await validarSucursalVenta(client, sucursalId))) {
      throw Object.assign(new Error('Sucursal destino inválida'), { status: 400 })
    }

    let total = 0
    const lineas = items.map((it) => {
      const cantidad = Number(it.cantidad)
      const precio = Number(it.precio_unitario)
      if (!it.producto_id || !(cantidad > 0)) {
        throw Object.assign(new Error('Item inválido'), { status: 400 })
      }
      const subtotal = cantidad * precio
      total += subtotal
      return { producto_id: it.producto_id, cantidad, precio_unitario: precio, subtotal }
    })

    const { rows: compraRows } = await client.query(
      `INSERT INTO compras (sucursal_id, proveedor_id, total, notas)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sucursalId, proveedor_id || null, total, notas || null]
    )
    const compra = compraRows[0]

    for (const linea of lineas) {
      const prod = await client.query(
        `SELECT precio_costo FROM productos WHERE id = $1`,
        [linea.producto_id]
      )
      if (!prod.rows.length) {
        throw Object.assign(new Error(`Producto ${linea.producto_id} no encontrado`), { status: 400 })
      }

      const costoActual = Number(prod.rows[0].precio_costo) || 0
      const costoNuevo = linea.precio_unitario

      await client.query(
        `INSERT INTO detalles_compra (compra_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [compra.id, linea.producto_id, linea.cantidad, linea.precio_unitario, linea.subtotal]
      )

      await client.query(
        `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
         VALUES ($1, $2, $3)
         ON CONFLICT (producto_id, sucursal_id)
         DO UPDATE SET cantidad = stock_sucursal.cantidad + EXCLUDED.cantidad`,
        [linea.producto_id, sucursalId, linea.cantidad]
      )

      await client.query(
        `INSERT INTO historial_costos
           (producto_id, compra_id, sucursal_id, precio_costo_anterior, precio_costo_nuevo, cantidad)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [linea.producto_id, compra.id, sucursalId, costoActual, costoNuevo, linea.cantidad]
      )

      let precioCosto = costoActual
      const costoSubio = costoNuevo > costoActual || (costoActual === 0 && costoNuevo > 0)
      if (costoSubio) precioCosto = costoNuevo

      if (precioCosto !== costoActual) {
        await client.query(
          `UPDATE productos SET precio_costo = $1, updated_at = NOW() WHERE id = $2`,
          [precioCosto, linea.producto_id]
        )
      }

      if (costoSubio && precioCosto > 0) {
        await client.query(
          `UPDATE precio_sucursal ps
           SET porcentaje_ganancia = ROUND(((ps.precio - $1) / $1) * 100, 2)
           FROM sucursales s
           WHERE ps.sucursal_id = s.id
             AND COALESCE(s.es_deposito, FALSE) = FALSE
             AND ps.producto_id = $2`,
          [precioCosto, linea.producto_id]
        )
      }

      await restarAFuturosPedidos(client, linea.producto_id, linea.cantidad)
    }

    await client.query('COMMIT')
    res.status(201).json(compra)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Error al crear compra' })
  } finally {
    client.release()
  }
})

export default router
