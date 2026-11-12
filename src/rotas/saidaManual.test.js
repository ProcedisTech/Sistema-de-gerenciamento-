import { afterEach, describe, expect, it, vi } from 'vitest';
import { saidaManual } from './saidaManual';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('saidaManual', () => {
  it('marcar / existe / limpar', () => {
    expect(saidaManual.existe()).toBe(false);
    saidaManual.marcar();
    expect(saidaManual.existe()).toBe(true);
    expect(sessionStorage.getItem('procedi_saida_manual')).toBe('1');
    saidaManual.limpar();
    expect(saidaManual.existe()).toBe(false);
  });

  it('storage que lança: existe() false e nada lança', () => {
    const erro = () => {
      throw new Error('bloqueado');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(erro);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(erro);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(erro);
    expect(() => saidaManual.marcar()).not.toThrow();
    expect(saidaManual.existe()).toBe(false);
    expect(() => saidaManual.limpar()).not.toThrow();
  });
});
