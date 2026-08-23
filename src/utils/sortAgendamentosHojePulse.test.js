import { describe, expect, it } from 'vitest';
import { isAgendamentoHojePassado, sortAgendamentosHojePulse } from './sortAgendamentosHojePulse.js';

const NOW = new Date(2026, 7, 23, 18, 0, 0, 0); // 23/08/2026 18:00 local

function slot(overrides) {
  return {
    data: '2026-08-23',
    horaInicio: '08:00',
    horaFim: '09:00',
    status: 'confirmado',
    ...overrides,
  };
}

describe('isAgendamentoHojePassado', () => {
  it('realizado é passado mesmo com horaFim no futuro', () => {
    expect(
      isAgendamentoHojePassado(slot({ status: 'realizado', horaInicio: '19:00', horaFim: '20:00' }), NOW),
    ).toBe(true);
  });

  it('confirmado com horaFim antes de agora é passado', () => {
    expect(isAgendamentoHojePassado(slot({ status: 'confirmado', horaFim: '09:00' }), NOW)).toBe(true);
  });

  it('pendente com horaFim depois de agora não é passado', () => {
    expect(
      isAgendamentoHojePassado(slot({ status: 'pendente', horaInicio: '19:00', horaFim: '20:00' }), NOW),
    ).toBe(false);
  });
});

describe('sortAgendamentosHojePulse', () => {
  it('coloca próximos no topo e passados no fim, ambos por horaInicio', () => {
    const rows = [
      slot({ horaInicio: '08:00', horaFim: '09:00', status: 'confirmado' }),
      slot({ horaInicio: '19:30', horaFim: '20:30', status: 'pendente' }),
      slot({ horaInicio: '10:00', horaFim: '11:00', status: 'realizado' }),
      slot({ horaInicio: '18:30', horaFim: '19:00', status: 'confirmado' }),
    ];
    const sorted = sortAgendamentosHojePulse(rows, NOW);
    expect(sorted.map((r) => r.horaInicio)).toEqual(['18:30', '19:30', '08:00', '10:00']);
  });
});
