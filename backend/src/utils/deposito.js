import pool from '../db.js'

/** Devuelve el id de la sucursal depósito (la crea si no existe). */
export async function getDepositoId(client = pool) {
  const existing = await client.query(
    `SELECT id FROM sucursales WHERE es_deposito = TRUE OR codigo = 'DEPOSITO' LIMIT 1`
  )
  if (existing.rows.length) return Number(existing.rows[0].id)

  const inserted = await client.query(
    `INSERT INTO sucursales (nombre, codigo, activa, es_deposito)
     VALUES ('Depósito', 'DEPOSITO', TRUE, TRUE)
     ON CONFLICT (codigo) DO UPDATE SET es_deposito = TRUE, nombre = 'Depósito'
     RETURNING id`
  )
  return Number(inserted.rows[0].id)
}
