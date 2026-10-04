/**
 * Estado do bloqueio do shell enquanto o /me da clínica (permissões + fuso) não respondeu.
 * @param {{ orgId: string, contextStatus: string }} p
 * @returns {null | 'carregando' | 'erro' | 'semClinica'} null = shell liberado
 */
export function estadoGateContexto({ orgId, contextStatus }) {
  if (contextStatus === 'ready' && orgId) return null;
  if (!orgId) return 'semClinica';
  if (contextStatus === 'error') return 'erro';
  return 'carregando';
}
