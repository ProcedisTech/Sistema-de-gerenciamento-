import { minutesToHhmm, parseHhmmToMinutes } from './agendaAvailability.js';
import { intervalWithinWindows } from './disponibilidadeDayWindows.js';

export const SLOT_STEP_MIN = 30;

/** horaFimSlot guarda o término real do atendimento (não o início do último bloco). */
export function deriveDuracaoFromRange(horaInicio, horaFimSlot) {
  const start = parseHhmmToMinutes(horaInicio);
  const fimMin = parseHhmmToMinutes(horaFimSlot);
  if (!horaInicio || !horaFimSlot || fimMin < start + SLOT_STEP_MIN) return 0;
  return fimMin - start;
}

/** Alias de display — horaFimSlot já é o término real. */
export function deriveHoraFimReal(horaFimSlot) {
  if (!horaFimSlot) return '';
  return String(horaFimSlot).slice(0, 5);
}

export function deriveRangePhase(horaInicio, horaFimSlot) {
  if (!horaInicio) return 'idle';
  if (!horaFimSlot) return 'awaitingEnd';
  return 'complete';
}

/**
 * Divisão A1: base em múltiplos de 5; último procedimento absorve o resto.
 * @param {number} totalMin
 * @param {number} n
 * @returns {number[]}
 */
export function divideDuracaoEntreProcedimentos(totalMin, n) {
  const count = Math.max(1, Number(n) || 1);
  const total = Math.max(0, Number(totalMin) || 0);
  const base = Math.floor(total / count / 5) * 5;
  const durations = Array.from({ length: count }, () => base);
  const sum = base * count;
  durations[count - 1] += total - sum;
  return durations;
}

function slotBlocksRange(slot) {
  if (!slot) return true;
  if (slot.state === 'ocupado' || slot.state === 'bloqueio') return true;
  return slot.clickable === false;
}

/**
 * Verifica se o range [inicioMin, fimMin) é contíguo e livre.
 */
export function isRangeContiguous(gradeSlots, inicioMin, fimMin, windows, dayEndMin) {
  if (fimMin < inicioMin + SLOT_STEP_MIN) return false;
  if (fimMin > dayEndMin) return false;
  if (!intervalWithinWindows(inicioMin, fimMin, windows)) return false;

  const byStart = new Map((gradeSlots || []).map((s) => [s.startMin, s]));
  for (let t = inicioMin; t < fimMin; t += SLOT_STEP_MIN) {
    const slot = byStart.get(t);
    if (!slot || slotBlocksRange(slot)) return false;
  }
  return true;
}

/**
 * Dado início, retorna Set de hhmm válidos como término (início+30, início+60, …, dayEndMin).
 * Para no primeiro obstáculo; último término válido é inclusivo.
 */
export function computeValidFimSlots(gradeSlots, inicioMin, windows, dayEndMin) {
  const valid = new Set();
  if (inicioMin == null || !Array.isArray(gradeSlots)) return valid;

  let fim = inicioMin + SLOT_STEP_MIN;
  while (fim <= dayEndMin) {
    if (!isRangeContiguous(gradeSlots, inicioMin, fim, windows, dayEndMin)) break;
    valid.add(minutesToHhmm(fim));
    fim += SLOT_STEP_MIN;
  }

  return valid;
}

/**
 * Gera candidatos de término para a régua awaitingEnd: início+30 … dayEndMin.
 */
export function buildFimTerminoRuler(inicioMin, dayEndMin) {
  const rows = [];
  if (inicioMin == null) return rows;
  for (let fim = inicioMin + SLOT_STEP_MIN; fim <= dayEndMin; fim += SLOT_STEP_MIN) {
    rows.push({ fimMin: fim, hhmm: minutesToHhmm(fim) });
  }
  return rows;
}
