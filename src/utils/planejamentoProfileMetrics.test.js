import { describe, expect, it } from 'vitest';
import { calcSessoesPlano } from './planejamentoProfileMetrics.js';

describe('calcSessoesPlano', () => {
  it('conta feitas / total ignorando cancelados', () => {
    const { feitas, total } = calcSessoesPlano([
      { statusItem: 'finalizado' },
      { statusItem: 'finalizado' },
      { statusItem: null },
      { statusItem: 'cancelado' },
      { statusItem: 'agendado' },
    ]);
    expect(feitas).toBe(2);
    expect(total).toBe(4);
  });

  it('lista vazia zera', () => {
    expect(calcSessoesPlano([])).toEqual({ feitas: 0, total: 0 });
    expect(calcSessoesPlano(null)).toEqual({ feitas: 0, total: 0 });
  });
});
