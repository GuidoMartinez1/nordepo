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
         cmp.alias AS cuenta_mp_alias,
         u.username AS usuario_nombre
  FROM ventas v
  JOIN sucursales s ON s.id = v.sucursal_id
  LEFT JOIN clientes c ON c.id = v.cliente_id
  LEFT JOIN cuentas_mp cmp ON cmp.id = v.cuenta_mp_id
  LEFT JOIN users u ON u.id = v.usuario_id
`

router.get('/', async (req, res) => {
  let sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  const esVendedor = req.user?.role === 'vendedor'
  if (esVendedor) {
    if (!req.user.sucursal_id) {
      return res.status(403).json({ error: 'Vendedor sin sucursal asignada' })
    }
    if (!req.user.id) {
      return res.status(403).json({ error: 'Usuario no identificado' })
    }
    sucursalId = Number(req.user.sucursal_id)
  }
  try {
    const params = []
    const clauses = []
    if (sucursalId) {
      params.push(sucursalId)
      clauses.push(`v.sucursal_id = $${params.length}`)
    }
    if (esVendedor) {
      params.push(Number(req.user.id))
      clauses.push(`v.usuario_id = $${params.length}`)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
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

    const venta = rows[0]
    if (req.user?.role === 'vendedor') {
      if (Number(venta.usuario_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'No podés ver esta venta' })
      }
    }

    const detalles = await pool.query(
      `SELECT d.*, p.nombre AS producto_nombre
       FROM detalles_venta d
       LEFT JOIN productos p ON p.id = d.producto_id
       WHERE d.venta_id = $1`,
      [req.params.id]
    )
    res.json({ ...venta, detalles: detalles.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener venta' })
  }
})

/**
 * body: {
 *   sucursal_id, cliente_id?, metodo_pago?, cuenta_mp_id?, estado?, notas?,
 *   items: [{ producto_id?, cantidad, precio_unitario, descripcion? }]
 * }
 * Items sin producto_id = importe directo (no descuenta stock).
 */
router.post('/', async (req, res) => {
  let { sucursal_id, cliente_id, metodo_pago, cuenta_mp_id, estado, notas, items } =
    req.body || {}

  if (req.user?.role === 'vendedor') {
    if (!req.user.sucursal_id) {
      return res.status(403).json({ error: 'Vendedor sin sucursal asignada' })
    }
    sucursal_id = Number(req.user.sucursal_id)
  }

  if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es obligatorio' })
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es obligatorio' })
  }

  const metodo = metodo_pago || 'efectivo'
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
      const precio = Math.round(Number(it.precio_unitario))
      const productoId = it.producto_id ? Number(it.producto_id) : null
      const descripcion = (it.descripcion || '').trim() || null
      if (!(cantidad > 0) || !(precio >= 0)) {
        throw Object.assign(new Error('Item inválido'), { status: 400 })
      }
      if (!productoId && precio <= 0) {
        throw Object.assign(new Error('Importe directo inválido'), { status: 400 })
      }
      const subtotal = cantidad * precio
      total += subtotal
      return {
        producto_id: productoId,
        cantidad,
        precio_unitario: precio,
        subtotal,
        descripcion: productoId ? descripcion : descripcion || 'Importe directo',
      }
    })

    const usuarioId = req.user?.id ? Number(req.user.id) : null

    const { rows: ventaRows } = await client.query(
      `INSERT INTO ventas
         (sucursal_id, cliente_id, total, estado, metodo_pago, cuenta_mp_id, notas, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        sucursal_id,
        cliente_id || null,
        total,
        estado || 'completada',
        metodo,
        cuentaMpId,
        notas || null,
        usuarioId,
      ]
    )
    const venta = ventaRows[0]

    for (const linea of lineas) {
      let precioCostoUnitario = null
      if (linea.producto_id) {
        const costoResult = await client.query(
          `SELECT precio_costo FROM productos WHERE id = $1`,
          [linea.producto_id]
        )
        if (costoResult.rows.length > 0 && costoResult.rows[0].precio_costo != null) {
          precioCostoUnitario = costoResult.rows[0].precio_costo
        }
      }

      await client.query(
        `INSERT INTO detalles_venta
           (venta_id, producto_id, cantidad, precio_unitario, subtotal, descripcion, precio_costo_unitario)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          venta.id,
          linea.producto_id,
          linea.cantidad,
          linea.precio_unitario,
          linea.subtotal,
          linea.descripcion,
          precioCostoUnitario,
        ]
      )

      if (!linea.producto_id) continue

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

    if (venta.estado === 'completada' || venta.estado === 'adeuda' || venta.estado === 'cambio') {
      for (const d of detalles) {
        if (!d.producto_id) continue
        const cantidad = Number(d.cantidad)

        if (cantidad > 0) {
          await client.query(
            `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
             VALUES ($1, $2, $3)
             ON CONFLICT (producto_id, sucursal_id)
             DO UPDATE SET cantidad = stock_sucursal.cantidad + EXCLUDED.cantidad`,
            [d.producto_id, venta.sucursal_id, cantidad]
          )
          await restarAFuturosPedidos(client, d.producto_id, cantidad)
        } else if (cantidad < 0) {
          const qty = Math.abs(cantidad)
          const upd = await client.query(
            `UPDATE stock_sucursal
             SET cantidad = cantidad - $1
             WHERE producto_id = $2 AND sucursal_id = $3 AND cantidad >= $1
             RETURNING cantidad`,
            [qty, d.producto_id, venta.sucursal_id]
          )
          if (!upd.rows.length) {
            throw Object.assign(
              new Error(`No se puede revertir: stock insuficiente para producto ${d.producto_id}`),
              { status: 400 }
            )
          }
          await sumarAFuturosPedidos(client, d.producto_id, qty)
        }
      }
    }

    await client.query('DELETE FROM ventas WHERE id = $1', [venta.id])
    await client.query('COMMIT')
    res.json({ ok: true, message: 'Venta eliminada y stock restaurado' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Error al eliminar venta' })
  } finally {
    client.release()
  }
})

export default router
