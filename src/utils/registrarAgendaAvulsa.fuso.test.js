import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api.js', () => ({
  agendasApi: { create: vi.fn(async () => ({ id: 'ag-1' })), atualizarStatus: vi.fn(async () => ({})) },
}));
vi.mock('./agendaTipoProcedimento.js', () => ({
  RETORNO_TIPO_CODIGO: 'retorno',
  CONSULTA_TIPO_CODIGO: 'consulta',
  resolveTipoProcedimentoIdByCodigo: vi.fn(async () => 'tipo-1'),
}));
vi.mock('./serverTime.js', () => ({ getGuaranteedNow: vi.fn() }));

import { agendasApi } from '../services/api.js';
import { getGuaranteedNow } from './serverTime.js';
import { registrarAgendaAvulsa } from './registrarAgendaAvulsa.js';

function registrar(fuso, inicioIso) {
  return registrarAgendaAvulsa({
    journeyState: {},
    paciente: { id: 'p-1' },
    roleUserId: 'r-1',
    attendanceStartTimeIso: inicioIso,
    fuso,
  });
}

describe('registrarAgendaAvulsa — dia e horas no fuso da clínica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // fim às 00:30 de Brasília = 22:30 de Rio Branco do dia anterior
    vi.mocked(getGuaranteedNow).mockReturnValue(new Date(Date.UTC(2026, 9, 2, 3, 30)));
  });

  it.each([
    ['America/Sao_Paulo', '2026-10-02', '00:00', '00:30'],
    ['America/Rio_Branco', '2026-10-01', '22:00', '22:30'],
  ])('%s: data e horas vêm do mesmo fuso', async (fuso, dia, inicio, fim) => {
    await registrar(fuso, '2026-10-02T03:00:00.000Z');
    expect(agendasApi.create).toHaveBeenCalledTimes(1);
    const [body] = vi.mocked(agendasApi.create).mock.calls[0];
    expect(body).toMatchObject({ dataAgendamento: dia, horaInicio: inicio, horaFim: fim });
  });

  it('encerramento na clínica AC grava início e fim na hora do Acre', async () => {
    vi.mocked(getGuaranteedNow).mockReturnValue(new Date('2026-10-02T12:48:00Z'));
    await registrar('America/Rio_Branco', '2026-10-02T12:00:00Z');
    const [body] = vi.mocked(agendasApi.create).mock.calls[0];
    expect(body).toMatchObject({ dataAgendamento: '2026-10-02', horaInicio: '07:00', horaFim: '07:48' });
  });

  it('sem início válido usa o fim com piso de 1 minuto', async () => {
    await registrar('America/Rio_Branco', null);
    const [body] = vi.mocked(agendasApi.create).mock.calls[0];
    expect(body).toMatchObject({ dataAgendamento: '2026-10-01', horaInicio: '22:30', horaFim: '22:31' });
  });
});
