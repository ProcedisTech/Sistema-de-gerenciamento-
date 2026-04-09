/**
 * Cliente HTTP do frontend para o Spring Boot (mesma origem em dev via Vite: :5173 → proxy /api → :8080).
 *
 * Autenticação
 * - Cookie HttpOnly `jwt` (POST /api/auth/login) + credentials: 'include' em todas as chamadas.
 * - Se o JSON de login ou GET /api/auth/me trouxer `accessToken` (LoginResponseDTO / MeResponseDTO), enviamos também
 *   Authorization: Bearer … (sessionStorage + memória) — necessário quando o filtro JWT do Spring prioriza Bearer.
 *
 * Rotas públicas (exemplos)
 * - POST /api/auth/login   body: { username, password }
 *
 * Autenticado
 * - GET /api/auth/me — 401 = usuário não logado
 * - POST /api/auth/logout
 *
 * Protegido
 * - /api/v1/** — X-Org-Id quando needsOrg: true + Bearer quando houver accessToken guardado.
 * - Binários (foto de perfil, galeria/arquivo): requestBlob com os mesmos headers.
 *
 * @see vite.config.js — proxy /api, reescrita de cookie para dev same-origin
 * @see src/config/apiEnv.js — VITE_DEFAULT_ORG_ID, VITE_ALT_ORG_ID
 */

import { DEFAULT_ORG_ID, resolveApiUrl } from '../config/apiEnv';

let currentOrgId = DEFAULT_ORG_ID;

export function setOrgId(id) {
  currentOrgId = id || DEFAULT_ORG_ID;
}
export function getOrgId() {
  return currentOrgId;
}

const ACCESS_TOKEN_LS = 'procedi_access_token';

function readStoredAccessToken() {
  try {
    const v = sessionStorage.getItem(ACCESS_TOKEN_LS);
    return v && String(v).trim() ? String(v).trim() : null;
  } catch {
    return null;
  }
}

let accessTokenMemory = readStoredAccessToken();

/** Grava token devolvido no login/register/me; limpar no logout. Persiste na sessão da aba (F5 mantém). */
export function setAccessToken(token) {
  const t =
    token != null && typeof token === 'string' && token.trim() ? String(token).trim() : null;
  accessTokenMemory = t;
  try {
    if (t) sessionStorage.setItem(ACCESS_TOKEN_LS, t);
    else sessionStorage.removeItem(ACCESS_TOKEN_LS);
  } catch {
    /* ignore */
  }
}

export function getAccessToken() {
  return accessTokenMemory;
}

