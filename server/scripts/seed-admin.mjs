import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../db/client.js'

const username = (process.env.ADMIN_USERNAME || 'Rafael').trim()
const passwordPlain = process.env.ADMIN_PASSWORD || 'PROcedi'
const existingHash = process.env.ADMIN_PASSWORD_HASH
const role = process.env.ADMIN_ROLE || 'admin'

async function main() {
  const passwordHash = existingHash || (await bcrypt.hash(passwordPlain, 12))

  await pool.query(
    `
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [username, passwordHash, role]
  )

  console.log(`[seed-admin] user upserted: ${username}`)
}

main()
  .catch((error) => {
    console.error('[seed-admin] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })

