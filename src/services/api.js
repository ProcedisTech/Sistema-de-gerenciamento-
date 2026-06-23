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

import { STATUS_PROCEDIMENTO_FINALIZADO_ID } from '../constants/statusProcedimento.js';
import { DEFAULT_ORG_ID, resolveApiUrl, shouldAttachApiAuthToFetchUrl } from '../config/apiEnv';
import { supabase } from '../lib/supabaseClient';

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
async function dispatchAuthExpiredIfSessionReallyGone(failedUrl) {
  console.warn(`[api] A requisição para ${failedUrl} retornou 401. Como a sessão é controlada pelo Supabase, ignorando logout forçado.`);
}

async function requestDelete(path, { needsOrg = true } = {}) {
  const headers = withAuthHeaders({});
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;
  const url = path.startsWith('http') ? path : resolveApiUrl(path);
  const res = await fetch(url, { method: 'DELETE', credentials: 'include', headers });
  if (res.status === 204) return null;
  if (!res.ok) {
    if (res.status === 401) {
      console.warn(`[api] DELETE ${url} retornou 401.`);
      await dispatchAuthExpiredIfSessionReallyGone(url);
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

/**
 * Bean Validation (Spring): `errors: [{ defaultMessage, field, ... }]`.
 * @param {Record<string, unknown> | null | undefined} body
 * @returns {string}
 */
function getValidationErrorMessagesText(body) {
  if (!body || typeof body !== 'object') return '';
  const errors = body.errors;
  if (!Array.isArray(errors) || errors.length === 0) return '';
  const parts = [];
  const seen = new Set();
  for (const item of errors) {
    if (!item || typeof item !== 'object') continue;
    const dm = item.defaultMessage != null ? String(item.defaultMessage).trim() : '';
    if (dm && !seen.has(dm)) {
      seen.add(dm);
      parts.push(dm);
    }
  }
  return parts.length ? parts.join('; ') : '';
}

/** @param {Record<string, unknown> | null | undefined} body @returns {string} */
function getCpfFieldMessageFromBody(body) {
  if (!body || typeof body !== 'object') return '';
  const errors = body.errors;
  if (!Array.isArray(errors)) return '';
  for (const item of errors) {
    if (!item || typeof item !== 'object') continue;
    const f = item.field != null ? String(item.field) : '';
    if (!f) continue;
    if (f.toLowerCase() === 'cpf' || f.toLowerCase().endsWith('.cpf') || /\.cpf/i.test(f)) {
      const dm = item.defaultMessage != null ? String(item.defaultMessage).trim() : '';
      if (dm) return dm;
    }
  }
  return '';
}

const PACIENTE_CPF_DUPLICADO_USUARIO =
  'Este CPF já está cadastrado nesta clínica.';

/** Texto de erro estável para UI e logs (sempre com código HTTP). */
function buildApiErrorMessage(status, body, statusText) {
  const validationText = getValidationErrorMessagesText(body);
  if (validationText) return `[HTTP ${status}] ${validationText}`;
  const detail =
    (body && typeof body === 'object' && (body.message || body.error || body.detail)) || statusText || '';
  const trimmed = String(detail).trim();
  return trimmed ? `[HTTP ${status}] ${trimmed}` : `[HTTP ${status}]`;
}

/**
 * Mensagem legível a partir do JSON de erro (Spring / ProblemDetail), sem prefixo `[HTTP n]`.
 * Prioridade: Bean Validation `errors[].defaultMessage`, depois `message`, `detail`, `error` (string).
 * @param {{ body?: Record<string, unknown> } | null | undefined} err
 * @returns {string}
 */
export function getApiErrorDetail(err) {
  const body = err && typeof err === 'object' && err.body && typeof err.body === 'object' ? err.body : null;
  if (!body) return '';
  const fromValidation = getValidationErrorMessagesText(body);
  if (fromValidation) return fromValidation;
  const msg = body.message != null ? String(body.message).trim() : '';
  if (msg) return msg;
  const det = body.detail != null ? String(body.detail).trim() : '';
  if (det) return det;
  if (typeof body.error === 'string' && body.error.trim()) return body.error.trim();
  return '';
}

/**
 * Mensagem para toast.
 *
 * Tradução por status (BUG #14): traduzimos status pra texto legível
 * antes de cair no body do backend, porque "Erro ao carregar X" não diz
 * ao profissional se é sessão expirada, internet caída ou backend fora.
 *
 * Ordem:
 *   1. status conhecido → frase amigável fixa (401/5xx/network).
 *   2. corpo Spring (`getApiErrorDetail`) — validação Bean / ProblemDetail.
 *   3. Axios-shape (`err.response.data.message`).
 *   4. `Error.message` cru.
 *   5. fallback do caller (ou genérico).
 *
 * @param {unknown} err
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorToastMessage(err, fallback) {
  const status = err != null && typeof err === 'object' ? err.status : undefined;

  if (status === 401) return 'Sua sessão expirou. Faça login novamente.';
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return 'Erro do servidor. Tente novamente em alguns minutos.';
  }

  const rawMessage =
    err != null && typeof err === 'object' && typeof err.message === 'string' ? err.message.trim() : '';
  if (status == null && /failed to fetch|network ?error|load failed/i.test(rawMessage)) {
    return 'Sem conexão com a internet. Verifique e tente novamente.';
  }

  const fromApi = err != null && typeof err === 'object' ? getApiErrorDetail(err) : '';
  if (fromApi) return fromApi;
  const ax =
    err != null && typeof err === 'object' && err.response && typeof err.response === 'object'
      ? err.response.data
      : null;
  const axMsg =
    ax && typeof ax === 'object' && ax.message != null ? String(ax.message).trim() : '';
  if (axMsg) return axMsg;
  if (rawMessage) return rawMessage;
  return fallback || 'Não foi possível carregar. Tente recarregar a página.';
}

/**
 * Feedback de UI para POST de paciente (400 validação, 409 CPF duplicado).
 * @param {{ status?: number, body?: Record<string, unknown> } | null | undefined} err
 * @returns {{ banner: string, cpfField: string, highlightCpf: boolean }}
 */
export function getPacienteCreateErrorFeedback(err) {
  const status = err?.status;
  const fromBody = err && typeof err === 'object' && err.body && typeof err.body === 'object' ? err.body : null;
  const detailAll = getApiErrorDetail(err);

  if (status === 409) {
    const backendHint =
      detailAll && /cpf|já exist|duplic|organiza|paciente/i.test(detailAll) ? detailAll : '';
    const banner = backendHint || PACIENTE_CPF_DUPLICADO_USUARIO;
    return { banner, cpfField: banner, highlightCpf: true };
  }

  if (status === 400) {
    const cpfField =
      getCpfFieldMessageFromBody(fromBody) || (detailAll && /cpf/i.test(detailAll) ? detailAll : '');
    const banner = detailAll || 'Não foi possível validar os dados enviados.';
    const highlightCpf = Boolean(cpfField) || (Boolean(detailAll) && /cpf/i.test(detailAll));
    return { banner, cpfField, highlightCpf };
  }

  const banner = getApiErrorDetail(err) || 'Erro ao cadastrar paciente.';
  return { banner, cpfField: '', highlightCpf: false };
}

async function ensureValidToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      setAccessToken(session.access_token);
    }
  } catch {
    /* ignore */
  }
}

