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

async function ejecutarTraslado(client, {
  producto_id,
  origenId,
  destinoId,
  qty,
  usuarioId,
  notas,
}) {
  const debited = await client.query(
    `UPDATE stock_sucursal
     SET cantidad = cantidad - $1
     WHERE producto_id = $2 AND sucursal_id = $3 AND cantidad >= $1
     RETURNING cantidad`,
    [qty, producto_id, origenId]
  )
  if (!debited.rows.length) {
    throw Object.assign(
      new Error(`Stock insuficiente en origen (producto ${producto_id})`),
      { status: 400 }
    )
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
    [producto_id, origenId, destinoId, qty, usuarioId || null, notas || null]
  )
  return rows[0]
}

/**
 * body:
 *  - single: { producto_id, sucursal_origen_id, sucursal_destino_id, cantidad, notas? }
 *  - cart:   { sucursal_origen_id, sucursal_destino_id, items: [{ producto_id, cantidad }], notas? }
 * Origen/destino: depósito o cualquier sucursal (distintos).
 */
router.post('/', async (req, res) => {
  const {
    producto_id,
    sucursal_origen_id,
    sucursal_destino_id,
    cantidad,
    notas,
    items,
  } = req.body || {}

  if (!sucursal_origen_id || !sucursal_destino_id) {
    return res.status(400).json({ error: 'Origen y destino son obligatorios' })
  }

  const origenId = Number(sucursal_origen_id)
  const destinoId = Number(sucursal_destino_id)
  if (origenId === destinoId) {
    return res.status(400).json({ error: 'Origen y destino deben ser distintos' })
  }

  const lineas = Array.isArray(items) && items.length
    ? items.map((it) => ({
        producto_id: Number(it.producto_id),
        cantidad: Number(it.cantidad),
      }))
    : producto_id
      ? [{ producto_id: Number(producto_id), cantidad: Number(cantidad) }]
      : []

  if (!lineas.length) {
    return res.status(400).json({ error: 'Agregá al menos un producto' })
  }
  for (const l of lineas) {
    if (!l.producto_id || !(l.cantidad > 0)) {
      return res.status(400).json({ error: 'Ítem de traslado inválido' })
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const locs = await client.query(
      `SELECT id FROM sucursales WHERE id = ANY($1::int[]) AND activa = TRUE`,
      [[origenId, destinoId]]
    )
    if (locs.rows.length < 2) {
      throw Object.assign(new Error('Origen o destino inválido'), { status: 400 })
    }

    const creados = []
    for (const linea of lineas) {
      const row = await ejecutarTraslado(client, {
        producto_id: linea.producto_id,
        origenId,
        destinoId,
        qty: linea.cantidad,
        usuarioId: req.user?.id,
        notas,
      })
      creados.push(row)
    }

    await client.query('COMMIT')
    res.status(201).json(creados.length === 1 ? creados[0] : { ok: true, traslados: creados })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Error al crear traslado' })
  } finally {
    client.release()
  }
})

export default router
