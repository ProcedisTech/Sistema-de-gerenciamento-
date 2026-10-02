import { describe, it, expect } from 'vitest';
import { offsetUtc, textoFusoUf } from './fusoUf.js';

const DATA = new Date('2026-07-15T12:00:00Z');

describe('fusoUf', () => {
  it('AC → UTC−5 (Acre)', () => {
    expect(textoFusoUf({ sigla: 'AC', nome: 'Acre', fusoIana: 'America/Rio_Branco' }, DATA)).toBe(
      'Fuso horário: UTC−5 (Acre)'
    );
  });

  it('DF → UTC−3 (Distrito Federal)', () => {
    expect(
      textoFusoUf({ sigla: 'DF', nome: 'Distrito Federal', fusoIana: 'America/Sao_Paulo' }, DATA)
    ).toBe('Fuso horário: UTC−3 (Distrito Federal)');
  });

  it('AM → UTC−4 (Amazonas)', () => {
    expect(textoFusoUf({ sigla: 'AM', nome: 'Amazonas', fusoIana: 'America/Manaus' }, DATA)).toBe(
      'Fuso horário: UTC−4 (Amazonas)'
    );
  });

  it('sem UF → horário de Brasília', () => {
    expect(textoFusoUf(undefined, DATA)).toBe('Sem UF: usa o horário de Brasília (UTC−3)');
    expect(textoFusoUf(null, DATA)).toBe('Sem UF: usa o horário de Brasília (UTC−3)');
  });

  it('usa o sinal de menos U+2212', () => {
    expect(offsetUtc('America/Rio_Branco', DATA)).toBe('UTC\u22125');
  });
});
