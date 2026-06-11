import { deriveAgendaSlotStatus } from './agendaMapping.js';
import {
  dayBoundsFromWindows,
  getDayWindowsForIso,
  intervalWithinWindows,
} from './disponibilidadeDayWindows.js';

/** Alinhar à grade semanal em WeekTimeGrid.jsx (comentário de sincronização). */
export const AGENDA_DAY_START_MIN = 7 * 60;
export const AGENDA_DAY_END_MIN = 20 * 60;
export const AGENDA_SLOT_STEP_MIN = 30;

const ACTIVE_OCCUPANCY_STATUSES = new Set(['pendente', 'confirmado', 'aguardando_confirmacao']);

export function isAgendaDtoBloqueio(dto) {
  if (!dto) return false;
  return String(dto.tipoProcedimentoCodigo || '').toLowerCase() === 'bloqueio';
}

/** Status ativos para cálculo de ocupação (spec PR-4). */
export function isAgendaDtoActiveForOccupancy(dto) {
  if (!dto || typeof dto !== 'object') return false;
  if (dtoLooksCancelled(dto)) return false;
  const status = deriveAgendaSlotStatus(dto);
  if (ACTIVE_OCCUPANCY_STATUSES.has(status)) return true;
  if (isAgendaDtoBloqueio(dto)) return true;
  return false;
}

export function dtoIntervalMinutes(dto) {
  const hi = dto.horaInicio != null ? String(dto.horaInicio).slice(0, 5) : '';
  const hf = dto.horaFim != null ? String(dto.horaFim).slice(0, 5) : '';
  const start = parseHhmmToMinutes(hi);
  let end = parseHhmmToMinutes(hf);
  if (end <= start) end = start + 45;
  return { startMin: start, endMin: end };
}

function dtoDateIso(dto) {
  return dto?.dataAgendamento ? String(dto.dataAgendamento).slice(0, 10) : '';
}

/**
 * Segmentos ocupados com metadados para lista de slots.
 * @returns {Array<{startMin: number, endMin: number, kind: 'bloqueio'|'atendimento', dto: object}>}
 */
export function occupiedSegmentsFromAgendaDtos(dtos, opts = {}) {
  const { profissionalRoleUserId, excludeAgendaId } = opts;
  const list = Array.isArray(dtos) ? dtos : [];
  const segments = [];
  for (const dto of list) {
    if (!dto) continue;
    if (excludeAgendaId && String(dto.id) === String(excludeAgendaId)) continue;
    if (!isAgendaDtoActiveForOccupancy(dto)) continue;
    if (profissionalRoleUserId) {
      const dtoProf = dto.profissionalRoleUserId ?? dto.roleUserId;
      if (dtoProf != null && String(dtoProf) !== String(profissionalRoleUserId)) continue;
    }
    const { startMin, endMin } = dtoIntervalMinutes(dto);
    segments.push({
      startMin,
      endMin,
      kind: isAgendaDtoBloqueio(dto) ? 'bloqueio' : 'atendimento',
      dto,
    });
  }
  return segments;
}

export function segmentsForDayIso(dtos, iso, opts = {}) {
  const day = String(iso || '').slice(0, 10);
  return occupiedSegmentsFromAgendaDtos(dtos, opts).filter((s) => dtoDateIso(s.dto) === day);
}

