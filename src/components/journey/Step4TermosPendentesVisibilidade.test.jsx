// Regressão prevenida: Quando há procedimentos selecionados com termos obrigatórios não assinados
// (execucaoBloqueadaPorTermos = true), o card "Termos de Consentimento da Sessão" DEVE continuar
// visível com a lista de pendências e ações de assinatura, nunca sumindo da tela do profissional.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Step4Procedimento } from './Step4LGPD.jsx';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [{ id: 'cat-botox', nomeProcedimento: 'Toxina Botulínica' }],
    loading: false,
  }),
}));

vi.mock('./mapa-aplicacao/MapaAplicacaoPanel.jsx', () => ({
  MapaAplicacaoPanel: () => <div data-testid="mapa-panel">mapa-panel</div>,
}));

vi.mock('./PhotoCarouselLane.jsx', () => ({
  PhotoCarouselLane: () => <div>photo-carousel-lane</div>,
}));

describe('Step4LGPD — Regressão de Visibilidade dos Termos Pendentes', () => {
  it('exibe o card "Termos de Consentimento da Sessão" mesmo quando a execução está bloqueada por termos não assinados', () => {
    // Arrange (Dado)
    const procedimentos = [
      {
        catalogoProcedimentoSaudeId: 'cat-botox',
        nomeProcedimento: 'Toxina Botulínica',
      },
    ];

    const resolucao = {
      itens: [
        {
          termoId: 'termo-1',
          titulo: 'Termo de Toxina Botulínica',
          assinado: false,
        },
      ],
      temPendencia: true,
    };

    // Act (Quando)
    render(
      <Step4Procedimento
        procedimentosSessao={procedimentos}
        execucaoBloqueadaPorTermos={true}
        titulosTermosFaltantes={['Termo de Toxina Botulínica']}
        resolucao={resolucao}
      />
    );

    // Assert (Então)
    const cardTitulo = screen.getByText(/Termos de Consentimento da Sessão/i);
    expect(cardTitulo).toBeInTheDocument();

    const bannerBloqueio = screen.getByText(/Procedimento bloqueado até a assinatura de:/i);
    expect(bannerBloqueio).toBeInTheDocument();
  });
});
