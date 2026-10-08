import bcrypt from 'bcrypt'
import pool from './db.js'
import 'dotenv/config'

/**
 * Schema NORDEPO:
 * - Stock y precio de venta / % por sucursal de venta
 * - Compras ingresan en la sucursal destino elegida
 * - Traslados solo entre sucursales de venta
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
        es_deposito BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      ALTER TABLE sucursales
      ADD COLUMN IF NOT EXISTS es_deposito BOOLEAN NOT NULL DEFAULT FALSE
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'admin'
          CHECK (role IN ('admin', 'vendedor')),
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // Migración suave si la tabla ya existía sin role
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin'
    `)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE
    `)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL
    `)
    await client.query(`UPDATE users SET role = 'admin' WHERE role IS NULL OR role = ''`)
    await client.query(`UPDATE users SET activo = TRUE WHERE activo IS NULL`)

    // Username único solo entre activos (permite recrear al vendedor en otra sucursal)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'users_username_key' AND conrelid = 'users'::regclass
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_username_key;
        END IF;
      END $$;
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_activo_unique
      ON users (username)
      WHERE activo = TRUE
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

    // Cuentas / alias de Mercado Pago por sucursal
    await client.query(`
      CREATE TABLE IF NOT EXISTS cuentas_mp (
        id SERIAL PRIMARY KEY,
        sucursal_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL,
        alias VARCHAR(255) NOT NULL,
        activa BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (sucursal_id, alias)
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cuentas_mp_sucursal ON cuentas_mp(sucursal_id)
    `)

    await client.query(`
      ALTER TABLE ventas
      ADD COLUMN IF NOT EXISTS cuenta_mp_id INTEGER REFERENCES cuentas_mp(id) ON DELETE SET NULL
    `)
    await client.query(`
      ALTER TABLE ventas
      ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS detalles_venta (
        id SERIAL PRIMARY KEY,
        venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        cantidad INTEGER NOT NULL CHECK (cantidad <> 0),
        precio_unitario DECIMAL(12,2) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL,
        descripcion VARCHAR(255)
      )
    `)
    await client.query(`
      ALTER TABLE detalles_venta
      DROP CONSTRAINT IF EXISTS detalles_venta_cantidad_check
    `)
    await client.query(`
      ALTER TABLE detalles_venta
      ADD CONSTRAINT detalles_venta_cantidad_check CHECK (cantidad <> 0)
    `)
    await client.query(`
      ALTER TABLE detalles_venta
      ADD COLUMN IF NOT EXISTS descripcion VARCHAR(255)
    `)
    await client.query(`
      ALTER TABLE detalles_venta
      ADD COLUMN IF NOT EXISTS precio_costo_unitario DECIMAL(12,2)
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS historial_costos (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
        compra_id INTEGER REFERENCES compras(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
        precio_costo_anterior DECIMAL(12,2) NOT NULL DEFAULT 0,
        precio_costo_nuevo DECIMAL(12,2) NOT NULL DEFAULT 0,
        cantidad INTEGER DEFAULT 0,
        revisado BOOLEAN NOT NULL DEFAULT FALSE,
        creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS futuros_pedidos (
        id SERIAL PRIMARY KEY,
        producto VARCHAR(255),
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        cantidad VARCHAR(50),
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_futuros_pedidos_producto
      ON futuros_pedidos(producto_id)
    `)

    // Precio de venta y % por sucursal (el costo sigue global en productos)
    await client.query(`
      CREATE TABLE IF NOT EXISTS precio_sucursal (
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
        sucursal_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
        precio DECIMAL(12,2) NOT NULL DEFAULT 0,
        porcentaje_ganancia DECIMAL(7,2) DEFAULT 30,
        PRIMARY KEY (producto_id, sucursal_id)
      )
    `)

    // Backfill: precios solo en sucursales de venta (no depósito)
    await client.query(`
      INSERT INTO precio_sucursal (producto_id, sucursal_id, precio, porcentaje_ganancia)
      SELECT p.id, s.id, p.precio, COALESCE(p.porcentaje_ganancia, 30)
      FROM productos p
      CROSS JOIN sucursales s
      WHERE s.activa = TRUE AND COALESCE(s.es_deposito, FALSE) = FALSE
      ON CONFLICT (producto_id, sucursal_id) DO NOTHING
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS cotizaciones (
        id SERIAL PRIMARY KEY,
        fecha DATE UNIQUE NOT NULL,
        valor DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        concepto VARCHAR(255) NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
        monto_ars DECIMAL(12,2) NOT NULL,
        fecha DATE NOT NULL,
        categoria VARCHAR(50) NOT NULL,
        usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      ALTER TABLE gastos
      ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    `)

    await client.query('CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_stock_sucursal_sucursal ON stock_sucursal(sucursal_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_ventas_sucursal ON ventas(sucursal_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_compras_sucursal ON compras(sucursal_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_traslados_fecha ON traslados(fecha)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_historial_costos_revisado ON historial_costos(revisado)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_historial_costos_producto ON historial_costos(producto_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria)')

    // Sucursales de venta (Galería / Oulet). No se crea Depósito.
    await client.query(`
      INSERT INTO sucursales (nombre, codigo, es_deposito)
      VALUES
        ('Galería', 'CENTRO', FALSE),
        ('Oulet', 'NORTE', FALSE)
      ON CONFLICT (codigo) DO UPDATE
      SET nombre = EXCLUDED.nombre
    `)

    // Migración one-shot: stock del Depósito → primera sucursal de venta; desactivar Depósito
    await client.query(`
      DO $$
      DECLARE
        dep_id INTEGER;
        venta_id INTEGER;
      BEGIN
        SELECT id INTO dep_id
        FROM sucursales
        WHERE COALESCE(es_deposito, FALSE) = TRUE OR codigo = 'DEPOSITO'
        LIMIT 1;

        IF dep_id IS NULL THEN
          RETURN;
        END IF;

        SELECT id INTO venta_id
        FROM sucursales
        WHERE activa = TRUE AND COALESCE(es_deposito, FALSE) = FALSE
        ORDER BY nombre
        LIMIT 1;

        IF venta_id IS NOT NULL THEN
          INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad)
          SELECT producto_id, venta_id, cantidad
          FROM stock_sucursal
          WHERE sucursal_id = dep_id AND cantidad > 0
          ON CONFLICT (producto_id, sucursal_id)
          DO UPDATE SET cantidad = stock_sucursal.cantidad + EXCLUDED.cantidad;

          DELETE FROM stock_sucursal WHERE sucursal_id = dep_id;
        END IF;

        UPDATE sucursales
        SET activa = FALSE, es_deposito = TRUE, nombre = 'Depósito'
        WHERE id = dep_id;
      END $$;
    `)

    // Usuario admin
    const { rows: userCount } = await client.query('SELECT COUNT(*)::int AS c FROM users')
    if (userCount[0].c === 0) {
      const adminUser = (process.env.ADMIN_USERNAME || '').trim()
      const adminPass = process.env.ADMIN_PASSWORD || ''
      if (adminUser && adminPass) {
        const hash = await bcrypt.hash(adminPass, 12)
        await client.query(
          `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')`,
          [adminUser, hash]
        )
        console.log(`Usuario inicial creado: ${adminUser} (admin)`)
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
