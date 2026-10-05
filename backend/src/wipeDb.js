/**
 * Borra los datos de negocio de NORDEPO (mantiene el schema).
 *
 * Por defecto CONSERVA: users y sucursales (para poder seguir entrando).
 * Con --todo también borra users y sucursales (después corrés: npm run init-db).
 *
 * Uso (desde backend/ o con el script npm):
 *   CONFIRMAR=SI node src/wipeDb.js
 *   CONFIRMAR=SI node src/wipeDb.js --todo
 *
 * O desde la raíz del repo:
 *   CONFIRMAR=SI npm run wipe-db
 *   CONFIRMAR=SI npm run wipe-db -- --todo
 */
import 'dotenv/config'
import pool from './db.js'

const args = new Set(process.argv.slice(2))
const confirmar =
  process.env.CONFIRMAR === 'SI' || args.has('--confirmar') || args.has('-y')
const todo = args.has('--todo') || args.has('--all')

const TABLAS_NEGOCIO = [
  'detalles_venta',
  'detalles_compra',
  'ventas',
  'compras',
  'traslados',
  'historial_costos',
  'futuros_pedidos',
  'stock_sucursal',
  'precio_sucursal',
  'gastos',
  'cotizaciones',
  'cuentas_mp',
  'clientes',
  'proveedores',
  'productos',
  'categorias',
]

async function main() {
  const dbName = process.env.DB_NAME || 'nordepo'
  const dbHost = process.env.DB_HOST || 'localhost'

  console.log('────────────────────────────────────────')
  console.log('  NORDEPO — wipe de datos')
  console.log(`  Base: ${dbName} @ ${dbHost}`)
  console.log(
    todo
      ? '  Modo: TODO (incluye users y sucursales)'
      : '  Modo: negocio (conserva users y sucursales)'
  )
  console.log('────────────────────────────────────────')

  if (!confirmar) {
    console.error(`
Abortado: falta confirmación.

Ejecutá así:
  CONFIRMAR=SI npm run wipe-db --prefix backend

O para borrar también usuarios y sucursales:
  CONFIRMAR=SI npm run wipe-db --prefix backend -- --todo
`)
    process.exit(1)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Solo truncar tablas que existan (por si falta alguna migración)
    const { rows: existentes } = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])`,
      [TABLAS_NEGOCIO]
    )
    const tablas = existentes.map((r) => r.tablename)
    if (tablas.length === 0) {
      throw new Error('No se encontraron tablas de negocio. ¿Está bien el DB_NAME?')
    }

    const sql = `TRUNCATE TABLE ${tablas.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`
    console.log(`Truncando: ${tablas.join(', ')}`)
    await client.query(sql)

    if (todo) {
      const extras = []
      const check = await client.query(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
        [['users', 'sucursales']]
      )
      for (const r of check.rows) extras.push(r.tablename)
      if (extras.length) {
        console.log(`Truncando también: ${extras.join(', ')}`)
        await client.query(
          `TRUNCATE TABLE ${extras.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`
        )
      }
    }

    await client.query('COMMIT')
    console.log('Listo: datos borrados.')
    if (todo) {
      console.log('Después corré: npm run init-db --prefix backend')
      console.log('(recrea Galería/Oulet y el admin del .env si no hay users)')
    } else {
      console.log('Usuarios y sucursales se mantuvieron.')
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error al borrar datos:', err.message || err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
