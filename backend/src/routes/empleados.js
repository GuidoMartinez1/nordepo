import express from 'express'
import bcrypt from 'bcrypt'
import pool from '../db.js'
import { requireRole } from '../middleware/requireAuth.js'

const router = express.Router()

router.use(requireRole('admin'))

const selectEmpleado = `
  SELECT u.id, u.username, u.role, u.activo, u.sucursal_id, u.created_at,
         s.nombre AS sucursal_nombre
  FROM users u
  LEFT JOIN sucursales s ON s.id = u.sucursal_id
`

async function validarSucursalVenta(sucursalId) {
  const { rows } = await pool.query(
    `SELECT id FROM sucursales
     WHERE id = $1 AND activa = TRUE AND COALESCE(es_deposito, FALSE) = FALSE`,
    [sucursalId]
  )
  return rows.length > 0
}

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`${selectEmpleado} ORDER BY u.username, u.id DESC`)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar empleados' })
  }
})

router.post('/', async (req, res) => {
  const username = (req.body?.username || '').trim()
  const password = req.body?.password || ''
  const role = req.body?.role === 'vendedor' ? 'vendedor' : 'admin'
  const activo = req.body?.activo !== false
  const sucursalId =
    req.body?.sucursal_id != null && req.body.sucursal_id !== ''
      ? Number(req.body.sucursal_id)
      : null

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' })
  }
  if (role === 'vendedor') {
    if (!sucursalId) {
      return res.status(400).json({ error: 'El vendedor debe tener una sucursal asignada' })
    }
    if (!(await validarSucursalVenta(sucursalId))) {
      return res.status(400).json({ error: 'Sucursal inválida' })
    }
  }

  try {
    const hash = await bcrypt.hash(password, 12)
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, role, activo, sucursal_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [username, hash, role, activo, role === 'vendedor' ? sucursalId : null]
    )
    const { rows: full } = await pool.query(`${selectEmpleado} WHERE u.id = $1`, [rows[0].id])
    res.status(201).json(full[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario activo con ese nombre' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al crear empleado' })
  }
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const username = (req.body?.username || '').trim()
  const password = req.body?.password || ''
  const role =
    req.body?.role === 'vendedor' ? 'vendedor' : req.body?.role === 'admin' ? 'admin' : null
  const activo = req.body?.activo
  const hasSucursal = Object.prototype.hasOwnProperty.call(req.body || {}, 'sucursal_id')
  const sucursalId =
    hasSucursal && req.body.sucursal_id != null && req.body.sucursal_id !== ''
      ? Number(req.body.sucursal_id)
      : hasSucursal
        ? null
        : undefined

  try {
    if (password && password.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' })
    }

    const current = await pool.query(`SELECT role, sucursal_id FROM users WHERE id = $1`, [id])
    if (!current.rows.length) return res.status(404).json({ error: 'Empleado no encontrado' })

    const nextRole = role || current.rows[0].role
    let nextSucursal =
      sucursalId === undefined ? current.rows[0].sucursal_id : sucursalId

    if (nextRole === 'vendedor') {
      if (!nextSucursal) {
        return res.status(400).json({ error: 'El vendedor debe tener una sucursal asignada' })
      }
      if (!(await validarSucursalVenta(nextSucursal))) {
        return res.status(400).json({ error: 'Sucursal inválida' })
      }
    } else {
      nextSucursal = null
    }

    const hash = password ? await bcrypt.hash(password, 12) : null
    const { rows } = await pool.query(
      `UPDATE users
       SET username = COALESCE(NULLIF($1, ''), username),
           role = $2,
           activo = COALESCE($3, activo),
           password_hash = COALESCE($4, password_hash),
           sucursal_id = $5
       WHERE id = $6
       RETURNING id`,
      [username, nextRole, activo, hash, nextSucursal, id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Empleado no encontrado' })
    const { rows: full } = await pool.query(`${selectEmpleado} WHERE u.id = $1`, [id])
    res.json(full[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario activo con ese nombre' })
    }
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar empleado' })
  }
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'No podés desactivar tu propio usuario' })
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET activo = FALSE WHERE id = $1 RETURNING id`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Empleado no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al desactivar empleado' })
  }
})

export default router
