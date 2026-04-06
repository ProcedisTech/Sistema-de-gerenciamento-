/**
 * Cliente HTTP do frontend para o Spring Boot (mesma origem em dev via Vite: :5173 → proxy /api → :8080).
 *
 * Autenticação
 * - JWT em cookie HttpOnly nome `jwt`, definido pelo backend em POST /api/auth/login.
 * - Todas as chamadas usam credentials: 'include' para enviar o cookie.
 * - 401 em rotas protegidas = sessão ausente ou expirada (não indica que o servidor está offline).
 *
 * Rotas públicas (exemplos)
 * - POST /api/auth/login   body: { username, password }
 *
 * Autenticado (cookie + eventualmente Bearer se o backend passar a expor no JSON — hoje não usamos Bearer no client)
 * - GET /api/auth/me — 401 = usuário não logado
 * - POST /api/auth/logout
 *
 * Protegido
 * - /api/v1/** — enviar X-Org-Id quando needsOrg: true (padrão), alinhado ao UUID da org no banco (VITE_DEFAULT_ORG_ID).
 *
 * @see vite.config.js — proxy /api, reescrita de cookie para dev same-origin
 * @see src/config/apiEnv.js — VITE_DEFAULT_ORG_ID, VITE_ALT_ORG_ID
 */

import { DEFAULT_ORG_ID } from '../config/apiEnv';

let currentOrgId = DEFAULT_ORG_ID;

export function setOrgId(id) {
  currentOrgId = id || DEFAULT_ORG_ID;
}
export function getOrgId() {
  return currentOrgId;
}

/** Texto de erro estável para UI e logs (sempre com código HTTP). */
function buildApiErrorMessage(status, body, statusText) {
  const detail =
    (body && typeof body === 'object' && (body.message || body.error || body.detail)) || statusText || '';
  const trimmed = String(detail).trim();
  return trimmed ? `[HTTP ${status}] ${trimmed}` : `[HTTP ${status}]`;
}

