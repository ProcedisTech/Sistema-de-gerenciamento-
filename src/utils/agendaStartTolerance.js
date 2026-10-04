import { getGuaranteedNow } from './serverTime.js';
import { agoraDaClinica, instanteDoHorarioDaClinica } from './datasClinica.js';

/** Margem técnica ±min para iniciar sem modal (mesmo dia). */
export const MARGEM_TECNICA_MIN = 10;

/**
 * Instante do horário de calendário do agendamento (data YYYY-MM-DD + hora HH:MM[:SS]) no fuso da clínica.
 * @param {string} dataIso
 * @param {string} horaInicio
 * @param {string} fuso IANA da clínica
 * @returns {Date | null}
 */
export function parseSlotLocalDateTime(dataIso, horaInicio, fuso) {
  const dk = String(dataIso || '').trim().slice(0, 10);
  const hm = String(horaInicio || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dk) || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(hm)) return null;
  const ms = instanteDoHorarioDaClinica(dk, hm, fuso);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * Minutos (agendado − agora). Positivo = agendamento no futuro.
 * @param {Date} scheduledAt
 * @param {Date} [now]
 */
export function diffScheduledMinusNowMinutes(scheduledAt, now = getGuaranteedNow()) {
  return (scheduledAt.getTime() - now.getTime()) / 60000;
}

/** Ex.: "25 min de antecedência" (scheduled ahead of now). */
export function formatAntecedenciaText(diffMinScheduledMinusNow) {
  const n = Math.max(0, Math.round(diffMinScheduledMinusNow));
  return `${n} min de antecedência`;
}

/** Ex.: "2h 15min de atraso" a partir de minutos positivos de atraso. */
export function formatAtrasoText(latenessMinutesPositive) {
  const total = Math.max(0, Math.round(latenessMinutesPositive));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} min de atraso`;
  if (m <= 0) return `${h}h de atraso`;
  return `${h}h${m}min de atraso`;
}

/**
 * Decide se o início do atendimento de um agendamento de hoje vai direto ou pede o modal de tolerância.
 * "Previsto" é o HH:mm do próprio agendamento; "Agora" é o relógio da clínica.
 * @param {{ dataIso: string, hora: string, fuso: string, agoraMs?: number }} params
 * @returns {{ acao: 'direto' | 'early' | 'late' | 'invalido', scheduledTimeLabel?: string, nowTimeLabel?: string, antecedenciaTexto?: string, atrasoTexto?: string }}
 */
export function avaliarInicioAgendamento({ dataIso, hora, fuso, agoraMs = getGuaranteedNow().getTime() }) {
  const scheduledAt = parseSlotLocalDateTime(dataIso, hora, fuso);
  if (!scheduledAt) return { acao: 'invalido' };

  const diffMin = diffScheduledMinusNowMinutes(scheduledAt, new Date(agoraMs));
  if (Math.abs(diffMin) <= MARGEM_TECNICA_MIN) return { acao: 'direto' };

  const [hh, mm] = String(hora).trim().split(':');
  const scheduledTimeLabel = `${hh.padStart(2, '0')}:${mm}`;
  const nowTimeLabel = agoraDaClinica(fuso, agoraMs).hhmm;

  if (diffMin > MARGEM_TECNICA_MIN) {
    return {
      acao: 'early',
      scheduledTimeLabel,
      nowTimeLabel,
      antecedenciaTexto: formatAntecedenciaText(diffMin),
    };
  }

  return {
    acao: 'late',
    scheduledTimeLabel,
    nowTimeLabel,
    atrasoTexto: formatAtrasoText(-diffMin),
  };
}
