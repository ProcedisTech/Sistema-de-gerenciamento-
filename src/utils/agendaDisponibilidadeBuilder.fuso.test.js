import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDaySlotList } from './agendaDisponibilidadeBuilder.js';
import { findNextFreeSlotAcrossDays } from './agendaAvailability.js';

const CLINICA_SEG_SEX = [1, 2, 3, 4, 5].map((diaSemana) => ({
  diaSemana,
  horaInicio: '07:00',
  horaFim: '23:00',
  ativo: true,
}));

const QUI = '2026-10-01';

function slotsDoDia(fuso, iso = QUI) {
  return buildDaySlotList({
    iso,
    disponibilidade: [],
    clinicaHorarios: CLINICA_SEG_SEX,
    dtos: [],
    duracaoMin: 30,
    profissionalRoleUserId: '',
    fuso,
  }).slots;
}

const estadoDe = (slots, hhmm) => slots.find((s) => s.hhmm === hhmm)?.state;

describe('buildDaySlotList — "horário já passou" no fuso da clínica', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 19:30 em Rio Branco (UTC-5) = 21:30 em Brasília = 00:30 UTC do dia seguinte.
    vi.setSystemTime(new Date('2026-10-02T00:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('AC: hoje ainda é 01/10; 19:00 passou e 20:00 está livre', () => {
    const slots = slotsDoDia('America/Rio_Branco');
    expect(estadoDe(slots, '19:00')).toBe('passado');
    expect(estadoDe(slots, '19:30')).toBe('livre');
    expect(estadoDe(slots, '20:00')).toBe('livre');
    expect(estadoDe(slots, '22:30')).toBe('livre');
  });

  it('DF: 01/10 às 21:30; 21:00 passou e 21:30 está livre', () => {
    const slots = slotsDoDia('America/Sao_Paulo');
    expect(estadoDe(slots, '20:00')).toBe('passado');
    expect(estadoDe(slots, '21:00')).toBe('passado');
    expect(estadoDe(slots, '21:30')).toBe('livre');
  });

  it('fuso UTC: 01/10 já terminou inteiro', () => {
    const slots = slotsDoDia('UTC');
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.state === 'passado')).toBe(true);
  });

  it('sem fuso e sem hoje: nada é marcado como passado', () => {
    const slots = slotsDoDia(null);
    expect(slots.some((s) => s.state === 'passado')).toBe(false);
  });

  it('próximo horário livre respeita o "agora" da clínica', () => {
    const disp = CLINICA_SEG_SEX;
    const ac = findNextFreeSlotAcrossDays({
      startIso: QUI,
      disponibilidade: disp,
      dtos: [],
      duracaoMin: 30,
      fuso: 'America/Rio_Branco',
    });
    const df = findNextFreeSlotAcrossDays({
      startIso: QUI,
      disponibilidade: disp,
      dtos: [],
      duracaoMin: 30,
      fuso: 'America/Sao_Paulo',
    });
    expect(ac).toMatchObject({ iso: QUI });
    expect(ac.hhmm >= '19:30').toBe(true);
    expect(df).toMatchObject({ iso: QUI });
    expect(df.hhmm >= '21:30').toBe(true);
  });
});
