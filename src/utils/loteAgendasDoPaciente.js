import { STATUS_FECHADOS } from '../components/consulta/consultaServidor.js';
import { findEntryForAppointmentId, getAppointmentsFromEntry } from './agendaDayInsights.js';

/** Status de agenda que ainda vão ser atendidos. */
export const STATUS_AGENDA_ATIVOS = Object.freeze(['pendente', 'aguardando_confirmacao', 'confirmado']);

/**
 * B-42 F2: linhas de UM card → lote do "Iniciar atendimento".
 * Mapeamento idêntico ao da Agenda (AgendaDashboard, handlePrimary).
 * @param {Array<object>} linhas linhas do dashboard (`mapAgendaDtoToDashboardRow`) do card
 */
export function loteDasLinhas(linhas) {
  return (Array.isArray(linhas) ? linhas : []).map((a) => ({
    agendaId: a.id || a.agendaId,
    procedimentoNome: a.tipoProcedimento?.nome || a.procedimentoNome,
    catalogoProcedimentoSaudeId: a.catalogoProcedimentoSaudeId,
    planejamentoItemId: a.planejamentoItemId ?? null,
  }));
}

/**
 * B-42 F2: linhas do card de hoje (`kpi.entradasHoje`, mesmo agrupamento da Agenda) que contém a agenda.
 * Agenda fora dos cards → só o próprio slot.
 * @param {Array<object>} entradasHoje cards (`agruparAgendamentosHojePulse`)
 * @param {string} agendaId
 * @param {object} [slot] linha clicada (volta sozinha quando o card não é achado)
 */
export function linhasDoCard(entradasHoje, agendaId, slot) {
  const entrada = findEntryForAppointmentId(entradasHoje, agendaId);
  const linhas = entrada ? getAppointmentsFromEntry(entrada) : [];
  if (linhas.length > 0) return linhas;
  return slot ? [slot] : [];
}

/** Agenda ativa e sem consulta em andamento (sem consulta, ou consulta encerrada/cancelada/abandonada). */
function agendaNaoIniciada(linha) {
  if (!STATUS_AGENDA_ATIVOS.includes(String(linha?.status || '').toLowerCase())) return false;
  const atendimentoId = linha?.atendimentoId == null ? '' : String(linha.atendimentoId).trim();
  if (!atendimentoId) return true;
  // Status da consulta (tb_atendimento) fechada não segura a agenda (abandonada = normal, como no card): a mesma
  // lista da tela da consulta (consultaServidor.js).
  return STATUS_FECHADOS.has(String(linha?.atendimentoStatusCodigo || '').toLowerCase());
}

function hhmm(raw) {
  const m = String(raw ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

function pacienteDaLinha(linha) {
  return String(linha?.pacienteId || linha?.paciente?.id || '').trim();
}

/**
 * B-42 F2: card do atalho "escolher paciente", entre os cards de hoje do paciente com agenda ativa e não iniciada:
 * 1) em andamento (início ≤ agora < fim); 2) já passado, o mais recente (maior fim ≤ agora); 3) o próximo
 * (menor início > agora). Nenhum → null.
 * @param {Array<object>} entradasHoje cards (`agruparAgendamentosHojePulse`)
 * @param {string} pacienteId
 * @param {string} agora `"YYYY-MM-DD HH:mm"` no fuso da clínica (`nowComparableDateTimeClinica`)
 * @returns {{ linhas: Array<object>, primeira: object } | null} linhas do card e a 1ª agenda não iniciada dele
 */
export function cardDoAtalho(entradasHoje, pacienteId, agora) {
  const pid = String(pacienteId || '').trim();
  const agoraTxt = String(agora || '');
  if (!pid || !agoraTxt) return null;

  const candidatos = [];
  for (const entrada of Array.isArray(entradasHoje) ? entradasHoje : []) {
    const linhas = getAppointmentsFromEntry(entrada);
    if (!linhas.length || linhas.some((l) => pacienteDaLinha(l) !== pid)) continue;
    const primeira = linhas.find(agendaNaoIniciada);
    if (!primeira) continue;
    const data = String(entrada.data || linhas[0]?.data || '').slice(0, 10);
    const ini = hhmm(entrada.kind === 'group' ? entrada.horaInicio : linhas[0]?.horaInicio);
    if (!data || !ini) continue;
    const fim = hhmm(entrada.kind === 'group' ? entrada.horaFim : linhas[0]?.horaFim) || ini;
    candidatos.push({ linhas, primeira, inicio: `${data} ${ini}`, fim: `${data} ${fim}` });
  }

  const emAndamento = candidatos.find((c) => c.inicio <= agoraTxt && agoraTxt < c.fim);
  if (emAndamento) return { linhas: emAndamento.linhas, primeira: emAndamento.primeira };

  let passado = null;
  for (const c of candidatos) {
    if (c.fim <= agoraTxt && (!passado || c.fim > passado.fim)) passado = c;
  }
  if (passado) return { linhas: passado.linhas, primeira: passado.primeira };

  let proximo = null;
  for (const c of candidatos) {
    if (c.inicio > agoraTxt && (!proximo || c.inicio < proximo.inicio)) proximo = c;
  }
  return proximo ? { linhas: proximo.linhas, primeira: proximo.primeira } : null;
}
