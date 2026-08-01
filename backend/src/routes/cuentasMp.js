import express from 'express'
import pool from '../db.js'
import { requireRole } from '../middleware/requireAuth.js'

const router = express.Router()

/** Listar. ?sucursal_id=N. Por defecto solo activas; ?todas=1 incluye inactivas (admin). */
router.get('/', async (req, res) => {
  const sucursalId = req.query.sucursal_id ? Number(req.query.sucursal_id) : null
  const todas = req.query.todas === '1' || req.query.todas === 'true'
  const isAdmin = req.user?.role === 'admin'
  try {
    const params = []
    const where = []
    if (sucursalId) {
      params.push(sucursalId)
      where.push(`c.sucursal_id = $${params.length}`)
    }
    if (!(todas && isAdmin)) {
      where.push('c.activa = TRUE')
    }
    const { rows } = await pool.query(
      `SELECT c.id, c.sucursal_id, c.nombre, c.alias, c.activa, c.created_at,
              s.nombre AS sucursal_nombre
       FROM cuentas_mp c
       JOIN sucursales s ON s.id = c.sucursal_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY s.nombre, c.nombre`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar cuentas MP' })
  }
})

router.post('/', requireRole('admin'), async (req, res) => {
  const nombre = (req.body?.nombre || '').trim()
  const alias = (req.body?.alias || '').trim()
  const sucursalId = req.body?.sucursal_id ? Number(req.body.sucursal_id) : null
  const activa = req.body?.activa !== false
  if (!nombre || !alias || !sucursalId) {
    return res.status(400).json({ error: 'nombre, alias y sucursal_id son obligatorios' })
  }
  try {
    const suc = await pool.query(
      `SELECT id FROM sucursales
       WHERE id = $1 AND activa = TRUE AND COALESCE(es_deposito, FALSE) = FALSE`,
      [sucursalId]
    )
    if (!suc.rows.length) {
      return res.status(400).json({ error: 'Sucursal inválida' })
    }
    const { rows } = await pool.query(
      `INSERT INTO cuentas_mp (sucursal_id, nombre, alias, activa)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sucursalId, nombre, alias, activa]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe ese alias en la sucursal' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear cuenta MP' })
  }
})

router.put('/:id', requireRole('admin'), async (req, res) => {
  const nombre = (req.body?.nombre || '').trim()
  const alias = (req.body?.alias || '').trim()
  const sucursalId =
    req.body?.sucursal_id != null ? Number(req.body.sucursal_id) : null
  const activa = req.body?.activa
  try {
    const { rows } = await pool.query(
      `UPDATE cuentas_mp
       SET nombre = COALESCE(NULLIF($1, ''), nombre),
           alias = COALESCE(NULLIF($2, ''), alias),
           sucursal_id = COALESCE($3, sucursal_id),
           activa = COALESCE($4, activa)
       WHERE id = $5
       RETURNING *`,
      [nombre, alias, sucursalId, activa, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Cuenta no encontrada' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe ese alias en la sucursal' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar cuenta MP' })
  }
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    // Soft-delete: desactivar para no romper historial de ventas
    const { rows } = await pool.query(
      `UPDATE cuentas_mp SET activa = FALSE WHERE id = $1 RETURNING id`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Cuenta no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al desactivar cuenta MP' })
  }
})

export default router
