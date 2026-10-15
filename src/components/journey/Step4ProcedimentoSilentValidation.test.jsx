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
  MapaAplicacaoPanel: (props) => (
    <div data-testid="mapa-panel" data-disabled={String(props.disabled)} data-hint={props.disabledHint}>
      mapa-aplicacao-panel
    </div>
  ),
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

  it('bloqueia o MapaAplicacaoPanel (disabled=true) quando nenhum procedimento foi selecionado', () => {
    render(
      <Step4Procedimento
        procedimentosSessao={[]}
        mapaState={{}}
      />
    );

    const mapaPanel = screen.getByTestId('mapa-panel');
    expect(mapaPanel.getAttribute('data-disabled')).toBe('true');
    expect(mapaPanel.getAttribute('data-hint')).toContain('Selecione um procedimento do catálogo');
  });

  it('desbloqueia o MapaAplicacaoPanel (disabled=false) quando há procedimento válido selecionado', () => {
    render(
      <Step4Procedimento
        procedimentosSessao={[
          {
            catalogoProcedimentoSaudeId: 'cat-1',
            catalogoId: 'cat-1',
            nomeProcedimento: 'Biópsia de Pele',
          },
        ]}
        mapaState={{}}
      />
    );

    const mapaPanel = screen.getByTestId('mapa-panel');
    expect(mapaPanel.getAttribute('data-disabled')).toBe('false');
  });

  it('exibe o card de Termos de Consentimento com status de checagem quando ha procedimentos selecionados e resolucao e nula', () => {
    const onValidarMock = vi.fn().mockResolvedValue(true);
    render(
      <Step4Procedimento
        procedimentosSessao={[
          {
            catalogoProcedimentoSaudeId: 'cat-1',
            catalogoId: 'cat-1',
            nomeProcedimento: 'Biópsia de Pele',
          },
        ]}
        resolucao={null}
        onValidarTermosCatalogo={onValidarMock}
      />
    );

    expect(screen.getByText('Termos de Consentimento da Sessão')).toBeInTheDocument();
    expect(screen.getByText(/Verificando termos.../i)).toBeInTheDocument();
  });

  it('exibe o card de Termos de Consentimento com badges de assinado e dispensado quando resolvido', () => {
    render(
      <Step4Procedimento
        procedimentosSessao={[
          {
            catalogoProcedimentoSaudeId: 'cat-1',
            catalogoId: 'cat-1',
            nomeProcedimento: 'Biópsia de Pele',
          },
        ]}
        resolucao={{
          termosExigidos: [
            {
              termoId: 't-1',
              titulo: 'Termo Ponto',
              vigente: true,
              assinaturaId: 'ass-1',
              catalogos: [{ catalogoId: 'cat-2', nome: 'Retirada de Pontos' }],
            },
          ],
          faltantes: [],
          procedimentosSemVinculo: [{ catalogoId: 'cat-1', nome: 'Biópsia de Pele' }],
        }}
        consentimentosAguardandoExecucao={[
          {
            termoId: 't-1',
            titulo: 'Termo Ponto',
            procedimentos: ['Retirada de Pontos'],
          },
        ]}
      />
    );

    expect(screen.getByText('Termos de Consentimento da Sessão')).toBeInTheDocument();
    expect(screen.getByText(/1 assinado/i)).toBeInTheDocument();
    expect(screen.getByText(/1 dispensado/i)).toBeInTheDocument();
  });

  it('nao exibe o card de Termos de Consentimento quando nenhum procedimento esta selecionado', () => {
    render(
      <Step4Procedimento
        procedimentosSessao={[]}
        resolucao={null}
      />
    );

    expect(screen.queryByText('Termos de Consentimento da Sessão')).not.toBeInTheDocument();
  });
});
