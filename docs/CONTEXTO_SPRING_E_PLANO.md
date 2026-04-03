# Contexto Spring Boot + plano de evolução (frontend)

Documento **vivo** para alinhar este repositório (frontend React/Vite) com o backend **Spring Boot** do projeto **plataforma-procedimentos**, orientar implementação por fases e servir de briefing para **outros agentes de IA** ou desenvolvedores.

**Como manter atualizado:** após cada sprint ou mudança relevante de API, edite a [Seção 8 — Changelog](#8-changelog) e, se necessário, a [Seção 3 — Estado atual no código](#3-estado-atual-no-código-frontend).

---

## 1. Relação entre repositórios

| Repositório | Conteúdo |
|-------------|----------|
| **Este repo** (`Sistema-de-gerenciamento-` ou nome local) | Frontend React 19 + Vite 8; proxy `/api` → Spring em dev |
| **plataforma-procedimentos** | Spring Boot 3.2.5, `backend/`, DDL/seed, `docs/` do backend |

Documentação de referência no **backend** (caminhos típicos):

- `docs/CONTEXTO_CONJUNTO_FRONT_BACK.md` — contrato API, lacunas, briefing cruzado
- `docs/DOCUMENTACAO_TECNICA.md`, `docs/BANCO_DE_DADOS.md`, `docs/PLANO_PROTECAO_DADOS.md`

**Legado neste repo:** pasta `server/` (Express + auth por cookie). A direção do produto é **substituir** esse backend pelo Spring; integrações novas devem preferir **`src/services/api.js`** e `http://localhost:8080` (via proxy).

---

## 2. Avaliação do plano operacional (backend)

O plano em fases (0 → A → B → C → D → E, mais mídia e disponibilidade) está **coerente** com o estado real do frontend e com as lacunas já mapeadas:

- **Separação BD / Backend / Frontend** evita surpresas (“orçamento só UI” não mexe no PostgreSQL; “orçamento persistido” exige Flyway).
- **Fase A** prioriza o que já existe na API (agenda, catálogo, procedimentos, notas, perfil) antes de domínios novos — reduz risco.
- **A3 (REST de agendamentos no slot)** está bem posicionada como **opcional decisório**: sem ela, a recepção não lista “quem está no horário”; com ela, o fluxo fica completo sem gambiarras só com `POST /procedimentos/iniciar`.
- **B1 vs B2** e **C1 vs C2** deixam explícito o trade-off MVP vs auditoria/produção.
- **Mídia** e **disponibilidade** como faixas paralelas após agenda estável é realista.

**Sugestões de refinamento (frontend):**

- Em **A2**, o mapeamento `AgendaDTO` → UI deve **remover** o campo `patient` inventado até A3 ou até o DTO trazer filhos; documentar no componente para não regressar mocks silenciosos.
- Em **A5/A6**, alinhar **sempre** `pacienteId` UUID vindo de `GET /pacientes` (não só CPF) antes de `iniciar`/`finalizar` procedimento.
- Manter **uma única fonte** de `roleUserId` (equipe selecionada ou seed dev) até existir JWT.

---

## 3. Estado atual no código (frontend)

*Última revisão documental: ver changelog.*

### 3.1 Stack e entrada

- React 19, Vite 8, Tailwind, JSX
- App principal: `src/components/AppRefactored.jsx`
- HTTP: `src/services/api.js` (`fetch`, header `X-Org-Id` quando `needsOrg`)
- Org padrão: `b0000000-0000-0000-0000-000000000001` (ajustar via `setOrgId` até haver UI)

### 3.2 Integrado ao Spring (chamadas reais)

| Área | Arquivos | Endpoints usados |
|------|----------|------------------|
| Lista pacientes | `usePatientState.js` | `GET /api/v1/pacientes` |
| Cadastro paciente | `PatientCreateView.jsx` | `POST /pacientes`, `GET /dimensoes/estados-civis` |
| Anamnese admin | `anamnese/*` | categorias, hábitos, alternativas, fichas, especialidades, tipos-resposta |
| Anamnese jornada | `Step2Anamnese.jsx`, `AppRefactored.jsx` | fichas, preenchimento `POST .../paciente`, etc. |
| Anamnese perfil | `PatientProfileView.jsx` | list + detalhe por id |

### 3.3 Cliente definido mas sem uso na UI

- `notasApi`, `equipeApi`, `agendasApi`, métodos parciais de `pacientesApi` (get/search/update/remove), `procedimentosApi` (só `byPaciente` no arquivo)

### 3.4 Ausente em `api.js` (backend já expõe — plugar quando for a vez)

- `catalogosApi`
- `procedimentosApi`: create, iniciar, patchStatus, finalizar
- `agendasApi`: GET por id, PUT
- `usuariosApi` (leitura)
- `dimensoesApi`: roles, status-agenda, status-procedimento, status-anamnese, periodos-dia

### 3.5 Fluxos ainda locais ou legado

- **Agenda:** `useAgendaController.js` — estado React apenas
- **Jornada:** `upsertPatientLocal` em `AppRefactored.jsx` — não substitui `PUT /pacientes`
- **Auth:** `useAuthState.js` — Express em dev; Spring sem JWT no momento
- **Termos / finalização:** textos fixos em `Step4LGPD.jsx`, `Step5Finalization.jsx`

---

## 4. Plano de fases (resumo alinhado ao backend)

Legenda: **BD** = PostgreSQL; **Backend** = Java Spring; **Frontend** = este repo.

### Fase 0 — Alinhamento

Decisões: A3 sim/não; orçamento B1 vs B2; estratégia de mídia. Frontend: inventário endpoint ↔ `api.js` ↔ tela; `OrgProvider`/seletor org e `roleUserId`.

### Fase A — Plugar API existente

| ID | Meta | Frontend (este repo) |
|----|------|------------------------|
| A1 | Cliente HTTP completo | Estender `api.js` (catálogo, procedimentos, agendas, dimensões, usuários) |
| A2 | Agenda real | `useAgendaController` + `AgendaView` → `by-range`/`by-date`, create, cancelar, PUT |
| A3 | Agendamentos no slot | Opcional; após endpoints no Spring, modal lista/cria compromisso no slot |
| A4 | Perfil | `PatientProfileView`: GET paciente, notas CRUD, procedimentos por paciente |
| A5 | Jornada | Step1 POST paciente novo; PUT incremental; UUID; `finalizar` anamnese se regra exigir |
| A6 | Fechamento | `finishJourney` → procedimento iniciar/finalizar + IDs reais (`agendaId`, `catalogoProcedimentoSaudeId`, `roleUserId`) |

**Mudança de banco na Fase A pura:** não (exceto processo Flyway baseline, se aplicável no backend).

### Fase B — Avaliação → orçamento

- **B1:** só UI — multiselect catálogo, `valorFinal`, localStorage/PDF — **sem BD**
- **B2:** persistido — depende de novas tabelas + API no backend

### Fase C — Termos dinâmicos

- **C1:** templates no front — sem BD
- **C2:** templates + aceite no servidor — BD + API backend

### Fase D — Pagamento

Onda final; stub de rota/view no front até contrato financeiro.

### Fase E — Estoque / lotes

Módulo grande; BD + backend + telas de kardex e consumo por procedimento.

### Paralelos

- **Mídia (fotos avaliação):** S3/Blob + tabela referência, ou legado Express temporário — documentar decisão no changelog.
- **Disponibilidade profissional:** CRUD quando backend expuser; `disponibilidade_profissional_id` nos slots se trigger exigir.

---

## 5. Ordem sugerida de execução (sincronizada)

1. Fase 0 (decisões)
2. A1 + A2 (`api.js` + agenda Spring na UI)
3. A3 se “sim”
4. A4, A5, A6
5. B (B1 ou B2)
6. C (C2 se auditoria)
7. D (última onda)
8. E se couber
9. Mídia e disponibilidade conforme capacidade

---

## 6. Checklist “preciso mexer no banco?”

- Fase A pura + A3 REST em cima de `tb_agendamento` → **não** (somente código app)
- Orçamento histórico, termos aceite, fotos com metadados no Procedi, pagamento, estoque → **sim** (ver plano backend + Flyway)

---

## 7. Informações para o agente de **backend** (resumo)

- Base API dev: `http://localhost:8080`, prefixo `/api/v1`, quase sempre `X-Org-Id`
- Frontend dev: `http://localhost:5173`, proxy Vite `/api` → 8080
- Prioridade de contrato: completar **A3** se recepção precisar listar paciente no slot; expor **catálogo** e **procedimentos** já usados pelo plano A6
- Dúvidas de DTO: Swagger `http://localhost:8080/swagger-ui.html`

---

## 8. Changelog

| Data | Autor / nota | Alteração |
|------|----------------|-----------|
| 2026-04-01 | Plano inicial | Criação do documento; alinhamento ao plano operacional backend + snapshot do código frontend |
| 2026-04-01 | Integração Fase A (front) | `api.js` expandido; `OrgProvider` + barra de contexto; agenda via `by-range`/create/cancelar; perfil com GET/PUT paciente, notas e procedimentos; jornada POST paciente novo, anamnese com `roleUserId` do contexto, etapa 5 com catálogo e `finishJourney` → agenda + iniciar + finalizar procedimento |
| 2026-04-01 | API compromissos no slot | `agendamentosApi` (GET por slot, POST, DELETE); após `byRange` carrega compromissos por `agendaId`; UI lista paciente/procedimento; modal “Marcar atendimento”; 409 com mensagens em `agendaErrors.js` |

---

## 9. Referências neste repositório

- `docs/ARCHITECTURE.md` — visão geral (pode estar desatualizada em relação ao Spring; priorizar esta página para integração)
- `vite.config.js` — proxy e porta da API
- `src/services/api.js` — cliente Spring
