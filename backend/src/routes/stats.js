import express from 'express'
import pool from '../db.js'

const router = express.Router()

/** Resumen dashboard. ?sucursal_id=N filtra por sucursal. */
router.get('/dashboard', async (req, res) => {
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  try {
    const params = []
    let ventaFilter = ''
    if (sucursalId) {
      params.push(sucursalId)
      ventaFilter = `AND v.sucursal_id = $${params.length}`
    }

    const ventasHoy = await pool.query(
      `SELECT COALESCE(SUM(total), 0)::float AS total,
              COUNT(*)::int AS cantidad
       FROM ventas v
       WHERE v.fecha::date = CURRENT_DATE
         AND v.estado IN ('completada', 'adeuda')
         ${ventaFilter}`,
      params
    )

    const productos = await pool.query(`SELECT COUNT(*)::int AS c FROM productos`)
    const clientes = await pool.query(`SELECT COUNT(*)::int AS c FROM clientes`)

    let bajoStock
    if (sucursalId) {
      bajoStock = await pool.query(
        `SELECT p.id, p.nombre, ss.cantidad AS stock
         FROM stock_sucursal ss
         JOIN productos p ON p.id = ss.producto_id
         WHERE ss.sucursal_id = $1 AND ss.cantidad <= 5
         ORDER BY ss.cantidad ASC
         LIMIT 10`,
        [sucursalId]
      )
    } else {
      bajoStock = await pool.query(
        `SELECT p.id, p.nombre, s.nombre AS sucursal_nombre, ss.cantidad AS stock
         FROM stock_sucursal ss
         JOIN productos p ON p.id = ss.producto_id
         JOIN sucursales s ON s.id = ss.sucursal_id
         WHERE ss.cantidad <= 5
         ORDER BY ss.cantidad ASC, p.nombre
         LIMIT 20`
      )
    }

    res.json({
      ventas_hoy: ventasHoy.rows[0],
      total_productos: productos.rows[0].c,
      total_clientes: clientes.rows[0].c,
      bajo_stock: bajoStock.rows,
      sucursal_id: sucursalId,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener estadísticas' })
  }
})

export default router
