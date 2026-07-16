/**
 * Organização(ões) para o header X-Org-Id nas rotas /api/v1/** que o backend exige.
 *
 * Defina no .env (ver .env.example):
 * - VITE_DEFAULT_ORG_ID — UUID real da org (dev). Nunca use o placeholder seed de bootstrap.
 * - VITE_ALT_ORG_ID — opcional; segunda org na barra de contexto (dev).
 *
 * URL absoluta da API no deploy (Netlify → Render): defina VITE_API_BASE_URL sem barra final.
 *
 * Importante: o UUID seed `b0000000-0000-0000-0000-000000000001` NÃO é org do usuário —
 * se aparecer em env/localStorage, é tratado como vazio (ver {@link isPlaceholderOrgId}).
 */
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Placeholder histórico de bootstrap single-tenant — nunca deve virar currentOrgId. */
export const PLACEHOLDER_ORG_ID = 'b0000000-0000-0000-0000-000000000001';

/**
 * @param {unknown} id
 * @returns {boolean}
 */
export function isPlaceholderOrgId(id) {
  if (id == null) return false;
  const s = String(id).trim().toLowerCase();
  return s === PLACEHOLDER_ORG_ID;
}

/**
 * Normaliza UUID de org: inválido / placeholder → string vazia.
 * @param {unknown} id
 * @returns {string}
 */
export function sanitizeOrgId(id) {
  if (id == null) return '';
  const s = String(id).trim();
  if (!s || !UUID_RE.test(s) || isPlaceholderOrgId(s)) return '';
  return s;
}

function pickUuidOrEmpty(envValue) {
  const v = typeof envValue === 'string' ? envValue.trim() : '';
  if (v && UUID_RE.test(v) && !isPlaceholderOrgId(v)) return v;
  return '';
}

/**
 * Org default só se VITE_DEFAULT_ORG_ID for UUID real (não placeholder).
 * Sem env / seed → '' (descoberta via /organizacoes/minhas).
 */
export const DEFAULT_ORG_ID = pickUuidOrEmpty(import.meta.env.VITE_DEFAULT_ORG_ID);

export const ALT_ORG_ID = (() => {
  const v =
    typeof import.meta.env.VITE_ALT_ORG_ID === 'string' ? import.meta.env.VITE_ALT_ORG_ID.trim() : '';
  return v && UUID_RE.test(v) && !isPlaceholderOrgId(v) ? v : null;
})();

/** Base URL do backend (vazia em dev com proxy Vite). */
export function getApiBaseUrl() {
  const b = typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL.trim() : '';
  return b.replace(/\/+$/, '');
}

/** Caminho absoluto no browser para chamar a API (ex.: `https://api.app.com/api/auth/me` ou `/api/auth/me`). */
export function resolveApiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${p}`;
}

/**
 * Se `fetch(url)` deve levar cookie jwt, Bearer e X-Org-Id (rotas da API ou proxy em dev).
 * URLs em outro host (ex.: GET presigned do R2) retornam false — headers extras quebram assinatura S3-style.
 */
export function shouldAttachApiAuthToFetchUrl(resolvedUrl) {
  if (typeof resolvedUrl !== 'string' || !resolvedUrl.trim()) return true;
  try {
    const pageBase = typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
    const u = new URL(resolvedUrl, pageBase);
    const base = getApiBaseUrl();
    const apiOrigin = base
      ? new URL(base).origin
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
    return Boolean(apiOrigin) && u.origin === apiOrigin;
  } catch {
    return true;
  }
}

let warnedDev8080Base = false;

/** Em dev: avisa se a base aponta direto para :8080 — cookie jwt costuma ficar na origem errada (use proxy :5173). */
export function warnDevApiBaseIfMisconfigured() {
  if (warnedDev8080Base) return;
  if (typeof import.meta.env === 'undefined' || !import.meta.env.DEV) return;
  const b = getApiBaseUrl().toLowerCase();
  if (b.includes('localhost:8080') || b.includes('127.0.0.1:8080')) {
    warnedDev8080Base = true;
    console.warn(
      '[Procedi] VITE_API_BASE_URL aponta para a porta 8080. Com login por cookie, em dev deixe essa variável ' +
        'VAZIA para usar http://localhost:5173/api (proxy do Vite). Caso contrário, /api/auth/me e /api/v1/* podem ' +
        'responder 401 por falta do cookie jwt na requisição. Veja .env.example.',
    );
  }
}
