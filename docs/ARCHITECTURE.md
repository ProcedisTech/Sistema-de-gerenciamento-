# Arquitetura do sistema

## Visao geral
O sistema tem duas camadas principais:
- **Frontend SPA** em React (`src/`).
- **Backend API** Spring Boot (repositório `plataforma-procedimentos`), consumida via `/api` (proxy do Vite em dev).

Fluxo principal de autenticação:
1. Usuario autentica via `POST /api/auth/login` (Spring).
2. Backend emite JWT e define cookie httpOnly.
3. `src/services/api.js` envia `credentials: 'include'` nas requisições.
4. Rotas protegidas exigem cookie JWT válido (configuração no Spring).

## Frontend
### Entradas
- `src/main.jsx`: bootstrap React.
- `src/components/AppRoot.jsx`: `OrgProvider` + error boundary.
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
  - `users/` (CRUD de usuarios)

### Observacao de estado
- Pacientes/agendamentos ainda podem estar em estado local em memoria em partes do fluxo.
- Estruturas seed em `patients/patientSeeds.js` e `usePatientState.js`.

### Contexto de organizacao
- `src/contexts/OrgContext.jsx`: `orgId`, `roleUserId` (sincronizado com a sessao apos login/`/me`).

## Backend (Spring Boot)
Documentacao e codigo ficam no repositorio do backend. Contratos REST usados pelo frontend estao centralizados em `src/services/api.js`.

## Decisao de rollout
Migracao incremental por modulos (pacientes, agenda, jornadas) conforme plano em `docs/CONTEXTO_SPRING_E_PLANO.md`.