async function request(path, { needsOrg = true, ...fetchOpts } = {}) {
  const headers = { 'Content-Type': 'application/json', ...fetchOpts.headers };
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;

  // Sempre enviar cookie HttpOnly `jwt` (same-origin :5173 + proxy /api). Nunca use 'omit' aqui.
  const res = await fetch(path, {
    ...fetchOpts,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    const body = await res.json().catch(() => ({}));
    const err = new Error(buildApiErrorMessage(res.status, body, res.statusText));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// ── Pacientes ──────────────────────────────────────────────

export const pacientesApi = {
  list: () => request('/api/v1/pacientes'),
  get: (id) => request(`/api/v1/pacientes/${id}`),
  search: (q) => request(`/api/v1/pacientes/search?q=${encodeURIComponent(q)}`),
  create: (data) => request('/api/v1/pacientes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/pacientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/pacientes/${id}`, { method: 'DELETE' }),
};

// ── Notas do paciente ──────────────────────────────────────

export const notasApi = {
  list: (pid) => request(`/api/v1/notas-paciente/paciente/${pid}`),
  create: (pid, data) =>
    request(`/api/v1/notas-paciente/paciente/${pid}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/notas-paciente/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/notas-paciente/${id}`, { method: 'DELETE' }),
};

// ── Equipe / usuários ──────────────────────────────────────

export const equipeApi = {
  list: () => request('/api/v1/equipe'),
  get: (id) => request(`/api/v1/equipe/${id}`),
};

export const usuariosApi = {
  list: () => request('/api/v1/usuarios'),
  get: (id) => request(`/api/v1/usuarios/${id}`),
  create: (data) => request('/api/v1/usuarios', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/usuarios/${id}`, { method: 'DELETE' }),
};

// ── Catálogo de procedimentos ───────────────────────────────

export const catalogosApi = {
  list: () => request('/api/v1/catalogos'),
  get: (id) => request(`/api/v1/catalogos/${id}`),
};

// ── Agenda ─────────────────────────────────────────────────

export const agendasApi = {
  get: (id) => request(`/api/v1/agendas/${id}`),
  byDate: (date) => request(`/api/v1/agendas/by-date?date=${date}`),
  byRange: (start, end) => request(`/api/v1/agendas/by-range?start=${start}&end=${end}`),
  byProfissional: (roleUserId, date) =>
    request(`/api/v1/agendas/by-profissional?roleUserId=${roleUserId}&date=${date}`),
  create: (data) => request('/api/v1/agendas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/agendas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelar: (id) => request(`/api/v1/agendas/${id}/cancelar`, { method: 'PATCH' }),
};

/**
 * Compromissos no slot (tb_agendamento): paciente + catálogo sem ProcedimentoFeito.
 * GET …/agendas/{agendaId}/agendamentos · POST /agendamentos · DELETE /agendamentos/{id}
 */
export const agendamentosApi = {
  listByAgenda: (agendaId) => request(`/api/v1/agendas/${agendaId}/agendamentos`),
  /** Mesmo `request()` que pacientes/agendas: credentials:'include', cookie jwt, X-Org-Id. URL relativa → :5173/api/v1/agendamentos com proxy. */
  create: (body) => request('/api/v1/agendamentos', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id) => request(`/api/v1/agendamentos/${id}`, { method: 'DELETE' }),
};

// ── Procedimentos ──────────────────────────────────────────

export const procedimentosApi = {
  byPaciente: (pid) => request(`/api/v1/procedimentos/paciente/${pid}`),
  create: (data) => request('/api/v1/procedimentos', { method: 'POST', body: JSON.stringify(data) }),
  iniciar: (data) => request('/api/v1/procedimentos/iniciar', { method: 'POST', body: JSON.stringify(data) }),
  patchStatus: (id, statusId) =>
    request(`/api/v1/procedimentos/${id}/status?statusId=${encodeURIComponent(statusId)}`, {
      method: 'PATCH',
    }),
  finalizar: (id) => request(`/api/v1/procedimentos/${id}/finalizar`, { method: 'PATCH' }),
};

// ── Estoque / Insumos ───────────────────────────────────────

export const estoqueApi = {
  listItens: () => request('/api/v1/estoque/itens'),
  getItem: (id) => request(`/api/v1/estoque/itens/${id}`),
  createItem: (data) =>
    request('/api/v1/estoque/itens', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id, data) =>
    request(`/api/v1/estoque/itens/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleItem: (id) =>
    request(`/api/v1/estoque/itens/${id}/toggle`, { method: 'PATCH' }),

  listLotes: (itemId) => request(`/api/v1/estoque/itens/${itemId}/lotes`),
  createLote: (itemId, data) =>
    request(`/api/v1/estoque/itens/${itemId}/lotes`, { method: 'POST', body: JSON.stringify(data) }),
  updateLote: (loteId, data) =>
    request(`/api/v1/estoque/lotes/${loteId}`, { method: 'PUT', body: JSON.stringify(data) }),

  listMovimentacoes: (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
    const qs = new URLSearchParams(Object.fromEntries(entries)).toString();
    return request(`/api/v1/estoque/movimentacoes${qs ? `?${qs}` : ''}`);
  },
  createMovimentacao: (data) =>
    request('/api/v1/estoque/movimentacoes', { method: 'POST', body: JSON.stringify(data) }),

  listCatalogoProcedimentoItens: (catalogoId) =>
    request(`/api/v1/estoque/catalogo-procedimento/${catalogoId}/itens`),
};

// ── Dimensões (sem X-Org-Id) ───────────────────────────────

export const dimensoesApi = {
  estadosCivis: () => request('/api/v1/dimensoes/estados-civis', { needsOrg: false }),
  especialidades: () => request('/api/v1/dimensoes/especialidades', { needsOrg: false }),
  tiposResposta: () => request('/api/v1/dimensoes/tipos-resposta', { needsOrg: false }),
  roles: () => request('/api/v1/dimensoes/roles', { needsOrg: false }),
  statusProcedimento: () => request('/api/v1/dimensoes/status-procedimento', { needsOrg: false }),
  statusAgenda: () => request('/api/v1/dimensoes/status-agenda', { needsOrg: false }),
  statusAnamnese: () => request('/api/v1/dimensoes/status-anamnese', { needsOrg: false }),
  periodosDia: () => request('/api/v1/dimensoes/periodos-dia', { needsOrg: false }),
};

// ── Anamnese ───────────────────────────────────────────────

export const anamneseApi = {
  listCategorias: () => request('/api/v1/anamnese/categorias', { needsOrg: false }),
  createCategoria: (data) =>
    request('/api/v1/anamnese/categorias', { method: 'POST', body: JSON.stringify(data), needsOrg: false }),
  updateCategoria: (id, { nome }) =>
    request(`/api/v1/anamnese/categorias/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ nome }),
      needsOrg: false,
    }),
  deleteCategoria: (id) =>
    request(`/api/v1/anamnese/categorias/${id}`, { method: 'DELETE', needsOrg: false }),

  listHabitos: (catId) =>
    request(`/api/v1/anamnese/habitos?categoriaId=${catId}`, { needsOrg: false }),
  listAllHabitos: async () => {
    const cats = await request('/api/v1/anamnese/categorias', { needsOrg: false });
    if (!Array.isArray(cats) || cats.length === 0) return [];
    const results = await Promise.all(
      cats.map((c) =>
        request(`/api/v1/anamnese/habitos?categoriaId=${c.id}`, { needsOrg: false }).catch(() => [])
      )
    );
    return results.flat();
  },
  createHabito: (data) =>
    request('/api/v1/anamnese/habitos', { method: 'POST', body: JSON.stringify(data), needsOrg: false }),
  /** Body: categoriaId, tipoRespostaId, descricao; opcional alternativas (sync quando enviado). */
  updateHabito: (id, body) =>
    request(`/api/v1/anamnese/habitos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      needsOrg: false,
    }),
  deleteHabito: (id) =>
    request(`/api/v1/anamnese/habitos/${id}`, { method: 'DELETE', needsOrg: false }),
  reordenarAlternativas: (habitoId, ordens) =>
    request(`/api/v1/anamnese/habitos/${habitoId}/alternativas/reordenar`, {
      method: 'PATCH',
      body: JSON.stringify(ordens),
      needsOrg: false,
    }),

  addAlternativas: (habitoId, data) =>
    request(`/api/v1/anamnese/habitos/${habitoId}/alternativas`, {
      method: 'POST',
      body: JSON.stringify(data),
      needsOrg: false,
    }),

  listFichas: () => request('/api/v1/anamnese/fichas'),
  getFicha: (id) => request(`/api/v1/anamnese/fichas/${id}`),
  createFicha: (data) => request('/api/v1/anamnese/fichas', { method: 'POST', body: JSON.stringify(data) }),
  updateFicha: (id, data) => request(`/api/v1/anamnese/fichas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeFicha: (id) => request(`/api/v1/anamnese/fichas/${id}`, { method: 'DELETE' }),

  listPaciente: (pid) => request(`/api/v1/anamnese/paciente/${pid}`),
  getPaciente: (pid, aid) => request(`/api/v1/anamnese/paciente/${pid}/${aid}`),
  createPaciente: (pid, roleId, data) =>
    request(`/api/v1/anamnese/paciente/${pid}?roleUserId=${roleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  finalizarPaciente: (pid, aid) =>
    request(`/api/v1/anamnese/paciente/${pid}/${aid}/finalizar`, { method: 'PATCH' }),
};
