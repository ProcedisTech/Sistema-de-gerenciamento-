import { parseSlotLocalDateTime } from './agendaStartTolerance.js';
import { getGuaranteedNow } from './serverTime.js';
import { formatarInstante, instanteMs } from './datasClinica.js';

/**
 * Formata duração em minutos para o formato amigável:
 * - < 60 min: "25 min"
 * - exatos múltiplos de 60: "2h", "11h"
 * - misto: "1h20min", "2h15min"
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatDurationText(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h}h`;
  return `${h}h${m}min`;
}

const EXECUCAO_VAZIA = { hasExecution: false, dataReal: '', horaInicioReal: '', horaFimReal: '', duracaoRealMin: 0, duracaoText: '', rangeText: '', badge: null };

/**
 * Horário da consulta ligada. Consulta cancelada não fornece horário (decisão do Johnn, 09/10): o fim dela é a hora
 * do cancelamento, não do atendimento — início e fim caem na regra de hoje.
 */
function horarioDaConsulta(appointment) {
  if (String(appointment.atendimentoStatusCodigo || '').toLowerCase() === 'cancelado') {
    return { inicio: null, fim: null };
  }
  return { inicio: appointment.atendimentoIniciadoEm || null, fim: appointment.atendimentoEncerradoEm || null };
}

/**
 * Início real: parâmetro explícito → `atendimentoIniciadoEm` (consulta ligada) → regra de hoje
 * (attendanceStartTimeIso / horaInicioReal / criadoEm se realizado). A consulta só troca a fonte do horário:
 * sem a regra de hoje haver execução, nada aparece (mesma visibilidade de antes).
 */
function inicioRealIso(appointment, attendanceStartTimeIso) {
  if (attendanceStartTimeIso) return attendanceStartTimeIso;
  const regraDeHoje =
    appointment.attendanceStartTimeIso ||
    appointment.horaInicioReal ||
    (appointment.status === 'realizado' ? appointment.criadoEm : null);
  if (!regraDeHoje) return null;
  return horarioDaConsulta(appointment).inicio || regraDeHoje;
}

/** Fim real: `horaFimReal` → `atendimentoEncerradoEm` (consulta ligada) → regra de hoje (atualizadoEm se realizado, senão agora). */
function fimRealMs(appointment) {
  if (appointment.horaFimReal) return instanteMs(appointment.horaFimReal);
  const { fim } = horarioDaConsulta(appointment);
  if (fim) return instanteMs(fim);
  if (appointment.status === 'realizado' && appointment.atualizadoEm) return instanteMs(appointment.atualizadoEm);
  return getGuaranteedNow().getTime();
}

/**
 * Calcula o badge de pontualidade (Atraso / Adiantamento / No horário)
 * comparando o horário agendado com o horário real de execução.
 * 
 * Tolerância: ±5 minutos = No horário.
 * 
 * @param {object} appointment Objeto do agendamento
 * @param {string} fuso IANA da clínica (converte o horário previsto)
 * @param {string} [attendanceStartTimeIso] Iso string da hora em que iniciou o atendimento
 * @returns {{ type: 'adiantado' | 'atrasado' | 'pontual', label: string, badgeClass: string } | null}
 */
export function getTimingBadge(appointment, fuso, attendanceStartTimeIso = null) {
  if (!appointment) return null;

  const dataIso = appointment.dataAgendamento || appointment.data;
  const horaAgendada = appointment.horaInicio;

  if (!dataIso || !horaAgendada) return null;

  const scheduledDate = parseSlotLocalDateTime(dataIso, horaAgendada, fuso);
  if (!scheduledDate) return null;

  // Prioridade da hora real:
  // 1. Parametro explicito attendanceStartTimeIso
  // 2. Início da consulta ligada (atendimentoIniciadoEm)
  // 3. Regra de hoje: prop no appointment (attendanceStartTimeIso / horaInicioReal) ou criadoEm se realizado
  const actualIso = inicioRealIso(appointment, attendanceStartTimeIso);

  if (!actualIso) return null;

  const actualMs = instanteMs(actualIso);
  if (Number.isNaN(actualMs)) return null;

  // Diff em minutos: (agendado - real)
  // Positivo => Real ocorreu ANTES do agendado (Adiantado)
  // Negativo => Real ocorreu DEPOIS do agendado (Atrasado)
  const diffMinutes = Math.round((scheduledDate.getTime() - actualMs) / 60000);

  // Tolerância de ±5 minutos
  if (Math.abs(diffMinutes) <= 5) {
    return {
      type: 'pontual',
      label: 'No horário',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (diffMinutes > 5) {
    // Adiantado
    return {
      type: 'adiantado',
      label: `Adiantado ${formatDurationText(diffMinutes)}`,
      badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    };
  }

  // Atrasado
  const latenessMin = Math.abs(diffMinutes);
  return {
    type: 'atrasado',
    label: `Atrasado ${formatDurationText(latenessMin)}`,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  };
}

/**
 * Retorna o resumo completo de execução de um atendimento (quando iniciado ou realizado)
 * inclui data real, faixa de horário real e duração real.
 * 
 * @param {object} appointment
 * @param {string} fuso IANA da clínica (horário previsto e exibição dos horários reais)
 * @param {string} [attendanceStartTimeIso]
 * @returns {{ hasExecution: boolean, dataReal: string, horaInicioReal: string, horaFimReal: string, duracaoRealMin: number, duracaoText: string, rangeText: string, badge: object | null }}
 */
export function getExecutionSummary(appointment, fuso, attendanceStartTimeIso = null) {
  if (!appointment) return { ...EXECUCAO_VAZIA };

  const badge = getTimingBadge(appointment, fuso, attendanceStartTimeIso);

  const startIso = inicioRealIso(appointment, attendanceStartTimeIso);

  if (!startIso) return { ...EXECUCAO_VAZIA };

  const startMs = instanteMs(startIso);
  if (Number.isNaN(startMs)) return { ...EXECUCAO_VAZIA };

  const dataReal = formatarInstante(startMs, fuso, 'diaMes');
  const hiReal = appointment.horaInicioRealStr || formatarInstante(startMs, fuso, 'hora');

  const endMs = fimRealMs(appointment);

  const hfReal = appointment.horaFimRealStr || (Number.isNaN(endMs) ? '' : formatarInstante(endMs, fuso, 'hora'));

  const diffMs = Number.isNaN(endMs) ? 0 : endMs - startMs;
  const rawMin = Math.round(diffMs / 60000);
  const duracaoRealMin = Math.max(1, rawMin >= 0 ? rawMin : 1);
  const duracaoText = `${duracaoRealMin} min`;
  
  let rangeText = '';
  if (hiReal && hfReal && hiReal !== hfReal) {
    rangeText = `${dataReal ? `${dataReal} · ` : ''}${hiReal}–${hfReal}`;
  } else {
    rangeText = `${dataReal ? `${dataReal} · ` : ''}${hiReal}`;
  }

  const fullText = `${rangeText} (${duracaoText})`;

  return {
    hasExecution: true,
    dataReal,
    horaInicioReal: hiReal,
    horaFimReal: hfReal,
    duracaoRealMin,
    duracaoText,
    rangeText,
    fullText,
    badge,
  };
}
