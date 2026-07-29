import bcrypt from 'bcrypt'
import pool from './db.js'
import 'dotenv/config'

/**
 * Schema NORDEPO:
 * - Stock por sucursal (no stock global en productos)
 * - Ventas/compras atadas a sucursal
 * - Traslados entre sucursales
 * - Sin bolsas / precio_kg / AFIP
 */
export async function initDatabase() {
  const client = await pool.connect()
  try {
    console.log('Inicializando base de datos NORDEPO...')

    await client.query(`
      CREATE TABLE IF NOT EXISTS sucursales (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(12,2) NOT NULL DEFAULT 0,
        precio_costo DECIMAL(12,2) DEFAULT 0,
        porcentaje_ganancia DECIMAL(7,2) DEFAULT 30,
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        codigo VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_sucursal (
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
        sucursal_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
        cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
        PRIMARY KEY (producto_id, sucursal_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        telefono VARCHAR(50),
        direccion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS proveedores (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        telefono VARCHAR(50),
        direccion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        total DECIMAL(12,2) NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(50) DEFAULT 'completada',
        metodo_pago VARCHAR(50) DEFAULT 'efectivo',
        venta_origen_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
        notas TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS detalles_venta (
        id SERIAL PRIMARY KEY,
        venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        precio_unitario DECIMAL(12,2) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS compras (
        id SERIAL PRIMARY KEY,
        sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
        proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
        total DECIMAL(12,2) NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado VARCHAR(50) DEFAULT 'completada',
        notas TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS detalles_compra (
        id SERIAL PRIMARY KEY,
        compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        precio_unitario DECIMAL(12,2) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS traslados (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES productos(id),
        sucursal_origen_id INTEGER NOT NULL REFERENCES sucursales(id),
        sucursal_destino_id INTEGER NOT NULL REFERENCES sucursales(id),
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notas TEXT,
        CHECK (sucursal_origen_id <> sucursal_destino_id)
      )
    `)

    await client.query('CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_stock_sucursal_sucursal ON stock_sucursal(sucursal_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_ventas_sucursal ON ventas(sucursal_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_compras_sucursal ON compras(sucursal_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_traslados_fecha ON traslados(fecha)')

    // Sucursales iniciales
    const { rows: sucCount } = await client.query('SELECT COUNT(*)::int AS c FROM sucursales')
    if (sucCount[0].c === 0) {
      await client.query(
        `INSERT INTO sucursales (nombre, codigo) VALUES
          ('Sucursal Centro', 'CENTRO'),
          ('Sucursal Norte', 'NORTE')`
      )
      console.log('Sucursales iniciales creadas: Centro, Norte')
    }

    // Usuario admin
    const { rows: userCount } = await client.query('SELECT COUNT(*)::int AS c FROM users')
    if (userCount[0].c === 0) {
      const adminUser = (process.env.ADMIN_USERNAME || '').trim()
      const adminPass = process.env.ADMIN_PASSWORD || ''
      if (adminUser && adminPass) {
        const hash = await bcrypt.hash(adminPass, 12)
        await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [
          adminUser,
          hash,
        ])
        console.log(`Usuario inicial creado: ${adminUser}`)
      } else {
        console.log('Sin usuarios: definí ADMIN_USERNAME y ADMIN_PASSWORD en .env')
      }
    }

    console.log('Base de datos NORDEPO lista.')
  } finally {
    client.release()
  }
}

import { fileURLToPath } from 'url'

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  initDatabase()
    .then(() => {
      console.log('init-db OK')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Error init-db:', err)
      process.exit(1)
    })
}
