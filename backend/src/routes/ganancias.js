import express from 'express'
import pool from '../db.js'

const router = express.Router()

/** Resumen diario. ?desde=&hasta=&sucursal_id= */
router.get('/', async (req, res) => {
  const desde = req.query.desde || '2000-01-01'
  const hasta = req.query.hasta || '2099-12-31'
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null

  try {
    const params = [desde, hasta]
    let ventaSucursal = ''
    if (sucursalId) {
      params.push(sucursalId)
      ventaSucursal = `AND v.sucursal_id = $${params.length}`
    }

    const diarios = await pool.query(
      `SELECT
         to_char(v.fecha::date, 'YYYY-MM-DD') AS fecha,
         COUNT(DISTINCT v.id)::int AS cantidad_ventas,
         COALESCE(SUM(dv.cantidad), 0)::int AS unidades,
         COALESCE(SUM(dv.subtotal), 0)::numeric AS total_venta,
         COALESCE(SUM(dv.precio_costo_unitario * dv.cantidad), 0)::numeric AS total_costo,
         COALESCE(SUM((dv.precio_unitario - dv.precio_costo_unitario) * dv.cantidad), 0)::numeric AS ganancia_neta
       FROM detalles_venta dv
       JOIN ventas v ON v.id = dv.venta_id
       WHERE dv.producto_id IS NOT NULL
         AND dv.precio_costo_unitario IS NOT NULL
         AND v.fecha::date >= $1::date
         AND v.fecha::date <= $2::date
         ${ventaSucursal}
       GROUP BY v.fecha::date
       ORDER BY fecha DESC`,
      params
    )

    const totales = await pool.query(
      `SELECT
         COALESCE(SUM(dv.cantidad), 0)::int AS unidades,
         COALESCE(SUM(dv.subtotal), 0)::numeric AS total_venta,
         COALESCE(SUM(dv.precio_costo_unitario * dv.cantidad), 0)::numeric AS total_costo,
         COALESCE(SUM((dv.precio_unitario - dv.precio_costo_unitario) * dv.cantidad), 0)::numeric AS ganancia_neta
       FROM detalles_venta dv
       JOIN ventas v ON v.id = dv.venta_id
       WHERE dv.producto_id IS NOT NULL
         AND dv.precio_costo_unitario IS NOT NULL
         AND v.fecha::date >= $1::date
         AND v.fecha::date <= $2::date
         ${ventaSucursal}`,
      params
    )

    res.json({
      diarios: diarios.rows,
      totales: totales.rows[0],
    })
  } catch (err) {
    console.error('Error al obtener ganancias:', err)
    res.status(500).json({ error: 'Error al obtener ganancias' })
  }
})

/** Detalle por producto. ?desde=&hasta=&sucursal_id= */
router.get('/detalle', async (req, res) => {
  const desde = req.query.desde || '2000-01-01'
  const hasta = req.query.hasta || '2099-12-31'
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null

  try {
    const params = [desde, hasta]
    let ventaSucursal = ''
    if (sucursalId) {
      params.push(sucursalId)
      ventaSucursal = `AND v.sucursal_id = $${params.length}`
    }

    const { rows } = await pool.query(
      `SELECT
         p.id AS producto_id,
         p.nombre AS producto_nombre,
         COALESCE(SUM(dv.cantidad), 0)::int AS unidades,
         COALESCE(SUM(dv.subtotal), 0)::numeric AS total_venta,
         COALESCE(SUM(dv.precio_costo_unitario * dv.cantidad), 0)::numeric AS total_costo,
         COALESCE(SUM((dv.precio_unitario - dv.precio_costo_unitario) * dv.cantidad), 0)::numeric AS ganancia_neta
       FROM detalles_venta dv
       JOIN ventas v ON v.id = dv.venta_id
       JOIN productos p ON p.id = dv.producto_id
       WHERE dv.producto_id IS NOT NULL
         AND dv.precio_costo_unitario IS NOT NULL
         AND v.fecha::date >= $1::date
         AND v.fecha::date <= $2::date
         ${ventaSucursal}
       GROUP BY p.id, p.nombre
       ORDER BY ganancia_neta DESC`,
      params
    )

    res.json(rows)
  } catch (err) {
    console.error('Error al obtener detalle de ganancias:', err)
    res.status(500).json({ error: 'Error al obtener detalle de ganancias' })
  }
})

export default router
