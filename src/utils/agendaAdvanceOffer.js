import { intervalsOverlap, minutesToHhmm, parseHhmmToMinutes } from './agendaAvailability';

const VACANT_STATUSES = new Set(['cancelado', 'reagendado']);
const ACTIVE_STATUSES = new Set(['pendente', 'confirmado', 'aguardando_confirmacao']);

function profKey(appt) {
  return String(appt?.profissionalRoleUserId || appt?.roleUserId || '').trim();
}

function hhmmSlice(appt) {
  return String(appt?.horaInicio || '').slice(0, 5);
}

function vacantStartEndMin(prev) {
  const startMin = parseHhmmToMinutes(prev?.horaInicio);
  const raw = prev?.rawSlot;
  if (raw?.horaFim != null) {
    const endMin = parseHhmmToMinutes(String(raw.horaFim).slice(0, 5));
    if (endMin > startMin) return { startMin, endMin };
  }
  const dur = Number(prev?.duracaoMin);
  const endMin = startMin + (Number.isFinite(dur) && dur > 0 ? dur : 45);
  return { startMin, endMin };
}

function activeIntervalsForDay(dayRows, excludeAgendaId) {
  const intervals = [];
  for (const row of dayRows || []) {
    if (!row || row.tipo === 'bloqueio') continue;
    if (!ACTIVE_STATUSES.has(row.status)) continue;
    if (excludeAgendaId && String(row.id) === String(excludeAgendaId)) continue;
    const startMin = parseHhmmToMinutes(row.horaInicio);
    const endMin = startMin + (Number(row.duracaoMin) || 45);
    intervals.push({ startMin, endMin });
  }
  return intervals;
}

function fitsWithoutConflict(targetHoraInicio, duracaoMin, dayRows, excludeAgendaId) {
  const start = parseHhmmToMinutes(String(targetHoraInicio || '').slice(0, 5));
  const end = start + (Number(duracaoMin) || 45);
  const occupied = activeIntervalsForDay(dayRows, excludeAgendaId);
  for (const o of occupied) {
    if (intervalsOverlap(start, end, o.startMin, o.endMin)) return false;
  }
  return true;
}

/** Há outro ativo entre o fim da vaga e o início do candidato (exclui o próprio candidato). */
function hasActiveBetween(dayRows, prevEndMin, candStartMin, candidateId) {
  for (const row of dayRows || []) {
    if (!row || row.tipo === 'bloqueio') continue;
    if (!ACTIVE_STATUSES.has(row.status)) continue;
    if (String(row.id) === String(candidateId)) continue;
    const startMin = parseHhmmToMinutes(row.horaInicio);
    if (startMin >= prevEndMin && startMin < candStartMin) return true;
  }
  return false;
}

/**
 * Vaga estritamente anterior ao candidato: início antes e fim não depois do início do candidato.
 */
function isStrictlyPriorVacantSlot(prev, candStartMin) {
  const { startMin, endMin } = vacantStartEndMin(prev);
  if (startMin >= candStartMin) return false;
  if (endMin > candStartMin) return false;
  return true;
}

export function isValidAdvanceOffer(appointment, offer) {
  if (!appointment || !offer?.targetHoraInicio) return false;
  const target = String(offer.targetHoraInicio).slice(0, 5);
  const current = hhmmSlice(appointment);
  if (!target || !current) return false;
  return parseHhmmToMinutes(target) < parseHhmmToMinutes(current);
}

/**
 * Mapa agendaId → oferta de adiantar para início da vaga anterior mais próxima.
 * @param {Array} appointments linhas do dashboard
 * @returns {Map<string, { targetHoraInicio: string, vacantFromLabel: string }>}
 */
export function buildAdvanceOffersByAgendaId(appointments) {
  const map = new Map();
  const list = Array.isArray(appointments) ? appointments : [];
  const byDayProf = new Map();

  for (const appt of list) {
    if (!appt?.id) continue;
    const day = String(appt.data || '').slice(0, 10);
    const pk = `${day}|${profKey(appt)}`;
    if (!byDayProf.has(pk)) byDayProf.set(pk, []);
    byDayProf.get(pk).push(appt);
  }

  for (const dayRows of byDayProf.values()) {
    const sorted = [...dayRows].sort(
      (a, b) =>
        parseHhmmToMinutes(a.horaInicio) - parseHhmmToMinutes(b.horaInicio) ||
        String(a.id).localeCompare(String(b.id)),
    );

    for (const candidate of sorted) {
      if (!ACTIVE_STATUSES.has(candidate.status) || candidate.tipo === 'bloqueio') continue;

      const candStartMin = parseHhmmToMinutes(candidate.horaInicio);
      let bestVacant = null;
      let bestVacantStartMin = -1;

      for (const prev of sorted) {
        if (String(prev.id) === String(candidate.id)) continue;
        if (!VACANT_STATUSES.has(prev.status) || prev.tipo === 'bloqueio') continue;
        if (!isStrictlyPriorVacantSlot(prev, candStartMin)) continue;

        const { startMin, endMin } = vacantStartEndMin(prev);
        if (hasActiveBetween(sorted, endMin, candStartMin, candidate.id)) continue;

        if (startMin > bestVacantStartMin) {
          bestVacantStartMin = startMin;
          bestVacant = prev;
        }
      }

      if (!bestVacant || bestVacantStartMin < 0) continue;

      const targetHoraInicio = minutesToHhmm(bestVacantStartMin);
      if (parseHhmmToMinutes(targetHoraInicio) >= candStartMin) continue;

      const { endMin: vacantEndMin } = vacantStartEndMin(bestVacant);
      const vacantDuration = vacantEndMin - bestVacantStartMin;
      const nextDur = Number(candidate.duracaoMin) || 45;
      if (nextDur > vacantDuration) continue;
      if (!fitsWithoutConflict(targetHoraInicio, nextDur, sorted, candidate.id)) continue;

      const offer = {
        targetHoraInicio,
        vacantFromLabel: targetHoraInicio,
      };
      if (!isValidAdvanceOffer(candidate, offer)) continue;

      map.set(String(candidate.id), offer);
    }
  }

  return map;
}
