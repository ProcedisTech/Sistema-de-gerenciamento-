/**
 * Próximo retorno do perfil (`fetchNextAppointmentIsoForPaciente`): só agenda com status ativo
 * (`STATUS_AGENDA_ATIVOS`: pendente, aguardando confirmação, confirmado) e com início a partir de agora
 * no relógio da clínica. Realizado, reagendado e cancelado nunca contam.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buscarProximoAgendamentoDoPaciente,
  fetchNextAppointmentIsoForPaciente,
} from './patientProfileDerivedDates.js';

const state = vi.hoisted(() => ({ byRange: vi.fn() }));

vi.mock('../services/api', () => ({
  agendasApi: { byRange: (...a) => state.byRange(...a) },
}));

const FUSO = 'America/Sao_Paulo';
const ANA = '11111111-1111-4111-8111-111111111111';
const OUTRA = '22222222-2222-4222-8222-222222222222';

/** AgendaDTO mínimo do `by-range`. */
const agenda = (id, data, horaInicio, statusCodigo, pacienteId = ANA) => ({
  id,
  dataAgendamento: data,
  horaInicio: `${horaInicio}:00`,
  horaFim: `${horaInicio.slice(0, 2)}:59:00`,
  statusCodigo,
  statusNome: statusCodigo,
  pacienteId,
  pacienteNome: pacienteId === ANA ? 'Ana Lima' : 'Outra Pessoa',
  tipoProcedimentoCodigo: 'ESTETICA',
  catalogoProcedimentoNome: 'Toxina',
});

describe('fetchNextAppointmentIsoForPaciente · só agenda ativa e futura', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 06/10/2026 10:00 em São Paulo
    vi.setSystemTime(new Date('2026-10-06T13:00:00Z'));
    state.byRange.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cenário da Ana: reagendado às 03:00 de amanhã + realizados (passado e mais tarde hoje) → nulo', async () => {
    state.byRange.mockResolvedValue([
      agenda('a-realizada-cedo', '2026-10-06', '05:00', 'realizado'),
      agenda('a-realizada-tarde', '2026-10-06', '16:00', 'realizado'),
      agenda('a-reagendada', '2026-10-07', '03:00', 'reagendado'),
    ]);
    await expect(fetchNextAppointmentIsoForPaciente(ANA, { pacienteNome: 'Ana Lima', fuso: FUSO })).resolves.toBeNull();
  });

  it('cancelado futuro também não conta', async () => {
    state.byRange.mockResolvedValue([agenda('a-cancelada', '2026-10-08', '09:00', 'cancelado')]);
    await expect(fetchNextAppointmentIsoForPaciente(ANA, { fuso: FUSO })).resolves.toBeNull();
  });

  it.each(['pendente', 'aguardando_confirmacao', 'confirmado'])(
    'status ativo "%s" no futuro é o próximo retorno (pulando reagendado e realizado antes dele)',
    async (status) => {
      state.byRange.mockResolvedValue([
        agenda('a-realizada-tarde', '2026-10-06', '16:00', 'realizado'),
        agenda('a-reagendada', '2026-10-07', '03:00', 'reagendado'),
        agenda('a-ativa', '2026-10-09', '14:30', status),
      ]);
      await expect(fetchNextAppointmentIsoForPaciente(ANA, { fuso: FUSO })).resolves.toBe('2026-10-09T14:30');
    },
  );

  it('agenda ativa que já começou hoje (antes de agora) não conta; a de mais tarde hoje conta', async () => {
    state.byRange.mockResolvedValue([
      agenda('a-passada', '2026-10-06', '09:00', 'confirmado'),
      agenda('a-mais-tarde', '2026-10-06', '11:00', 'pendente'),
    ]);
    await expect(fetchNextAppointmentIsoForPaciente(ANA, { fuso: FUSO })).resolves.toBe('2026-10-06T11:00');
  });

  it('agenda ativa de outro paciente não conta', async () => {
    state.byRange.mockResolvedValue([agenda('a-outra', '2026-10-07', '10:00', 'confirmado', OUTRA)]);
    await expect(fetchNextAppointmentIsoForPaciente(ANA, { fuso: FUSO })).resolves.toBeNull();
  });

  it('erro da busca: fetchNext devolve nulo; buscarProximo lança (a rebusca por aviso mantém a tela)', async () => {
    state.byRange.mockRejectedValue(new Error('rede'));
    await expect(fetchNextAppointmentIsoForPaciente(ANA, { fuso: FUSO })).resolves.toBeNull();
    await expect(buscarProximoAgendamentoDoPaciente(ANA, { fuso: FUSO })).rejects.toThrow('rede');
  });
});
