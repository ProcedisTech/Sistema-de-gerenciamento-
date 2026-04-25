# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Procedi** — frontend SPA (React 19 + Vite 8 + Tailwind) for a clinic/procedures management system. The Spring Boot backend lives in a separate repo (`plataforma-procedimentos`); this repo only contains the frontend. An older `server/` Express folder has been removed.

## Commands

```bash
npm run dev          # Vite dev server (default :5173, strictPort)
npm run dev:clean    # Kills lingering ports first (scripts/clean-ports.ps1, Windows/PowerShell)
npm run build        # Production build to dist/
npm run lint         # ESLint flat config
npm run preview      # Preview built bundle
```

There is **no test runner configured**. Don't claim tests pass — there are none.

## Backend dependency

The frontend assumes Spring Boot is running and reachable. `vite.config.js` proxies `/api/*` to `VITE_API_PROXY_TARGET` (default `http://localhost:8080`) and rewrites cookie domain/path so the HttpOnly `jwt` cookie is same-origin in dev.

Critical dev rule (from README): pick **one** host — `localhost:5173` or `127.0.0.1:5173` — and stay on it. Cookies aren't shared across the two; mixing them silently breaks auth and produces 401s on `POST /api/v1/*`.

Relevant env vars (all optional, `VITE_*`):
- `VITE_API_BASE_URL` — leave **empty** in dev so calls go through the Vite proxy and the cookie stays same-origin. Setting it to `http://localhost:8080` directly will break auth.
- `VITE_API_PROXY_TARGET` — Spring URL for the proxy.
- `VITE_DEFAULT_ORG_ID` — UUID sent as `X-Org-Id` on `/api/v1/*` routes that need org scoping.
- `VITE_PORT`.

## Architecture

### Entry chain
`src/main.jsx` → `AppRoot.jsx` (provides `OrgProvider` + ErrorBoundary) → `App.jsx` (thin facade) → `AppRefactored.jsx` (the actual orchestrator that mounts views and wires controller hooks).

### Module layout (`src/components/`)
Feature folders, each largely self-contained: `agenda/`, `anamnese/`, `auth/`, `canvas/`, `configuracoes/`, `estoque/`, `journey/`, `layout/`, `patients/`, `system/`, `termos/`, `users/`.

Cross-cutting state lives in `src/components/hooks/` as controller hooks (`useAgendaController`, `useJourneyController`, `useAppointmentState`, `usePatientState`, `useAuthState`, `useCanvasController`, `useJourneyState`, `useProcedureCamera`). Treat these as the source of truth for their domain — `AppRefactored` composes them and drills props down.

### HTTP layer — `src/services/api.js`
The single client for the Spring backend. Key behaviors to preserve when editing:
- `credentials: 'include'` on every call so the HttpOnly `jwt` cookie travels.
- **Dual auth**: in addition to the cookie, if `/api/auth/login` or `/api/auth/me` returns an `accessToken`, it's stored in `sessionStorage` (`procedi_access_token`) + memory and sent as `Authorization: Bearer …`. This is required because the Spring JWT filter prefers Bearer over cookie. Don't strip one and assume the other works.
- `X-Org-Id` is auto-attached on `/api/v1/*` routes when `needsOrg: true`. The current org is held in module state (`setOrgId`/`getOrgId`) and synced by `OrgContext`.
- Binary endpoints (profile photo, gallery files) go through `requestBlob` with the same headers.

When you need headers from outside this module (e.g. raw `fetch` for journey photos, logout), use `authHeadersForFetch({ needsOrg })` rather than reconstructing them.

### Org context
`src/contexts/OrgContext.jsx` owns `orgId` and `roleUserId` (synced with the session after login / `/me`). It also calls `setOrgId` on the api module — keep that bridge intact when refactoring.

### Supabase
`src/lib/supabaseClient.js` exists (`@supabase/supabase-js` is a dep) and there's an active `feat/supabase-auth-frontend` branch. The current architecture is still cookie+JWT against Spring; treat Supabase as in-progress, not the canonical auth path, unless the user says otherwise.

### State migration status
Per `docs/ARCHITECTURE.md` and `CONTEXTO_SPRING_E_PLANO.md`: pacientes/agenda are being migrated incrementally from in-memory seeds to Spring. Some views still hold local state, and `patients/patientSeeds.js` / `usePatientState.js` carry seed structures. Don't assume a given screen is fully wired to the API — check the controller hook first.

## Conventions worth knowing

- JSX only (no TypeScript). React 19, function components, hooks.
- ESLint flat config (`eslint.config.js`) with per-file relaxations for known offenders (e.g. `set-state-in-effect` is disabled for specific files like `PatientProfileView.jsx`, `Step5Finalization.jsx`, several estoque modals, and a few hooks). Don't globally disable rules — extend the targeted overrides if needed.
- `no-unused-vars` ignores identifiers starting with uppercase or `_` (`varsIgnorePattern: '^[A-Z_]'`).
- Tailwind 3 + `@tailwindcss/postcss` 4 (mixed setup — don't "fix" by aligning versions without checking it still builds).
- Comments and identifiers mix Portuguese and English; match the file you're editing.

## Deeper docs

When the user asks about backend contracts, migration phases, or DB shape, consult these before guessing:
- `docs/CONTEXTO_SPRING_E_PLANO.md` — phased rollout plan, endpoint inventory, frontend↔backend gaps. Living doc with a changelog.
- `docs/ARCHITECTURE.md`
- `docs/MAINTENANCE.md`, `docs/RUNBOOKS.md`, `docs/DATABASE_POSTGRESQL.md`
