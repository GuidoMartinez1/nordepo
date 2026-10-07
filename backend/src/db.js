import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const useSsl = process.env.DB_SSL === 'true' || process.env.DATABASE_URL?.includes('sslmode=require')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST || 'localhost',
  port: process.env.DATABASE_URL ? undefined : Number(process.env.DB_PORT) || 5432,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME || 'nordepo',
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER || 'postgres',
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD || '',
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Error en el pool de PostgreSQL:', err)
})

export default pool
