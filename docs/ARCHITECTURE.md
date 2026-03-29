# Arquitetura do sistema

## Visao geral
O sistema tem duas camadas principais:
- **Frontend SPA** em React (`src/`).
- **Backend API** em Express (`server/`).

Fluxo principal:
1. Usuario autentica via `POST /api/auth/login`.
2. Backend emite JWT assinado e grava cookie httpOnly.
3. Frontend usa `credentials: include` para chamadas autenticadas.
4. API valida cookie JWT no middleware `requireAuth`.

## Frontend
### Entradas
- `src/main.jsx`: bootstrap React.
- `src/components/AppRoot.jsx`: lazy load + error boundary.
- `src/components/App.jsx`: facade estavel para `AppRefactored`.

### Composicao atual
- `AppRefactored` concentra orquestracao das views.
- Hooks de estado/controller em `src/components/hooks/`.
- Modulos de UI:
  - `journey/`
  - `agenda/`
  - `patients/`
  - `auth/`
  - `layout/`

### Observacao de estado
- Pacientes/agendamentos ainda estao em estado local em memoria.
- Estruturas seed em `patients/patientSeeds.js` e `usePatientState.js`.

## Backend
### Arquivos chave
- `server/index.js`: bootstrap, CORS, helmet, auth router, health.
- `server/routes/auth.js`: login/logout/me.
- `server/middleware/requireAuth.js`: guard JWT.
- `server/db/client.js`: pool PostgreSQL.
- `server/db/usersRepo.js`: acesso a usuarios para autenticacao.

### Segurança
- `helmet` ativo (CSP desligado intencionalmente no momento).
- Rate limit em `/api/auth/login`.
- JWT issuer fixo: `procedi-api`.
- Cookie httpOnly com `sameSite` configuravel.

## Banco de dados
- PostgreSQL com migration SQL em `server/db/migrations/001_init.sql`.
- Runner de migrations: `server/scripts/migrate.mjs`.
- Seed admin: `server/scripts/seed-admin.mjs`.

## Decisao de rollout
Banco adotado com **migracao incremental por modulos**:
1. Infra do banco + auth.
2. Pacientes.
3. Agenda.
4. Jornadas/fotos.
5. Corte final de estado local.

