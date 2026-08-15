import { parseSlotLocalDateTime } from './agendaStartTolerance.js';

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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateToHhmm(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDateToDdMm(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

/**
 * Calcula o badge de pontualidade (Atraso / Adiantamento / No horário)
 * comparando o horário agendado com o horário real de execução.
 * 
 * Tolerância: ±5 minutos = No horário.
 * 
 * @param {object} appointment Objeto do agendamento
 * @param {string} [attendanceStartTimeIso] Iso string da hora em que iniciou o atendimento
 * @returns {{ type: 'adiantado' | 'atrasado' | 'pontual', label: string, badgeClass: string } | null}
 */
export function getTimingBadge(appointment, attendanceStartTimeIso = null) {
  if (!appointment) return null;

  const dataIso = appointment.dataAgendamento || appointment.data;
  const horaAgendada = appointment.horaInicio;

  if (!dataIso || !horaAgendada) return null;

  const scheduledDate = parseSlotLocalDateTime(dataIso, horaAgendada);
  if (!scheduledDate) return null;

  // Prioridade da hora real:
  // 1. Parametro explicito attendanceStartTimeIso
  // 2. Prop no appointment (attendanceStartTimeIso / horaInicioReal)
  // 3. Data de criacao/execucao (procedimentoFeitoHoraInicio / criadoEm se status for realizado)
  const actualIso =
    attendanceStartTimeIso ||
    appointment.attendanceStartTimeIso ||
    appointment.horaInicioReal ||
    (appointment.status === 'realizado' ? appointment.criadoEm : null);

  if (!actualIso) return null;

  const actualDate = new Date(actualIso);
  if (Number.isNaN(actualDate.getTime())) return null;

  // Diff em minutos: (agendado - real)
  // Positivo => Real ocorreu ANTES do agendado (Adiantado)
  // Negativo => Real ocorreu DEPOIS do agendado (Atrasado)
  const diffMinutes = Math.round((scheduledDate.getTime() - actualDate.getTime()) / 60000);

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
 * @param {string} [attendanceStartTimeIso]
 * @returns {{ hasExecution: boolean, dataReal: string, horaInicioReal: string, horaFimReal: string, duracaoRealMin: number, duracaoText: string, rangeText: string, badge: object | null }}
 */
export function getExecutionSummary(appointment, attendanceStartTimeIso = null) {
  if (!appointment) {
    return { hasExecution: false, dataReal: '', horaInicioReal: '', horaFimReal: '', duracaoRealMin: 0, duracaoText: '', rangeText: '', badge: null };
  }

  const badge = getTimingBadge(appointment, attendanceStartTimeIso);

  const startIso =
    attendanceStartTimeIso ||
    appointment.attendanceStartTimeIso ||
    appointment.horaInicioReal ||
    (appointment.status === 'realizado' ? appointment.criadoEm : null);

  if (!startIso) {
    return { hasExecution: false, dataReal: '', horaInicioReal: '', horaFimReal: '', duracaoRealMin: 0, duracaoText: '', rangeText: '', badge: null };
  }

  const startDate = new Date(startIso);
  if (Number.isNaN(startDate.getTime())) {
    return { hasExecution: false, dataReal: '', horaInicioReal: '', horaFimReal: '', duracaoRealMin: 0, duracaoText: '', rangeText: '', badge: null };
  }

  const dataReal = formatDateToDdMm(startDate);
  const hiReal = appointment.horaInicioRealStr || formatDateToHhmm(startDate);

  let endDate;
  if (appointment.horaFimReal) {
    endDate = new Date(appointment.horaFimReal);
  } else if (appointment.status === 'realizado' && appointment.atualizadoEm) {
    endDate = new Date(appointment.atualizadoEm);
  } else {
    endDate = new Date();
  }

  const hfReal = appointment.horaFimRealStr || formatDateToHhmm(endDate);

  const diffMs = endDate.getTime() - startDate.getTime();
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
