/**
 * UI: slot cancelado por reagendamento (backend preenche agendaNova* no AgendaDTO).
 */

function validDestinoDate(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (s.length < 10) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

function validDestinoHora(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return /^\d{1,2}:\d{2}/.test(s);
}

export function isSlotCanceladoPorReagendamento(appointment) {
  if (!appointment || appointment.status !== 'cancelado') return false;
  const id = appointment.agendaNovaId;
  if (id == null || String(id).trim() === '') return false;
  if (!validDestinoDate(appointment.agendaNovaDataAgendamento)) return false;
  if (!validDestinoHora(appointment.agendaNovaHoraInicio)) return false;
  return true;
}

/**
 * @returns {string|null} "Reagendado para DD/MM as HH:mm" ou null se incompleto
 */
export function formatDestinoReagendamentoLabel(appointment) {
  if (!isSlotCanceladoPorReagendamento(appointment)) return null;
  const dataIso = String(appointment.agendaNovaDataAgendamento).trim().slice(0, 10);
  const parts = dataIso.split('-');
  if (parts.length < 3) return null;
  const [y, mo, d] = parts;
  if (!y || !mo || !d) return null;
  const ddmm = `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}`;
  const hhmm = String(appointment.agendaNovaHoraInicio).trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  return `Reagendado para ${ddmm} as ${hhmm}`;
}