async function request(path, { needsOrg = true, ...fetchOpts } = {}) {
  await ensureValidToken();
  const headers = withAuthHeaders({ 'Content-Type': 'application/json', ...fetchOpts.headers });
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;


  const url = path.startsWith('http') ? path : resolveApiUrl(path);

  console.log(`[api] about to fetch ${url}. Headers:`, headers);

  // Sempre enviar cookie HttpOnly `jwt` (same-origin :5173 + proxy /api). Nunca use 'omit' aqui.
  const res = await fetch(url, {
    ...fetchOpts,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    if (res.status === 401) {
      console.warn(`[api] ${fetchOpts.method || 'GET'} ${url} retornou 401.`);
      await dispatchAuthExpiredIfSessionReallyGone(url);
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
  await ensureValidToken();
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
      console.warn(`[api] POST/form ${url} retornou 401.`);
      await dispatchAuthExpiredIfSessionReallyGone(url);
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

/**
 * GET binário: rotas /api com cookie + Bearer + X-Org-Id.
 * URL absoluta em outro host (presigned R2 etc.) — sem auth (assinatura na query string).
 */
async function requestBlob(path, { needsOrg = true } = {}) {
  await ensureValidToken();
  const url = path.startsWith('http') ? path : resolveApiUrl(path);
  const attachAuth = shouldAttachApiAuthToFetchUrl(url);
  let headers = {};
  let credentials = 'omit';
  if (attachAuth) {
    headers = withAuthHeaders({});
    if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;
    credentials = 'include';
  }
  const tokenMark = accessTokenMemory ? 'b' : 'c';
  const dedupeKey = attachAuth
    ? `${needsOrg ? String(currentOrgId || '') : '_'}|${tokenMark}|${url}`
    : `ext|${url}`;
  const existing = blobInflight.get(dedupeKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(url, { method: 'GET', credentials, headers });
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

/**
 * Requisição pública: NÃO envia Authorization, NÃO envia X-Org-Id, NÃO envia cookie de sessão.
 * Usado pelas rotas /c/** (página pública de confirmação WhatsApp do paciente).
 */
async function requestPublic(path, fetchOpts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(fetchOpts.headers || {}) };
  const url = path.startsWith('http') ? path : resolveApiUrl(path);
  const res = await fetch(url, {
    ...fetchOpts,
    headers,
    credentials: 'omit',
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(buildApiErrorMessage(res.status, body, res.statusText));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// ── Pacientes ──────────────────────────────────────────────

/**
 * Normaliza resposta Spring `Page` ou array legado para UI de listagem.
 * @param {unknown} raw
 * @returns {{
 *   content: unknown[],
 *   first: boolean,
 *   last: boolean,
 *   totalPages: number,
 *   number: number,
 *   size: number,
 *   totalElements: number,
 * }}
 */
export function normalizePacientesPage(raw) {
  if (Array.isArray(raw)) {
    const n = raw.length;
    return {
      content: raw,
      first: true,
      last: true,
      totalPages: n > 0 ? 1 : 0,
      number: 0,
      size: n,
      totalElements: n,
    };
  }
  if (!raw || typeof raw !== 'object') {
    return {
      content: [],
      first: true,
      last: true,
      totalPages: 0,
      number: 0,
      size: 0,
      totalElements: 0,
    };
  }
  const content = Array.isArray(raw.content) ? raw.content : [];
  const totalPages =
    typeof raw.totalPages === 'number' && raw.totalPages >= 0 ? raw.totalPages : content.length ? 1 : 0;
  const number = typeof raw.number === 'number' && raw.number >= 0 ? raw.number : 0;
  const size = typeof raw.size === 'number' && raw.size >= 0 ? raw.size : content.length;
  const totalElements =
    typeof raw.totalElements === 'number' && raw.totalElements >= 0 ? raw.totalElements : content.length;
  return {
    content,
    first: Boolean(raw.first),
    last: Boolean(raw.last),
    totalPages,
    number,
    size,
    totalElements,
  };
}

/** Mapa ordenação UI → parâmetro `sort` da API (exceto `birthday_asc`, que usa `order`). */
export function patientListSortToApiParam(sortBy) {
  const v = sortBy != null ? String(sortBy).trim() : '';
  switch (v) {
    case 'nome-desc':
      return 'nome_desc';
    case 'idade-asc':
      return 'idade_asc';
    case 'idade-desc':
      return 'idade_desc';
    case 'visita-desc':
      return 'visita_desc';
    case 'visita-asc':
      return 'visita_asc';
    case 'nome-asc':
    default:
      return 'nome_asc';
  }
}

function buildPacientesListQuery(opts = {}) {
  const params = new URLSearchParams();
  params.set('page', String(opts.page != null ? opts.page : 0));
  params.set('size', String(opts.size != null ? opts.size : 20));
  const order = opts.order != null && String(opts.order).trim() !== '' ? String(opts.order).trim() : '';
  if (order) params.set('order', order);
  const sort =
    !order && opts.sort != null && String(opts.sort).trim() !== '' ? String(opts.sort).trim() : '';
  if (sort) params.set('sort', sort);
  // Filtros server-side v1
  const VALID_STATUS_PLANO = ['sem_plano', 'plano_ativo'];
  if (opts.statusPlano != null && VALID_STATUS_PLANO.includes(String(opts.statusPlano))) {
    params.set('statusPlano', String(opts.statusPlano));
  }
  if (opts.anamneseDesatualizada === true) params.set('anamneseDesatualizada', 'true');
  if (opts.semRetorno === true) params.set('semRetorno', 'true');
  if (opts.ehNovo === true) params.set('ehNovo', 'true');
  if (opts.ehAniversariante === true) params.set('ehAniversariante', 'true');
  if (opts.ehAniversarianteMes === true) params.set('ehAniversarianteMes', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const pacientesApi = {
  /**
   * Lista paginada (Spring Page). Mantém fallback se o backend ainda devolver array.
   * Texto de busca: usar `search()` — esta rota não filtra por `q` no servidor atual.
   * @param {{
   *   page?: number,
   *   size?: number,
   *   order?: string,
   *   sort?: string,
   *   statusPlano?: 'sem_plano' | 'plano_ativo',
   *   anamneseDesatualizada?: boolean,
   *   semRetorno?: boolean,
   *   ehNovo?: boolean,
   *   ehAniversariante?: boolean,
   *   ehAniversarianteMes?: boolean,
   * }} [opts]
   */
  list: async (opts = {}) => {
    const qs = buildPacientesListQuery(opts);
    const raw = await request(`/api/v1/pacientes${qs}`);
    return normalizePacientesPage(raw);
  },
  get: (id) => request(`/api/v1/pacientes/${id}`),
  /** Busca textual (nome | CPF | telefone). Normaliza como `list` — array ou Page. */
  search: async (q) => {
    const raw = await request(`/api/v1/pacientes/search?q=${encodeURIComponent(q ?? '')}`);
    return normalizePacientesPage(raw);
  },
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
  /** Body: `{ senha, motivo? }` */
  inativar: (id, data) =>
    request(`/api/v1/pacientes/${encodeURIComponent(String(id))}/inativar`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),
  /** Body: `{ senha }` */
  reativar: (id, data) =>
    request(`/api/v1/pacientes/${encodeURIComponent(String(id))}/reativar`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),
  /** Pacientes inativos — mesma forma que `list`. */
  listInativos: async (opts = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(opts.page != null ? opts.page : 0));
    params.set('size', String(opts.size != null ? opts.size : 20));
    const raw = await request(`/api/v1/pacientes/inativos?${params.toString()}`);
    return normalizePacientesPage(raw);
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

    // URL presigned R2/S3: fetch limpo, sem headers de auth, sem cookie.
    // X-Amz-SignedHeaders=host — qualquer header extra quebra a assinatura e dispara CORS.
    const isPresignedExternal =
      (raw.startsWith('https://') || raw.startsWith('http://')) && raw.includes('X-Amz-Signature');
    if (isPresignedExternal) {
      return fetch(raw, { method: 'GET', credentials: 'omit' }).then((res) => {
        if (!res.ok) {
          const err = new Error(`[HTTP ${res.status}]`);
          err.status = res.status;
          throw err;
        }
        return res.blob();
      });
    }

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

/**
 * Plano de tratamento / mapeamento facial (PlanejamentoController).
 * @see plataforma-procedimentos — /api/v1/planejamentos
 */
export const planejamentosApi = {
  criar: (body) =>
    request('/api/v1/planejamentos', { method: 'POST', body: JSON.stringify(body ?? {}) }),
  listarPorPaciente: (pacienteId) =>
    request(
      `/api/v1/planejamentos?pacienteId=${encodeURIComponent(String(pacienteId))}`,
    ),
  detalhe: (planejamentoId) =>
    request(`/api/v1/planejamentos/${encodeURIComponent(String(planejamentoId))}`),
  salvar: (planejamentoId, body) =>
    request(`/api/v1/planejamentos/${encodeURIComponent(String(planejamentoId))}`, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    }),
  alterarStatus: (planejamentoId, { codigo }) =>
    request(`/api/v1/planejamentos/${encodeURIComponent(String(planejamentoId))}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ codigo: String(codigo ?? '').trim() }),
    }),
  adicionarItem: (planejamentoId, body) =>
    request(`/api/v1/planejamentos/${encodeURIComponent(String(planejamentoId))}/itens`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  atualizarItem: (planejamentoId, itemId, body) =>
    request(
      `/api/v1/planejamentos/${encodeURIComponent(String(planejamentoId))}/itens/${encodeURIComponent(String(itemId))}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
      },
    ),
  removerItem: (planejamentoId, itemId) =>
    requestDelete(
      `/api/v1/planejamentos/${encodeURIComponent(String(planejamentoId))}/itens/${encodeURIComponent(String(itemId))}`,
    ),
  darBaixaItem: (planejamentoId, itemId) =>
    planejamentosApi.atualizarItem(planejamentoId, itemId, {
      statusProcedimentoId: STATUS_PROCEDIMENTO_FINALIZADO_ID,
    }),
  salvarPontosVista: (itemId, vistaCodigo, pontos) =>
    request(
      `/api/v1/planejamentos/item/${encodeURIComponent(String(itemId))}/pontos?vista=${encodeURIComponent(String(vistaCodigo))}`,
      {
        method: 'PUT',
        body: JSON.stringify({ pontos: Array.isArray(pontos) ? pontos : [] }),
      },
    ),
};

/**
 * Alertas manuais do paciente (CRUD próprio ao cadastro manual).
 * Não confundir com alertas inferidos pela anamnese (somente front + anamneseApi).
 *
 * Contrato sugerido: GET/POST/PUT/DELETE em …/pacientes/{id}/alertas-manuais
 */
export const pacienteAlertasManuaisApi = {
  list: (pacienteId) =>
    request(`/api/v1/pacientes/${encodeURIComponent(String(pacienteId))}/alertas-manuais`),
  create: (pacienteId, data) =>
    request(`/api/v1/pacientes/${encodeURIComponent(String(pacienteId))}/alertas-manuais`, {
      method: 'POST',
      body: JSON.stringify({
        titulo: String(data?.titulo ?? '').trim(),
        descricao: String(data?.descricao ?? '').trim(),
      }),
    }),
  update: (pacienteId, alertaId, data) =>
    request(
      `/api/v1/pacientes/${encodeURIComponent(String(pacienteId))}/alertas-manuais/${encodeURIComponent(String(alertaId))}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          titulo: String(data?.titulo ?? '').trim(),
          descricao: String(data?.descricao ?? '').trim(),
        }),
      },
    ),
  remove: (pacienteId, alertaId) =>
    requestDelete(
      `/api/v1/pacientes/${encodeURIComponent(String(pacienteId))}/alertas-manuais/${encodeURIComponent(String(alertaId))}`,
    ),
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
  create: (data) => request('/api/v1/equipe', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/equipe/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/equipe/${id}`, { method: 'DELETE' }),
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
  list: (incluirInativos = false) =>
    request(`/api/v1/catalogos?incluirInativos=${incluirInativos}`),
  get: (id) => request(`/api/v1/catalogos/${id}`),
  /** Body alinhado ao Spring (ajustar chaves se o DTO divergir). */
  criar: (data) => request('/api/v1/catalogos', { method: 'POST', body: JSON.stringify(data) }),
  inativar: (id) => request(`/api/v1/catalogos/${id}/inativar`, { method: 'PATCH' }),
  ativar: (id) => request(`/api/v1/catalogos/${id}/ativar`, { method: 'PATCH' }),
};

export const catalogoApi = {
  listar: (tipoCodigo) => {
    const qs = tipoCodigo ? `?tipoCodigo=${encodeURIComponent(tipoCodigo)}` : '';
    return request(`/api/v1/catalogos/procedimentos${qs}`);
  },
};

export const clinicaProcedimentoApi = {
  listar: () => request('/api/v1/clinica/procedimentos'),
  vincular: (catalogoProcedimentoId) =>
    request('/api/v1/clinica/procedimentos', {
      method: 'POST',
      body: JSON.stringify({ catalogoProcedimentoId }),
    }),
  desvincular: (vinculoId) =>
    request(`/api/v1/clinica/procedimentos/${vinculoId}`, { method: 'DELETE' }),
};

/**
 * Orientações pós-procedimento + template por nome (contrato alinhar com `plataforma-procedimentos`).
 * Esperado: POST body `[{ descricao, checado, ordem }]`, GET template JSON com `itens` ou array,
 * PUT template `{ procedimentoNome, itens }`, POST catálogo `{ nomeProcedimento }` (ajustar se o DTO Spring divergir).
 */
export const orientacoesApi = {
  salvar: (procedimentoFeitoId, itens) =>
    request(`/api/v1/procedimentos/${encodeURIComponent(String(procedimentoFeitoId))}/orientacoes`, {
      method: 'POST',
      body: JSON.stringify(Array.isArray(itens) ? itens : []),
    }),
  listar: (procedimentoFeitoId) =>
    request(`/api/v1/procedimentos/${encodeURIComponent(String(procedimentoFeitoId))}/orientacoes`),
};

/** Preferências de perfil / clínica (templates). */
export const perfilApi = {
  getOrientacoesTemplate: (procedimentoNome) => {
    const q = encodeURIComponent(String(procedimentoNome || '').trim());
    return request(`/api/v1/perfil/orientacoes-template?procedimentoNome=${q}`);
  },
  salvarOrientacoesTemplate: (procedimentoNome, itens) =>
    request('/api/v1/perfil/orientacoes-template', {
      method: 'PUT',
      body: JSON.stringify({
        procedimentoNome: String(procedimentoNome || '').trim(),
        itens: Array.isArray(itens) ? itens : [],
      }),
    }),
};

// ── Agenda ─────────────────────────────────────────────────

export const agendasApi = {
  get: (id) => request(`/api/v1/agendas/${id}`),
  byDate: (date) => request(`/api/v1/agendas/by-date?date=${date}`),
  byRange: (start, end, opts = {}) => {
    let url = `/api/v1/agendas/by-range?start=${start}&end=${end}`;
    if (opts?.profissionalRoleUserId) {
      url += `&profissionalRoleUserId=${encodeURIComponent(String(opts.profissionalRoleUserId).trim())}`;
    }
    return request(url);
  },
  byProfissional: (roleUserId, date) =>
    request(`/api/v1/agendas/by-profissional?roleUserId=${roleUserId}&date=${date}`),
  create: (data, opts = {}) => {
    const qs = opts.forcar ? '?forcar=true' : '';
    return request(`/api/v1/agendas${qs}`, { method: 'POST', body: JSON.stringify(data) });
  },
  /**
   * Bloqueia período cancelando conflitos na mesma transação (N-cancel).
   * @returns {Promise<{ bloqueio: object, quantidadeCancelada: number, idsCancelados: string[] }>}
   */
  bloquearPeriodo: (data, opts = {}) => {
    const qs = opts.forcar ? '?forcar=true' : '';
    return request(`/api/v1/agendas/bloquear-periodo${qs}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: (id, data, opts = {}) => {
    const qs = opts.forcar ? '?forcar=true' : '';
    return request(`/api/v1/agendas/${id}${qs}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  /**
   * Cancela um slot da agenda com motivo (Onda 4).
   * @param {string} id UUID da agenda
   * @param {{ motivoCancelamentoId: string, motivoCancelamentoTexto?: string }} payload
   */
  cancelar: (id, payload) =>
    request(`/api/v1/agendas/${id}/cancelar`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /**
   * Atualiza status do slot (confirmado | realizado).
   * @param {string} id UUID do slot
   * @param {'confirmado'|'realizado'} codigo
   */
  atualizarStatus: (id, codigo) =>
    request(`/api/v1/agendas/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ codigo }),
    }),

  /**
   * Reagenda um slot (V30): move o agendamento e marca o original como reagendado.
   * @param {string} id UUID do slot original
   * @param {{ novaData: string, novaHoraInicio: string, novaHoraFim: string, observacao?: string }} payload
   */
  reagendar: (id, payload, opts = {}) => {
    const qs = opts.forcar ? '?forcar=true' : '';
    return request(`/api/v1/agendas/${id}/reagendar${qs}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Adianta início do slot para nova hora no mesmo dia (PATCH).
   * @param {string} id UUID da agenda
   * @param {string} novaHoraInicio HH:MM (local)
   */
  adiantar: (id, novaHoraInicio) =>
    request(
      `/api/v1/agendas/${encodeURIComponent(String(id))}/adiantar?novaHoraInicio=${encodeURIComponent(String(novaHoraInicio || '').trim())}`,
      { method: 'PATCH' },
    ),
};

function buildDisponibilidadeQuery(params) {
  const qs = new URLSearchParams();
  if (params.data) qs.set('data', String(params.data));
  if (params.ano != null) qs.set('ano', String(params.ano));
  if (params.mes != null) qs.set('mes', String(params.mes));
  if (params.roleUserId) qs.set('roleUserId', String(params.roleUserId));
  if (params.especialidadeId) qs.set('especialidadeId', String(params.especialidadeId));
  if (params.duracaoMinutos != null) qs.set('duracaoMinutos', String(params.duracaoMinutos));
  return qs.toString();
}

/** Disponibilidade agregada de slots (Agenda V2 — granularidade 1h). */
export const agendaDisponibilidadeApi = {
  slotsDoDia: ({ data, roleUserId, especialidadeId, duracaoMinutos = 30 } = {}) => {
    const q = buildDisponibilidadeQuery({ data, roleUserId, especialidadeId, duracaoMinutos });
    return request(`/api/v1/agenda/disponibilidade/dia?${q}`);
  },
  diasDoMes: ({ ano, mes, roleUserId, especialidadeId } = {}) => {
    const q = buildDisponibilidadeQuery({ ano, mes, roleUserId, especialidadeId });
    return request(`/api/v1/agenda/disponibilidade/mes?${q}`);
  },
};

/** Motivos de cancelamento de agenda (Onda 4; UUID para PATCH /agendas/{id}/cancelar). */
export const motivosCancelamentoApi = {
  /** @returns {Promise<Array<{ motivoCancelamentoId: string, codigo: string, nome: string, ordem: number }>>} */
  listar: () => request('/api/v1/motivos-cancelamento'),
};

// ── Confirmação WhatsApp ───────────────────────────────────
export const confirmacaoApi = {
  /**
   * Gera link WhatsApp wa.me + mensagem pronta + token mágico para o paciente confirmar.
   * Endpoint AUTENTICADO (profissional clica no botão).
   * @param {{ agendaId: string, tipoEnvio: 'confirmacao_24h'|'lembrete_1h' }} payload
   * @returns {Promise<{ confirmacaoId: string, tokenLink: string, mensagemPronta: string, urlWhatsApp: string }>}
   */
  gerar: (payload) =>
    request('/api/v1/confirmacoes/gerar', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ── Confirmação Pública (rotas /c/** — paciente clica link WhatsApp) ─────
export const confirmacaoPublicaApi = {
  /**
   * Busca info da confirmação por token (sem login).
   * @param {string} token UUID do token mágico
   */
  buscar: (token) => requestPublic(`/c/${encodeURIComponent(token)}`),

  /**
   * Paciente confirma ou recusa.
   * @param {string} token
   * @param {'confirmado'|'recusado'} resposta
   */
  responder: (token, resposta) =>
    requestPublic(
      `/c/${encodeURIComponent(token)}/responder?resposta=${encodeURIComponent(resposta)}`,
      {
        method: 'POST',
      }
    ),
};

// ── Procedimentos ──────────────────────────────────────────

export const procedimentosApi = {
  byPaciente: (pid) => request(`/api/v1/procedimentos/paciente/${pid}`),
  create: (data) => request('/api/v1/procedimentos', { method: 'POST', body: JSON.stringify(data) }),
  iniciar: (data) => request('/api/v1/procedimentos/iniciar', { method: 'POST', body: JSON.stringify(data) }),
  iniciarLote: (dtos) => request('/api/v1/procedimentos/lote', { method: 'POST', body: JSON.stringify(dtos) }),
  registrarManual: (pacienteId, data) =>
    request(`/api/v1/procedimentos/paciente/${pacienteId}/manual`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  patchStatus: (id, statusId) =>
    request(`/api/v1/procedimentos/${id}/status?statusId=${encodeURIComponent(statusId)}`, {
      method: 'PATCH',
    }),
  finalizar: (id) => request(`/api/v1/procedimentos/${id}/finalizar`, { method: 'PATCH' }),
  deletar: (id) => request(`/api/v1/procedimentos/${id}`, { method: 'DELETE' }),
  getPontos: (procedimentoFeitoId, { vista } = {}) => {
    const pid = encodeURIComponent(String(procedimentoFeitoId));
    const v = vista != null && String(vista).trim() ? String(vista).trim() : '';
    const qs = v ? `?vista=${encodeURIComponent(v)}` : '';
    return request(`/api/v1/procedimentos/${pid}/pontos${qs}`);
  },
  salvarPontos: (procedimentoFeitoId, vistaCodigo, body) => {
    const pid = encodeURIComponent(String(procedimentoFeitoId));
    const vista = encodeURIComponent(String(vistaCodigo || '').trim());
    return request(`/api/v1/procedimentos/${pid}/pontos?vista=${vista}`, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    });
  },
};

export const criarRelatoAcompanhamento = (dados) =>
  request('/api/relatos-acompanhamento', { method: 'POST', body: JSON.stringify(dados) });

export const buscarRelatoPorSessao = (procedimentoFeitoId) =>
  request(`/api/relatos-acompanhamento/procedimento/${procedimentoFeitoId}`);

export const listarRelatosPorPaciente = (pacienteId) =>
  request(`/api/relatos-acompanhamento/paciente/${pacienteId}`);

export const atualizarRelatoAcompanhamento = (relatoAcompanhamentoId, dados) =>
  request(`/api/relatos-acompanhamento/${relatoAcompanhamentoId}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });

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
  profissoes: () => request('/api/v1/dimensoes/profissoes', { needsOrg: false }),
  /** Tipos de procedimento da agenda (avaliacao, bloqueio, retorno, …). */
  tiposProcedimento: () => request('/api/v1/dimensoes/tipos-procedimento', { needsOrg: false }),
};

// ── Anamnese ───────────────────────────────────────────────
// Categorias/hábitos: mesmo padrão que fichas (X-Org-Id + cookie/Bearer). Omitir needsOrg enviava só GET “ok” e
// POST/PUT/DELETE sem X-Org-Id → 401 em muitos setups Spring multi-tenant.

export const anamneseApi = {
  listarFichas: () => request('/api/v1/anamnese/fichas'),
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
  /** Inclui `prioridade` ('NORMAL' | 'ALERTA'); padrão NORMAL se omitido. */
  createHabito: (data) =>
    request('/api/v1/anamnese/habitos', {
      method: 'POST',
      body: JSON.stringify({ prioridade: 'NORMAL', ...data }),
    }),
  /** Body: categoriaId, tipoRespostaId, descricao, prioridade; opcional alternativas (sync quando enviado). */
  updateHabito: (id, body) =>
    request(`/api/v1/anamnese/habitos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ prioridade: 'NORMAL', ...body }),
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
  getFichaBasica: () => request('/api/v1/anamnese/fichas/basica'),
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
  atualizarObservacoesAnamnese: (pacienteId, preenchimentoId, observacoes) =>
    request(`/api/v1/anamnese/paciente/${pacienteId}/${preenchimentoId}/observacoes`, {
      method: 'PATCH',
      body: JSON.stringify({ observacoes }),
    }),
  finalizarPaciente: (pid, aid) =>
    request(`/api/v1/anamnese/paciente/${pid}/${aid}/finalizar`, { method: 'PATCH' }),
  editPaciente: (pid, aid, roleId, data) =>
    request(`/api/v1/anamnese/paciente/${pid}/${aid}?roleUserId=${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

  // 🟨🟨 Configurações de Acesso Público 🟨🟨
  export const acessoPublicoApi = {
    buscar: () => request('/api/v1/configuracoes/acesso-publico'),
    atualizar: (payload) =>
      request('/api/v1/configuracoes/acesso-publico', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  };

  // 🟨🟨 Termos (LGPD e Outros) 🟨🟨─────────────────────────────────────────────
export const termosApi = {
  list: () => request('/api/v1/termos'),
  create: (data) => request('/api/v1/termos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/api/v1/termos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/termos/${id}`, { method: 'DELETE' }),
};

export const termoAssinaturaApi = {
  criar: (data) =>
    request('/api/v1/termos/assinaturas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listarPorPaciente: (pacienteId) =>
    request(`/api/v1/termos/assinaturas/paciente/${pacienteId}`),

  buscar: (id) => request(`/api/v1/termos/assinaturas/${id}`),

  vincularProcedimento: (id, procedimentoFeitoId) =>
    request(`/api/v1/termos/assinaturas/${id}/vincular-procedimento`, {
      method: 'PATCH',
      body: JSON.stringify({ procedimentoFeitoId }),
    }),
};

/** Normaliza corpo de GET /api/v1/organizacoes/minhas para lista. */
export function normalizeMinhasOrganizacoesResponse(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const list = raw.content ?? raw.organizacoes ?? raw.data;
    if (Array.isArray(list)) return list;
  }
  return [];
}

// ── Organizações (minhas / cadastro Onda 3) ────────────────────
export const organizacaoApi = {
  getMinhas: async () => {
    const raw = await request('/api/v1/organizacoes/minhas');
    return normalizeMinhasOrganizacoesResponse(raw);
  },
  criar: (dto) =>
    request('/api/v1/organizacoes', {
      method: 'POST',
      needsOrg: false,
      body: JSON.stringify(dto != null && typeof dto === 'object' ? dto : {}),
    }),
  atualizar: (id, patchDto) =>
    request(`/api/v1/organizacoes/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      body: JSON.stringify(patchDto != null && typeof patchDto === 'object' ? patchDto : {}),
    }),
};

// ── Clinica ────────────────────────────────────────────────
export const clinicaApi = {
  buscar: () => request('/api/v1/clinica'),
  atualizar: (payload) =>
    request('/api/v1/clinica', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};


// ── Configurações da Clínica ──────
export const configuracoesClinicaApi = {
  /**
   * Busca configurações da clínica (V30: somente tipoOrg).
   * @returns {Promise<{ tipoOrg: string }>}
   */
  buscar: () => request('/api/v1/configuracoes/clinica'),

  /**
   * Atualiza configurações.
   * @param {{ tipoOrg: string }} payload
   */
  atualizar: (payload) =>
    request('/api/v1/configuracoes/clinica', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};

// ── Horários de funcionamento por organização (V30) ─────────
export const organizacoesHorariosApi = {
  /**
   * @returns {Promise<Array<{id?: string, diaSemana: number, horaInicio: string, horaFim: string, ativo: boolean}>>}
   */
  buscar: (orgId) =>
    request(`/api/v1/organizacoes/${encodeURIComponent(String(orgId))}/horarios`),
  /**
   * Replace-all
   * @param {string} orgId
   * @param {Array<{id?: string, diaSemana: number, horaInicio: string, horaFim: string, ativo: boolean}>} payload
   */
  atualizar: (orgId, payload) =>
    request(`/api/v1/organizacoes/${encodeURIComponent(String(orgId))}/horarios`, {
      method: 'PUT',
      body: JSON.stringify(Array.isArray(payload) ? payload : []),
    }),
};

// ── Feriados ───────────────────────────────────────────────
export const feriadosApi = {
  /**
   * Lista feriados ativos no período.
   * @param {string} inicio YYYY-MM-DD
   * @param {string} fim YYYY-MM-DD
   */
  listar: (inicio, fim) =>
    request(
      `/api/v1/feriados?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`
    ),

  /**
   * Cria novo feriado.
   * @param {{ data: string, nome: string }} payload
   */
  criar: (payload) =>
    request('/api/v1/feriados', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /**
   * Soft delete (marca ativo=false).
   */
  desativar: (id) => requestDelete(`/api/v1/feriados/${id}`),

  /**
   * Sugestões nacionais BR hardcoded (8 datas fixas: Natal, Tiradentes, etc.).
   * @param {number} ano
   */
  sugestoesNacionais: (ano) =>
    request(`/api/v1/feriados/sugestoes-nacionais?ano=${encodeURIComponent(ano)}`),
};

// ── Templates de Mensagem WhatsApp ─────────────────────────
export const templatesMensagemApi = {
  /**
   * Lista templates da clínica. Pode estar vazio (frontend usa fallback hardcoded do backend).
   */
  listar: () => request('/api/v1/templates-mensagem'),

  /**
   * Upsert (cria ou atualiza) template por tipo.
   * @param {'confirmacao'|'lembrete'} tipo
   * @param {string} texto
   */
  salvar: (tipo, texto) =>
    request(`/api/v1/templates-mensagem/${encodeURIComponent(tipo)}`, {
      method: 'PUT',
      body: JSON.stringify({ texto }),
    }),
};

// ── Notificações ───────────────────────────────────────────
export const notificacoesApi = {
  /**
   * Lista paginada.
   * @param {{ lida?: boolean, page?: number, size?: number }} opts
   */
  listar: ({ lida, page = 0, size = 20 } = {}) => {
    const params = new URLSearchParams();
    if (lida !== undefined && lida !== null) params.set('lida', String(lida));
    params.set('page', String(page));
    params.set('size', String(size));
    return request(`/api/v1/notificacoes?${params.toString()}`);
  },

  /**
   * Contador de não-lidas (pra sino do header).
   * @returns {Promise<{ count: number }>}
   */
  contarNaoLidas: () => request('/api/v1/notificacoes/count-nao-lidas'),

  /**
   * Marca uma notificação como lida.
   */
  marcarLida: (id) => request(`/api/v1/notificacoes/${id}/lida`, { method: 'PATCH' }),

  /**
   * Bulk: marca todas como lidas.
   * @returns {Promise<{ marcadas: number }>}
   */
  marcarTodasLidas: () =>
    request('/api/v1/notificacoes/marcar-todas-lidas', { method: 'PATCH' }),

  /**
   * Sugere inclusão de procedimento no catálogo (notifica admins da org).
   * @param {string} nome
   * @returns {Promise<{ criadas: number }>}
   */
  sugerirProcedimento: (nome) =>
    request('/api/v1/notificacoes/sugestao-procedimento', {
      method: 'POST',
      body: JSON.stringify({ nomeSugerido: String(nome).trim() }),
    }),
};

// ── Disponibilidade do Profissional ───────────────────────
export const disponibilidadeApi = {
  /**
   * @param {string} roleUserId
   * @returns {Promise<Array<{id?: string, diaSemana: number, horaInicio: string, horaFim: string, ativo: boolean}>>}
   */
  buscar: (roleUserId) =>
    request(`/api/v1/equipe/${encodeURIComponent(roleUserId)}/disponibilidade`),

  /**
   * Replace-all de intervalos por profissional.
   * @param {string} roleUserId
   * @param {Array<{id?: string, diaSemana: number, horaInicio: string, horaFim: string, ativo: boolean}>} payload
   */
  atualizar: (roleUserId, payload) =>
    request(`/api/v1/equipe/${encodeURIComponent(roleUserId)}/disponibilidade`, {
      method: 'PUT',
      body: JSON.stringify(Array.isArray(payload) ? payload : []),
    }),
};

// ── Auditoria ──────────────────────────────────────────────
export const auditoriaApi = {
  list: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.page != null) params.set('page', String(opts.page));
    if (opts.size != null) params.set('size', String(opts.size));
    if (opts.roleUserId) params.set('roleUserId', opts.roleUserId);
    if (opts.search) params.set('search', opts.search);
    if (opts.suspeito !== undefined) params.set('suspeito', String(opts.suspeito));
    const qs = params.toString();
    return request(`/api/v1/auditoria${qs ? `?${qs}` : ''}`);
  },
};

// ── Perfil Clínico do Paciente ─────────────────────────────
/**
 * Perfil clínico persistente do paciente (alergias, medicamentos, antecedentes).
 * Distinto de `perfilApi` (orientações pós-procedimento).
 */
export const perfilClinicoApi = {
  /**
   * Busca perfil clínico do paciente.
   * @param {string} pacienteId
   * @returns {Promise<PerfilClinicoResponseDTO>}
   */
  get: (pacienteId) =>
    request(`/api/v1/pacientes/${encodeURIComponent(pacienteId)}/perfil-clinico`),

  /**
   * Atualiza perfil clínico (replace-por-seção).
   * Sempre enviar as 4 listas, mesmo vazias — omitir = back não atualiza; [] = back zera.
   * @param {string} pacienteId
   * @param {{ roleUserId: string, alergias: object[], alergiasPrincipioAtivo: object[], medicamentosEmUso: object[], antecedentes: object[] }} body
   */
  put: (pacienteId, body) =>
    request(`/api/v1/pacientes/${encodeURIComponent(pacienteId)}/perfil-clinico`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

// ── Catálogo Clínico (lookup global) ──────────────────────
/**
 * Catálogos para autocomplete no perfil clínico. Rotas globais (needsOrg: false).
 * Sem `q` retorna lista completa de cada catálogo (sem paginação).
 */
export const catalogoClinicoApi = {
  /** Alimentos para alergias alimentares. `q` opcional. */
  alimentos: (q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/v1/catalogo-clinico/alimentos${qs}`, { needsOrg: false });
  },

  /** Princípios ativos para alergias a PA. `q` opcional. */
  principiosAtivos: (q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/v1/catalogo-clinico/principios-ativos${qs}`, { needsOrg: false });
  },

  /** Medicamentos em uso. `q` opcional. */
  medicamentos: (q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/v1/catalogo-clinico/medicamentos${qs}`, { needsOrg: false });
  },

  /**
   * Antecedentes pessoais. `q` opcional; `sexo` opcional — omitir retorna todos.
   * @param {string} q
   * @param {'M'|'F'|null|undefined} sexo
   */
  antecedentesPessoais: (q = '', sexo) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (sexo && sexo !== 'N') params.set('sexo', sexo);
    const qs = params.toString();
    return request(`/api/v1/catalogo-clinico/antecedentes-pessoais${qs ? `?${qs}` : ''}`, { needsOrg: false });
  },

  /** Outras alergias (não alimentares e não por PA). `q` opcional. */
  outrasAlergias: (q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/v1/catalogo-clinico/outras-alergias${qs}`, { needsOrg: false });
  },
};

