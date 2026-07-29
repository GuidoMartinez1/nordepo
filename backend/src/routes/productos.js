import express from 'express'
import pool from '../db.js'

const router = express.Router()

/** Lista productos. ?sucursal_id=N agrega stock de esa sucursal. */
router.get('/', async (req, res) => {
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  try {
    if (sucursalId) {
      const { rows } = await pool.query(
        `SELECT p.*, c.nombre AS categoria_nombre,
                COALESCE(ss.cantidad, 0)::int AS stock
         FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN stock_sucursal ss
           ON ss.producto_id = p.id AND ss.sucursal_id = $1
         ORDER BY p.nombre`,
        [sucursalId]
      )
      return res.json(rows)
    }

    const { rows } = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre,
              COALESCE((
                SELECT SUM(ss.cantidad)::int FROM stock_sucursal ss WHERE ss.producto_id = p.id
              ), 0) AS stock_total
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       ORDER BY p.nombre`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar productos' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.id = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' })

    const stock = await pool.query(
      `SELECT ss.sucursal_id, s.nombre AS sucursal_nombre, ss.cantidad
       FROM stock_sucursal ss
       JOIN sucursales s ON s.id = ss.sucursal_id
       WHERE ss.producto_id = $1
       ORDER BY s.nombre`,
      [req.params.id]
    )

    res.json({ ...rows[0], stock_por_sucursal: stock.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener producto' })
  }
})

router.post('/', async (req, res) => {
  const {
    nombre,
    descripcion,
    precio,
    precio_costo,
    porcentaje_ganancia,
    categoria_id,
    codigo,
    stock_inicial,
    sucursal_id,
  } = req.body || {}

  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es obligatorio' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO productos
         (nombre, descripcion, precio, precio_costo, porcentaje_ganancia, categoria_id, codigo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        nombre.trim(),
        descripcion || null,
        Number(precio) || 0,
        Number(precio_costo) || 0,
        porcentaje_ganancia ?? 30,
        categoria_id || null,
        codigo?.trim() || null,
      ]
    )
    const producto = rows[0]

    if (sucursal_id && Number(stock_inicial) > 0) {
      await client.query(
        `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
         VALUES ($1, $2, $3)
         ON CONFLICT (producto_id, sucursal_id)
         DO UPDATE SET cantidad = stock_sucursal.cantidad + EXCLUDED.cantidad`,
        [producto.id, sucursal_id, Number(stock_inicial)]
      )
    }

    await client.query('COMMIT')
    res.status(201).json(producto)
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese código' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear producto' })
  } finally {
    client.release()
  }
})

router.put('/:id', async (req, res) => {
  const {
    nombre,
    descripcion,
    precio,
    precio_costo,
    porcentaje_ganancia,
    categoria_id,
    codigo,
  } = req.body || {}

  try {
    const { rows } = await pool.query(
      `UPDATE productos SET
         nombre = COALESCE(NULLIF($1, ''), nombre),
         descripcion = COALESCE($2, descripcion),
         precio = COALESCE($3, precio),
         precio_costo = COALESCE($4, precio_costo),
         porcentaje_ganancia = COALESCE($5, porcentaje_ganancia),
         categoria_id = COALESCE($6, categoria_id),
         codigo = COALESCE($7, codigo),
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        nombre?.trim() || '',
        descripcion,
        precio !== undefined ? Number(precio) : null,
        precio_costo !== undefined ? Number(precio_costo) : null,
        porcentaje_ganancia !== undefined ? Number(porcentaje_ganancia) : null,
        categoria_id,
        codigo?.trim() ?? null,
        req.params.id,
      ]
    )
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese código' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar producto' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar producto' })
  }
})

export default router
