import { resolveApiUrl } from '../config/apiEnv.js';
import { fetchAuthMeSnapshot } from './authMeProbe.js';
import { authHeadersForFetch } from '../services/api.js';

const FAST_FAIL_MS = 2500;

function envBool(name) {
  const v = import.meta.env[name];
  return v === true || String(v).toLowerCase() === 'true';
}

function envInt(name, fallback) {
  const n = Number(import.meta.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Só para desenvolvimento local sem Spring; nunca use em produção pública. */
export function shouldSkipBackendCheck() {
  return envBool('VITE_SKIP_BACKEND_CHECK');
}

export function getBackendPingPath() {
  const p =
    typeof import.meta.env.VITE_BACKEND_PING_PATH === 'string'
      ? import.meta.env.VITE_BACKEND_PING_PATH.trim()
      : '';
  return p || '/api/auth/me';
}

export function getBackendPingTimeoutMs() {
  return envInt('VITE_BACKEND_PING_TIMEOUT_MS', 55_000);
}

export function getBackendRetryIntervalMs() {
  return envInt('VITE_BACKEND_RETRY_INTERVAL_MS', 10_000);
}

/**
 * Tenta falar com o backend. Qualquer resposta HTTP válida (incl. 401) indica que o serviço respondeu.
 * @returns {Promise<{ ok: true, status: number } | { ok: false, kind: 'timeout' | 'network' }>}
 */
export async function pingBackendOnce() {
  const path = getBackendPingPath();
  const timeoutMs = getBackendPingTimeoutMs();
  const started = Date.now();

  /** Mesmo GET que useAuthState — snapshot deduplicado (menos requisições / logs 401 em dev). */
  if (path === '/api/auth/me') {
    let timerId;
    try {
      const timeoutP = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error('__ping_timeout__')), timeoutMs);
      });
      const snap = await Promise.race([fetchAuthMeSnapshot(), timeoutP]);
      clearTimeout(timerId);
      if (snap.status === 502 || snap.status === 503 || snap.status === 504) {
        const elapsed = Date.now() - started;
        return { ok: false, kind: elapsed < FAST_FAIL_MS ? 'network' : 'timeout' };
      }
      return { ok: true, status: snap.status };
    } catch (e) {
      if (timerId) clearTimeout(timerId);
      if (e?.message === '__ping_timeout__') {
        return { ok: false, kind: 'timeout' };
      }
      return { ok: false, kind: 'network' };
    }
  }

  const url = resolveApiUrl(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      cache: 'no-store',
      headers: { ...(await authHeadersForFetch({ needsOrg: false })) },
    });
    clearTimeout(timer);

    if (res.status === 502 || res.status === 503 || res.status === 504) {
      const elapsed = Date.now() - started;
      return { ok: false, kind: elapsed < FAST_FAIL_MS ? 'network' : 'timeout' };
    }

    return { ok: true, status: res.status };
  } catch {
    clearTimeout(timer);
    const aborted = controller.signal.aborted;
    if (aborted) {
      return { ok: false, kind: 'timeout' };
    }
    return { ok: false, kind: 'network' };
  }
}
