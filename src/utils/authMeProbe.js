import { resolveApiUrl } from '../config/apiEnv.js';
import { authHeadersForFetch } from '../services/api.js';

const AUTH_ME_PATH = '/api/auth/me';
const TTL_MS = 5000;

let cache = {
  /** @type {Promise<{ status: number, payload: object | null, ok: boolean }> | null} */
  inFlight: null,
  /** @type {number} */
  expiresAt: 0,
  /** @type {{ status: number, payload: object | null, ok: boolean } | null} */
  snapshot: null,
};

export function invalidateAuthMeCache() {
  cache = { inFlight: null, expiresAt: 0, snapshot: null };
}

/**
 * Um único GET /api/auth/me por janela de TTL — BackendGate + useAuthState + StrictMode
 * compartilham o mesmo resultado (menos 401 repetidos no console quando não há sessão).
 *
 * 401 aqui = sem cookie jwt (não logado ou sessão expirada). O DevTools pode mostrar
 * "ERR_ABORTED" junto em alguns casos; o ping do BackendGate ainda considera a API "online".
 * Se você está logado e vê 401 em /auth/me e em /api/v1/*, confira VITE_API_BASE_URL vazio em dev (proxy :5173).
 */
export async function fetchAuthMeSnapshot() {
  const now = Date.now();
  if (cache.snapshot && cache.expiresAt > now) {
    return cache.snapshot;
  }
  if (cache.inFlight) {
    return cache.inFlight;
  }

  const url = resolveApiUrl(AUTH_ME_PATH);
  cache.inFlight = (async () => {
    try {
      const headers = { ...authHeadersForFetch({ needsOrg: false }) };
      console.log(`[authMeProbe] about to fetch ${url}. Headers:`, headers);
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
      const status = res.status;
      let payload = null;
      if (res.ok) {
        payload = await res.json().catch(() => ({}));
      }
      const data = { status, payload, ok: res.ok };
      cache.snapshot = data;
      cache.expiresAt = Date.now() + TTL_MS;
      return data;
    } finally {
      cache.inFlight = null;
    }
  })();

  return cache.inFlight;
}
