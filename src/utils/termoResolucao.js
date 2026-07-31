/**
 * Uma assinatura de termo é considerada resolvida (não pendente) quando não
 * foi recusada e ainda não expirou. Compartilhado entre useTermosPendentes.js
 * (badge do Hub) e Step4LGPD.jsx (auto-inclusão de termos obrigatórios).
 */
export function isAssinaturaResolvida(assinatura) {
  if (!assinatura || assinatura.recusado) return false;
  if (!assinatura.dataExpiracao) return true;
  return new Date(assinatura.dataExpiracao) > new Date();
}
