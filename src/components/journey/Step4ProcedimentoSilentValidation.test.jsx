import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { Step4Procedimento } from './Step4LGPD.jsx';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: 'cat-1', nomeProcedimento: 'Biópsia de Pele' },
      { id: 'cat-2', nomeProcedimento: 'Retirada de Pontos' },
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

describe('Step4Procedimento — validação silenciosa de termos no autocomplete', () => {
  it('ao selecionar procedimento, passa { abrirModal: false } para onValidarTermosCatalogo', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    const setProcedimentosSessaoMock = vi.fn();

    render(
      <Step4Procedimento
        procedimentosSessao={[]}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
      />
    );

    // Clica no input de busca para abrir opções
    const searchInput = screen.getByPlaceholderText(/Buscar procedimento/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Biópsia' } });

    // Clica na opção
    const option = await screen.findByText(/Biópsia de Pele/i);
    fireEvent.click(option);

    await waitFor(() => {
      expect(onValidarMock).toHaveBeenCalledWith(
        ['cat-1'],
        'Biópsia de Pele',
        expect.objectContaining({ abrirModal: false })
      );
    });
  });

  it('ao remover chip de procedimento, passa { abrirModal: false } para onValidarTermosCatalogo', async () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    const setProcedimentosSessaoMock = vi.fn();

    render(
      <Step4Procedimento
        procedimentosSessao={[
          {
            catalogoProcedimentoSaudeId: 'cat-1',
            catalogoId: 'cat-1',
            nomeProcedimento: 'Biópsia de Pele',
          },
          {
            catalogoProcedimentoSaudeId: 'cat-2',
            catalogoId: 'cat-2',
            nomeProcedimento: 'Retirada de Pontos',
          },
        ]}
        setProcedimentosSessao={setProcedimentosSessaoMock}
        onValidarTermosCatalogo={onValidarMock}
      />
    );

    // Encontra o botão de remover do chip Biópsia de Pele
    const chipRemove = screen.getByRole('button', { name: /Remover Biópsia de Pele/i });
    expect(chipRemove).toBeTruthy();
    fireEvent.click(chipRemove);

    await waitFor(() => {
      expect(onValidarMock).toHaveBeenCalledWith(
        ['cat-2'],
        'Retirada de Pontos',
        expect.objectContaining({ abrirModal: false })
      );
    });
  });
});
