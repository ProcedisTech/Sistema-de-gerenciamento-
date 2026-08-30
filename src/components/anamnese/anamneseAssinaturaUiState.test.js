import { describe, expect, it } from 'vitest';
import { resolverEstadoAssinatura } from './anamneseAssinaturaUiState.js';

describe('resolverEstadoAssinatura', () => {
  it('permite solicitar sem assinatura e sem envio', () => {
    const ui = resolverEstadoAssinatura({
      assinada: false,
      envioStatus: null,
      preenchimentoId: 'p1',
      pacienteId: 'pac1',
      imutavel: false,
    });
    expect(ui.podeSolicitar).toBe(true);
    expect(ui.envioAtivo).toBe(false);
  });

  it('bloqueia solicitar com envio pendente', () => {
    const ui = resolverEstadoAssinatura({
      assinada: false,
      envioStatus: 'PENDENTE',
      preenchimentoId: 'p1',
      pacienteId: 'pac1',
      imutavel: false,
    });
    expect(ui.podeSolicitar).toBe(false);
    expect(ui.aguardandoPaciente).toBe(true);
    expect(ui.envioAtivo).toBe(true);
  });

  it('reenviar após expirado', () => {
    const ui = resolverEstadoAssinatura({
      assinada: false,
      envioStatus: 'EXPIRADO',
      preenchimentoId: 'p1',
      pacienteId: 'pac1',
      imutavel: false,
    });
    expect(ui.podeSolicitar).toBe(true);
    expect(ui.envioAtivo).toBe(false);
  });
});
