// Regressão prevenida: No mapa facial compartilhado com múltiplos procedimentos (ex: Botox e Preenchimento),
// os pontos existentes de Botox (ex: cor azul #3b82f6) devem manter sua cor e catalogoId mesmo quando
// o profissional seleciona ou arma outro procedimento (ex: Preenchimento rosa #ec4899).
// A renderização do canvas e a extração de allPontos a partir de pontosVista não pode contaminar ou
// sobrescrever p.cor e p.catalogoId com os dados do grupo pai ou do procedimento atualmente ativo.

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FotoVistaCanvas } from './FotoVistaCanvas.jsx';

vi.mock('../../ui/ProtectedPatientMedia.jsx', () => ({
  ProtectedPatientMedia: React.forwardRef((props, ref) => (
    <img ref={ref} alt="paciente" src={props.src} {...props} />
  )),
}));

vi.mock('./MapaMarcacoesOverlay.jsx', () => ({
  MapaMarcacoesOverlay: ({ pontos }) => (
    <div data-testid="mock-marcacoes-overlay">
      {(pontos || []).map((p, idx) => (
        <span
          key={p.localId || idx}
          data-testid={`ponto-${p.localId || idx}`}
          data-cor={p.cor}
          data-catalogo={p.catalogoId}
          data-nome={p.nomeProcedimento}
        >
          {p.nomeProcedimento} ({p.cor})
        </span>
      ))}
    </div>
  ),
}));

describe('Regressão Zero — Isolamento de Cores e Procedimentos em FotoVistaCanvas', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserva estritamente a cor e catalogoId de cada ponto ao gerar allPontos', () => {
    const pontosVista = [
      {
        grupoId: 'grp-botox',
        catalogoProcedimentoSaudeId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica Facial',
        corHex: '#3b82f6',
        pontos: [
          {
            localId: 'pt-1',
            posX: 30,
            posY: 40,
            quantidade: 2,
            catalogoId: 'cat-botox',
            nomeProcedimento: 'Toxina Botulínica Facial',
            cor: '#3b82f6',
          },
        ],
      },
      {
        grupoId: 'grp-preenchimento',
        catalogoProcedimentoSaudeId: 'cat-preenchimento',
        nomeProcedimento: 'Preenchimento Labial',
        corHex: '#ec4899',
        pontos: [
          {
            localId: 'pt-2',
            posX: 50,
            posY: 70,
            quantidade: 1,
            catalogoId: 'cat-preenchimento',
            nomeProcedimento: 'Preenchimento Labial',
            cor: '#ec4899',
          },
        ],
      },
    ];

    // O profissional atualmente está com Preenchimento armado
    const procedimentoArmado = {
      id: 'cat-preenchimento',
      catalogoProcedimentoSaudeId: 'cat-preenchimento',
      nome: 'Preenchimento Labial',
      corHex: '#ec4899',
    };

    const { getByTestId } = render(
      <FotoVistaCanvas
        vistaAtual="frontal"
        foto={{ displayUrl: 'https://exemplo.com/foto.jpg' }}
        procedimentoArmado={procedimentoArmado}
        pontosVista={pontosVista}
        modo="ponto"
        readOnly={false}
      />
    );

    const pontoBotox = getByTestId('ponto-pt-1');
    expect(pontoBotox.getAttribute('data-cor')).toBe('#3b82f6');
    expect(pontoBotox.getAttribute('data-catalogo')).toBe('cat-botox');
    expect(pontoBotox.getAttribute('data-nome')).toBe('Toxina Botulínica Facial');

    const pontoPreenchimento = getByTestId('ponto-pt-2');
    expect(pontoPreenchimento.getAttribute('data-cor')).toBe('#ec4899');
    expect(pontoPreenchimento.getAttribute('data-catalogo')).toBe('cat-preenchimento');
    expect(pontoPreenchimento.getAttribute('data-nome')).toBe('Preenchimento Labial');
  });
});
