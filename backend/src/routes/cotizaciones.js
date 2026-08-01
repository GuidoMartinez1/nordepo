import express from 'express'
import pool from '../db.js'

const router = express.Router()

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM cotizaciones ORDER BY fecha DESC'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar cotizaciones' })
  }
})

router.get('/fecha/:fecha', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT valor FROM cotizaciones WHERE fecha = $1',
      [req.params.fecha]
    )
    if (!rows.length) return res.json({ valor: 1 })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener cotización' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { fecha, valor } = req.body
    if (!fecha || valor == null || Number(valor) <= 0) {
      return res.status(400).json({ error: 'Fecha y valor válidos son obligatorios' })
    }
    const { rows } = await pool.query(
      `INSERT INTO cotizaciones (fecha, valor)
       VALUES ($1, $2)
       ON CONFLICT (fecha) DO UPDATE SET valor = EXCLUDED.valor
       RETURNING *`,
      [fecha, valor]
    )
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al guardar cotización' })
  }
})

export default router
