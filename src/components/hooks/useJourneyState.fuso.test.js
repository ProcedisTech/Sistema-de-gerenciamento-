import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useJourneyState } from './useJourneyState.js';

const fusoStub = vi.hoisted(() => ({ fuso: null }));

vi.mock('./useFusoClinica', () => ({
  useFusoClinica: () => ({
    fuso: fusoStub.fuso,
    pronto: fusoStub.fuso != null,
    recarregarFuso: () => {},
  }),
}));

const CPF = '12345678901';
const KEY = `procedis_start_time_${CPF}`;

describe('useJourneyState — restauração do início do atendimento espera o fuso', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 21:30 de 30/09 em Brasília = 19:30 em Rio Branco = 00:30 de 01/10 em UTC.
    vi.setSystemTime(new Date('2026-10-01T00:30:00Z'));
    sessionStorage.clear();
    fusoStub.fuso = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('antes do fuso: não restaura nem descarta; com o fuso: restaura o início do mesmo dia da clínica', () => {
    const inicio = '2026-09-30T23:00:00Z';
    sessionStorage.setItem(KEY, JSON.stringify({ time: inicio, date: '2026-09-30' }));

    const { result, rerender } = renderHook(() => useJourneyState());
    expect(result.current.getAttendanceStartTime(CPF)).toBeNull();
    expect(sessionStorage.getItem(KEY)).not.toBeNull();

    fusoStub.fuso = 'America/Rio_Branco';
    rerender();
    expect(result.current.getAttendanceStartTime(CPF)).toBe(inicio);
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('com o fuso pronto descarta início de outro dia da clínica', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ time: '2026-09-29T15:00:00Z', date: '2026-09-29' }));
    fusoStub.fuso = 'America/Sao_Paulo';

    const { result } = renderHook(() => useJourneyState());
    expect(result.current.getAttendanceStartTime(CPF)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
