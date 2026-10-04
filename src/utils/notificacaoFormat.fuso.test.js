import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grupoTemporal, groupNotificacoes } from './notificacaoFormat.js';

const DF = 'America/Sao_Paulo';
const AC = 'America/Rio_Branco';

describe('grupoTemporal — "hoje" no fuso da clínica (21:30 Brasília = 00:30 UTC)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Qua 30/09/2026 21:30 em Brasília; 19:30 em Rio Branco; já 01/10 em UTC.
    vi.setSystemTime(new Date('2026-10-01T00:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('notificação de 20:00 (Brasília) do dia 30 é "hoje" em DF e AC, apesar de UTC já ser dia 01', () => {
    const criadoEm = '2026-09-30T23:00:00Z';
    expect(grupoTemporal(criadoEm, DF)).toBe('hoje');
    expect(grupoTemporal(criadoEm, AC)).toBe('hoje');
  });

  it('01:00 de 30/09 em Brasília é 23:00 de 29/09 no Acre: "hoje" em DF, "semana" em AC', () => {
    const criadoEm = '2026-09-30T04:00:00Z';
    expect(grupoTemporal(criadoEm, DF)).toBe('hoje');
    expect(grupoTemporal(criadoEm, AC)).toBe('semana');
  });

  it('groupNotificacoes usa o fuso recebido (sem default do navegador)', () => {
    const items = [
      { id: 1, tipo: 'paciente_confirmou', criadoEm: '2026-09-30T04:00:00Z' },
      { id: 2, tipo: 'paciente_confirmou', criadoEm: '2026-09-30T23:00:00Z' },
    ];
    const df = groupNotificacoes(items, 'todas', DF);
    const ac = groupNotificacoes(items, 'todas', AC);
    expect(df.hoje.map((n) => n.id)).toEqual([1, 2]);
    expect(ac.hoje.map((n) => n.id)).toEqual([2]);
    expect(ac.semana.map((n) => n.id)).toEqual([1]);
  });
});
