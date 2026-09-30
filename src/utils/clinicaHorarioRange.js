import { dayBoundsFromWindows, getDayWindowsForIso } from './disponibilidadeDayWindows.js';

/** Defaults da grade semanal (WeekTimeGrid). */
export const WEEK_DEFAULT_START_MIN = 7 * 60;
export const WEEK_DEFAULT_END_MIN = 20 * 60;

/** Defaults do trilho do dia (agendaRailHelpers). */
export const RAIL_DEFAULT_START_MIN = 6 * 60;
export const RAIL_DEFAULT_END_MIN = 22 * 60;

function timeToMinutes(t) {
  if (t == null || t === '') return 0;
  const parts = String(t).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function appointmentEndMin(appt, defaultDur = 45) {
  const start = timeToMinutes(appt?.horaInicio);
  const dur = Number(appt?.duracaoMin) || defaultDur;
  return start + dur;
}

/**
 * Range da grade semanal a partir do horário da clínica + stretch por agendamentos.
 * Sem janelas na semana → 07:00–20:00; depois estica para incluir todos os appts (floor/ceil 30 min).
 *
 * @param {string[]} weekDayIsos
 * @param {Array} clinicaHorarios — shape de OrganizacaoHorarioDTO / disponibilidade
 * @param {Array} appointments
 * @returns {{ startMin: number, endMin: number }}
 */
export function computeWeekRangeFromClinic(weekDayIsos, clinicaHorarios, appointments = []) {
  let min = Infinity;
  let max = -Infinity;
  let hasClinicWindow = false;

  for (const iso of weekDayIsos || []) {
    const windows = getDayWindowsForIso(iso, clinicaHorarios);
    if (!windows.length) continue;
    hasClinicWindow = true;
    const { dayStartMin, dayEndMin } = dayBoundsFromWindows(windows);
    if (dayStartMin < min) min = dayStartMin;
    if (dayEndMin > max) max = dayEndMin;
  }

  if (!hasClinicWindow) {
    min = WEEK_DEFAULT_START_MIN;
    max = WEEK_DEFAULT_END_MIN;
  }

  for (const appt of appointments || []) {
    if (!appt || !appt.horaInicio) continue;
    const start = timeToMinutes(appt.horaInicio);
    const end = appointmentEndMin(appt, 45);
    if (start < min) min = Math.floor(start / 30) * 30;
    if (end > max) max = Math.ceil(end / 30) * 30;
  }

  return {
    startMin: Math.max(0, min),
    endMin: Math.min(24 * 60 - 30, max),
  };
}

/**
 * Eixo do trilho do dia: janelas da clínica no dia (ou 06–22 se fechado/vazio) + stretch pelos appts.
 *
 * @param {string} iso
 * @param {Array} clinicaHorarios
 * @param {Array} appointments
 * @returns {{ startMin: number, endMin: number }}
 */
export function computeDayRailRange(iso, clinicaHorarios, appointments = []) {
  const windows = getDayWindowsForIso(iso, clinicaHorarios);
  let startMin = RAIL_DEFAULT_START_MIN;
  let endMin = RAIL_DEFAULT_END_MIN;

  if (windows.length > 0) {
    const bounds = dayBoundsFromWindows(windows);
    startMin = bounds.dayStartMin;
    endMin = bounds.dayEndMin;
  }

  for (const appt of appointments || []) {
    if (!appt || !appt.horaInicio) continue;
    const start = timeToMinutes(appt.horaInicio);
    const end = appointmentEndMin(appt, 45);
    if (start < startMin) startMin = start;
    if (end > endMin) endMin = end;
  }

  if (endMin < startMin + 30) endMin = startMin + 30;
  return {
    startMin: Math.max(0, startMin),
    endMin: Math.min(24 * 60, endMin),
  };
}

/**
 * Labels de hora par para o eixo do trilho (ex.: 6,8,…,22).
 * @param {number} startMin
 * @param {number} endMin
 * @returns {number[]} horas (0–23)
 */
export function hourLabelsForRange(startMin, endMin) {
  const first = Math.ceil(Math.max(0, startMin) / 60);
  const last = Math.floor(Math.min(24 * 60, endMin) / 60);
  let h = first % 2 === 0 ? first : first + 1;
  const labels = [];
  for (; h <= last; h += 2) {
    labels.push(h);
  }
  if (labels.length === 0 && last >= first) {
    labels.push(first);
  }
  return labels;
}
