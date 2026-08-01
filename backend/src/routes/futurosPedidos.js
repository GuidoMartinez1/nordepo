import express from 'express'
import pool from '../db.js'
import { requireRole } from '../middleware/requireAuth.js'

const router = express.Router()

router.use(requireRole('admin'))

const baseQuery = `
  SELECT
    fp.id,
    fp.producto,
    fp.cantidad,
    fp.creado_en,
    fp.producto_id,
    COALESCE(p.nombre, fp.producto) AS producto_nombre,
    p.precio_costo,
    COALESCE((
      SELECT SUM(ss.cantidad)::int FROM stock_sucursal ss WHERE ss.producto_id = p.id
    ), 0) AS stock_actual
  FROM futuros_pedidos fp
  LEFT JOIN productos p ON fp.producto_id = p.id
`

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`${baseQuery} ORDER BY fp.id DESC`)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error obteniendo futuros pedidos' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { producto, cantidad, producto_id } = req.body || {}
    let nombre = (producto || '').trim() || null
    let prodId = producto_id || null

    if (prodId) {
      const prod = await pool.query(`SELECT id, nombre FROM productos WHERE id = $1`, [prodId])
      if (!prod.rows.length) {
        return res.status(400).json({ error: 'Producto no encontrado' })
      }
      nombre = prod.rows[0].nombre
    }

    if (!nombre && !prodId) {
      return res.status(400).json({ error: 'Indicá un producto' })
    }

    const { rows } = await pool.query(
      `INSERT INTO futuros_pedidos (producto, cantidad, producto_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [nombre, cantidad != null ? String(cantidad) : null, prodId]
    )

    const nuevo = await pool.query(`${baseQuery} WHERE fp.id = $1`, [rows[0].id])
    res.status(201).json(nuevo.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error creando futuro pedido' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { producto, cantidad, producto_id } = req.body || {}
    const fields = []
    const values = []
    let i = 1

    if (producto !== undefined) {
      fields.push(`producto = $${i++}`)
      values.push(producto || null)
    }
    if (cantidad !== undefined) {
      fields.push(`cantidad = $${i++}`)
      values.push(cantidad != null ? String(cantidad) : null)
    }
    if (producto_id !== undefined) {
      fields.push(`producto_id = $${i++}`)
      values.push(producto_id || null)
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }

    values.push(req.params.id)
    const result = await pool.query(
      `UPDATE futuros_pedidos SET ${fields.join(', ')} WHERE id = $${i} RETURNING id`,
      values
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Pedido no encontrado' })

    const updated = await pool.query(`${baseQuery} WHERE fp.id = $1`, [req.params.id])
    res.json(updated.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error actualizando futuro pedido' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM futuros_pedidos WHERE id = $1 RETURNING id`,
      [req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error eliminando futuro pedido' })
  }
})

export default router
