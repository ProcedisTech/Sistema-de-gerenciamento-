import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuscaNoVencimento } from './useBuscaNoVencimento.js';

const AGORA = new Date('2026-10-04T12:00:00Z').getTime();

describe('useBuscaNoVencimento', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
  });
  afterEach(() => vi.useRealTimers());

  it('agenda uma busca no vencimento', () => {
    const buscar = vi.fn();
    renderHook(() => useBuscaNoVencimento(new Date(AGORA + 60_000).toISOString(), buscar));
    vi.advanceTimersByTime(59_999);
    expect(buscar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(buscar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10 * 60_000);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('mais de 24 dias não agenda', () => {
    const buscar = vi.fn();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    renderHook(() => useBuscaNoVencimento(new Date(AGORA + 25 * 86_400_000).toISOString(), buscar));
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(buscar).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('vencido busca na hora', () => {
    const buscar = vi.fn();
    renderHook(() => useBuscaNoVencimento(new Date(AGORA - 1000).toISOString(), buscar));
    vi.advanceTimersByTime(0);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('sem expiraEm não faz nada; desmontar cancela', () => {
    const buscar = vi.fn();
    renderHook(() => useBuscaNoVencimento(null, buscar));
    const { unmount } = renderHook(() => useBuscaNoVencimento(new Date(AGORA + 5000).toISOString(), buscar));
    unmount();
    vi.advanceTimersByTime(10_000);
    expect(buscar).not.toHaveBeenCalled();
  });
});
