import express from 'express'
import pool from '../db.js'

const router = express.Router()

/** ?venta=1 → solo sucursales de venta (sin depósito) */
router.get('/', async (req, res) => {
  try {
    const soloVenta = req.query.venta === '1' || req.query.venta === 'true'
    const { rows } = await pool.query(
      `SELECT id, nombre, codigo, activa, es_deposito, created_at
       FROM sucursales
       ${soloVenta ? 'WHERE COALESCE(es_deposito, FALSE) = FALSE' : ''}
       ORDER BY es_deposito DESC, nombre`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar sucursales' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, codigo, activa, es_deposito, created_at FROM sucursales WHERE id = $1',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Sucursal no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener sucursal' })
  }
})

router.post('/', async (req, res) => {
  const nombre = (req.body?.nombre || '').trim()
  const codigo = (req.body?.codigo || '').trim().toUpperCase()
  if (!nombre || !codigo) {
    return res.status(400).json({ error: 'nombre y codigo son obligatorios' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO sucursales (nombre, codigo, activa, es_deposito)
       VALUES ($1, $2, COALESCE($3, TRUE), FALSE)
       RETURNING id, nombre, codigo, activa, es_deposito, created_at`,
      [nombre, codigo, req.body?.activa]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una sucursal con ese código' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear sucursal' })
  }
})

router.put('/:id', async (req, res) => {
  const nombre = (req.body?.nombre || '').trim()
  const codigo = (req.body?.codigo || '').trim().toUpperCase()
  const activa = req.body?.activa
  try {
    const { rows } = await pool.query(
      `UPDATE sucursales
       SET nombre = COALESCE(NULLIF($1, ''), nombre),
           codigo = COALESCE(NULLIF($2, ''), codigo),
           activa = COALESCE($3, activa)
       WHERE id = $4 AND COALESCE(es_deposito, FALSE) = FALSE
       RETURNING id, nombre, codigo, activa, es_deposito, created_at`,
      [nombre, codigo, activa, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Sucursal no encontrada' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una sucursal con ese código' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar sucursal' })
  }
})

export default router
