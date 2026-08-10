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

/** Usuario logueado cambia su propia contraseña (solo admin) */
router.post('/change-password', requireAuth, async (req, res) => {
  if (req.user?.role === 'vendedor') {
    return res.status(403).json({
      error: 'Los vendedores no pueden cambiar la contraseña. Pedile al administrador.',
    })
  }

  const currentPassword = req.body?.current_password || ''
  const newPassword = req.body?.new_password || ''

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Completá la contraseña actual y la nueva' })
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, password_hash FROM users WHERE id = $1 AND COALESCE(activo, TRUE) = TRUE`,
      [req.user.id]
    )
    if (!rows.length) {
      return res.status(401).json({ error: 'Sesión inválida' })
    }

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash)
    if (!ok) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user.id])
    res.json({ ok: true, message: 'Contraseña actualizada' })
  } catch (err) {
    console.error('Error al cambiar contraseña:', err)
    res.status(500).json({ error: 'Error al cambiar la contraseña' })
  }
})

/**
 * Recuperación sin email: usuario + código maestro (PASSWORD_RESET_CODE en env) + nueva clave.
 * Solo para cuentas admin (los vendedores se resetean desde Usuarios).
 */
router.post('/reset-with-code', async (req, res) => {
  const username = (req.body?.username || '').trim()
  const resetCode = req.body?.reset_code || ''
  const newPassword = req.body?.new_password || ''
  const configuredCode = process.env.PASSWORD_RESET_CODE || ''

  if (!configuredCode) {
    return res.status(503).json({
      error: 'La recuperación por código no está configurada. Pedile al administrador una nueva clave.',
    })
  }
  if (!username || !resetCode || !newPassword) {
    return res.status(400).json({ error: 'Completá usuario, código de recuperación y nueva contraseña' })
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' })
  }
  if (resetCode !== configuredCode) {
    return res.status(401).json({ error: 'Código de recuperación incorrecto' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, role FROM users WHERE username = $1 AND COALESCE(activo, TRUE) = TRUE
       ORDER BY id DESC LIMIT 1`,
      [username]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo' })
    }
    if (rows[0].role === 'vendedor') {
      return res.status(403).json({
        error: 'Los vendedores no pueden restablecer la clave. Pedile al administrador.',
      })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, rows[0].id])
    res.json({ ok: true, message: 'Contraseña restablecida. Ya podés ingresar.' })
  } catch (err) {
    console.error('Error al restablecer contraseña:', err)
    res.status(500).json({ error: 'Error al restablecer la contraseña' })
  }
})

export default router
