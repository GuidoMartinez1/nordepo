import express from 'express'
import pool from '../db.js'

const router = express.Router()

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proveedores ORDER BY nombre')
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar proveedores' })
  }
})

router.post('/', async (req, res) => {
  const nombre = (req.body?.nombre || '').trim()
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO proveedores (nombre, email, telefono, direccion)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, req.body?.email || null, req.body?.telefono || null, req.body?.direccion || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al crear proveedor' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE proveedores SET
         nombre = COALESCE(NULLIF($1, ''), nombre),
         email = COALESCE($2, email),
         telefono = COALESCE($3, telefono),
         direccion = COALESCE($4, direccion)
       WHERE id = $5 RETURNING *`,
      [
        (req.body?.nombre || '').trim(),
        req.body?.email,
        req.body?.telefono,
        req.body?.direccion,
        req.params.id,
      ]
    )
    if (!rows.length) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar proveedor' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM proveedores WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar proveedor' })
  }
})

export default router
