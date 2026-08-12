/**
 * Uma assinatura de termo é considerada resolvida (não pendente) quando não
 * foi recusada e ainda está vigente. Compartilhado entre useTermosPendentes.js
 * (badge do Hub) e Step4LGPD.jsx (auto-inclusão de termos exigidos).
 */
export function isAssinaturaResolvida(assinatura) {
  if (!assinatura) return false;
  if (assinatura.statusCodigo === 'RECUSADO') return false;
  if (typeof assinatura.vigente === 'boolean') return assinatura.vigente;
  if (!assinatura.expiradaEm) return true;
  return new Date(assinatura.expiradaEm) > new Date();
}

/** Termo exigido na fila de assinatura: natureza PROCEDIMENTO. */
export function isTermoExigido(termo) {
  return termo?.naturezaCodigo === 'PROCEDIMENTO';
}
