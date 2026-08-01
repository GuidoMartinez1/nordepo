import express from 'express'
import pool from '../db.js'
import { requireRole } from '../middleware/requireAuth.js'
import { sumarAFuturosPedidos, restarAFuturosPedidos } from '../utils/futurosPedidosHelper.js'

const router = express.Router()

const ventaSelect = `
  SELECT v.*,
         s.nombre AS sucursal_nombre,
         c.nombre AS cliente_nombre,
         cmp.nombre AS cuenta_mp_nombre,
         cmp.alias AS cuenta_mp_alias
  FROM ventas v
  JOIN sucursales s ON s.id = v.sucursal_id
  LEFT JOIN clientes c ON c.id = v.cliente_id
  LEFT JOIN cuentas_mp cmp ON cmp.id = v.cuenta_mp_id
`

router.get('/', async (req, res) => {
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  try {
    const params = []
    let where = ''
    if (sucursalId) {
      params.push(sucursalId)
      where = `WHERE v.sucursal_id = $${params.length}`
    }
    const { rows } = await pool.query(
      `${ventaSelect}
       ${where}
       ORDER BY v.fecha DESC
       LIMIT 5000`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar ventas' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`${ventaSelect} WHERE v.id = $1`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Venta no encontrada' })
    const detalles = await pool.query(
      `SELECT d.*, p.nombre AS producto_nombre
       FROM detalles_venta d
       LEFT JOIN productos p ON p.id = d.producto_id
       WHERE d.venta_id = $1`,
      [req.params.id]
    )
    res.json({ ...rows[0], detalles: detalles.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener venta' })
  }
})

/**
 * body: {
 *   sucursal_id, cliente_id?, metodo_pago?, cuenta_mp_id?, estado?, notas?,
 *   items: [{ producto_id, cantidad, precio_unitario }]
 * }
 */
router.post('/', async (req, res) => {
  const { sucursal_id, cliente_id, metodo_pago, cuenta_mp_id, estado, notas, items } =
    req.body || {}
  if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es obligatorio' })
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es obligatorio' })
  }

  const metodo = metodo_pago || 'efectivo'
  let cuentaMpId = null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (metodo === 'mercadopago') {
      if (!cuenta_mp_id) {
        throw Object.assign(
          new Error('Elegí la cuenta / alias de Mercado Pago'),
          { status: 400 }
        )
      }
      const cuenta = await client.query(
        `SELECT id FROM cuentas_mp
         WHERE id = $1 AND sucursal_id = $2 AND activa = TRUE`,
        [cuenta_mp_id, sucursal_id]
      )
      if (!cuenta.rows.length) {
        throw Object.assign(
          new Error('Cuenta Mercado Pago inválida para esta sucursal'),
          { status: 400 }
        )
      }
      cuentaMpId = Number(cuenta_mp_id)
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

    const { rows: ventaRows } = await client.query(
      `INSERT INTO ventas
         (sucursal_id, cliente_id, total, estado, metodo_pago, cuenta_mp_id, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        sucursal_id,
        cliente_id || null,
        total,
        estado || 'completada',
        metodo,
        cuentaMpId,
        notas || null,
      ]
    )
    const venta = ventaRows[0]

    for (const linea of lineas) {
      await client.query(
        `INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [venta.id, linea.producto_id, linea.cantidad, linea.precio_unitario, linea.subtotal]
      )

      if ((estado || 'completada') === 'completada' || estado === 'adeuda') {
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
    }

    await client.query('COMMIT')
    res.status(201).json(venta)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Error al crear venta' })
  } finally {
    client.release()
  }
})

/** Solo admin: borra la venta y devuelve el stock a la sucursal. */
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: ventaRows } = await client.query(
      `SELECT id, sucursal_id, estado FROM ventas WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    )
    if (!ventaRows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Venta no encontrada' })
    }

    const venta = ventaRows[0]
    const { rows: detalles } = await client.query(
      `SELECT producto_id, cantidad FROM detalles_venta WHERE venta_id = $1`,
      [venta.id]
    )

    if (venta.estado === 'completada' || venta.estado === 'adeuda') {
      for (const d of detalles) {
        if (!d.producto_id) continue
        await client.query(
          `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (producto_id, sucursal_id)
           DO UPDATE SET cantidad = stock_sucursal.cantidad + EXCLUDED.cantidad`,
          [d.producto_id, venta.sucursal_id, d.cantidad]
        )
        await restarAFuturosPedidos(client, d.producto_id, d.cantidad)
      }
    }

    await client.query('DELETE FROM ventas WHERE id = $1', [venta.id])
    await client.query('COMMIT')
    res.json({ ok: true, message: 'Venta eliminada y stock restaurado' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar venta' })
  } finally {
    client.release()
  }
})

export default router
