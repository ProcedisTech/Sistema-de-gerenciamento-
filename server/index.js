import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { createAuthRouter } from './routes/auth.js'
import { requireAuth } from './middleware/requireAuth.js'

const PORT = Number(process.env.PORT) || 3001
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'Rafael').trim()
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
const COOKIE_NAME = process.env.COOKIE_NAME || 'procedi_token'
const isProd = process.env.NODE_ENV === 'production'

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    'Defina JWT_SECRET no arquivo .env (mínimo 32 caracteres aleatórios).'
  )
  process.exit(1)
}
if (!ADMIN_PASSWORD_HASH) {
  console.error(
    'Defina ADMIN_PASSWORD_HASH no .env. Gere com: npm run hash-password -- "sua_senha"'
  )
  process.exit(1)
}

const app = express()
app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
)

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
)

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

const cookieBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  path: '/',
}

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
    adminPasswordHash: ADMIN_PASSWORD_HASH,
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
  console.log(`CORS: ${FRONTEND_ORIGIN}`)
})
