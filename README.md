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

### Dev: mesma origem e cookie JWT (`jwt`)
- Abra o app **sempre** em **uma** URL fixa: ou `http://localhost:5173` **ou** `http://127.0.0.1:5173`. Cookies **nao** sao compartilhados entre os dois; misturar login em um e API no outro quebra a sessao.
- Com autenticacao por cookie, deixe **`VITE_API_BASE_URL` vazio** para todas as chamadas irem a `/api/...` no mesmo host do Vite (proxy para o Spring). Apontar o front direto para `:8080` armazena o cookie em outro host e os `POST /api/v1/*` no `:5173` ficam sem `jwt`.
- Apos login, em DevTools → Application → Cookies, o nome do cookie deve ser **`jwt`** no **mesmo** host da barra de enderecos.
- Para diagnosticar **401** em `POST /api/v1/agendamentos`: Network → a requisicao deve mostrar **Request Headers** com `Cookie: ...jwt=...` e `X-Org-Id` alinhado ao banco / `VITE_DEFAULT_ORG_ID`. Compare com um `GET` que funcione (ex. pacientes).

## Scripts importantes
```bash
npm run dev
npm run build
npm run lint
```

## Variaveis de ambiente (frontend, opcional)
- `VITE_API_BASE_URL` — em dev com JWT em cookie, **deixe vazio** (use o proxy). Ver `.env.example`.
- `VITE_API_PROXY_TARGET` — alvo do proxy em dev (ex.: `http://localhost:8080`)
- `VITE_PORT` — porta do Vite
- `VITE_DEFAULT_ORG_ID` — UUID enviado em `X-Org-Id` nas rotas `/api/v1/*` que exigem org

## Seguranca minima recomendada
- Nunca commitar `.env` real com segredos.
- Em producao, usar HTTPS e cookies com flags adequadas conforme o backend.

## Observacao sobre compatibilidade
O login e o CRUD de usuarios consomem o Spring Boot (`/api/auth/*`, `/api/v1/usuarios`). O header `X-Org-Id` e enviado automaticamente nas rotas que exigem organizacao (`src/services/api.js`).
