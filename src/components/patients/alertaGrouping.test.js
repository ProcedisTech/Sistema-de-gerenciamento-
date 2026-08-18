import { describe, it, expect } from 'vitest';
import { buildGroupedChips } from './alertaGrouping.js';

const alergiaAlimentar = {
  key: 'perfil-alergia-1',
  titulo: 'Alergia alimentar',
  valor: 'Peixe (genérico)',
  secao: 'alergias',
};

const alergiaPa = {
  key: 'perfil-pa-1',
  titulo: 'Alergia a princípio ativo',
  valor: 'dipirona',
  secao: 'alergiasPrincipioAtivo',
};

const medicamento = {
  key: 'perfil-med-1',
  titulo: 'Medicamento em uso',
  valor: 'Losartana · 50mg',
  secao: 'medicamentos',
};

const fatoCritico = {
  key: 'fato-critica-0',
  titulo: 'Tem dificuldade em abrir a boca',
  valor: 'Tem dificuldade em abrir a boca',
  origem: 'anamnese',
  severidade: 'critica',
};

describe('buildGroupedChips', () => {
  it('agrupa por campo na ordem alimentar → PA → medicamento → anamnese', () => {
    const groups = buildGroupedChips([alergiaAlimentar, alergiaPa, medicamento], [fatoCritico]);
    expect(groups.map((g) => g.secao)).toEqual([
      'alergias',
      'alergiasPrincipioAtivo',
      'medicamentos',
      'anamnese',
    ]);
    expect(groups[0].items[0].label).toBe('Peixe (genérico)');
    expect(groups[3].items[0].label).toBe('Tem dificuldade em abrir a boca');
  });

  it('omite grupos vazios', () => {
    const groups = buildGroupedChips([medicamento], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].secao).toBe('medicamentos');
  });

  it('listas vazias devolvem nenhum grupo', () => {
    expect(buildGroupedChips([], [])).toEqual([]);
  });
});
