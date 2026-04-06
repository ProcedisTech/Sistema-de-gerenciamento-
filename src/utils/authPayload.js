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
