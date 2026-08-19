/**
 * Regras de fila de termos: o backend resolve pelo vínculo
 * (tb_termo_procedimento). O front só interpreta o DTO.
 */

export function isAssinaturaResolvida(assinatura) {
  if (!assinatura) return false;
  if (assinatura.statusCodigo === 'RECUSADO') return false;
  if (assinatura.statusCodigo === 'CANCELADO') return false;
  if (assinatura.statusCodigo && assinatura.statusCodigo !== 'ASSINADO') return false;
  if (typeof assinatura.vigente === 'boolean') return assinatura.vigente;
  if (!assinatura.expiradaEm) return true;
  return new Date(assinatura.expiradaEm) > new Date();
}

/** IDs da fila obrigatória a partir do DTO GET /termos/resolucao. */
export function idsFilaExigida(resolucao) {
  if (!resolucao || !Array.isArray(resolucao.faltantes)) return [];
  return resolucao.faltantes
    .map((f) => (f && f.termoId != null ? String(f.termoId) : ''))
    .filter(Boolean);
}

export function primeiroFaltante(resolucao) {
  const ids = idsFilaExigida(resolucao);
  return ids[0] || null;
}

export function temFaltantes(resolucao) {
  return idsFilaExigida(resolucao).length > 0;
}

/** Bloqueio de execução: independente de o modal estar aberto. */
export function procedimentoBloqueadoPorTermos(resolucao) {
  return temFaltantes(resolucao);
}

/**
 * Encerrar administrativo (modal do hub/footer) pode sair mesmo com termo pendente.
 * Finalizar o ato clínico (orientações / jornada) continua abortando.
 */
export function abortarEncerrarPorTermos({
  bloqueadoPorTermos,
  isApenasSair = false,
  pularGateTermos = false,
} = {}) {
  return Boolean(bloqueadoPorTermos) && !isApenasSair && !pularGateTermos;
}

/** Não cria PF nem consome consentimento quando o termo ainda falta. */
export function deveCriarProcedimentoNoEncerrar(bloqueadoPorTermos) {
  return !bloqueadoPorTermos;
}

export function titulosFaltantes(resolucao) {
  if (!resolucao || !Array.isArray(resolucao.faltantes)) return [];
  return resolucao.faltantes
    .map((f) => (f && f.titulo != null ? String(f.titulo).trim() : ''))
    .filter(Boolean);
}

/** Créditos vigentes do catálogo, aguardando o PF consumir. */
export function consentimentosAguardandoExecucao(resolucao) {
  if (!resolucao || !Array.isArray(resolucao.termosExigidos) || temFaltantes(resolucao)) {
    return [];
  }
  return resolucao.termosExigidos
    .filter((e) => e && e.vigente && e.assinaturaId)
    .map((e) => ({
      termoId: e.termoId != null ? String(e.termoId) : '',
      titulo: e.titulo != null ? String(e.titulo).trim() : 'Termo',
      assinadoEm: e.assinadoEm || null,
    }))
    .filter((e) => e.termoId);
}

export function parseTermosBloqueioError(err) {
  if (!err || err.status !== 409) return null;
  const body = err.body && typeof err.body === 'object' ? err.body : {};
  if (body.error !== 'TERMOS_OBRIGATORIOS_PENDENTES' && body.code !== 'TERMOS_OBRIGATORIOS_PENDENTES') {
    return null;
  }
  return {
    nomeProcedimento: body.nomeProcedimento || '',
    faltantes: Array.isArray(body.termosFaltantes) ? body.termosFaltantes : [],
    message: body.message || '',
  };
}

export function catalogoIdsDoAtendimento({
  nomeProcedimentoCatalogoId,
  procedimentosSessao,
  catalogoOrigemId,
} = {}) {
  const ids = [];
  const seen = new Set();
  const add = (raw) => {
    const s = raw != null ? String(raw).trim() : '';
    if (!s || seen.has(s)) return;
    seen.add(s);
    ids.push(s);
  };
  add(nomeProcedimentoCatalogoId);
  add(catalogoOrigemId);
  if (Array.isArray(procedimentosSessao)) {
    for (const p of procedimentosSessao) {
      add(p?.nomeProcedimentoCatalogoId || p?.catalogoProcedimentoSaudeId);
    }
  }
  return ids;
}
