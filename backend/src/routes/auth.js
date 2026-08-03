import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '3650d'
}

function normalizeRole(role) {
  return role === 'vendedor' ? 'vendedor' : 'admin'
}

function mapUser(row) {
  const role = normalizeRole(row.role)
  return {
    id: row.id,
    username: row.username,
    role,
    sucursal_id: role === 'vendedor' ? row.sucursal_id ?? null : null,
    sucursal_nombre: role === 'vendedor' ? row.sucursal_nombre ?? null : null,
  }
}

router.post('/login', async (req, res) => {
  const username = (req.body?.username || '').trim()
  const password = req.body?.password || ''

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.role,
              COALESCE(u.activo, TRUE) AS activo,
              u.sucursal_id,
              s.nombre AS sucursal_nombre
       FROM users u
       LEFT JOIN sucursales s ON s.id = u.sucursal_id
       WHERE u.username = $1 AND COALESCE(u.activo, TRUE) = TRUE
       ORDER BY u.id DESC
       LIMIT 1`,
      [username]
    )
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }
    const user = result.rows[0]
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return res.status(500).json({ error: 'Error de configuración del servidor' })
    }

    const mapped = mapUser(user)
    if (mapped.role === 'vendedor' && !mapped.sucursal_id) {
      return res.status(403).json({
        error: 'Este vendedor no tiene sucursal asignada. Pedile al admin que lo dé de alta de nuevo.',
      })
    }

    const token = jwt.sign(
      {
        username: mapped.username,
        role: mapped.role,
        sucursal_id: mapped.sucursal_id,
      },
      secret,
      {
        subject: String(mapped.id),
        expiresIn: getJwtExpiresIn(),
      }
    )

    res.json({ token, user: mapped })
  } catch (err) {
    console.error('Error en login:', err)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.role, u.sucursal_id, s.nombre AS sucursal_nombre,
              COALESCE(u.activo, TRUE) AS activo
       FROM users u
       LEFT JOIN sucursales s ON s.id = u.sucursal_id
       WHERE u.id = $1`,
      [req.user.id]
    )
    if (!rows.length || !rows[0].activo) {
      return res.status(401).json({ error: 'Sesión inválida' })
    }
    const mapped = mapUser(rows[0])
    if (mapped.role === 'vendedor' && !mapped.sucursal_id) {
      return res.status(403).json({ error: 'Vendedor sin sucursal asignada' })
    }
    res.json(mapped)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener usuario' })
  }
})

router.post('/logout', requireAuth, (_req, res) => {
  res.json({ ok: true })
})

export default router
