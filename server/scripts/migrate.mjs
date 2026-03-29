import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../db/client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.resolve(__dirname, '../db/migrations')

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations() {
  const res = await pool.query('SELECT name FROM schema_migrations ORDER BY name ASC')
  return new Set(res.rows.map((row) => row.name))
}

async function readMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

async function applyMigration(name) {
  const fullPath = path.join(migrationsDir, name)
  const sql = await fs.readFile(fullPath, 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name])
    await client.query('COMMIT')
    console.log(`[migrate] applied: ${name}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  await ensureMigrationsTable()
  const [applied, files] = await Promise.all([getAppliedMigrations(), readMigrationFiles()])

  let appliedCount = 0
  for (const fileName of files) {
    if (applied.has(fileName)) continue
    await applyMigration(fileName)
    appliedCount += 1
  }

  if (appliedCount === 0) {
    console.log('[migrate] no pending migrations')
  } else {
    console.log(`[migrate] completed with ${appliedCount} migration(s)`) 
  }
}

main()
  .catch((error) => {
    console.error('[migrate] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })

