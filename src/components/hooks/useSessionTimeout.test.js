import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout } from './useSessionTimeout';
import { useAuthState } from './useAuthState';

vi.mock('../../config/sessionTimeout', () => ({
  SESSION_TIMEOUT_MS: 5000,
  SESSION_WARNING_BEFORE_MS: 2000,
  ACTIVITY_THROTTLE_MS: 100,
  SESSION_STORAGE_KEY: 'test_last_activity',
}));

// Só para o caso "inatividade não mostra a mensagem" (useAuthState junto do useSessionTimeout).
const sessaoU1 = { access_token: 'tok-u1', user: { id: 'u1', email: 'u1@clinica.test' } };
vi.mock('../../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: sessaoU1 }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(),
    },
  },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toast }));

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

  it('consultaModule preenchido fora da tela da consulta: o relógio corre', () => {
    const spy = vi.fn();
    window.addEventListener('auth:expired', spy);

    renderHook(() =>
      useSessionTimeout({ isLoggedIn: true, activeView: 'pacientes', consultaModule: 'hub' }),
    );

    act(() => vi.advanceTimersByTime(5100));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toEqual({ scope: 'local' });
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

  it('B-42 FD: a saída por inatividade NÃO mostra "Sua sessão expirou" (só o toast "Sessão encerrada.")', async () => {
    toast.info.mockClear();
    const { result } = renderHook(() => {
      const auth = useAuthState({ clearOrgSession: () => {} });
      const sessao = useSessionTimeout({
        isLoggedIn: auth.isLoggedIn,
        activeView: 'pacientes',
        consultaModule: null,
      });
      return { auth, sessao };
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.auth.isLoggedIn).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });

    expect(result.current.auth.isLoggedIn).toBe(false);
    expect(result.current.auth.loginError).toBe('');
    expect(toast.info).toHaveBeenCalledWith('Sessão encerrada.');
    expect(toast.info).toHaveBeenCalledTimes(1);
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
