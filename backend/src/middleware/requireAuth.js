import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET no está definido')
    return res.status(500).json({ error: 'Error de configuración del servidor' })
  }
  try {
    const payload = jwt.verify(token, secret)
    req.user = {
      id: Number(payload.sub),
      username: payload.username,
      role: payload.role === 'vendedor' ? 'vendedor' : 'admin',
      sucursal_id: payload.sucursal_id ? Number(payload.sucursal_id) : null,
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o vencida' })
  }
}

/** Uso: requireRole('admin') o requireRole('admin', 'vendedor') */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' })
    }
    next()
  }
}

export function isPublicRoute(req) {
  if (req.method === 'OPTIONS') return true
  const path = req.path || ''
  if (req.method === 'GET' && (path === '/' || path === '/api/test' || path === '/api/health')) {
    return true
  }
  if (req.method === 'POST' && path === '/api/auth/login') return true
  return false
}
