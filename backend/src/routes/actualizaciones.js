import express from 'express'
import pool from '../db.js'
import { requireRole } from '../middleware/requireAuth.js'

const router = express.Router()

router.use(requireRole('admin'))

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT h.id,
             h.producto_id,
             p.nombre AS producto_nombre,
             h.precio_costo_anterior AS costo_anterior,
             h.precio_costo_nuevo AS costo_nuevo,
             COALESCE(
               (SELECT AVG(ps.precio) FROM precio_sucursal ps
                JOIN sucursales s ON s.id = ps.sucursal_id
                WHERE ps.producto_id = p.id AND COALESCE(s.es_deposito, FALSE) = FALSE),
               p.precio
             ) AS precio_venta_actual,
             COALESCE(
               (SELECT AVG(ps.porcentaje_ganancia) FROM precio_sucursal ps
                JOIN sucursales s ON s.id = ps.sucursal_id
                WHERE ps.producto_id = p.id AND COALESCE(s.es_deposito, FALSE) = FALSE),
               p.porcentaje_ganancia
             ) AS porcentaje_ganancia,
             (
               SELECT COALESCE(json_agg(json_build_object(
                 'sucursal_id', s.id,
                 'sucursal_nombre', s.nombre,
                 'precio', COALESCE(ps.precio, p.precio),
                 'porcentaje_ganancia', COALESCE(ps.porcentaje_ganancia, p.porcentaje_ganancia, 30)
               ) ORDER BY s.nombre), '[]'::json)
               FROM sucursales s
               LEFT JOIN precio_sucursal ps
                 ON ps.sucursal_id = s.id AND ps.producto_id = p.id
               WHERE s.activa = TRUE AND COALESCE(s.es_deposito, FALSE) = FALSE
             ) AS precios_por_sucursal,
             c.fecha AS fecha_detectado,
             c.sucursal_id,
             s.nombre AS sucursal_nombre,
             pr.nombre AS proveedor_nombre
      FROM historial_costos h
      JOIN productos p ON h.producto_id = p.id
      JOIN compras c ON h.compra_id = c.id
      LEFT JOIN sucursales s ON s.id = c.sucursal_id
      LEFT JOIN proveedores pr ON c.proveedor_id = pr.id
      WHERE h.revisado = FALSE
        AND h.precio_costo_nuevo <> h.precio_costo_anterior
      ORDER BY c.fecha DESC
    `)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener actualizaciones' })
  }
})

/**
 * body: { precio, porcentaje_ganancia, sucursal_id? }
 * - sin sucursal_id → aplica a todas las sucursales de venta
 * - con sucursal_id → solo esa sucursal
 */
router.post('/:id/resolver', async (req, res) => {
  const { precio, porcentaje_ganancia, sucursal_id } = req.body || {}
  if (precio === undefined || porcentaje_ganancia === undefined) {
    return res.status(400).json({ error: 'precio y porcentaje_ganancia son obligatorios' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const historial = await client.query(
      'SELECT producto_id FROM historial_costos WHERE id = $1',
      [req.params.id]
    )
    if (!historial.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Alerta no encontrada' })
    }

    const prodId = historial.rows[0].producto_id
    const precioNum = Number(precio)
    const pctNum = Number(porcentaje_ganancia)
    const soloSucursal = sucursal_id != null && sucursal_id !== '' ? Number(sucursal_id) : null

    if (soloSucursal) {
      const dest = await client.query(
        `SELECT id FROM sucursales
         WHERE id = $1 AND activa = TRUE AND COALESCE(es_deposito, FALSE) = FALSE`,
        [soloSucursal]
      )
      if (!dest.rows.length) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Sucursal inválida' })
      }

      await client.query(
        `INSERT INTO precio_sucursal (producto_id, sucursal_id, precio, porcentaje_ganancia)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (producto_id, sucursal_id)
         DO UPDATE SET precio = EXCLUDED.precio,
                       porcentaje_ganancia = EXCLUDED.porcentaje_ganancia`,
        [prodId, soloSucursal, precioNum, pctNum]
      )
    } else {
      await client.query(
        `UPDATE productos
         SET precio = $1, porcentaje_ganancia = $2, updated_at = NOW()
         WHERE id = $3`,
        [precioNum, pctNum, prodId]
      )

      await client.query(
        `INSERT INTO precio_sucursal (producto_id, sucursal_id, precio, porcentaje_ganancia)
         SELECT $1, s.id, $2, $3
         FROM sucursales s
         WHERE s.activa = TRUE AND COALESCE(s.es_deposito, FALSE) = FALSE
         ON CONFLICT (producto_id, sucursal_id)
         DO UPDATE SET precio = EXCLUDED.precio,
                       porcentaje_ganancia = EXCLUDED.porcentaje_ganancia`,
        [prodId, precioNum, pctNum]
      )
    }

    await client.query('UPDATE historial_costos SET revisado = TRUE WHERE id = $1', [req.params.id])
    await client.query('COMMIT')
    res.json({
      message: soloSucursal
        ? 'Precio actualizado en la sucursal seleccionada'
        : 'Producto actualizado en todas las sucursales',
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Error al resolver la actualización' })
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE historial_costos SET revisado = TRUE WHERE id = $1', [req.params.id])
    res.json({ message: 'Alerta ignorada' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al archivar alerta' })
  }
})

export default router
