import jwt from 'jsonwebtoken'

const COOKIE_NAME = process.env.COOKIE_NAME || 'procedi_token'
// Fallback para testes em nuvem sem configurar .env
const JWT_SECRET_FALLBACK =
  process.env.JWT_SECRET ||
  'procedi-dev-jwt-secret-please-change-me-0123456789abcdef'

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET_FALLBACK, {
      issuer: 'procedi-api',
    })
    req.user = { username: payload.sub, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ error: 'Sessão expirada ou inválida.' })
  }
}
