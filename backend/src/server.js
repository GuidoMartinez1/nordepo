import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import pool from './db.js'
import { requireAuth, isPublicRoute } from './middleware/requireAuth.js'
import { initDatabase } from './initDb.js'

import authRoutes from './routes/auth.js'
import sucursalesRoutes from './routes/sucursales.js'
import categoriasRoutes from './routes/categorias.js'
import productosRoutes from './routes/productos.js'
import clientesRoutes from './routes/clientes.js'
import proveedoresRoutes from './routes/proveedores.js'
import ventasRoutes from './routes/ventas.js'
import comprasRoutes from './routes/compras.js'
import trasladosRoutes from './routes/traslados.js'
import statsRoutes from './routes/stats.js'

const app = express()
const PORT = process.env.PORT || 3001
const FRONTEND_URL = process.env.FRONTEND_URL || null

const corsOptions = {
  origin: FRONTEND_URL ? FRONTEND_URL : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
  next()
})

app.get('/', (_req, res) => res.send('NORDEPO API OK'))
app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS fecha')
    res.json({ ok: true, fecha: result.rows[0].fecha })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Error consultando la BD' })
  }
})
app.get('/api/test', (_req, res) => res.json({ message: 'Conexión exitosa' }))

app.use('/api/auth', authRoutes)

app.use((req, res, next) => {
  if (isPublicRoute(req)) return next()
  return requireAuth(req, res, next)
})

app.use('/api/sucursales', sucursalesRoutes)
app.use('/api/categorias', categoriasRoutes)
app.use('/api/productos', productosRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/proveedores', proveedoresRoutes)
app.use('/api/ventas', ventasRoutes)
app.use('/api/compras', comprasRoutes)
app.use('/api/traslados', trasladosRoutes)
app.use('/api/stats', statsRoutes)

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Error interno' })
})

async function start() {
  try {
    await initDatabase()
  } catch (err) {
    console.error('No se pudo inicializar el schema (¿PostgreSQL corriendo?):', err.message)
  }

  app.listen(PORT, () => {
    console.log(`NORDEPO API en http://localhost:${PORT}`)
  })
}

start()
