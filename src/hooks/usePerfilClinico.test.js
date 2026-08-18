import { describe, it, expect } from 'vitest';
import { mapGetToState } from './usePerfilClinico';

describe('mapGetToState', () => {
  it('mapeia origemDeclaracao, confirmadoEm e registradoPorNome', () => {
    const state = mapGetToState({
      alergias: [{
        id: 'a1',
        codigo: 'dipirona',
        nome: 'Dipirona',
        observacao: '',
        origemDeclaracao: 'PACIENTE_DECLAROU',
        confirmadoEm: null,
        registradoPorNome: null,
      }],
      alergiasPrincipioAtivo: [],
      medicamentosEmUso: [{
        id: 'm1',
        codigo: 'losartana',
        nome: 'Losartana',
        dose: '50mg',
        origemDeclaracao: 'PROFISSIONAL_REGISTROU',
        confirmadoEm: '2026-08-16T12:00:00Z',
        registradoPorNome: 'Dra. Ana',
      }],
      antecedentes: [],
    });

    expect(state.alergias[0].origemDeclaracao).toBe('PACIENTE_DECLAROU');
    expect(state.alergias[0].confirmadoEm).toBeNull();
    expect(state.medicamentosEmUso[0].registradoPorNome).toBe('Dra. Ana');
    expect(state.medicamentosEmUso[0].confirmadoEm).toBe('2026-08-16T12:00:00Z');
  });

  it('tolera resposta antiga sem os campos de origem', () => {
    const state = mapGetToState({
      alergias: [{ id: 'a1', codigo: 'latex', nome: 'Látex' }],
    });
    expect(state.alergias[0].nome).toBe('Látex');
    expect(state.alergias[0].origemDeclaracao).toBeNull();
    expect(state.alergias[0].confirmadoEm).toBeNull();
    expect(state.alergias[0].registradoPorNome).toBeNull();
  });
});
