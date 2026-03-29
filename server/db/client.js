import pg from 'pg'

const { Pool } = pg

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/procedi'

function resolveSslConfig() {
  const mode = String(process.env.DB_SSL_MODE || '').toLowerCase()
  if (mode === 'disable' || mode === 'off') return false
  if (mode === 'require' || mode === 'on') {
    return { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  }
  return undefined
}

const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: resolveSslConfig(),
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 8000,
})

export async function query(text, params = []) {
  return pool.query(text, params)
}

export async function testDatabaseConnection() {
  const res = await query('SELECT NOW() AS now')
  return res.rows[0]?.now || null
}

export async function closeDatabase() {
  await pool.end()
}

