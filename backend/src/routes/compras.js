import express from 'express'
import pool from '../db.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  try {
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
       LIMIT 200`,
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
 * body: {
 *   sucursal_id, proveedor_id?, notas?,
 *   items: [{ producto_id, cantidad, precio_unitario }]
 * }
 * Suma stock en la sucursal indicada y actualiza precio_costo del producto.
 */
router.post('/', async (req, res) => {
  const { sucursal_id, proveedor_id, notas, items } = req.body || {}
  if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es obligatorio' })
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es obligatorio' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

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
      [sucursal_id, proveedor_id || null, total, notas || null]
    )
    const compra = compraRows[0]

    for (const linea of lineas) {
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
        [linea.producto_id, sucursal_id, linea.cantidad]
      )

      await client.query(
        `UPDATE productos
         SET precio_costo = $1, updated_at = NOW()
         WHERE id = $2`,
        [linea.precio_unitario, linea.producto_id]
      )
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