function bearerAuthorizationHeader() {
  const t = accessTokenMemory;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function withAuthHeaders(base) {
  const h = base && typeof base === 'object' ? { ...base } : {};
  Object.assign(h, bearerAuthorizationHeader());
  return h;
}

/**
 * Headers para `fetch` fora deste módulo (ex.: logout, journey photos).
 * @param {{ needsOrg?: boolean }} opts
 */
export function authHeadersForFetch({ needsOrg = true } = {}) {
  const h = bearerAuthorizationHeader();
  if (needsOrg && currentOrgId) h['X-Org-Id'] = currentOrgId;
  return h;
}

/**
 * Dispara `auth:expired` (logout) apenas se GET /api/auth/me também retornar 401 — ou seja,
 * a sessão realmente expirou. Se /me responder 200, o 401 é de negócio/org e não desloga.
 * Usa dynamic import para evitar dependência circular estática com authMeProbe.js.
 */
async function dispatchAuthExpiredIfSessionReallyGone() {
  try {
    const { invalidateAuthMeCache, fetchAuthMeSnapshot } = await import('../utils/authMeProbe.js');
    invalidateAuthMeCache();
    const snap = await fetchAuthMeSnapshot();
    if (snap.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
  } catch {
    // Falha ao verificar /me: disparar logout por segurança
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
}

async function requestDelete(path, { needsOrg = true } = {}) {
  const headers = withAuthHeaders({});
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;
  const url = path.startsWith('http') ? path : resolveApiUrl(path);
  const res = await fetch(url, { method: 'DELETE', credentials: 'include', headers });
  if (res.status === 204) return null;
  if (!res.ok) {
    if (res.status === 401) {
      await dispatchAuthExpiredIfSessionReallyGone();
    }
    const body = await res.json().catch(() => ({}));
    const err = new Error(buildApiErrorMessage(res.status, body, res.statusText));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Texto de erro estável para UI e logs (sempre com código HTTP). */
function buildApiErrorMessage(status, body, statusText) {
  const detail =
    (body && typeof body === 'object' && (body.message || body.error || body.detail)) || statusText || '';
  const trimmed = String(detail).trim();
  return trimmed ? `[HTTP ${status}] ${trimmed}` : `[HTTP ${status}]`;
}

/**
 * Mensagem legível a partir do JSON de erro (Spring / ProblemDetail), sem prefixo `[HTTP n]`.
 * Ordem: `message`, `detail`, `error` apenas se for string.
 * @param {{ body?: Record<string, unknown> } | null | undefined} err
 * @returns {string}
 */
export function getApiErrorDetail(err) {
  const body = err && typeof err === 'object' && err.body && typeof err.body === 'object' ? err.body : null;
  if (!body) return '';
  const msg = body.message != null ? String(body.message).trim() : '';
  if (msg) return msg;
  const det = body.detail != null ? String(body.detail).trim() : '';
  if (det) return det;
  if (typeof body.error === 'string' && body.error.trim()) return body.error.trim();
  return '';
}

async function request(path, { needsOrg = true, ...fetchOpts } = {}) {
  const headers = withAuthHeaders({ 'Content-Type': 'application/json', ...fetchOpts.headers });
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;

  const url = path.startsWith('http') ? path : resolveApiUrl(path);

  // Sempre enviar cookie HttpOnly `jwt` (same-origin :5173 + proxy /api). Nunca use 'omit' aqui.
  const res = await fetch(url, {
    ...fetchOpts,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    if (res.status === 401) {
      await dispatchAuthExpiredIfSessionReallyGone();
    }
    const body = await res.json().catch(() => ({}));
    const err = new Error(buildApiErrorMessage(res.status, body, res.statusText));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

/** POST multipart (FormData): não define Content-Type para o browser enviar boundary. */
async function requestForm(path, { needsOrg = true, method = 'POST', body, ...rest } = {}) {
  const headers = withAuthHeaders({ ...rest.headers });
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;

  const url = path.startsWith('http') ? path : resolveApiUrl(path);

  const res = await fetch(url, {
    ...rest,
    method,
    body,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    if (res.status === 401) {
      await dispatchAuthExpiredIfSessionReallyGone();
    }
    const resBody = await res.json().catch(() => ({}));
    const err = new Error(buildApiErrorMessage(res.status, resBody, res.statusText));
    err.status = res.status;
    err.body = resBody;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  return null;
}

/** Deduplica GETs binários simultâneos (Strict Mode / várias miniaturas) — mesma URL + org → uma requisição. */
const blobInflight = new Map();

/** GET binário (ex.: foto de perfil) com cookie + Bearer + X-Org-Id — não usar <img src="/api/..."> em rotas que exigem org. */
async function requestBlob(path, { needsOrg = true } = {}) {
  const headers = withAuthHeaders({});
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;
  const url = path.startsWith('http') ? path : resolveApiUrl(path);
  const tokenMark = accessTokenMemory ? 'b' : 'c';
  const dedupeKey = `${needsOrg ? String(currentOrgId || '') : '_'}|${tokenMark}|${url}`;
  const existing = blobInflight.get(dedupeKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(url, { method: 'GET', credentials: 'include', headers });
      if (!res.ok) {
        // Não disparar auth:expired aqui (ver comentário anterior no histórico).
        const body = await res.json().catch(() => ({}));
        if (import.meta.env.DEV && res.status === 401) {
          console.warn(
            '[api] requestBlob 401 — envie Cookie jwt e/ou Authorization Bearer (accessToken do login) + X-Org-Id. ' +
              'Org:',
            currentOrgId || '(vazio)',
            ' Bearer:',
            accessTokenMemory ? '(presente)' : '(ausente)',
            '\n URL:',
            url,
          );
        }
        const err = new Error(buildApiErrorMessage(res.status, body, res.statusText));
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return res.blob();
    } finally {
      blobInflight.delete(dedupeKey);
    }
  })();

  blobInflight.set(dedupeKey, promise);
  return promise;
}

// ── Pacientes ──────────────────────────────────────────────

export const pacientesApi = {
  list: () => request('/api/v1/pacientes'),
  get: (id) => request(`/api/v1/pacientes/${id}`),
  search: (q) => request(`/api/v1/pacientes/search?q=${encodeURIComponent(q)}`),
  create: (data) => request('/api/v1/pacientes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/pacientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/pacientes/${id}`, { method: 'DELETE' }),
  /** Multipart `file` — backend normaliza para JPEG 480px; tipos jpeg/png/webp, limite ~5 MiB. */
  uploadFotoPerfil: (pacienteId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return requestForm(`/api/v1/pacientes/${pacienteId}/foto-perfil`, { method: 'POST', body: fd });
  },
  removeFotoPerfil: (pacienteId) =>
    requestDelete(`/api/v1/pacientes/${pacienteId}/foto-perfil`),
  /**
   * GET foto de perfil com os mesmos headers que o restante da API (jwt + X-Org-Id).
   * @param {string} pacienteId UUID
   * @param {string} [fotoPerfilUrlHint] path (/api/v1/.../foto-perfil?v=…) ou URL absoluta do DTO
   */
  getFotoPerfilBlob: (pacienteId, fotoPerfilUrlHint) => {
    const hint = typeof fotoPerfilUrlHint === 'string' ? fotoPerfilUrlHint.trim() : '';
    let path;
    if (hint.startsWith('http://') || hint.startsWith('https://')) {
      path = hint;
    } else if (hint.startsWith('/')) {
      path = hint;
    } else {
      path = `/api/v1/pacientes/${pacienteId}/foto-perfil`;
    }
    return requestBlob(path, { needsOrg: true });
  },
};

/**
 * Galeria de evolução — PacienteController (jwt cookie + X-Org-Id, mesmo padrão que /pacientes/**).
 *
 * GET    /api/v1/pacientes/{id}/galeria  → { fotos: [...] }; query opcional: dataDesde, dataAte,
 *        catalogoProcedimentoSaudeId, procedimentoFeitoId (datas YYYY-MM-DD).
 * POST   /api/v1/pacientes/{id}/galeria  → multipart file + opcionais (dataReferencia, legenda, …)
 * DELETE /api/v1/pacientes/{id}/galeria/{fotoId} → 204
 * Arquivo: GET …/galeria/{fotoId}/arquivo?v=… — usar fetch+blob (X-Org-Id), não <img src> direto se a rota exigir org.
 *
 * Normalização: src/utils/pacienteGaleria.js
 */
function buildGaleriaListPath(pacienteId, filters = {}) {
  const params = new URLSearchParams();
  const f = filters && typeof filters === 'object' ? filters : {};
  if (f.dataDesde) params.set('dataDesde', String(f.dataDesde).trim());
  if (f.dataAte) params.set('dataAte', String(f.dataAte).trim());
  if (f.catalogoProcedimentoSaudeId) params.set('catalogoProcedimentoSaudeId', String(f.catalogoProcedimentoSaudeId).trim());
  if (f.procedimentoFeitoId) params.set('procedimentoFeitoId', String(f.procedimentoFeitoId).trim());
  const q = params.toString();
  return `/api/v1/pacientes/${pacienteId}/galeria${q ? `?${q}` : ''}`;
}

export const pacientesGaleriaApi = {
  list: (pacienteId, filters) => request(buildGaleriaListPath(pacienteId, filters)),
  /**
   * Binário da foto (cookie + X-Org-Id). `pathOrUrl`: path /api/v1/.../arquivo?… ou URL absoluta.
   */
  fetchArquivoBlob: (pathOrUrl) => {
    const raw = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : '';
    if (!raw) return Promise.reject(new Error('URL da imagem vazia.'));
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return requestBlob(raw, { needsOrg: true });
    }
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return requestBlob(path, { needsOrg: true });
  },
  upload: (pacienteId, file, options = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    const {
      roleUserId,
      dataReferencia,
      catalogoProcedimentoSaudeId,
      procedimentoFeitoId,
      legenda,
    } = options;
    if (roleUserId && /^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
      fd.append('roleUserId', String(roleUserId));
    }
    if (dataReferencia != null && String(dataReferencia).trim()) {
      fd.append('dataReferencia', String(dataReferencia).trim());
    }
    if (catalogoProcedimentoSaudeId != null && String(catalogoProcedimentoSaudeId).trim()) {
      fd.append('catalogoProcedimentoSaudeId', String(catalogoProcedimentoSaudeId).trim());
    }
    if (procedimentoFeitoId != null && String(procedimentoFeitoId).trim()) {
      fd.append('procedimentoFeitoId', String(procedimentoFeitoId).trim());
    }
    if (legenda != null && String(legenda).trim()) {
      fd.append('legenda', String(legenda).trim());
    }
    return requestForm(`/api/v1/pacientes/${pacienteId}/galeria`, { method: 'POST', body: fd });
  },
  remove: (pacienteId, fotoId) =>
    requestDelete(`/api/v1/pacientes/${pacienteId}/galeria/${encodeURIComponent(fotoId)}`),
};

export const pacientesDocumentosApi = {
  list: (pacienteId) =>
    request(`/api/v1/pacientes/${pacienteId}/documentos`).then((data) => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.documentos)) return data.documentos;
      if (Array.isArray(data?.itens)) return data.itens;
      return [];
    }),
  upload: (pacienteId, file, options = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    const { roleUserId } = options || {};
    if (roleUserId && /^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
      fd.append('roleUserId', String(roleUserId));
    }
    return requestForm(`/api/v1/pacientes/${pacienteId}/documentos`, { method: 'POST', body: fd });
  },
  fetchArquivoBlob: (pacienteId, documentoId) =>
    requestBlob(`/api/v1/pacientes/${pacienteId}/documentos/${documentoId}/arquivo`, { needsOrg: true }),
  remove: (pacienteId, documentoId) =>
    requestDelete(`/api/v1/pacientes/${pacienteId}/documentos/${encodeURIComponent(documentoId)}`),
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
// Categorias/hábitos: mesmo padrão que fichas (X-Org-Id + cookie/Bearer). Omitir needsOrg enviava só GET “ok” e
// POST/PUT/DELETE sem X-Org-Id → 401 em muitos setups Spring multi-tenant.

export const anamneseApi = {
  listCategorias: () => request('/api/v1/anamnese/categorias'),
  createCategoria: (data) =>
    request('/api/v1/anamnese/categorias', { method: 'POST', body: JSON.stringify(data) }),
  updateCategoria: (id, { nome }) =>
    request(`/api/v1/anamnese/categorias/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ nome }),
    }),
  deleteCategoria: (id) =>
    request(`/api/v1/anamnese/categorias/${id}`, { method: 'DELETE' }),

  listHabitos: (catId) =>
    request(`/api/v1/anamnese/habitos?categoriaId=${catId}`),
  listAllHabitos: async () => {
    const cats = await request('/api/v1/anamnese/categorias');
    if (!Array.isArray(cats) || cats.length === 0) return [];
    const results = await Promise.all(
      cats.map((c) =>
        request(`/api/v1/anamnese/habitos?categoriaId=${c.id}`).catch(() => [])
      )
    );
    return results.flat();
  },
  createHabito: (data) =>
    request('/api/v1/anamnese/habitos', { method: 'POST', body: JSON.stringify(data) }),
  /** Body: categoriaId, tipoRespostaId, descricao; opcional alternativas (sync quando enviado). */
  updateHabito: (id, body) =>
    request(`/api/v1/anamnese/habitos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteHabito: (id) =>
    request(`/api/v1/anamnese/habitos/${id}`, { method: 'DELETE' }),
  reordenarAlternativas: (habitoId, ordens) =>
    request(`/api/v1/anamnese/habitos/${habitoId}/alternativas/reordenar`, {
      method: 'PATCH',
      body: JSON.stringify(ordens),
    }),

  addAlternativas: (habitoId, data) =>
    request(`/api/v1/anamnese/habitos/${habitoId}/alternativas`, {
      method: 'POST',
      body: JSON.stringify(data),
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
