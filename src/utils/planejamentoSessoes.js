import { RETORNO_TIPO_CODIGO } from './agendaTipoProcedimento.js';

const INACTIVE_SESSAO_STATUSES = new Set(['reagendado', 'cancelado', 'realizado']);

function normalizeSessaoStatus(sessao) {
  return String(sessao?.statusCodigo ?? sessao?.status ?? '')
    .trim()
    .toLowerCase();
}

function normalizeSessao(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const agendaId = raw.agendaId ?? raw.id;
  if (agendaId == null || String(agendaId).trim() === '') return null;
  return {
    agendaId: String(agendaId),
    dataAgendamento: raw.dataAgendamento ?? raw.data ?? null,
    horaInicio: raw.horaInicio ?? null,
    horaFim: raw.horaFim ?? null,
    statusCodigo: raw.statusCodigo ?? raw.status ?? null,
    profissionalRoleUserId: raw.profissionalRoleUserId ?? null,
    catalogoProcedimentoSaudeId:
      raw.catalogoProcedimentoSaudeId ?? raw.catalogoId ?? null,
    tipoProcedimentoCodigo: String(
      raw.tipoProcedimentoCodigo ?? raw.tipoProcedimento?.codigo ?? '',
    )
      .trim()
      .toLowerCase(),
    procedimentoFeitoOrigemId:
      raw.procedimentoFeitoOrigemId ?? raw.procedimento_feito_origem_id ?? null,
    procedimentoFeitoId:
      raw.procedimentoFeitoId ?? raw.procedimento_feito_id ?? null,
  };
}

/** Normaliza `sessoes[]` ou objeto singular `sessao` para array. */
export function coerceSessoesArray(raw) {
  if (Array.isArray(raw?.sessoes)) return raw.sessoes;
  if (Array.isArray(raw)) return raw;
  const singular = raw?.sessao ?? raw?.sessoes;
  if (singular && typeof singular === 'object' && !Array.isArray(singular)) {
    return [singular];
  }
  if (Array.isArray(singular)) return singular;
  return [];
}

export function isSessaoRetorno(sessao) {
  return (
    String(sessao?.tipoProcedimentoCodigo ?? '')
      .trim()
      .toLowerCase() === RETORNO_TIPO_CODIGO
  );
}

function pickSessaoFromList(list) {
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return [...list].sort((a, b) => {
    const da = `${a.dataAgendamento ?? ''}T${a.horaInicio ?? ''}`;
    const db = `${b.dataAgendamento ?? ''}T${b.horaInicio ?? ''}`;
    return db.localeCompare(da);
  })[0];
}

function filterSessoesAtivas(sessoes, { retornoOnly = false } = {}) {
  return (Array.isArray(sessoes) ? sessoes : [])
    .map(normalizeSessao)
    .filter(Boolean)
    .filter((s) => !INACTIVE_SESSAO_STATUSES.has(normalizeSessaoStatus(s)))
    .filter((s) => (retornoOnly ? isSessaoRetorno(s) : !isSessaoRetorno(s)));
}

/**
 * Escolhe a sessão de agenda “ativa” de procedimento (exclui retorno, reagendado/cancelado/realizado).
 * Prefere a mais recente por data+hora quando há múltiplas candidatas.
 */
export function pickSessaoAtiva(sessoes) {
  return pickSessaoFromList(filterSessoesAtivas(sessoes, { retornoOnly: false }));
}

/**
 * Escolhe a sessão de agenda realizada vinculada ao item (exclui retorno).
 * Prefere a mais recente por data+hora quando há múltiplas candidatas.
 */
export function pickSessaoRealizada(sessoes) {
  const realizadas = (Array.isArray(sessoes) ? sessoes : [])
    .map(normalizeSessao)
    .filter(Boolean)
    .filter((s) => normalizeSessaoStatus(s) === 'realizado' && !isSessaoRetorno(s));
  return pickSessaoFromList(realizadas);
}

/**
 * Escolhe a sessão de retorno “ativa” vinculada ao item (só tipo retorno).
 */
export function pickSessaoRetornoAtiva(sessoes) {
  return pickSessaoFromList(filterSessoesAtivas(sessoes, { retornoOnly: true }));
}

/**
 * Escolhe a sessão de retorno “realizada” vinculada ao item (só tipo retorno).
 * Prefere a mais recente por data+hora quando há múltiplas candidatas.
 */
export function pickSessaoRetornoRealizada(sessoes) {
  const realizadas = (Array.isArray(sessoes) ? sessoes : [])
    .map(normalizeSessao)
    .filter(Boolean)
    .filter((s) => normalizeSessaoStatus(s) === 'realizado' && isSessaoRetorno(s));
  return pickSessaoFromList(realizadas);
}

/**
 * Extrai mapa { planejamentoItemId → sessão } a partir do GET /planejamentos/{id}.
 */
export function sessoesMapFromDetalhe(detalhe) {
  const map = {};
  for (const item of detalhe?.itens ?? []) {
    const itemId = item.planejamentoItemId ?? item.id;
    const sessoes = coerceSessoesArray(item);
    const ativa = pickSessaoAtiva(sessoes);
    if (itemId && ativa) {
      map[String(itemId)] = ativa;
    }
  }
  return map;
}
