import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export function createAuthRouter(opts) {
  const router = Router()
  const { jwtSecret, adminUsername, adminPasswordHash, cookieName, cookieBase } = opts

  router.post('/login', async (req, res) => {
    const { username, password } = req.body ?? {}
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({ error: 'Informe usuário e senha.' })
    }
    if (username.length > 64 || password.length > 128) {
      return res.status(400).json({ error: 'Credenciais inválidas.' })
    }

    const userOk = username.trim() === adminUsername
    let passOk = false
    try {
      passOk = await bcrypt.compare(password, adminPasswordHash)
    } catch {
      passOk = false
    }

    if (!userOk || !passOk) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' })
    }

    const token = jwt.sign(
      { sub: adminUsername, role: 'admin' },
      jwtSecret,
      { expiresIn: '8h', issuer: 'procedi-api' }
    )

    res.cookie(cookieName, token, {
      ...cookieBase,
      maxAge: 8 * 60 * 60 * 1000,
    })

    return res.json({
      ok: true,
      user: { username: adminUsername, role: 'admin' },
    })
  })

  router.post('/logout', (req, res) => {
    res.clearCookie(cookieName, {
      ...cookieBase,
      maxAge: 0,
    })
    return res.json({ ok: true })
  })

  router.get('/me', (req, res) => {
    const token = req.cookies?.[cookieName]
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado.' })
    }
    try {
      const payload = jwt.verify(token, jwtSecret, { issuer: 'procedi-api' })
      return res.json({
        user: { username: payload.sub, role: payload.role },
      })
    } catch {
      return res.status(401).json({ error: 'Sessão expirada ou inválida.' })
    }
  })

  return router
}
