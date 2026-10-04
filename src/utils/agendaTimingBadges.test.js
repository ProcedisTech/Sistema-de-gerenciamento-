import { describe, expect, it } from 'vitest';
import { getExecutionSummary, getTimingBadge } from './agendaTimingBadges.js';

const AC = 'America/Rio_Branco';
const DF = 'America/Sao_Paulo';

const realizado = {
  data: '2026-10-02',
  horaInicio: '09:00',
  status: 'realizado',
  criadoEm: '2026-10-02T12:00:00Z',
  atualizadoEm: '2026-10-02T12:30:00Z',
};

describe('getTimingBadge — horário previsto no fuso da clínica', () => {
  it('início real às 12:00Z: no horário em DF (09:00), adiantado 2h em AC (07:00 contra 09:00)', () => {
    expect(getTimingBadge(realizado, DF).label).toBe('No horário');
    expect(getTimingBadge(realizado, AC).label).toBe('Adiantado 2h');
  });
});

describe('getExecutionSummary — horários reais exibidos no fuso da clínica', () => {
  it('DF', () => {
    const s = getExecutionSummary(realizado, DF);
    expect(s).toMatchObject({ dataReal: '02/10', horaInicioReal: '09:00', horaFimReal: '09:30', duracaoRealMin: 30 });
    expect(s.rangeText).toBe('02/10 · 09:00–09:30');
  });

  it('AC', () => {
    const s = getExecutionSummary(realizado, AC);
    expect(s).toMatchObject({ dataReal: '02/10', horaInicioReal: '07:00', horaFimReal: '07:30', duracaoRealMin: 30 });
  });

  it('sem execução', () => {
    expect(getExecutionSummary({ data: '2026-10-02', horaInicio: '09:00', status: 'pendente' }, DF).hasExecution).toBe(false);
  });
});
