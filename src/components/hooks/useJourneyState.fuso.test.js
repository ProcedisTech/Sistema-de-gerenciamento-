import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useJourneyState } from './useJourneyState.js';

const CPF = '12345678901';
const CHAVE_ANTIGA = `procedis_start_time_${CPF}`;
const INICIO_SERVIDOR = '2026-09-30T23:00:00Z';

/** Chaves do sessionStorage que contêm o CPF do paciente. */
function chavesComCpf() {
  const chaves = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const k = sessionStorage.key(i);
    if (k && k.includes(CPF)) chaves.push(k);
  }
  return chaves;
}

describe('useJourneyState — horário de início sem CPF no storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('chave antiga do horário (com CPF) é removida na primeira leitura e não é usada', () => {
    sessionStorage.setItem(CHAVE_ANTIGA, JSON.stringify({ time: '2026-09-30T20:00:00Z', date: '2026-09-30' }));
    sessionStorage.setItem('procedis_start_time_98765432100', JSON.stringify({ time: 'x', date: 'y' }));
    sessionStorage.setItem('activeView', 'pacientes');

    const { result } = renderHook(() => useJourneyState());

    expect(sessionStorage.getItem(CHAVE_ANTIGA)).toBeNull();
    expect(sessionStorage.getItem('procedis_start_time_98765432100')).toBeNull();
    expect(sessionStorage.getItem('activeView')).toBe('pacientes');
    expect(result.current.getAttendanceStartTime()).toBeNull();
  });

  it('o horário fica só em memória: nenhuma chave do sessionStorage contém o CPF', () => {
    const { result } = renderHook(() => useJourneyState());

    act(() => {
      result.current.setAttendanceStartTime('2026-10-01T00:10:00Z');
    });

    expect(result.current.getAttendanceStartTime(INICIO_SERVIDOR)).toBe('2026-10-01T00:10:00Z');
    expect(chavesComCpf()).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });

  it('sem horário em memória (ex.: depois do F5) vale o iniciadoEm da consulta do servidor', () => {
    const { result } = renderHook(() => useJourneyState());

    expect(result.current.getAttendanceStartTime(INICIO_SERVIDOR)).toBe(INICIO_SERVIDOR);
    expect(result.current.getAttendanceStartTime(null)).toBeNull();

    act(() => {
      result.current.setAttendanceStartTime('2026-10-01T00:10:00Z');
    });
    act(() => {
      result.current.setAttendanceStartTime(null);
    });
    expect(result.current.getAttendanceStartTime(INICIO_SERVIDOR)).toBe(INICIO_SERVIDOR);
  });
});
