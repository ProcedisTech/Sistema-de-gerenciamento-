import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { createAuthRouter } from './routes/auth.js'
import { requireAuth } from './middleware/requireAuth.js'

const PORT = Number(process.env.PORT) || 3001
// Se não estiver definido, o CORS vai refletir a origem recebida (bom para testes em nuvem).
// Em produção, defina para ficar restrito.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'procedi-dev-jwt-secret-please-change-me-0123456789abcdef'
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'Rafael').trim()
// Para testes sem banco em nuvem: senha fica no código (fallback).
// Em produção, prefira setar ADMIN_PASSWORD_HASH no .env.
const ADMIN_PASSWORD_FALLBACK = process.env.ADMIN_PASSWORD || 'PROcedi'
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
const COOKIE_NAME = process.env.COOKIE_NAME || 'procedi_token'
const isProd = process.env.NODE_ENV === 'production'

const cookieSameSite = process.env.COOKIE_SAMESITE || 'lax'
const cookieBase = {
  httpOnly: true,
  secure: cookieSameSite === 'none' ? true : isProd,
  sameSite: cookieSameSite,
  path: '/',
}

async function start() {
  // Calcula o hash na inicialização somente se não existir ADMIN_PASSWORD_HASH.
  const adminPasswordHash =
    ADMIN_PASSWORD_HASH || (await bcrypt.hash(ADMIN_PASSWORD_FALLBACK, 12))

  const app = express()
  app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  )

  app.use(
    cors({
      origin: FRONTEND_ORIGIN || true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    })
  )

  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 8,
    message: { error: 'Muitas tentativas de login. Aguarde alguns minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  })

  app.use('/api/auth/login', loginLimiter)

  app.use(
    '/api/auth',
    createAuthRouter({
      jwtSecret: JWT_SECRET,
      adminUsername: ADMIN_USERNAME,
      adminPasswordHash,
      cookieName: COOKIE_NAME,
      cookieBase,
    })
  )

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'procedi-api' })
  })

  app.get('/api/protected/ping', requireAuth, (req, res) => {
    res.json({ ok: true, user: req.user })
  })

  app.use((_req, res) => {
    res.status(404).json({ error: 'Não encontrado.' })
  })

  app.use((err, _req, res, _next) => {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor.' })
  })

  app.listen(PORT, () => {
    console.log(`Procedi API em http://localhost:${PORT}`)
    console.log(`CORS: ${FRONTEND_ORIGIN || '(refletindo origem)'} `)
    console.log(`Cookie SameSite: ${cookieSameSite} (secure=${cookieBase.secure})`)
  })
}

start().catch((err) => {
  console.error('Falha ao iniciar API:', err)
  process.exit(1)
})
