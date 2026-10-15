import { describe, expect, it } from 'vitest';
import { dentroDoPeriodo, formatData } from './AuditoriaUtils.jsx';

const DF = 'America/Sao_Paulo';
const AC = 'America/Rio_Branco';
// Qui 01/10/2026 00:30 UTC = Qua 30/09 21:30 em Brasília = 19:30 em Rio Branco.
const AGORA = Date.parse('2026-10-01T00:30:00Z');

describe('Auditoria — instantes no fuso da clínica', () => {
  it('formatData exibe o instante no fuso recebido, com o mesmo formato de antes', () => {
    expect(formatData('2026-10-01T00:30:00Z', DF)).toBe('30/09/2026, 21:30');
    expect(formatData('2026-10-01T00:30:00Z', AC)).toBe('30/09/2026, 19:30');
    expect(formatData(null, DF)).toBe('-');
  });

  it('"hoje" usa o dia da clínica, não o dia UTC', () => {
    const registro = '2026-09-30T23:50:00Z';
    expect(dentroDoPeriodo(registro, 'hoje', DF, AGORA)).toBe(true);
    expect(dentroDoPeriodo(registro, 'hoje', AC, AGORA)).toBe(true);
    expect(dentroDoPeriodo('2026-10-01T00:10:00Z', 'hoje', DF, AGORA)).toBe(true);
  });

  it('"mês" começa no dia 1 da clínica: 30/09 ainda é setembro em DF/AC', () => {
    // 02:00 UTC de 01/09 = 23:00 de 31/08 em Brasília → fora de setembro.
    expect(dentroDoPeriodo('2026-09-01T02:00:00Z', 'mes', DF, AGORA)).toBe(false);
    expect(dentroDoPeriodo('2026-09-01T03:30:00Z', 'mes', DF, AGORA)).toBe(true);
    // 04:30 UTC de 01/09 = 23:30 de 31/08 no Acre → fora; em DF já é setembro.
    expect(dentroDoPeriodo('2026-09-01T04:30:00Z', 'mes', AC, AGORA)).toBe(false);
    expect(dentroDoPeriodo('2026-09-01T04:30:00Z', 'mes', DF, AGORA)).toBe(true);
  });

  it('"1h" é janela móvel e ignora valores sem fuso', () => {
    expect(dentroDoPeriodo('2026-09-30T23:45:00Z', '1h', DF, AGORA)).toBe(true);
    expect(dentroDoPeriodo('2026-09-30T23:15:00Z', '1h', DF, AGORA)).toBe(false);
    expect(dentroDoPeriodo('2026-09-30T23:45:00', '1h', DF, AGORA)).toBe(false);
  });
});
