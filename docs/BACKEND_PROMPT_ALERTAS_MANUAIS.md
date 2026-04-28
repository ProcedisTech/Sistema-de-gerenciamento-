# Backend: CRUD de alertas manuais por paciente

Use este texto para implementar ou alinhar o contrato na API Spring (`plataforma-procedimentos`).

## Contexto

No frontend do módulo de pacientes já existem **alertas automáticos** vindos de respostas da anamnese. Esse fluxo **não deve ser alterado** em endpoints nem em semântica de dados.

Este documento cobre apenas **alertas manuais** — cadastro explícito no perfil do paciente, CRUD próprio.

## Requisitos funcionais

1. Alertas derivados da anamnese permanecem **somente leitura** no front (somente frontend + `anamneseApi`; não são CRUD aqui).
2. Alertas manuais podem ser **criados, atualizados e excluídos**.
3. Campos do alerta manual: **titulo** (obrigatório), **descricao** (obrigatório).
4. Cada alerta manual está vinculado a **`pacienteId`** e à **organização** (mesma regra de cabeçalho `X-Org-Id` já usada no sistema).
5. Quando possível, retornar **timestamps** e **metadados de autoria** (`createdAt`, `updatedAt`, `createdBy`).

## Endpoints solicitados (REST)

| Método | Caminho |
|--------|---------|
| `GET` | `/api/v1/pacientes/{pacienteId}/alertas-manuais` |
| `POST` | `/api/v1/pacientes/{pacienteId}/alertas-manuais` |
| `PUT` | `/api/v1/pacientes/{pacienteId}/alertas-manuais/{alertaId}` |
| `DELETE` | `/api/v1/pacientes/{pacienteId}/alertas-manuais/{alertaId}` |

**POST / PUT — body JSON**

```json
{
  "titulo": "string",
  "descricao": "string"
}
```

## Contrato de resposta (sugestão)

Itens retornados por `GET` (ou corpo de `POST`/`PUT`):

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | string ou number | UUID ou long aceito pelo front (`normalizeAlertaManualItem` em `PatientProfileView.jsx`). |
| `pacienteId` | string ou number | Opcional mas útil. |
| `titulo` | string | |
| `descricao` | string | |
| `origem` | `"manual"` | Opcional; o front compõe separado dos alertas de anamnese. |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |
| `createdBy` | string \| null | Nome ou id do criador |

O frontend aceita `GET` com **lista pura**, ou envelope com `content` / `items` / `data` / `_embedded.alertas`, etc.

## Regras de não interferência

- **Não** alterar endpoints nem comportamento dos dados de **anamnese** existentes por causa deste recurso.
- **Não** mesclar no backend os alertas manuais com os de anamnese: o frontend faz **composição visual por origem** (card “Alertas manuais” × “Alertas da anamnese”).
- Garantir **autorização** por organização e usuário autenticado (`jwt` cookie + Bearer, conforme segurança já usada nos `/api/v1/*`).

## Referência no frontend

- Cliente: `pacienteAlertasManuaisApi` em `src/services/api.js`.
- UI: `src/components/patients/PatientProfileView.jsx` — carregamento em efeito **separado** do fluxo de `anamneseApi.listPaciente`.

Se o recurso ainda não existir no servidor, o front trata `404` na listagem como lista vazia (dev), mas o CRUD espera os endpoints acima em produção.
