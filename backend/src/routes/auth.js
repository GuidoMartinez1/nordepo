import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '3650d'
}

router.post('/login', async (req, res) => {
  const username = (req.body?.username || '').trim()
  const password = req.body?.password || ''

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
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

    const token = jwt.sign({ username: user.username }, secret, {
      subject: String(user.id),
      expiresIn: getJwtExpiresIn(),
    })

    res.json({
      token,
      user: { id: user.id, username: user.username },
    })
  } catch (err) {
    console.error('Error en login:', err)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username })
})

router.post('/logout', requireAuth, (_req, res) => {
  res.json({ ok: true })
})

export default router
