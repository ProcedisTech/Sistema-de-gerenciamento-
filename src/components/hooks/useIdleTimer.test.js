import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleTimer } from './useIdleTimer';

vi.mock('../../config/sessionTimeout', () => ({
  ACTIVITY_THROTTLE_MS: 100,
  SESSION_STORAGE_KEY: 'test_last_activity',
}));

const KEY = 'test_last_activity';

describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const defaults = {
    enabled: true,
    timeoutMs: 5000,
    warningBeforeMs: 2000,
    onWarning: vi.fn(),
    onTimeout: vi.fn(),
  };

  it('semeia carimbo ao habilitar sem carimbo existente', () => {
    expect(sessionStorage.getItem(KEY)).toBeNull();
    renderHook(() => useIdleTimer(defaults));
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('preserva carimbo existente no mount (F5 não zera)', () => {
    const oldStamp = String(Date.now() - 3000);
    sessionStorage.setItem(KEY, oldStamp);
    renderHook(() => useIdleTimer(defaults));
    expect(sessionStorage.getItem(KEY)).toBe(oldStamp);
  });

  it('dispara onWarning uma vez ao atingir o limiar', () => {
    const onWarning = vi.fn();
    renderHook(() => useIdleTimer({ ...defaults, onWarning }));

    act(() => vi.advanceTimersByTime(3100));
    expect(onWarning).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(1000));
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  // B-42 FD: antes "UMA unica vez"; agora 1 vez e só reenvia depois de 5 s (T12 abaixo).
  it('dispara onTimeout uma vez e não repete antes de 5 s', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimer({ ...defaults, onTimeout }));

    act(() => vi.advanceTimersByTime(5100));
    expect(onTimeout).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(2000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('T12: vencido e ainda ativo, reenvia onTimeout a cada 5 s', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimer({ ...defaults, onTimeout }));

    act(() => vi.advanceTimersByTime(5100));
    expect(onTimeout).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(4000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(onTimeout).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(5000));
    expect(onTimeout).toHaveBeenCalledTimes(3);
  });

  it('T13: venceu sem aviso, desligou (saída) e religou (novo login) → dispara de novo no prazo, sem esperar o reenvio', () => {
    const onTimeout = vi.fn();
    const props = { ...defaults, timeoutMs: 2000, warningBeforeMs: 500, onTimeout };
    // Aba voltou de segundo plano com o carimbo já vencido: vence sem passar pelo aviso.
    sessionStorage.setItem(KEY, String(Date.now() - 10_000));
    const { rerender } = renderHook((p) => useIdleTimer(p), { initialProps: props });

    act(() => vi.advanceTimersByTime(1000));
    expect(onTimeout).toHaveBeenCalledTimes(1);

    // saída: timer desligado e carimbo removido; novo login religa
    rerender({ ...props, enabled: false });
    sessionStorage.removeItem(KEY);
    act(() => vi.advanceTimersByTime(200));
    rerender({ ...props, enabled: true });

    // 2,1 s depois de religar (3,3 s depois do 1º disparo, antes dos 5 s do reenvio)
    act(() => vi.advanceTimersByTime(2100));
    expect(onTimeout).toHaveBeenCalledTimes(2);
  });

  it('resetTimer renova carimbo e limpa warning', () => {
    const onWarning = vi.fn();
    const { result } = renderHook(() => useIdleTimer({ ...defaults, onWarning }));

    act(() => vi.advanceTimersByTime(3100));
    expect(result.current.isWarning).toBe(true);

    act(() => result.current.resetTimer());
    expect(result.current.isWarning).toBe(false);

    const stamp = Number(sessionStorage.getItem(KEY));
    expect(Date.now() - stamp).toBeLessThan(200);
  });

  it('congelamento: mousemove durante aviso NÃO grava carimbo', () => {
    const { result } = renderHook(() => useIdleTimer(defaults));

    act(() => vi.advanceTimersByTime(3100));
    expect(result.current.isWarning).toBe(true);

    const stampBefore = sessionStorage.getItem(KEY);
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(200);
    });
    expect(sessionStorage.getItem(KEY)).toBe(stampBefore);
  });

  it('resetTimer grava carimbo mesmo com isWarning=true', () => {
    const { result } = renderHook(() => useIdleTimer(defaults));

    act(() => vi.advanceTimersByTime(3100));
    expect(result.current.isWarning).toBe(true);

    act(() => result.current.resetTimer());
    const stamp = Number(sessionStorage.getItem(KEY));
    expect(Date.now() - stamp).toBeLessThan(200);
  });

  it('enabled=false desativa listeners e interval', () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      (props) => useIdleTimer(props),
      { initialProps: { ...defaults, onTimeout, enabled: false } },
    );

    act(() => vi.advanceTimersByTime(6000));
    expect(onTimeout).not.toHaveBeenCalled();

    rerender({ ...defaults, onTimeout, enabled: true });
    act(() => vi.advanceTimersByTime(5100));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('throttle: stampActivity ignora gravações rápidas demais', () => {
    renderHook(() => useIdleTimer(defaults));
    const stamp1 = sessionStorage.getItem(KEY);

    act(() => {
      vi.advanceTimersByTime(50);
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(sessionStorage.getItem(KEY)).toBe(stamp1);

    act(() => {
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(sessionStorage.getItem(KEY)).not.toBe(stamp1);
  });

  it('visibilitychange avalia sem resetar carimbo', () => {
    renderHook(() => useIdleTimer(defaults));
    const stampAfterMount = sessionStorage.getItem(KEY);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(sessionStorage.getItem(KEY)).toBe(stampAfterMount);
  });
});
