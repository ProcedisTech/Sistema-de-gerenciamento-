import jwt from 'jsonwebtoken'

const COOKIE_NAME = process.env.COOKIE_NAME || 'procedi_token'

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'procedi-api',
    })
    req.user = { username: payload.sub, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ error: 'Sessão expirada ou inválida.' })
  }
}
