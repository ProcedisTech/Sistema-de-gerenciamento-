/**
 * Organização(ões) para o header X-Org-Id nas rotas /api/v1/** que o backend exige.
 *
 * Defina no .env (ver .env.example):
 * - VITE_DEFAULT_ORG_ID — UUID da org no PostgreSQL (single-tenant dev).
 * - VITE_ALT_ORG_ID — opcional; segunda org na barra de contexto (dev).
 */
const UUID_RE = /^[0-9a-f-]{36}$/i;

function pickUuid(envValue, fallback) {
  const v = typeof envValue === 'string' ? envValue.trim() : '';
  if (v && UUID_RE.test(v)) return v;
  return fallback;
}

/** Fallback só quando VITE_DEFAULT_ORG_ID não é um UUID válido. */
const FALLBACK_ORG = 'b0000000-0000-0000-0000-000000000001';

export const DEFAULT_ORG_ID = pickUuid(import.meta.env.VITE_DEFAULT_ORG_ID, FALLBACK_ORG);

export const ALT_ORG_ID = (() => {
  const v =
    typeof import.meta.env.VITE_ALT_ORG_ID === 'string' ? import.meta.env.VITE_ALT_ORG_ID.trim() : '';
  return v && UUID_RE.test(v) ? v : null;
})();
