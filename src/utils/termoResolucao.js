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

function catalogoIdDoItemSessao(item) {
  const a = item?.catalogoProcedimentoSaudeId != null ? String(item.catalogoProcedimentoSaudeId).trim() : '';
  const b = item?.nomeProcedimentoCatalogoId != null ? String(item.nomeProcedimentoCatalogoId).trim() : '';
  return a || b || '';
}

/**
 * PF desta sessão só conta para o catálogo gravado na mesma linha.
 * Sem catálogo na linha ou sem id → null (gate permanece).
 */
export function pfIdNestaSessaoParaCatalogo(catalogoId, procedimentosSessao) {
  const cat = catalogoId != null ? String(catalogoId).trim() : '';
  if (!cat || !Array.isArray(procedimentosSessao)) return null;
  for (const item of procedimentosSessao) {
    if (!item) continue;
    const itemCat = catalogoIdDoItemSessao(item);
    if (!itemCat || itemCat !== cat) continue;
    const pid = item.id != null ? String(item.id).trim() : '';
    if (pid) return pid;
  }
  return null;
}

/** Faltantes só bloqueiam se ainda não existe PF deste catálogo na sessão. */
export function bloqueioExecucaoTermos({ resolucao, pfIdNestaSessao } = {}) {
  const pf = pfIdNestaSessao != null ? String(pfIdNestaSessao).trim() : '';
  if (pf) return false;
  return temFaltantes(resolucao);
}

/** Grava PF + catálogo do POST na mesma linha; nunca usa índice de lote de IDs. */
export function sessaoComPfDoCatalogo(procedimentosSessao, catalogoId, pfId, activeIndex = 0) {
  const cat = catalogoId != null ? String(catalogoId).trim() : '';
  const id = pfId != null ? String(pfId).trim() : '';
  const prev = Array.isArray(procedimentosSessao) ? procedimentosSessao.slice() : [];
  if (!cat || !id) return prev;
  const patch = {
    id,
    nomeProcedimentoCatalogoId: cat,
    catalogoProcedimentoSaudeId: cat,
  };
  const idx = prev.findIndex((item) => catalogoIdDoItemSessao(item) === cat);
  if (idx >= 0) {
    prev[idx] = { ...prev[idx], ...patch };
    return prev;
  }
  const ai = Number.isInteger(activeIndex) && activeIndex >= 0 ? activeIndex : 0;
  const active = prev[ai] || {};
  const activeCat = catalogoIdDoItemSessao(active);
  if (!activeCat || activeCat === cat) {
    while (prev.length <= ai) prev.push({});
    prev[ai] = { ...prev[ai], ...patch };
    return prev;
  }
  prev.push(patch);
  return prev;
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
