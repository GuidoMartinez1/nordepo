import express from 'express'
import pool from '../db.js'
import { requireRole } from '../middleware/requireAuth.js'

const router = express.Router()

function todayLocal() {
  return new Date().toLocaleDateString('en-CA')
}

router.get('/', async (req, res) => {
  try {
    const esVendedor = req.user?.role === 'vendedor'
    if (esVendedor) {
      if (!req.user?.id) {
        return res.status(403).json({ error: 'Usuario no identificado' })
      }
      const { rows } = await pool.query(
        `SELECT * FROM gastos
         WHERE usuario_id = $1
         ORDER BY fecha DESC, created_at DESC`,
        [req.user.id]
      )
      return res.json(rows)
    }
    const { rows } = await pool.query(
      'SELECT * FROM gastos ORDER BY fecha DESC, created_at DESC'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al listar gastos' })
  }
})

async function resolverMontoArs(moneda, monto, fecha) {
  let cotizacion = 1
  if (moneda === 'USD') {
    const { rows } = await pool.query(
      'SELECT valor FROM cotizaciones WHERE fecha = $1',
      [fecha]
    )
    if (!rows.length) {
      const err = new Error(`No existe cotización USD para la fecha: ${fecha}`)
      err.status = 400
      throw err
    }
    cotizacion = Number(rows[0].valor)
  }
  return Number(monto) * cotizacion
}

/** Alta simple: concepto + monto. Fecha/categoría/moneda opcionales (defaults). */
router.post('/', async (req, res) => {
  try {
    const {
      concepto,
      monto,
      fecha = todayLocal(),
      moneda = 'ARS',
      categoria = 'OTROS',
    } = req.body || {}

    if (!concepto?.trim() || monto == null || !(Number(monto) > 0)) {
      return res.status(400).json({ error: 'Descripción e importe son obligatorios' })
    }

    const monedaNorm = moneda === 'USD' ? 'USD' : 'ARS'
    const monto_ars = await resolverMontoArs(monedaNorm, monto, fecha)
    const usuarioId = req.user?.id ? Number(req.user.id) : null
    const { rows } = await pool.query(
      `INSERT INTO gastos (concepto, monto, fecha, moneda, monto_ars, categoria, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [concepto.trim(), monto, fecha, monedaNorm, monto_ars, categoria, usuarioId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al crear gasto' })
  }
})

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { concepto, monto, fecha, moneda = 'ARS', categoria } = req.body
    if (!concepto?.trim() || monto == null || !fecha || !categoria) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' })
    }
    const monedaNorm = moneda === 'USD' ? 'USD' : 'ARS'
    const monto_ars = await resolverMontoArs(monedaNorm, monto, fecha)
    const { rows } = await pool.query(
      `UPDATE gastos
       SET concepto = $1, monto = $2, fecha = $3, moneda = $4, monto_ars = $5, categoria = $6
       WHERE id = $7 RETURNING *`,
      [concepto.trim(), monto, fecha, monedaNorm, monto_ars, categoria, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado' })
    res.json(rows[0])
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Error al actualizar gasto' })
  }
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM gastos WHERE id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ error: 'Gasto no encontrado' })
    res.json({ message: 'Gasto eliminado' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar gasto' })
  }
})

export default router
