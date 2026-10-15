import agendaDto from './agenda-dto.json';
import pacienteDto from './paciente-dto.json';

/** Agendamento no formato exato do backend (`AgendaDTO`), com sobrescritas opcionais. */
export function agendaContrato(overrides = {}) {
  return { ...agendaDto, ...overrides };
}

/** Paciente no formato exato do backend (`PacienteDTO`), com sobrescritas opcionais. */
export function pacienteContrato(overrides = {}) {
  return { ...pacienteDto, ...overrides };
}
