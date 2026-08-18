import { describe, it, expect } from 'vitest';
import { mapResumoToLegacy, normalizeResumo } from './useAlertasClinicos.js';

const resumo = {
  temVigente: true,
  vigenteEm: '2026-08-18T12:00:00Z',
  vigenteAssinada: true,
  alergiasAlimentares: [{ id: 'a1', nome: 'Camarão' }],
  alergiasPrincipioAtivo: [{ id: 'p1', nome: 'dipirona' }],
  medicamentosEmUso: [{ id: 'm1', nome: 'Losartana', dose: '50mg' }],
  condicoesSaude: [{ id: 'c1', nome: 'Asma' }],
  declaracoesCriticas: ['Tem dificuldade em abrir a boca'],
  declaracoesDemais: ['Tem dor de dente'],
  historicoFamiliar: ['Infarto'],
  historico: [{ natureza: 'Alergia alimentar', texto: 'Ovo' }],
};

describe('mapResumoToLegacy', () => {
  it('mapeia o resumo e deriva legado para sidebar', () => {
    const mapped = mapResumoToLegacy(resumo);

    expect(mapped.temAnamneseVigente).toBe(true);
    expect(mapped.vigenteAssinada).toBe(true);
    expect(mapped.vigenteEm).toBe('2026-08-18T12:00:00Z');
    expect(mapped.resumo.historico).toEqual([{ natureza: 'Alergia alimentar', texto: 'Ovo' }]);

    expect(mapped.alertasPerfil.map((a) => a.secao)).toEqual([
      'alergias',
      'alergiasPrincipioAtivo',
      'medicamentos',
      'antecedentes',
    ]);
    expect(mapped.alertasPerfil.find((a) => a.secao === 'medicamentos').valor).toBe('Losartana · 50mg');

    expect(mapped.alertasAnamnese.map((a) => a.severidade)).toEqual(['critica', 'alerta', 'alerta']);
    expect(mapped.alertasAnamnese[2].familiar).toBe(true);
    expect(mapped.alertasAnamnese[2].titulo).toBe('Histórico familiar: Infarto');
  });

  it('criticosCount soma alergias alimentares, PA e declarações críticas', () => {
    const mapped = mapResumoToLegacy(resumo);
    expect(mapped.criticosCount).toBe(3);
  });

  it('tolera payload vazio', () => {
    const mapped = mapResumoToLegacy(null);
    expect(mapped.temAnamneseVigente).toBe(false);
    expect(mapped.vigenteAssinada).toBe(false);
    expect(mapped.alertasPerfil).toEqual([]);
    expect(mapped.alertasAnamnese).toEqual([]);
    expect(mapped.criticosCount).toBe(0);
  });
});

describe('normalizeResumo', () => {
  it('preenche listas ausentes', () => {
    const n = normalizeResumo({ temVigente: true });
    expect(n.alergiasAlimentares).toEqual([]);
    expect(n.historico).toEqual([]);
    expect(n.temVigente).toBe(true);
  });
});
