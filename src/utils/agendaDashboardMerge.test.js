import { describe, expect, it } from 'vitest';
import {
  monthContainsIso,
  monthRangeIso,
  resolveMonthRefreshAction,
  weekContainsIso,
} from './agendaDateUtils.js';
import { mergeDashboardRows } from './agendaDashboardMapping.js';

function row(id, data, patch = {}) {
  return { id, agendaId: id, data, horaInicio: '09:00', ...patch };
}

describe('weekContainsIso / monthContainsIso', () => {
  it('monthContainsIso: dentro e fora do mês', () => {
    const sept = new Date(2026, 8, 1);
    expect(monthContainsIso(sept, '2026-09-15')).toBe(true);
    expect(monthContainsIso(sept, '2026-08-31')).toBe(false);
    expect(monthContainsIso(sept, '2026-10-01')).toBe(false);
  });

  it('weekContainsIso: dentro e fora da semana', () => {
    expect(weekContainsIso('2026-08-30', '2026-09-05', '2026-09-02')).toBe(true);
    expect(weekContainsIso('2026-08-30', '2026-09-05', '2026-08-30')).toBe(true);
    expect(weekContainsIso('2026-08-30', '2026-09-05', '2026-09-05')).toBe(true);
    expect(weekContainsIso('2026-08-30', '2026-09-05', '2026-09-06')).toBe(false);
    expect(weekContainsIso('2026-08-30', '2026-09-05', '2026-08-29')).toBe(false);
  });
});

describe('mergeDashboardRows', () => {
  const sept = monthRangeIso(new Date(2026, 8, 1));

  it('insere dentro do mês', () => {
    const prev = [row('a', '2026-09-01')];
    const next = mergeDashboardRows(prev, [row('b', '2026-09-10')], {
      startIso: sept.start,
      endIso: sept.end,
    });
    expect(next.map((r) => r.agendaId).sort()).toEqual(['a', 'b']);
  });

  it('ignora fora do mês', () => {
    const prev = [row('a', '2026-09-01')];
    const next = mergeDashboardRows(prev, [row('b', '2026-10-02')], {
      startIso: sept.start,
      endIso: sept.end,
    });
    expect(next).toEqual(prev);
  });

  it('insere dentro da semana (gate via start/end)', () => {
    const week = { startIso: '2026-08-30', endIso: '2026-09-05' };
    expect(weekContainsIso(week.startIso, week.endIso, '2026-09-02')).toBe(true);
    const next = mergeDashboardRows([], [row('w', '2026-09-02')], week);
    expect(next).toHaveLength(1);
    expect(next[0].agendaId).toBe('w');
  });

  it('ignora fora da semana', () => {
    const week = { startIso: '2026-08-30', endIso: '2026-09-05' };
    expect(weekContainsIso(week.startIso, week.endIso, '2026-09-10')).toBe(false);
    const next = mergeDashboardRows([row('a', '2026-09-01')], [row('b', '2026-09-10')], week);
    expect(next.map((r) => r.agendaId)).toEqual(['a']);
  });

  it('dedupe por agendaId — incoming vence', () => {
    const prev = [row('x', '2026-09-01', { pacienteNome: 'Antigo' })];
    const next = mergeDashboardRows(prev, [row('x', '2026-09-01', { pacienteNome: 'Novo' })], {
      startIso: sept.start,
      endIso: sept.end,
    });
    expect(next).toHaveLength(1);
    expect(next[0].pacienteNome).toBe('Novo');
  });
});

describe('resolveMonthRefreshAction', () => {
  it('mesmo mês → loadMonth (sem setMonthDate)', () => {
    const cur = new Date(2026, 8, 1);
    const next = new Date(2026, 8, 1);
    expect(resolveMonthRefreshAction(cur, next)).toBe('loadMonth');
    expect(resolveMonthRefreshAction(cur, new Date(2026, 8, 15))).toBe('loadMonth');
  });

  it('mês diferente → setMonthDateOnly', () => {
    const cur = new Date(2026, 7, 1);
    const next = new Date(2026, 8, 1);
    expect(resolveMonthRefreshAction(cur, next)).toBe('setMonthDateOnly');
  });
});
