import { describe, expect, it } from 'vitest';
import { buildDaySlotList } from './agendaDisponibilidadeBuilder.js';
import { COMMERCIAL_WEEKDAY_WINDOW } from './disponibilidadeDayWindows.js';

const MON = '2026-09-21'; // segunda
const SUN = '2026-09-27'; // domingo

const CLINICA_SEG_SEX = [1, 2, 3, 4, 5].map((diaSemana) => ({
  diaSemana,
  horaInicio: '07:00',
  horaFim: '23:00',
  ativo: true,
}));

const PROF_DISP = [
  { diaSemana: 1, horaInicio: '09:00', horaFim: '12:00', ativo: true },
];

describe('buildDaySlotList — clínica (sem profissional)', () => {
  it('sem prof + clínica com janelas no dia → slots nas janelas da clínica', () => {
    const model = buildDaySlotList({
      iso: MON,
      disponibilidade: [],
      clinicaHorarios: CLINICA_SEG_SEX,
      dtos: [],
      duracaoMin: 30,
      profissionalRoleUserId: '',
      todayIso: '2026-09-01',
      currentBrasiliaMinutes: 0,
    });
    expect(model.isFallback).toBe(false);
    expect(model.dayStartMin).toBe(7 * 60);
    expect(model.dayEndMin).toBe(23 * 60);
    expect(model.slots.length).toBeGreaterThan(0);
    expect(model.slots[0].hhmm).toBe('07:00');
  });

  it('sem prof + clínica configurada + dia fechado → zero slots (não comercial)', () => {
    const model = buildDaySlotList({
      iso: SUN,
      disponibilidade: [],
      clinicaHorarios: CLINICA_SEG_SEX,
      dtos: [],
      duracaoMin: 30,
      profissionalRoleUserId: '',
      todayIso: '2026-09-01',
      currentBrasiliaMinutes: 0,
    });
    expect(model.isFallback).toBe(false);
    expect(model.windows).toEqual([]);
    expect(model.slots.length).toBe(0);
  });

  it('sem prof + clínica [] → comercial (atual)', () => {
    const model = buildDaySlotList({
      iso: MON,
      disponibilidade: [],
      clinicaHorarios: [],
      dtos: [],
      duracaoMin: 30,
      profissionalRoleUserId: '',
      todayIso: '2026-09-01',
      currentBrasiliaMinutes: 0,
    });
    expect(model.isFallback).toBe(false);
    expect(model.dayStartMin).toBe(COMMERCIAL_WEEKDAY_WINDOW.startMin);
    expect(model.dayEndMin).toBe(COMMERCIAL_WEEKDAY_WINDOW.endMin);
    expect(model.slots.length).toBeGreaterThan(0);
  });

  it('sem prof + clinicaHorarios ausente → comercial', () => {
    const model = buildDaySlotList({
      iso: MON,
      disponibilidade: [],
      dtos: [],
      duracaoMin: 30,
      profissionalRoleUserId: '',
      todayIso: '2026-09-01',
      currentBrasiliaMinutes: 0,
    });
    expect(model.dayStartMin).toBe(COMMERCIAL_WEEKDAY_WINDOW.startMin);
    expect(model.dayEndMin).toBe(COMMERCIAL_WEEKDAY_WINDOW.endMin);
  });

  it('com prof → path inalterado (usa disponibilidade, não clínica)', () => {
    const model = buildDaySlotList({
      iso: MON,
      disponibilidade: PROF_DISP,
      clinicaHorarios: CLINICA_SEG_SEX,
      dtos: [],
      duracaoMin: 30,
      profissionalRoleUserId: 'prof-1',
      todayIso: '2026-09-01',
      currentBrasiliaMinutes: 0,
    });
    expect(model.isFallback).toBe(false);
    expect(model.dayStartMin).toBe(9 * 60);
    expect(model.dayEndMin).toBe(12 * 60);
  });

  it('com prof zerado → comercial + isFallback', () => {
    const model = buildDaySlotList({
      iso: MON,
      disponibilidade: [],
      clinicaHorarios: CLINICA_SEG_SEX,
      dtos: [],
      duracaoMin: 30,
      profissionalRoleUserId: 'prof-1',
      todayIso: '2026-09-01',
      currentBrasiliaMinutes: 0,
    });
    expect(model.isFallback).toBe(true);
    expect(model.dayStartMin).toBe(COMMERCIAL_WEEKDAY_WINDOW.startMin);
  });
});
