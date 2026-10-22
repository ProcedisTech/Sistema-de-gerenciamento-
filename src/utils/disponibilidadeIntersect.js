import { diaDaSemana as diaDaSemanaCalendario } from './datasClinica.js';
import { normalizeDisponibilidade } from './normalizeDisponibilidade.js';

export function dentroDaDisponibilidade(appointment, disponibilidade, clinicaHorarios = []) {
  if (!appointment) return true;
  if (!appointment.dataAgendamento || !appointment.horaInicio) return true;

  const normalized = normalizeDisponibilidade(disponibilidade, clinicaHorarios);
  if (!Array.isArray(normalized) || normalized.length === 0) return true;

  const diaSemana = diaDaSemanaCalendario(appointment.dataAgendamento);
  if (Number.isNaN(diaSemana)) return true;
  const hora = String(appointment.horaInicio).slice(0, 5);
  const slotsDia = normalized.filter((d) => Number(d?.diaSemana) === diaSemana && d?.ativo !== false);
  if (slotsDia.length === 0) return false;
  return slotsDia.some((s) => {
    const inicio = String(s?.horaInicio || '').slice(0, 5);
    const fim = String(s?.horaFim || '').slice(0, 5);
    if (!inicio || !fim) return false;
    return hora >= inicio && hora < fim;
  });
}
