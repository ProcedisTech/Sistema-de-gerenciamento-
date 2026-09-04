import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout } from './useSessionTimeout';

vi.mock('../../config/sessionTimeout', () => ({
  SESSION_TIMEOUT_MS: 5000,
  SESSION_WARNING_BEFORE_MS: 2000,
  ACTIVITY_THROTTLE_MS: 100,
  SESSION_STORAGE_KEY: 'test_last_activity',
}));

const KEY = 'test_last_activity';

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const base = { isLoggedIn: true, activeView: 'pacientes', consultaModule: null };

  it('guard OR: activeView=consulta com consultaModule=null mantém timer parado', () => {
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    renderHook(() =>
      useSessionTimeout({ isLoggedIn: true, activeView: 'consulta', consultaModule: null }),
    );

    act(() => vi.advanceTimersByTime(6000));
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('auth:expired', spy);
  });

  it('guard OR: consultaModule!==null com activeView=pacientes mantém timer parado', () => {
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    renderHook(() =>
      useSessionTimeout({ isLoggedIn: true, activeView: 'pacientes', consultaModule: 'hub' }),
    );

    act(() => vi.advanceTimersByTime(6000));
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('auth:expired', spy);
  });

  it('enabled=false quando deslogado', () => {
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    renderHook(() =>
      useSessionTimeout({ isLoggedIn: false, activeView: 'pacientes', consultaModule: null }),
    );

    act(() => vi.advanceTimersByTime(6000));
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('auth:expired', spy);
  });

  it('dispara auth:expired com scope local após timeout', () => {
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    renderHook(() => useSessionTimeout(base));

    act(() => vi.advanceTimersByTime(5100));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toEqual({ scope: 'local' });
    window.removeEventListener('auth:expired', spy);
  });

  it('handleStay reseta o timer e fecha o aviso', () => {
    const { result } = renderHook(() => useSessionTimeout(base));

    act(() => vi.advanceTimersByTime(3100));
    expect(result.current.showWarning).toBe(true);

    act(() => result.current.handleStay());
    expect(result.current.showWarning).toBe(false);
  });

  it('handleLogoutNow dispara auth:expired com scope local', () => {
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    const { result } = renderHook(() => useSessionTimeout(base));

    act(() => result.current.handleLogoutNow());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toEqual({ scope: 'local' });
    window.removeEventListener('auth:expired', spy);
  });

  it('mount NÃO renova carimbo existente (F5)', () => {
    const oldStamp = String(Date.now() - 3000);
    sessionStorage.setItem(KEY, oldStamp);

    renderHook(() => useSessionTimeout(base));
    expect(sessionStorage.getItem(KEY)).toBe(oldStamp);
  });

  it('transição atendimento→fora renova carimbo (pós-mount)', () => {
    const { rerender } = renderHook(
      (props) => useSessionTimeout(props),
      { initialProps: { isLoggedIn: true, activeView: 'consulta', consultaModule: 'hub' } },
    );

    act(() => vi.advanceTimersByTime(100));
    const stampDuringAttendance = sessionStorage.getItem(KEY);

    rerender({ isLoggedIn: true, activeView: 'pacientes', consultaModule: null });
    act(() => vi.advanceTimersByTime(0));

    const stampAfterExit = Number(sessionStorage.getItem(KEY));
    expect(stampAfterExit).toBeGreaterThan(Number(stampDuringAttendance || 0));
  });

  it('login sem mousemove desloga após timeout', () => {
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    renderHook(() => useSessionTimeout(base));

    act(() => vi.advanceTimersByTime(5100));
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:expired', spy);
  });
});
