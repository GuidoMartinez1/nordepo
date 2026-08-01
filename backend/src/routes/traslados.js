import express from 'express'
import pool from '../db.js'
import { getDepositoId } from '../utils/deposito.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  try {
    const params = []
    let where = ''
    if (sucursalId) {
      params.push(sucursalId)
      where = `WHERE t.sucursal_origen_id = $${params.length} OR t.sucursal_destino_id = $${params.length}`
    }
    const { rows } = await pool.query(
      `SELECT t.*,
              p.nombre AS producto_nombre,
              so.nombre AS origen_nombre,
              sd.nombre AS destino_nombre,
              u.username AS usuario_nombre
       FROM traslados t
       JOIN productos p ON p.id = t.producto_id
       JOIN sucursales so ON so.id = t.sucursal_origen_id
       JOIN sucursales sd ON sd.id = t.sucursal_destino_id
       LEFT JOIN users u ON u.id = t.usuario_id
       ${where}
       ORDER BY t.fecha DESC
       LIMIT 200`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar traslados' })
  }
})

/**
 * body: { producto_id, sucursal_destino_id, cantidad, notas?, sucursal_origen_id? }
 * Por defecto el origen es el Depósito.
 */
router.post('/', async (req, res) => {
  const {
    producto_id,
    sucursal_origen_id,
    sucursal_destino_id,
    cantidad,
    notas,
  } = req.body || {}

  const qty = Number(cantidad)
  if (!producto_id || !sucursal_destino_id || !(qty > 0)) {
    return res.status(400).json({ error: 'Datos de traslado incompletos' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const depositoId = await getDepositoId(client)
    const origenId = sucursal_origen_id ? Number(sucursal_origen_id) : depositoId
    const destinoId = Number(sucursal_destino_id)

    if (origenId === destinoId) {
      throw Object.assign(new Error('Origen y destino deben ser distintos'), { status: 400 })
    }

    const destino = await client.query(
      `SELECT id, es_deposito FROM sucursales WHERE id = $1 AND activa = TRUE`,
      [destinoId]
    )
    if (!destino.rows.length) {
      throw Object.assign(new Error('Sucursal destino no encontrada'), { status: 400 })
    }
    if (destino.rows[0].es_deposito) {
      throw Object.assign(new Error('El destino debe ser una sucursal de venta'), { status: 400 })
    }

    const debited = await client.query(
      `UPDATE stock_sucursal
       SET cantidad = cantidad - $1
       WHERE producto_id = $2 AND sucursal_id = $3 AND cantidad >= $1
       RETURNING cantidad`,
      [qty, producto_id, origenId]
    )
    if (!debited.rows.length) {
      throw Object.assign(new Error('Stock insuficiente en el depósito'), { status: 400 })
    }

    await client.query(
      `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
       VALUES ($1, $2, $3)
       ON CONFLICT (producto_id, sucursal_id)
       DO UPDATE SET cantidad = stock_sucursal.cantidad + EXCLUDED.cantidad`,
      [producto_id, destinoId, qty]
    )

    const { rows } = await client.query(
      `INSERT INTO traslados
         (producto_id, sucursal_origen_id, sucursal_destino_id, cantidad, usuario_id, notas)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [producto_id, origenId, destinoId, qty, req.user?.id || null, notas || null]
    )

    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Error al crear traslado' })
  } finally {
    client.release()
  }
})

export default router
