import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { Step4Procedimento } from './Step4LGPD.jsx';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: 'cat-botox', nomeProcedimento: 'Toxina Botulínica' },
      { id: 'cat-preench', nomeProcedimento: 'Preenchimento Labial' },
      { id: 'cat-limpeza', nomeProcedimento: 'Limpeza de Pele' },
    ],
    loading: false,
  }),
}));

vi.mock('./mapa-aplicacao/MapaAplicacaoPanel.jsx', () => ({
  MapaAplicacaoPanel: () => <div>mapa-aplicacao-panel</div>,
}));

vi.mock('./PhotoCarouselLane.jsx', () => ({
  PhotoCarouselLane: () => <div>photo-carousel-lane</div>,
}));

describe('Step4Procedimento — Isolamento de Termos e Decisão Plano vs Avulso', () => {
  it('exibe card de procedimentos do plano ativo e adiciona com 1 clique', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    const setProcedimentosSessaoMock = vi.fn();

    const journeyPlanejamentoCtx = {
      planejamentoId: 'plano-123',
      titulo: 'Harmonização Facial',
      itens: [
        {
          id: 'item-botox-1',
          catalogoProcedimentoSaudeId: 'cat-botox',
          nomeProcedimento: 'Toxina Botulínica',
          statusItem: 'pendente',
        },
      ],
    };

    render(
      <Step4Procedimento
        procedimentosSessao={[]}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={journeyPlanejamentoCtx}
      />
    );

    // O card do plano ativo deve estar visível
    expect(screen.getByText(/Procedimentos do Plano de Tratamento Ativo/i)).toBeInTheDocument();

    // Clica no botão do item do plano
    const btnPlano = screen.getByRole('button', { name: /Realizar pelo Plano/i });
    fireEvent.click(btnPlano);

    // Verifica que a lista foi atualizada com planejamentoItemId e isAvulso: false
    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          catalogoId: 'cat-botox',
          nomeProcedimento: 'Toxina Botulínica',
          planejamentoItemId: 'item-botox-1',
          isAvulso: false,
        }),
      ])
    );
  });

  it('abre modal de interceptação quando procedimento do plano é selecionado na busca', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    const setProcedimentosSessaoMock = vi.fn();

    const journeyPlanejamentoCtx = {
      planejamentoId: 'plano-123',
      itens: [
        {
          id: 'item-botox-1',
          catalogoProcedimentoSaudeId: 'cat-botox',
          nomeProcedimento: 'Toxina Botulínica',
          statusItem: 'pendente',
        },
      ],
    };

    render(
      <Step4Procedimento
        procedimentosSessao={[]}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
        journeyPlanejamentoCtx={journeyPlanejamentoCtx}
      />
    );

    // Busca manual por Toxina Botulínica
    const searchInput = screen.getByPlaceholderText(/Buscar procedimento/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Toxina' } });

    // Seleciona a opção na lista do dropdown
    const option = await screen.findByRole('option', { name: /Toxina Botulínica/i });
    fireEvent.click(option);

    // O modal interceptador deve abrir
    await waitFor(() => {
      expect(screen.getByText(/Procedimento Encontrado no Plano/i)).toBeInTheDocument();
      expect(screen.getByText(/Realizar pelo Plano de Tratamento/i)).toBeInTheDocument();
      expect(screen.getByText(/Realizar como Procedimento Avulso \(Fora do Plano\)/i)).toBeInTheDocument();
    });

    // Se o usuário clicar em "Realizar como Procedimento Avulso"
    const btnAvulso = screen.getByText(/Realizar como Procedimento Avulso \(Fora do Plano\)/i);
    fireEvent.click(btnAvulso);

    expect(setProcedimentosSessaoMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          catalogoId: 'cat-botox',
          nomeProcedimento: 'Toxina Botulínica',
          planejamentoItemId: null,
          isAvulso: true,
        }),
      ])
    );
  });
});
