/**
 * JWT no JSON (LoginResponseDTO / MeResponseDTO) — Jackson serializa como accessToken (camelCase).
 * Raiz ou dentro de `user`; pode ser null no /me se não houver roleUserId no JWT.
 */
const ACCESS_TOKEN_JSON_KEYS = ['accessToken'];

function pickAccessTokenFromObject(o) {
  if (!o || typeof o !== 'object') return null;
  for (const k of ACCESS_TOKEN_JSON_KEYS) {
    const t = o[k];
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}

export function extractAccessTokenFromAuthResponse(data) {
  if (!data || typeof data !== 'object') return null;
  return pickAccessTokenFromObject(data) || pickAccessTokenFromObject(data.user);
}

/**
 * Extrai UUID da organização devolvido pelo Spring após login, register ou GET /api/auth/me.
 * O backend pode enviar no objeto raiz ou dentro de `user` (alinhar um dos nomes abaixo).
 */
export function extractOrganizacaoIdFromAuthResponse(data) {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    data.organizacaoSaudeId,
    data.organizationId,
    data.orgId,
    data.organizacaoId,
  ];
  for (const c of candidates) {
    if (c && /^[0-9a-f-]{36}$/i.test(String(c))) return String(c).trim();
  }
  const u = data.user;
  if (u && typeof u === 'object') {
    const inner = [
      u.organizacaoSaudeId,
      u.organizationId,
      u.orgId,
      u.organizacaoId,
    ];
    for (const c of inner) {
      if (c && /^[0-9a-f-]{36}$/i.test(String(c))) return String(c).trim();
    }
  }
  return null;
}

export function resolverPapel(roleNome) {
  if (!roleNome) return null;
  const roleLimpo = String(roleNome).trim().toUpperCase();

  if (roleLimpo === 'DONO') {
    return 'DONO';
  }
  if (roleLimpo === 'NIVEL_5' || roleLimpo === 'ADMINISTRADOR' || roleLimpo === 'ADMIN') {
    return 'NIVEL_5';
  }
  if (roleLimpo === 'NIVEL_4') {
    return 'NIVEL_4';
  }
  if (roleLimpo === 'NIVEL_3' || roleLimpo === 'PROFISSIONAL') {
    return 'NIVEL_3';
  }
  if (roleLimpo === 'NIVEL_2' || roleLimpo === 'RECEPCIONISTA') {
    return 'NIVEL_2';
  }
  if (roleLimpo === 'NIVEL_1') {
    return 'NIVEL_1';
  }

  return roleLimpo;
}

