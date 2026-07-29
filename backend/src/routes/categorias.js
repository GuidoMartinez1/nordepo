import express from 'express'
import pool from '../db.js'

const router = express.Router()

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, descripcion, created_at FROM categorias ORDER BY nombre'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar categorías' })
  }
})

router.post('/', async (req, res) => {
  const nombre = (req.body?.nombre || '').trim()
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nombre, descripcion)
       VALUES ($1, $2)
       RETURNING id, nombre, descripcion, created_at`,
      [nombre, req.body?.descripcion || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe esa categoría' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear categoría' })
  }
})

router.put('/:id', async (req, res) => {
  const nombre = (req.body?.nombre || '').trim()
  try {
    const { rows } = await pool.query(
      `UPDATE categorias
       SET nombre = COALESCE(NULLIF($1, ''), nombre),
           descripcion = COALESCE($2, descripcion)
       WHERE id = $3
       RETURNING id, nombre, descripcion, created_at`,
      [nombre, req.body?.descripcion, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Categoría no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar categoría' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM categorias WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Categoría no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar categoría' })
  }
})

export default router
