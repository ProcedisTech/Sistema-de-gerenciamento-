import { describe, expect, it } from 'vitest';
import { isAgendamentoHojePassado, sortAgendamentosHojePulse } from './sortAgendamentosHojePulse.js';

const AC = 'America/Rio_Branco';
const DF = 'America/Sao_Paulo';
// 12:00Z = 09:00 em Brasília = 07:00 em Rio Branco
const NOW = new Date('2026-10-02T12:00:00Z');

function slot(overrides) {
  return {
    data: '2026-10-02',
    horaInicio: '07:00',
    horaFim: '08:00',
    status: 'confirmado',
    ...overrides,
  };
}

describe('isAgendamentoHojePassado', () => {
  it('realizado é passado mesmo com horaFim no futuro', () => {
    expect(isAgendamentoHojePassado(slot({ status: 'realizado', horaFim: '20:00' }), DF, NOW)).toBe(true);
  });

  it('slot que termina às 08:00: passado em DF, ainda por vir em AC no mesmo instante', () => {
    expect(isAgendamentoHojePassado(slot(), DF, NOW)).toBe(true);
    expect(isAgendamentoHojePassado(slot(), AC, NOW)).toBe(false);
  });

  it('pendente com horaFim depois de agora não é passado', () => {
    expect(isAgendamentoHojePassado(slot({ status: 'pendente', horaFim: '20:00' }), DF, NOW)).toBe(false);
  });
});

describe('sortAgendamentosHojePulse', () => {
  const rows = [
    slot({ horaInicio: '07:00', horaFim: '08:00' }),
    slot({ horaInicio: '08:30', horaFim: '08:45' }),
    slot({ horaInicio: '06:00', horaFim: '06:30', status: 'realizado' }),
    slot({ horaInicio: '10:00', horaFim: '11:00', status: 'pendente' }),
  ];

  it('DF: 07:00 e 08:30 já terminaram e vão para o fim', () => {
    expect(sortAgendamentosHojePulse(rows, DF, NOW).map((r) => r.horaInicio)).toEqual(['10:00', '06:00', '07:00', '08:30']);
  });

  it('AC: no mesmo instante, 07:00 e 08:30 ainda estão por vir', () => {
    expect(sortAgendamentosHojePulse(rows, AC, NOW).map((r) => r.horaInicio)).toEqual(['07:00', '08:30', '10:00', '06:00']);
  });
});
