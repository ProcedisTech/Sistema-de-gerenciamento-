import { query } from './client.js'

export async function findUserByUsername(username) {
  const res = await query(
    `
      SELECT username, password_hash AS "passwordHash", role, is_active AS "isActive"
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  )
  return res.rows[0] || null
}

