import express from 'express'
import pool from '../db.js'

const router = express.Router()

/** Agregado diario ventas vs compras. ?desde=&hasta=&sucursal_id= */
router.get('/diarios', async (req, res) => {
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
      `WITH ventas_dia AS (
         SELECT v.fecha::date AS fecha,
                COALESCE(SUM(v.total), 0)::float AS total_ventas,
                COUNT(*)::int AS cantidad_ventas
         FROM ventas v
         WHERE v.fecha::date BETWEEN $1::date AND $2::date
           ${ventaSucursal}
         GROUP BY v.fecha::date
       ),
       compras_dia AS (
         SELECT c.fecha::date AS fecha,
                COALESCE(SUM(c.total), 0)::float AS total_compras,
                COUNT(*)::int AS cantidad_compras
         FROM compras c
         WHERE c.fecha::date BETWEEN $1::date AND $2::date
         GROUP BY c.fecha::date
       ),
       dias AS (
         SELECT fecha FROM ventas_dia
         UNION
         SELECT fecha FROM compras_dia
       )
       SELECT
         d.fecha,
         COALESCE(vd.total_ventas, 0)::float AS total_ventas,
         COALESCE(cd.total_compras, 0)::float AS total_compras,
         COALESCE(vd.cantidad_ventas, 0)::int AS cantidad_ventas,
         COALESCE(cd.cantidad_compras, 0)::int AS cantidad_compras,
         (COALESCE(vd.total_ventas, 0) - COALESCE(cd.total_compras, 0))::float AS utilidad_neta
       FROM dias d
       LEFT JOIN ventas_dia vd ON vd.fecha = d.fecha
       LEFT JOIN compras_dia cd ON cd.fecha = d.fecha
       ORDER BY d.fecha DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error('Error obteniendo reportes diarios:', err)
    res.status(500).json({ error: 'Error al obtener reportes' })
  }
})

/** Ranking de productos vendidos. ?desde=&hasta=&sucursal_id= */
router.get('/productos-vendidos', async (req, res) => {
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
          p.nombre,
          cat.nombre AS categoria,
          SUM(dv.cantidad)::float AS cantidad_total
       FROM detalles_venta dv
       JOIN ventas v ON v.id = dv.venta_id
       JOIN productos p ON p.id = dv.producto_id
       LEFT JOIN categorias cat ON cat.id = p.categoria_id
       WHERE v.fecha::date >= $1::date
         AND v.fecha::date <= $2::date
         ${ventaSucursal}
       GROUP BY p.id, p.nombre, cat.nombre
       ORDER BY cantidad_total DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error en el ranking' })
  }
})

export default router
