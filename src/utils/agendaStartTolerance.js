import { getGuaranteedNow } from './serverTime.js';

/** Margem técnica ±min para iniciar sem modal (mesmo dia). */
export const MARGEM_TECNICA_MIN = 10;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Instante local a partir de data YYYY-MM-DD + hora HH:MM ou HH:MM:SS.
 * @param {string} dataIso
 * @param {string} horaInicio
 * @returns {Date | null}
 */
export function parseSlotLocalDateTime(dataIso, horaInicio) {
  const dk = String(dataIso || '').trim().slice(0, 10);
  const hmRaw = String(horaInicio || '').trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hmRaw);
  if (!dk || dk.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dk) || !m) return null;
  const [_, hhStr, mmStr] = m;
  const hour = Number(hhStr);
  const minute = Number(mmStr);
  const [y, mo, d] = dk.split('-').map(Number);
  if (![y, mo, d].every((x) => Number.isFinite(x))) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return new Date(y, mo - 1, d, hour, minute, 0, 0);
}

/**
 * Minutos (agendado − agora). Positivo = agendamento no futuro.
 * @param {Date} scheduledAt
 * @param {Date} [now]
 */
export function diffScheduledMinusNowMinutes(scheduledAt, now = getGuaranteedNow()) {
  return (scheduledAt.getTime() - now.getTime()) / 60000;
}

/** HH:MM para exibição (relógio local do Date). */
export function formatClockHHMM(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Hora atual local HH:MM para query ao backend. */
export function formatNowHHMM(now = getGuaranteedNow()) {
  return formatClockHHMM(now);
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
