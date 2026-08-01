/**
 * Lista de reposición: suma/resta por producto_id (merge en una sola fila).
 */

export async function sumarAFuturosPedidos(client, productoId, cantidad = 1) {
  if (!productoId) return

  const qty = Number(cantidad)
  if (!Number.isFinite(qty) || qty <= 0) return

  const cantidadStr = Number.isInteger(qty) ? String(qty) : String(qty)

  const existing = await client.query(
    `SELECT id, cantidad FROM futuros_pedidos WHERE producto_id = $1`,
    [productoId]
  )

  if (existing.rows.length > 0) {
    const prev = parseFloat(existing.rows[0].cantidad) || 0
    const next = prev + qty
    const nextStr = Number.isInteger(next) ? String(next) : String(next)
    await client.query(`UPDATE futuros_pedidos SET cantidad = $1 WHERE id = $2`, [
      nextStr,
      existing.rows[0].id,
    ])
    return
  }

  const prod = await client.query(`SELECT nombre FROM productos WHERE id = $1`, [productoId])
  const nombre = prod.rows[0]?.nombre ?? null

  await client.query(
    `INSERT INTO futuros_pedidos (producto_id, producto, cantidad) VALUES ($1, $2, $3)`,
    [productoId, nombre, cantidadStr]
  )
}

export async function restarAFuturosPedidos(client, productoId, cantidad = 1) {
  if (!productoId) return

  const qty = Number(cantidad)
  if (!Number.isFinite(qty) || qty <= 0) return

  const existing = await client.query(
    `SELECT id, cantidad FROM futuros_pedidos WHERE producto_id = $1`,
    [productoId]
  )

  if (existing.rows.length === 0) return

  const prev = parseFloat(existing.rows[0].cantidad) || 0
  const next = prev - qty

  if (next <= 0) {
    await client.query(`DELETE FROM futuros_pedidos WHERE id = $1`, [existing.rows[0].id])
    return
  }

  const nextStr = Number.isInteger(next) ? String(next) : String(next)
  await client.query(`UPDATE futuros_pedidos SET cantidad = $1 WHERE id = $2`, [
    nextStr,
    existing.rows[0].id,
  ])
}
