import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEntradaTela } from './useEntradaTela.js';

describe('useEntradaTela', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('liga no início, desliga em 1800 ms, religa com chave nova e não religa com a mesma', () => {
    const { result, rerender } = renderHook(({ k }) => useEntradaTela(k), {
      initialProps: { k: 'a' },
    });
    expect(result.current('agenda-delay-100')).toBe('animate-agenda-rise agenda-delay-100');

    act(() => vi.advanceTimersByTime(1799));
    expect(result.current('agenda-delay-100')).toBe('animate-agenda-rise agenda-delay-100');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current('agenda-delay-100')).toBe('');

    rerender({ k: 'a' });
    expect(result.current('agenda-delay-100')).toBe('');

    rerender({ k: 'b' });
    expect(result.current('agenda-delay-100')).toBe('animate-agenda-rise agenda-delay-100');
    act(() => vi.advanceTimersByTime(1800));
    expect(result.current('agenda-delay-100')).toBe('');
  });
});