export function parseHhmmToMinutes(t) {
  if (t == null || t === '') return 0;
  const parts = String(t).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

export function minutesToHhmm(totalMin) {
  const t = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dtoLooksCancelled(dto) {
  if (!dto || typeof dto !== 'object') return false;
  const codigo = String(dto.statusCodigo || '').toLowerCase();
  const nomeStatus = String(dto.statusNome || '').toLowerCase();
  return codigo.includes('cancel') || nomeStatus.includes('cancel');
}

/** Intervalos [startMin, endMin) em minutos do dia. */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Um slot de agenda (ex.: grade semanal 30 min) está ocupado se intersecta
 * [horaInicio, horaInicio + duracaoMin) de algum item cujo status !== 'cancelado'.
 * @param {Array} dayAppointments linhas do dashboard (status, horaInicio, duracaoMin)
 * @param {number} slotStartMin minuto do dia no início do slot
 * @param {number} [slotDurationMin=30]
 */
export function isSlotOccupied(dayAppointments, slotStartMin, slotDurationMin = 30) {
  const slotEnd = slotStartMin + slotDurationMin;
  for (const appt of dayAppointments || []) {
    if (appt?.status === 'cancelado') continue;
    const start = parseHhmmToMinutes(appt?.horaInicio);
    const dur = Number(appt?.duracaoMin) || 45;
    if (intervalsOverlap(slotStartMin, slotEnd, start, start + dur)) return true;
  }
  return false;
}

/**
 * Extrai intervalos ocupados de DTOs crus do by-range.
 * @param {Array} dtos
 * @param {{ excludeCancelled?: boolean, profissionalRoleUserId?: string }} opts
 */
export function occupiedIntervalsFromAgendaDtos(dtos, opts = {}) {
  const { excludeCancelled = true, profissionalRoleUserId, excludeAgendaId, activeOnly = false } = opts;
  const list = Array.isArray(dtos) ? dtos : [];
  const intervals = [];
  for (const dto of list) {
    if (!dto) continue;
    if (excludeAgendaId && String(dto.id) === String(excludeAgendaId)) continue;
    if (activeOnly) {
      if (!isAgendaDtoActiveForOccupancy(dto)) continue;
    } else if (excludeCancelled && dtoLooksCancelled(dto)) continue;
    if (profissionalRoleUserId) {
      const dtoProf = dto.profissionalRoleUserId ?? dto.roleUserId;
      if (dtoProf != null && String(dtoProf) !== String(profissionalRoleUserId)) continue;
    }
    const { startMin, endMin } = dtoIntervalMinutes(dto);
    intervals.push({ startMin, endMin });
  }
  return intervals;
}

export function proposalOverlapsOccupied(horaInicio, duracaoMin, occupied) {
  const start = parseHhmmToMinutes(String(horaInicio || '').slice(0, 5));
  const dur = Number(duracaoMin) || 45;
  const end = start + dur;
  for (const o of occupied) {
    if (intervalsOverlap(start, end, o.startMin, o.endMin)) return true;
  }
  return false;
}

/** Hora (HH:mm) do primeiro intervalo ocupado que intersecta a proposta. */
export function findFirstConflictHhmm(horaInicio, duracaoMin, occupied) {
  const start = parseHhmmToMinutes(String(horaInicio || '').slice(0, 5));
  const dur = Number(duracaoMin) || 45;
  const end = start + dur;
  for (const o of occupied || []) {
    if (intervalsOverlap(start, end, o.startMin, o.endMin)) {
      return minutesToHhmm(o.startMin);
    }
  }
  return null;
}

/**
 * Próximo início (HH:mm) sem sobreposição com occupied, a partir de `fromMin` inclusive, em passos de stepMin.
 */
export function findNextFreeSlotStart(fromMin, durationMin, occupied, dayStartMin, dayEndMin, stepMin) {
  const dur = Number(durationMin) || 45;
  const step = Math.max(5, Number(stepMin) || AGENDA_SLOT_STEP_MIN);
  let t = Math.max(dayStartMin, Math.ceil(fromMin / step) * step);
  const lastStart = dayEndMin - dur;
  while (t <= lastStart) {
    const end = t + dur;
    let clash = false;
    for (const o of occupied) {
      if (intervalsOverlap(t, end, o.startMin, o.endMin)) {
        clash = true;
        break;
      }
    }
    if (!clash) return minutesToHhmm(t);
    t += step;
  }
  return null;
}

function parseIsoLocalDate(iso) {
  const s = String(iso || '').slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function listIsosInMonth(monthDate) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  const isos = [];
  for (let d = 1; d <= last; d += 1) {
    isos.push(`${y}-${pad(m + 1)}-${pad(d)}`);
  }
  return isos;
}

function nowMinutesLocal() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/**
 * Primeiro slot livre a partir de startIso/startHora, varrendo dias dos meses em monthDates.
 * @returns {{ iso: string, hhmm: string } | null}
 */
export function findNextFreeSlotAcrossDays({
  startIso,
  startHora,
  duracaoMin,
  dtos,
  disponibilidade,
  todayIso,
  excludeAgendaId,
  profissionalRoleUserId,
  monthDates = [],
  stepMin = AGENDA_SLOT_STEP_MIN,
}) {
  const dur = Number(duracaoMin) || 45;
  const step = Math.max(5, Number(stepMin) || AGENDA_SLOT_STEP_MIN);
  const today = String(todayIso || '').slice(0, 10);
  const anchor = String(startIso || today).slice(0, 10);

  const allIsos = [];
  for (const md of monthDates) {
    if (md instanceof Date && !Number.isNaN(md.getTime())) {
      allIsos.push(...listIsosInMonth(md));
    }
  }
  let uniqueSorted = [...new Set(allIsos)].sort();
  if (!uniqueSorted.length && anchor) {
    uniqueSorted = [anchor];
  }

  for (const iso of uniqueSorted) {
    if (iso < today) continue;
    if (iso < anchor) continue;

    // TODO PR2: aplicar getDayWindowsWithFallback para respeitar janelas comerciais em prof zerado
    const windows = getDayWindowsForIso(iso, disponibilidade);
    if (!windows.length) continue;

    const { dayStartMin, dayEndMin } = dayBoundsFromWindows(windows);
    const dayOccupied = occupiedIntervalsFromAgendaDtos(
      (Array.isArray(dtos) ? dtos : []).filter((d) => dtoDateIso(d) === iso),
      { profissionalRoleUserId, excludeAgendaId, activeOnly: true }
    );

    let fromMin = dayStartMin;
    if (iso === today) {
      fromMin = Math.max(fromMin, nowMinutesLocal());
    }
    if (iso === anchor && startHora) {
      fromMin = Math.max(fromMin, parseHhmmToMinutes(String(startHora).slice(0, 5)));
    }

    const hhmm = findNextFreeSlotStart(fromMin, dur, dayOccupied, dayStartMin, dayEndMin, step);
    if (!hhmm) continue;

    const t = parseHhmmToMinutes(hhmm);
    if (intervalWithinWindows(t, t + dur, windows)) {
      return { iso, hhmm };
    }
  }
  return null;
}

export function addDaysToIso(iso, delta) {
  const date = parseIsoLocalDate(iso);
  date.setDate(date.getDate() + delta);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
