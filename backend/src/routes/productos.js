import express from 'express'
import pool from '../db.js'
import { requireRole } from '../middleware/requireAuth.js'
import { getDepositoId } from '../utils/deposito.js'

const router = express.Router()

/** Lista productos. ?sucursal_id=N → stock y precio de esa sucursal. Sin filtro = vista consolidada. */
router.get('/', async (req, res) => {
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  try {
    if (sucursalId) {
      const { rows } = await pool.query(
        `SELECT p.id, p.nombre, p.descripcion, p.precio_costo, p.categoria_id, p.codigo,
                p.created_at, p.updated_at,
                c.nombre AS categoria_nombre,
                COALESCE(ps.precio, p.precio) AS precio,
                COALESCE(ps.porcentaje_ganancia, p.porcentaje_ganancia, 30) AS porcentaje_ganancia,
                COALESCE(ss.cantidad, 0)::int AS stock,
                COALESCE((
                  SELECT SUM(s2.cantidad)::int FROM stock_sucursal s2 WHERE s2.producto_id = p.id
                ), 0) AS stock_total
         FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN stock_sucursal ss
           ON ss.producto_id = p.id AND ss.sucursal_id = $1
         LEFT JOIN precio_sucursal ps
           ON ps.producto_id = p.id AND ps.sucursal_id = $1
         ORDER BY p.nombre`,
        [sucursalId]
      )
      return res.json(rows)
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.precio_costo, p.categoria_id, p.codigo,
              p.precio, p.porcentaje_ganancia, p.created_at, p.updated_at,
              c.nombre AS categoria_nombre,
              COALESCE((
                SELECT SUM(ss.cantidad)::int FROM stock_sucursal ss WHERE ss.producto_id = p.id
              ), 0) AS stock_total,
              COALESCE((
                SELECT SUM(ss.cantidad)::int FROM stock_sucursal ss WHERE ss.producto_id = p.id
              ), 0) AS stock
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

    const porSucursal = await pool.query(
      `SELECT s.id AS sucursal_id, s.nombre AS sucursal_nombre, s.es_deposito,
              COALESCE(ss.cantidad, 0)::int AS cantidad,
              COALESCE(ps.precio, p.precio, 0)::float AS precio,
              COALESCE(ps.porcentaje_ganancia, p.porcentaje_ganancia, 30)::float AS porcentaje_ganancia
       FROM sucursales s
       CROSS JOIN productos p
       LEFT JOIN stock_sucursal ss
         ON ss.sucursal_id = s.id AND ss.producto_id = p.id
       LEFT JOIN precio_sucursal ps
         ON ps.sucursal_id = s.id AND ps.producto_id = p.id
       WHERE s.activa = TRUE AND p.id = $1
       ORDER BY s.es_deposito DESC, s.nombre`,
      [req.params.id]
    )

    res.json({
      ...rows[0],
      stock_por_sucursal: porSucursal.rows.map((r) => ({
        sucursal_id: r.sucursal_id,
        sucursal_nombre: r.sucursal_nombre,
        es_deposito: r.es_deposito,
        cantidad: r.cantidad,
      })),
      // Precios solo en sucursales de venta
      precios_por_sucursal: porSucursal.rows
        .filter((r) => !r.es_deposito)
        .map((r) => ({
          sucursal_id: r.sucursal_id,
          sucursal_nombre: r.sucursal_nombre,
          precio: r.precio,
          porcentaje_ganancia: r.porcentaje_ganancia,
        })),
    })  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener producto' })
  }
})

async function upsertPreciosSucursal(client, productoId, precios, fallbackPrecio, fallbackPct) {
  if (Array.isArray(precios) && precios.length) {
    for (const row of precios) {
      if (!row?.sucursal_id) continue
      const esDep = await client.query(
        `SELECT es_deposito FROM sucursales WHERE id = $1`,
        [row.sucursal_id]
      )
      if (esDep.rows[0]?.es_deposito) continue
      await client.query(
        `INSERT INTO precio_sucursal (producto_id, sucursal_id, precio, porcentaje_ganancia)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (producto_id, sucursal_id)
         DO UPDATE SET precio = EXCLUDED.precio,
                       porcentaje_ganancia = EXCLUDED.porcentaje_ganancia`,
        [
          productoId,
          row.sucursal_id,
          Number(row.precio) || 0,
          row.porcentaje_ganancia !== undefined
            ? Number(row.porcentaje_ganancia)
            : Number(fallbackPct) || 30,
        ]
      )
    }
    return
  }

  // Precio base solo en sucursales de venta (no depósito)
  await client.query(
    `INSERT INTO precio_sucursal (producto_id, sucursal_id, precio, porcentaje_ganancia)
     SELECT $1, s.id, $2, $3
     FROM sucursales s
     WHERE s.activa = TRUE AND COALESCE(s.es_deposito, FALSE) = FALSE
     ON CONFLICT (producto_id, sucursal_id)
     DO UPDATE SET precio = EXCLUDED.precio,
                   porcentaje_ganancia = EXCLUDED.porcentaje_ganancia`,
    [productoId, Number(fallbackPrecio) || 0, Number(fallbackPct) || 30]
  )
}

router.post('/', requireRole('admin'), async (req, res) => {
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
    stock_por_sucursal,
    precios_por_sucursal,
  } = req.body || {}

  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es obligatorio' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pct = porcentaje_ganancia !== undefined && porcentaje_ganancia !== null
      ? Number(porcentaje_ganancia)
      : 30
    const precioNum = Number(precio) || 0

    const { rows } = await client.query(
      `INSERT INTO productos
         (nombre, descripcion, precio, precio_costo, porcentaje_ganancia, categoria_id, codigo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        nombre.trim(),
        descripcion || null,
        precioNum,
        Number(precio_costo) || 0,
        pct,
        categoria_id || null,
        codigo?.trim() || null,
      ]
    )
    const producto = rows[0]

    if (Array.isArray(stock_por_sucursal)) {
      for (const row of stock_por_sucursal) {
        if (!row?.sucursal_id) continue
        await client.query(
          `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (producto_id, sucursal_id)
           DO UPDATE SET cantidad = EXCLUDED.cantidad`,
          [producto.id, row.sucursal_id, Math.max(0, Number(row.cantidad) || 0)]
        )
      }
    } else {
      // Stock inicial siempre al depósito (salvo que manden desglose por sucursal)
      const depositoId = await getDepositoId(client)
      const qty = Math.max(0, Number(stock_inicial) || 0)
      if (qty > 0) {
        await client.query(
          `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (producto_id, sucursal_id)
           DO UPDATE SET cantidad = EXCLUDED.cantidad`,
          [producto.id, depositoId, qty]
        )
      }
    }

    await upsertPreciosSucursal(client, producto.id, precios_por_sucursal, precioNum, pct)

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

router.put('/:id', requireRole('admin'), async (req, res) => {
  const {
    nombre,
    descripcion,
    precio,
    precio_costo,
    porcentaje_ganancia,
    categoria_id,
    codigo,
    stock,
    sucursal_id,
    stock_por_sucursal,
    precios_por_sucursal,
  } = req.body || {}

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query('SELECT * FROM productos WHERE id = $1', [req.params.id])
    if (!existing.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    const cur = existing.rows[0]

    const precioFinal = precio !== undefined ? Number(precio) : Number(cur.precio)
    const pctFinal =
      porcentaje_ganancia !== undefined
        ? Number(porcentaje_ganancia)
        : Number(cur.porcentaje_ganancia)

    const { rows } = await client.query(
      `UPDATE productos SET
         nombre = $1,
         descripcion = $2,
         precio = $3,
         precio_costo = $4,
         porcentaje_ganancia = $5,
         categoria_id = $6,
         codigo = $7,
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        nombre !== undefined ? String(nombre).trim() : cur.nombre,
        descripcion !== undefined ? descripcion : cur.descripcion,
        precioFinal,
        precio_costo !== undefined ? Number(precio_costo) : Number(cur.precio_costo),
        pctFinal,
        categoria_id !== undefined ? categoria_id || null : cur.categoria_id,
        codigo !== undefined ? codigo?.trim() || null : cur.codigo,
        req.params.id,
      ]
    )

    if (sucursal_id != null && stock !== undefined) {
      await client.query(
        `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
         VALUES ($1, $2, $3)
         ON CONFLICT (producto_id, sucursal_id)
         DO UPDATE SET cantidad = EXCLUDED.cantidad`,
        [req.params.id, sucursal_id, Math.max(0, Number(stock) || 0)]
      )
    }

    if (Array.isArray(stock_por_sucursal)) {
      for (const row of stock_por_sucursal) {
        if (!row?.sucursal_id) continue
        await client.query(
          `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (producto_id, sucursal_id)
           DO UPDATE SET cantidad = EXCLUDED.cantidad`,
          [req.params.id, row.sucursal_id, Math.max(0, Number(row.cantidad) || 0)]
        )
      }
    }

    if (Array.isArray(precios_por_sucursal)) {
      await upsertPreciosSucursal(
        client,
        req.params.id,
        precios_por_sucursal,
        precioFinal,
        pctFinal
      )
    } else if (sucursal_id != null && (precio !== undefined || porcentaje_ganancia !== undefined)) {
      const dest = await client.query(
        `SELECT es_deposito FROM sucursales WHERE id = $1`,
        [sucursal_id]
      )
      if (!dest.rows[0]?.es_deposito) {
        await client.query(
          `INSERT INTO precio_sucursal (producto_id, sucursal_id, precio, porcentaje_ganancia)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (producto_id, sucursal_id)
           DO UPDATE SET precio = EXCLUDED.precio,
                         porcentaje_ganancia = EXCLUDED.porcentaje_ganancia`,
          [req.params.id, sucursal_id, precioFinal, pctFinal]
        )
      }
    }

    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese código' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar producto' })
  } finally {
    client.release()
  }
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
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
