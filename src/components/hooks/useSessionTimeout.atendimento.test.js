import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout } from './useSessionTimeout';
import {
  SESSION_TIMEOUT_MS,
  SESSION_WARNING_BEFORE_MS,
  SESSION_STORAGE_KEY,
} from '../../config/sessionTimeout';

// Constantes reais (15 min / 2 min): a renovação em atendimento (30 s) precisa ser menor que o limite.
const MIN = 60_000;
const EM_CONSULTA = { isLoggedIn: true, activeView: 'consulta', consultaModule: 'hub' };
const FORA = { isLoggedIn: true, activeView: 'pacientes', consultaModule: null };

let estadoVisibilidade = 'visible';
const descritorOriginal = Object.getOwnPropertyDescriptor(document, 'visibilityState');

function mudarVisibilidade(estado) {
  estadoVisibilidade = estado;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** F5: desmonta a tela da consulta e monta de novo fora dela (sessionStorage fica, refs zeram). */
function f5(unmount) {
  unmount();
  return renderHook(() => useSessionTimeout(FORA));
}

describe('useSessionTimeout — inatividade não corre em atendimento (F5 dentro da consulta)', () => {
  let saida;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    sessionStorage.clear();
    estadoVisibilidade = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => estadoVisibilidade,
    });
    saida = vi.fn();
    window.addEventListener('auth:expired', saida);
  });

  afterEach(() => {
    window.removeEventListener('auth:expired', saida);
    if (descritorOriginal) {
      Object.defineProperty(document, 'visibilityState', descritorOriginal);
    } else {
      delete document.visibilityState;
    }
    vi.useRealTimers();
  });

  it('A: 20 min em atendimento sem nenhum evento → F5 → não sai; fora, os 15 min contam do último carimbo (≤ 30 s)', () => {
    const { unmount } = renderHook(() => useSessionTimeout(EM_CONSULTA));
    // 20:50 não é múltiplo de intervalos redondos: um intervalo maior que 30 s deixa o carimbo velho aqui.
    act(() => vi.advanceTimersByTime(20 * MIN + 50_000));
    const carimbo = Number(sessionStorage.getItem(SESSION_STORAGE_KEY));
    expect(Date.now() - carimbo).toBeLessThanOrEqual(30_000);

    f5(unmount);
    act(() => vi.advanceTimersByTime(1500));
    expect(saida).not.toHaveBeenCalled();

    // Fora da consulta o relógio de 15 min conta a partir do último carimbo renovado.
    act(() => vi.advanceTimersByTime(carimbo + SESSION_TIMEOUT_MS - 1000 - Date.now()));
    expect(saida).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2000));
    expect(saida).toHaveBeenCalledTimes(1);
  });

  it('B: aba oculta por 20 min com a consulta aberta (timers seguros pelo navegador) → volta → F5 → não sai', () => {
    const { unmount } = renderHook(() => useSessionTimeout(EM_CONSULTA));
    act(() => mudarVisibilidade('hidden'));

    // O navegador segura os timers da aba oculta: o relógio anda, nenhum intervalo roda.
    vi.setSystemTime(Date.now() + 20 * MIN);
    act(() => mudarVisibilidade('visible'));

    f5(unmount);
    act(() => vi.advanceTimersByTime(1500));
    expect(saida).not.toHaveBeenCalled();
  });

  it('C: pagehide do F5 renova o carimbo mesmo sem o intervalo ter rodado → não sai', () => {
    const { unmount } = renderHook(() => useSessionTimeout(EM_CONSULTA));

    vi.setSystemTime(Date.now() + 20 * MIN);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(Number(sessionStorage.getItem(SESSION_STORAGE_KEY))).toBe(Date.now());

    f5(unmount);
    act(() => vi.advanceTimersByTime(1500));
    expect(saida).not.toHaveBeenCalled();
  });

  it('D: fora da consulta, 15 min sem evento → aviso aos 13 min e saída aos 15 (card de 04/09)', () => {
    const { result } = renderHook(() => useSessionTimeout(FORA));
    const limiarAviso = SESSION_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS;

    act(() => vi.advanceTimersByTime(limiarAviso - 1000));
    expect(result.current.showWarning).toBe(false);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.showWarning).toBe(true);

    act(() => vi.advanceTimersByTime(SESSION_TIMEOUT_MS - limiarAviso - 2000));
    expect(saida).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2000));
    expect(saida).toHaveBeenCalledTimes(1);
  });

  it('E: saiu da consulta normalmente → o relógio recomeça do zero na saída', () => {
    const { rerender } = renderHook((props) => useSessionTimeout(props), { initialProps: EM_CONSULTA });
    // Última renovação aos 20:00; sai da consulta aos 20:25.
    act(() => vi.advanceTimersByTime(20 * MIN + 25_000));

    rerender(FORA);
    act(() => vi.advanceTimersByTime(SESSION_TIMEOUT_MS - 1000));
    expect(saida).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2000));
    expect(saida).toHaveBeenCalledTimes(1);
  });

  it('F: ao entrar na consulta o carimbo é renovado na hora → F5 sem pagehide → não sai', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, String(Date.now() - 20 * MIN));
    const { unmount } = renderHook(() => useSessionTimeout(EM_CONSULTA));
    expect(Number(sessionStorage.getItem(SESSION_STORAGE_KEY))).toBe(Date.now());

    act(() => vi.advanceTimersByTime(10_000));
    f5(unmount);
    act(() => vi.advanceTimersByTime(1500));
    expect(saida).not.toHaveBeenCalled();
  });

  it('G: fora da consulta os ouvintes da renovação somem (visibilitychange e pagehide não mexem no carimbo)', () => {
    const { rerender } = renderHook((props) => useSessionTimeout(props), { initialProps: EM_CONSULTA });
    rerender(FORA);
    const carimbo = sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(carimbo).not.toBeNull();

    act(() => vi.advanceTimersByTime(3 * MIN));
    act(() => mudarVisibilidade('hidden'));
    act(() => mudarVisibilidade('visible'));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe(carimbo);
  });

  it('H: saiu pela Sidebar com consultaModule preso → o relógio corre: aviso aos 13 min e saída aos 15', () => {
    const { result, rerender } = renderHook((props) => useSessionTimeout(props), {
      initialProps: { isLoggedIn: true, activeView: 'consulta', consultaModule: 'avaliacao' },
    });
    act(() => vi.advanceTimersByTime(5 * MIN));

    rerender({ isLoggedIn: true, activeView: 'agenda', consultaModule: 'avaliacao' });
    const limiarAviso = SESSION_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS;

    act(() => vi.advanceTimersByTime(limiarAviso - 1000));
    expect(result.current.showWarning).toBe(false);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.showWarning).toBe(true);

    act(() => vi.advanceTimersByTime(SESSION_TIMEOUT_MS - limiarAviso - 2000));
    expect(saida).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2000));
    expect(saida).toHaveBeenCalledTimes(1);
  });
});
