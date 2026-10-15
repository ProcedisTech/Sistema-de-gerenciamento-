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
    // Um ID igual ao catalogoId não é um Procedimento Feito (PF) persistido
    if (pid && pid !== cat) return pid;
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

/**
 * Detalha os termos faltantes com seus títulos e a lista de procedimentos que os exigem.
 */
export function detalharTermosFaltantes(resolucao) {
  if (!resolucao || !Array.isArray(resolucao.faltantes) || resolucao.faltantes.length === 0) {
    return [];
  }
  const exigidos = Array.isArray(resolucao.termosExigidos) ? resolucao.termosExigidos : [];
  return resolucao.faltantes.map((f) => {
    const termoId = f && f.termoId != null ? String(f.termoId) : '';
    const titulo = f && f.titulo != null ? String(f.titulo).trim() : 'Termo';
    const exigido = exigidos.find((e) => String(e.termoId) === termoId);
    const procedimentos = Array.isArray(exigido?.catalogos)
      ? exigido.catalogos.map((c) => (c && c.nome ? String(c.nome).trim() : '')).filter(Boolean)
      : [];
    return {
      termoId,
      titulo,
      procedimentos,
    };
  });
}

/** Créditos vigentes do catálogo, aguardando o PF consumir. */
export function consentimentosAguardandoExecucao(resolucao) {
  if (!resolucao || !Array.isArray(resolucao.termosExigidos)) {
    return [];
  }
  return resolucao.termosExigidos
    .filter((e) => e && e.vigente && e.assinaturaId)
    .map((e) => ({
      termoId: e.termoId != null ? String(e.termoId) : '',
      titulo: e.titulo != null ? String(e.titulo).trim() : 'Termo',
      assinadoEm: e.assinadoEm || null,
      procedimentos: Array.isArray(e.catalogos)
        ? e.catalogos.map((c) => (c && c.nome ? String(c.nome).trim() : '')).filter(Boolean)
        : [],
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
      add(p?.nomeProcedimentoCatalogoId || p?.catalogoProcedimentoSaudeId || p?.catalogoId);
    }
  }
  return ids;
}

/**
 * Procedimentos do catálogo que não possuem termo de consentimento vinculado
 * na clínica (dispensados de termo). Extraído do campo procedimentosSemVinculo do DTO.
 */
export function procedimentosSemTermoExigido(resolucao) {
  if (!resolucao) return [];
  const list = resolucao.procedimentosSemVinculo || resolucao.semVinculo || [];
  return Array.isArray(list) ? list : [];
}

/**
 * Retorna o status do termo de consentimento para um procedimento específico
 * a partir do TermoResolucaoDTO: 'pendente' | 'assinado' | 'dispensado' | 'desconhecido'
 */
export function statusTermoPorProcedimento(catalogoId, resolucao) {
  if (!resolucao) return { status: 'desconhecido', rotulo: 'Em verificação' };
  const cid = catalogoId != null ? String(catalogoId).trim() : '';
  if (!cid) return { status: 'desconhecido', rotulo: 'Não identificado' };

  // 1. Procedimento sem vínculo (dispensado explicitamente pelo backend)
  const semVinculo = procedimentosSemTermoExigido(resolucao);
  if (semVinculo.some((p) => String(p.catalogoId || p.id) === cid)) {
    return { status: 'dispensado', rotulo: 'Não requer termo de consentimento (Dispensado)' };
  }

  // 2. Verificar se termo exigido está pendente (em faltantes)
  const exigidos = Array.isArray(resolucao.termosExigidos) ? resolucao.termosExigidos : [];
  const faltantes = Array.isArray(resolucao.faltantes) ? resolucao.faltantes : [];
  const faltantesIds = new Set(faltantes.map((f) => String(f.termoId)));

  for (const ex of exigidos) {
    const pertenca = Array.isArray(ex.catalogos) && ex.catalogos.some((c) => String(c.catalogoId || c.id) === cid);
    if (pertenca) {
      if (faltantesIds.has(String(ex.termoId))) {
        return { status: 'pendente', rotulo: `Pendente (${ex.titulo || 'Termo'})`, titulo: ex.titulo };
      }
      if (ex.vigente) {
        return { status: 'assinado', rotulo: `Termo assinado (${ex.titulo || 'Termo'})`, titulo: ex.titulo };
      }
    }
  }

  return { status: 'dispensado', rotulo: 'Não requer termo de consentimento (Dispensado)' };
}

