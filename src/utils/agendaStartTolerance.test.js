import { describe, expect, it } from 'vitest';
import { avaliarInicioAgendamento, parseSlotLocalDateTime } from './agendaStartTolerance.js';

const AC = 'America/Rio_Branco';
const DF = 'America/Sao_Paulo';

function avaliar(fuso, utc, hora = '09:00') {
  return avaliarInicioAgendamento({ dataIso: '2026-10-02', hora, fuso, agoraMs: Date.parse(utc) });
}

describe('parseSlotLocalDateTime', () => {
  it('converte o horário de calendário no fuso da clínica', () => {
    expect(parseSlotLocalDateTime('2026-10-02', '09:00', AC).toISOString()).toBe('2026-10-02T14:00:00.000Z');
    expect(parseSlotLocalDateTime('2026-10-02', '09:00:00', DF).toISOString()).toBe('2026-10-02T12:00:00.000Z');
    expect(parseSlotLocalDateTime('', '09:00', DF)).toBeNull();
    expect(parseSlotLocalDateTime('2026-10-02', 'x', DF)).toBeNull();
  });
});

describe('avaliarInicioAgendamento — aceitação (12:48Z, agendamento às 09:00)', () => {
  it('clínica AC: Agora 07:48, 72 min de antecedência', () => {
    expect(avaliar(AC, '2026-10-02T12:48:00Z')).toEqual({
      acao: 'early',
      scheduledTimeLabel: '09:00',
      nowTimeLabel: '07:48',
      antecedenciaTexto: '72 min de antecedência',
    });
  });

  it('clínica DF: Agora 09:48, 48 min de atraso', () => {
    expect(avaliar(DF, '2026-10-02T12:48:00Z')).toEqual({
      acao: 'late',
      scheduledTimeLabel: '09:00',
      nowTimeLabel: '09:48',
      atrasoTexto: '48 min de atraso',
    });
  });

  it('horário inválido', () => {
    expect(avaliar(DF, '2026-10-02T12:48:00Z', '')).toEqual({ acao: 'invalido' });
  });
});

describe('avaliarInicioAgendamento — limites da tolerância (±10 min)', () => {
  // [fuso, instante UTC, ação esperada, "Agora" no relógio da clínica]
  it.each([
    [DF, '2026-10-02T11:49:00Z', 'early', '08:49'],
    [DF, '2026-10-02T11:50:00Z', 'direto', null],
    [DF, '2026-10-02T12:10:00Z', 'direto', null],
    [DF, '2026-10-02T12:11:00Z', 'late', '09:11'],
    [AC, '2026-10-02T13:49:00Z', 'early', '08:49'],
    [AC, '2026-10-02T13:50:00Z', 'direto', null],
    [AC, '2026-10-02T14:10:00Z', 'direto', null],
    [AC, '2026-10-02T14:11:00Z', 'late', '09:11'],
  ])('%s em %s → %s', (fuso, utc, acao, agora) => {
    const r = avaliar(fuso, utc);
    expect(r.acao).toBe(acao);
    if (agora) expect(r.nowTimeLabel).toBe(agora);
  });
});
