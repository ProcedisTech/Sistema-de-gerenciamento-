/** Alinhar à grade semanal em WeekTimeGrid.jsx (comentário de sincronização). */
export const AGENDA_DAY_START_MIN = 7 * 60;
export const AGENDA_DAY_END_MIN = 20 * 60;
export const AGENDA_SLOT_STEP_MIN = 15;

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
  const { excludeCancelled = true, profissionalRoleUserId } = opts;
  const list = Array.isArray(dtos) ? dtos : [];
  const intervals = [];
  for (const dto of list) {
    if (!dto) continue;
    if (excludeCancelled && dtoLooksCancelled(dto)) continue;
    if (profissionalRoleUserId) {
      const dtoProf = dto.profissionalRoleUserId ?? dto.roleUserId;
      if (dtoProf != null && String(dtoProf) !== String(profissionalRoleUserId)) continue;
    }
    const hi = dto.horaInicio != null ? String(dto.horaInicio).slice(0, 5) : '';
    const hf = dto.horaFim != null ? String(dto.horaFim).slice(0, 5) : '';
    const start = parseHhmmToMinutes(hi);
    let end = parseHhmmToMinutes(hf);
    if (end <= start) end = start + 45;
    intervals.push({ startMin: start, endMin: end });
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
