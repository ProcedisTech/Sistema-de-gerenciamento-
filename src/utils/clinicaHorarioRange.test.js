import { describe, expect, it } from 'vitest';
import {
  WEEK_DEFAULT_END_MIN,
  WEEK_DEFAULT_START_MIN,
  RAIL_DEFAULT_END_MIN,
  RAIL_DEFAULT_START_MIN,
  computeDayRailRange,
  computeWeekRangeFromClinic,
  hourLabelsForRange,
} from './clinicaHorarioRange.js';

/** Seg–sex 07–23 (Esclusività-like). diaSemana: 0=dom … 6=sáb */
const CLINICA_SEG_SEX_07_23 = [1, 2, 3, 4, 5].map((diaSemana) => ({
  diaSemana,
  horaInicio: '07:00',
  horaFim: '23:00',
  ativo: true,
}));

const WEEK_MON_SUN = [
  '2026-09-21', // seg
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27', // dom
];

describe('computeWeekRangeFromClinic', () => {
  it('usa min/max da clínica na semana', () => {
    const range = computeWeekRangeFromClinic(WEEK_MON_SUN, CLINICA_SEG_SEX_07_23, []);
    expect(range.startMin).toBe(7 * 60);
    expect(range.endMin).toBe(23 * 60);
  });

  it('sem horário da clínica → 07–20', () => {
    const range = computeWeekRangeFromClinic(WEEK_MON_SUN, [], []);
    expect(range.startMin).toBe(WEEK_DEFAULT_START_MIN);
    expect(range.endMin).toBe(WEEK_DEFAULT_END_MIN);
  });

  it('estica para agendamento fora do horário da clínica', () => {
    const appts = [{ data: '2026-09-21', horaInicio: '06:15', duracaoMin: 45 }];
    const range = computeWeekRangeFromClinic(WEEK_MON_SUN, CLINICA_SEG_SEX_07_23, appts);
    expect(range.startMin).toBe(6 * 60); // floor 06:15 → 06:00
    expect(range.endMin).toBe(23 * 60);
  });

  it('estica fim além do fechamento da clínica', () => {
    const appts = [{ data: '2026-09-21', horaInicio: '22:30', duracaoMin: 60 }];
    const range = computeWeekRangeFromClinic(WEEK_MON_SUN, CLINICA_SEG_SEX_07_23, appts);
    expect(range.endMin).toBe(23 * 60 + 30); // ceil 23:30
  });
});

describe('computeDayRailRange', () => {
  it('usa janelas do dia da clínica', () => {
    const range = computeDayRailRange('2026-09-21', CLINICA_SEG_SEX_07_23, []);
    expect(range.startMin).toBe(7 * 60);
    expect(range.endMin).toBe(23 * 60);
  });

  it('dia fechado sem appts → 06–22', () => {
    const range = computeDayRailRange('2026-09-27', CLINICA_SEG_SEX_07_23, []);
    expect(range.startMin).toBe(RAIL_DEFAULT_START_MIN);
    expect(range.endMin).toBe(RAIL_DEFAULT_END_MIN);
  });

  it('trilho 19h vs clínica 18h — estica para incluir o appt', () => {
    const clinicaAte18 = [
      { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', ativo: true },
    ];
    const appts = [{ horaInicio: '19:00', duracaoMin: 30 }];
    const range = computeDayRailRange('2026-09-21', clinicaAte18, appts);
    expect(range.startMin).toBe(8 * 60);
    expect(range.endMin).toBe(19 * 60 + 30);
  });

  it('dia fechado com appt fora ainda entra no eixo', () => {
    const appts = [{ horaInicio: '10:00', duracaoMin: 60 }];
    const range = computeDayRailRange('2026-09-27', CLINICA_SEG_SEX_07_23, appts);
    expect(range.startMin).toBeLessThanOrEqual(10 * 60);
    expect(range.endMin).toBeGreaterThanOrEqual(11 * 60);
  });

  it('clínica vazia → 06–22', () => {
    const range = computeDayRailRange('2026-09-21', [], []);
    expect(range.startMin).toBe(RAIL_DEFAULT_START_MIN);
    expect(range.endMin).toBe(RAIL_DEFAULT_END_MIN);
  });
});

describe('hourLabelsForRange', () => {
  it('gera horas pares no intervalo', () => {
    expect(hourLabelsForRange(6 * 60, 22 * 60)).toEqual([6, 8, 10, 12, 14, 16, 18, 20, 22]);
  });
});
