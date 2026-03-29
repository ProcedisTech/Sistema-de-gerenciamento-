# Procedi - Sistema de gerenciamento

Documentacao principal para desenvolvimento, operacao e manutencao profunda.

## Estado atual do projeto
- Frontend React + Vite em `src/`.
- Backend Express em `server/`.
- Autenticacao JWT por cookie httpOnly em `server/routes/auth.js`.
- Banco PostgreSQL introduzido com base em migrations SQL em `server/db/migrations/`.
- Dados de pacientes/agenda no frontend ainda estao em memoria (fase de migracao incremental).

## Mapa rapido
- Arquitetura: `docs/ARCHITECTURE.md`
- Banco PostgreSQL: `docs/DATABASE_POSTGRESQL.md`
- Manutencao profunda: `docs/MAINTENANCE.md`
- Runbooks SRE: `docs/RUNBOOKS.md`

## Requisitos
- Node.js 20+
- npm 10+
- PostgreSQL 15+ (local ou gerenciado)

## Setup rapido (dev)
### 1) Frontend
```bash
npm install
npm run dev
```

### 2) Backend
```bash
cd server
npm install
cp .env.example .env
npm run migrate
npm run seed-admin
npm run dev
```

## Scripts importantes
### Raiz
```bash
npm run dev
npm run dev:full
npm run server
npm run build
npm run lint
```

### Backend (`server/`)
```bash
npm run dev
npm run start
npm run migrate
npm run seed-admin
npm run hash-password -- "SUA_SENHA"
```

## Variaveis de ambiente principais
Backend (`server/.env`):
- `PORT`
- `FRONTEND_ORIGIN`
- `DATABASE_URL`
- `DB_SSL_MODE`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH` (recomendado)
- `COOKIE_NAME`
- `LOGIN_RATE_LIMIT_MAX`

Frontend (`.env.local` opcional):
- `VITE_API_BASE_URL`

## Fases da implementacao do banco
1. **Concluida**: conexao PostgreSQL, migration runner, schema inicial e seed de usuario admin.
2. **Em andamento**: migracao de auth para tabela `users` com fallback para credencial por env.
3. **Proxima**: endpoints de pacientes, agenda e jornadas com persistencia real.
4. **Final**: frontend consumindo API para remover estado apenas em memoria.

## Seguranca minima recomendada
- Nunca commitar `.env` real.
- Trocar `JWT_SECRET` em todos os ambientes.
- Nao usar senha em texto puro em producao; usar `ADMIN_PASSWORD_HASH`.
- Habilitar TLS e `DB_SSL_MODE=require` para banco gerenciado.
- Monitorar tentativas de login e erros 5xx.

## Observacao sobre compatibilidade
A API atual foi atualizada para suportar autenticacao via PostgreSQL, mas ainda preserva fallback de credencial para ambientes sem banco operacional imediato. Isso permite rollout gradual.

