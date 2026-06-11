import { deriveAgendaSlotStatus } from './agendaMapping.js';
import {
  dtoIntervalMinutes,
  dtoLooksCancelled,
  intervalsOverlap,
  isAgendaDtoBloqueio,
  parseHhmmToMinutes,
} from './agendaAvailability.js';

const BLOQUEIO_CONFLICT_STATUSES = new Set(['pendente', 'confirmado', 'aguardando_confirmacao']);

function dtoDateIso(dto) {
  return dto?.dataAgendamento ? String(dto.dataAgendamento).slice(0, 10) : '';
}

/** Slot entra na contagem de conflitos do bloquear-periodo (regra alinhada ao backend). */
export function isAgendaDtoConflictWithBloqueioPeriodo(dto) {
  if (!dto || typeof dto !== 'object') return false;
  if (dtoLooksCancelled(dto)) return false;
  const status = deriveAgendaSlotStatus(dto);
  if (status === 'realizado' || status === 'reagendado' || status === 'cancelado') return false;
  if (isAgendaDtoBloqueio(dto)) return true;
  return BLOQUEIO_CONFLICT_STATUSES.has(status);
}

/**
 * Conta agendas que seriam canceladas pelo bloqueio no intervalo.
 * @param {Array} dtos AgendaDTO[]
 * @param {{ profissionalRoleUserId: string, dataAgendamento: string, horaInicio: string, horaFim: string }} opts
 */
export function countBloqueioPeriodoConflicts(dtos, opts = {}) {
  const day = String(opts.dataAgendamento || '').slice(0, 10);
  const prof = String(opts.profissionalRoleUserId || '').trim();
  const startMin = parseHhmmToMinutes(String(opts.horaInicio || '').slice(0, 5));
  const endMin = parseHhmmToMinutes(String(opts.horaFim || '').slice(0, 5));
  if (!day || !prof || endMin <= startMin) return 0;

  let n = 0;
  for (const dto of Array.isArray(dtos) ? dtos : []) {
    if (!isAgendaDtoConflictWithBloqueioPeriodo(dto)) continue;
    if (dtoDateIso(dto) !== day) continue;
    const dtoProf = dto.profissionalRoleUserId ?? dto.roleUserId;
    if (dtoProf != null && String(dtoProf) !== prof) continue;
    const { startMin: s, endMin: e } = dtoIntervalMinutes(dto);
    if (intervalsOverlap(startMin, endMin, s, e)) n += 1;
  }
  return n;
}
