import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PastaAtendimentosAvulsos } from './PastaAtendimentosAvulsos.jsx';

vi.mock('../patients/GaleriaArquivoImage.jsx', () => ({
  GaleriaArquivoImage: ({ alt }) => <img alt={alt} data-testid="galeria-arquivo-img" />,
}));

vi.mock('../patients/galeria/GaleriaMapaThumb.jsx', () => ({
  GaleriaMapaThumb: ({ alt }) => <div data-testid="galeria-mapa-thumb">{alt}</div>,
}));

describe('PastaAtendimentosAvulsos - Exibição de Procedimentos Únicos e Múltiplos', () => {
  it('renderiza título singular quando a sessão contém apenas 1 procedimento', () => {
    const atendimentosMock = [
      {
        chave: 'pf_1',
        id: 'pf_1',
        nomeProcedimento: 'Aplicação de Botox',
        procedimentosItens: [
          { id: 'pf_1', nome: 'Aplicação de Botox', corHex: '#06b6d4' },
        ],
        dataISO: '2026-04-10',
        fotos: [],
      },
    ];

    render(
      <PastaAtendimentosAvulsos
        atendimentosAvulsos={atendimentosMock}
        pacienteId="pac-1"
        initialOpen={true}
        onOpenLightbox={vi.fn()}
      />
    );

    expect(screen.getByText('Aplicação de Botox')).not.toBeNull();
    // Não deve exibir badge de "+N outros"
    expect(screen.queryByText(/outros/i)).toBeNull();
  });

  it('renderiza chips neutros com bolinha colorida quando a sessão contém múltiplos procedimentos', () => {
    const atendimentosMock = [
      {
        chave: 'ag_sessao_1',
        id: 'ag_sessao_1',
        agendaId: 'sessao_1',
        nomeProcedimento: 'Exérese de Lesão + Drenagem de Abscesso + Cauterização',
        nomesProcedimentos: ['Exérese de Lesão', 'Drenagem de Abscesso', 'Cauterização'],
        procedimentosItens: [
          { id: 'pf_1', nome: 'Exérese de Lesão', corHex: '#06b6d4' },
          { id: 'pf_2', nome: 'Drenagem de Abscesso', corHex: '#ec4899' },
          { id: 'pf_3', nome: 'Cauterização', corHex: '#10b981' },
        ],
        dataISO: '2026-04-10',
        fotos: [],
      },
    ];

    render(
      <PastaAtendimentosAvulsos
        atendimentosAvulsos={atendimentosMock}
        pacienteId="pac-1"
        initialOpen={true}
        onOpenLightbox={vi.fn()}
      />
    );

    // Os 2 primeiros devem aparecer nos chips
    expect(screen.getByText('Exérese de Lesão')).not.toBeNull();
    expect(screen.getByText('Drenagem de Abscesso')).not.toBeNull();

    // O terceiro deve ser condensado em "+1 outros"
    expect(screen.getByText('+1 outros')).not.toBeNull();

    // Ao clicar para expandir o card de atendimento
    const cardHeader = screen.getByText('Exérese de Lesão').closest('.cursor-pointer');
    fireEvent.click(cardHeader);

    // Na visualização expandida, todos os 3 procedimentos devem ser listados
    expect(screen.getByText(/Procedimentos Realizados nesta Sessão \(3\):/i)).not.toBeNull();
    expect(screen.getByText('Cauterização')).not.toBeNull();
  });
});
