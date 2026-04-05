# Procedi - Sistema de gerenciamento

Documentacao principal para desenvolvimento, operacao e manutencao profunda.

## Estado atual do projeto
- Frontend React + Vite em `src/`.
- **API:** Spring Boot (autenticacao JWT por cookie + REST em `/api/v1/...`). O Vite encaminha `/api` para o backend (veja `vite.config.js` e `VITE_API_PROXY_TARGET`).
- Dados de pacientes/agenda no frontend ainda podem estar em memoria em partes do fluxo (migracao incremental).
- **Integracao Spring Boot:** ver `docs/CONTEXTO_SPRING_E_PLANO.md`.

## Mapa rapido
- Contexto Spring + plano de evolucao: `docs/CONTEXTO_SPRING_E_PLANO.md`
- Arquitetura: `docs/ARCHITECTURE.md`
- Manutencao profunda: `docs/MAINTENANCE.md`
- Runbooks SRE: `docs/RUNBOOKS.md`

## Requisitos
- Node.js 20+
- npm 10+
- Spring Boot rodando (ex.: `http://localhost:8080`) para as chamadas `/api/*`

## Setup rapido (dev)
### Frontend
```bash
npm install
npm run dev
```

Certifique-se de que o Spring Boot esta ativo na porta configurada em `VITE_API_PROXY_TARGET` (padrao: 8080).

## Scripts importantes
```bash
npm run dev
npm run build
npm run lint
```

## Variaveis de ambiente (frontend, opcional)
- `VITE_API_BASE_URL` — base da API quando nao usar o proxy do Vite
- `VITE_API_PROXY_TARGET` — alvo do proxy em dev (ex.: `http://localhost:8080`)
- `VITE_PORT` — porta do Vite

## Seguranca minima recomendada
- Nunca commitar `.env` real com segredos.
- Em producao, usar HTTPS e cookies com flags adequadas conforme o backend.

## Observacao sobre compatibilidade
O login e o CRUD de usuarios consomem o Spring Boot (`/api/auth/*`, `/api/v1/usuarios`). O header `X-Org-Id` e enviado automaticamente nas rotas que exigem organizacao (`src/services/api.js`).
