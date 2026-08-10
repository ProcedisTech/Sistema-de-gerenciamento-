# Investigação: falhas em requisições de escrita (403/erro genérico) e CSP bloqueando fontes

> Documento de rastreio para investigação — não contém correção de código. Aberto durante o
> trabalho de redesign dos Alertas Clínicos (Trello #186), ao usar a conta de teste
> `guilhermebarcelos2006@gmail.com` no ambiente local (`localhost:5183` → backend local) e,
> depois, ao observar o mesmo padrão num ambiente com backend em
> `procedi-api-529230664257.southamerica-east1.run.app`.

## Bug 1 — 403 Forbidden em requisições de escrita (POST/PUT), GETs funcionam normalmente

### Onde já foi visto

1. `POST /api/v1/anamnese/paciente/{pacienteId}` (autosave da Anamnese, `anamneseApi.createPaciente` em `src/services/api.js`) — 403, deriva no crash do app inteiro via `ErrorBoundary` (`AppRoot.jsx`), pois a promise rejeitada não é tratada.
2. `PUT` do Perfil Clínico (`perfilClinicoApi.put`, chamado por `usePerfilClinico.save()` em `src/hooks/usePerfilClinico.js`) — mesmo 403, reproduzido ao clicar "Salvar" no modal "Sair sem salvar?" do módulo Anamnese.
3. Aparente terceira ocorrência: erro **"Falha ao salvar um ou mais procedimentos do lote."** ao clicar "Finalizar Atendimento" / "Encerrar consulta" (`handleEncerrarConsulta` em `src/components/AppRefactored.jsx`, por volta da linha 2790-2825, chamando `criarProcedimentoFeitoVinculado` em loop). O erro lançado é genérico (`throw new Error('Falha ao salvar um ou mais procedimentos do lote.')`) e **não preserva o status HTTP original** — não foi confirmado ainda se a causa raiz é o mesmo 403, mas o padrão (escrita falhando, leituras ok) bate com os outros dois casos.

Esse terceiro ponto (`AppRefactored.jsx:2790-2825`) é código pré-existente, de commits de outros devs entre 21/jun e 29/jul/2026 (confirmado via `git blame` contra `origin/main`), sem relação com o redesign dos Alertas Clínicos.

### O que já foi descartado como causa

- `TenantValidationInterceptor` (checagem de vínculo usuário-org) — bloquearia GETs também, e eles funcionam.
- `PatientsOnlyApiFilter` — retorna 404, não 403.
- `AnamneseController.preencherAnamnese` — sem `@PreAuthorize`, sem lançar 403 no código do service.
- `SecurityConfig` — `.anyRequest().authenticated()` genérico, sem regra específica de POST/PUT para essas rotas.

### Evidência mais forte encontrada

Log do backend local (`SecurityConfig` já loga `[CHAIN_REQ] {method} {path} | Auth | Org` por request, e `SupabaseJwtFilter` loga "SUCESSO!" ou cada branch de erro com `>>> EXIT: ...`). Na requisição POST de anamnese que falhou, o log mostra o `[CHAIN_REQ]` mas **nenhuma linha subsequente do `SupabaseJwtFilter`** — nem o WARN de RoleUser, nem "SUCESSO!", nem qualquer `>>> EXIT`. Olhando `SupabaseJwtFilter.java`, o único trecho do arquivo que não loga nada é quando não há token (nem `Authorization: Bearer` nem cookie `jwt`) — `filterChain.doFilter(request, response); return;` sem log.

**Hipótese (não confirmada):** corrida entre a renovação automática do token do Supabase (`getFreshToken()` em `src/services/api.js`, via `supabase.auth.getSession()`) e o disparo de alguma requisição de escrita — o token pode estar momentaneamente `null` durante o refresh, fazendo a requisição sair sem `Authorization`. Ponto que não fecha 100%: isso deveria resultar em 401 (via `HttpStatusEntryPoint`), não 403 — não foi possível confirmar a origem exata do 403 nesse cenário.

### Próximos passos sugeridos

1. Reproduzir com o DevTools aberto **antes** da ação de salvar, checando se o header `Authorization` está de fato ausente na requisição que falha.
2. Confirmar se o caso 3 (lote de procedimentos ao encerrar consulta) tem a mesma causa raiz — hoje o erro é engolido e reembalado sem preservar o status HTTP (`console.warn('[encerrarAtendimento] Erro ao criar procedimento do lote', e)` em `AppRefactored.jsx`), dificultando o diagnóstico. Vale logar/expor o status original antes de investigar mais fundo.
3. Considerar se algum retry automático do cliente (`request()` em `src/services/api.js`, que já tem retry em 401) deveria cobrir esse cenário também.

## Bug 2 — Erros de CSP bloqueando fonte do Google Fonts e script inline

Observado no console do navegador contra o ambiente `procedi-api-529230664257.southamerica-east1.run.app`:

```
Loading the stylesheet 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Inter:wght@400;500;600;700...'
violates the following Content Security Policy directive: "style-src 'self'". Note that 'style-src-elem' was not explicitly set, so 'style-src' is used as a fallback. The source has been blocked.

Executing inline script violates the following Content Security Policy directive: 'script-src 'self''.
Either the 'unsafe-inline' keyword, a hash (...), or a nonce (...) is required to enable inline execution. The action has been blocked.
```

Não relacionado ao Bug 1 nem ao redesign dos Alertas Clínicos — é configuração de CSP desse ambiente específico, bloqueando a folha de estilos de fontes do Google e algum script inline. Não foi investigada a origem exata do header CSP (proxy/CDN na frente do Cloud Run? meta tag no `index.html`? configuração do servidor?).

### Próximos passos sugeridos

1. Localizar de onde vem o header `Content-Security-Policy` nesse ambiente (não está em `vite.config.js` nem seria aplicado assim em dev local — provavelmente injetado no deploy/proxy).
2. Se as fontes via `<link>` do Google Fonts forem intencionais, adicionar `fonts.googleapis.com`/`fonts.gstatic.com` em `style-src`/`font-src`, ou trazer as fontes para local (self-host) evitando a dependência de CSP externo.
3. Identificar o script inline bloqueado e migrar para um arquivo externo, ou usar nonce/hash conforme a política já usa (`'nonce-...'`, `hash ('sha256-...')` já aparecem na mensagem de erro — a política já suporta nonce, só falta aplicá-lo nesse script específico).
