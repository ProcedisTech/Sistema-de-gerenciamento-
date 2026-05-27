/** Filtra objeto agenda do useAgendaPage para visão solo de um profissional. */
export function filterAgendaForProfissional(agenda, roleUserId) {
  const rid = String(roleUserId || '').trim();
  if (!rid || !agenda) return agenda;

  const match = (row) =>
    String(row?.profissionalRoleUserId || row?.roleUserId || '').trim() === rid;

  return {
    ...agenda,
    appointments: (agenda.appointments || []).filter(match),
    selectedDayAppointments: (agenda.selectedDayAppointments || []).filter(match),
    filteredWeekGridAppointments: (agenda.filteredWeekGridAppointments || []).filter(match),
    weekGridAppointments: (agenda.weekGridAppointments || []).filter(match),
  };
}

/** @param {string} horaRaw ex "09:00:00" */
export function formatHoraSlotLabel(horaRaw) {
  return String(horaRaw || '').slice(0, 5);
}

/** ISO date string YYYY-MM-DD */
export function toIsoDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(iso, delta) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return toIsoDate(dt);
}

export function startOfWeekIso(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return toIsoDate(dt);
}

export const TIPO_PROCEDIMENTO_V2_OPTIONS = Object.freeze([
  { codigo: 'avaliacao', label: 'Avaliação', duracaoMin: 45 },
  { codigo: 'retorno', label: 'Retorno', duracaoMin: 30 },
  { codigo: 'estetico_facial', label: 'Estético facial', duracaoMin: 60 },
  { codigo: 'estetico_corporal', label: 'Estético corporal', duracaoMin: 60 },
  { codigo: 'geral', label: 'Geral', duracaoMin: 45 },
]);

export function duracaoPadraoPorTipoCodigo(codigo) {
  const found = TIPO_PROCEDIMENTO_V2_OPTIONS.find((t) => t.codigo === codigo);
  return found?.duracaoMin ?? 45;
}
