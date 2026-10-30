import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { ConsultaRetornoOrigemModal } from './ConsultaRetornoOrigemModal.jsx';
import { pacientesApi, planejamentosApi, procedimentosApi } from '../../services/api.js';

vi.mock('../../services/api.js', () => ({
  pacientesApi: {
    listarProcedimentosFeitosRaiz: vi.fn(),
  },
  planejamentosApi: {
    listarPorPaciente: vi.fn(),
  },
  procedimentosApi: {
    byPaciente: vi.fn(),
  },
}));

vi.mock('../hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }),
}));

describe('ConsultaRetornoOrigemModal — Abas, Accordion Natural e Trava de Escopo', () => {
  const pacienteId = 'paciente-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock das APIs com 2 planos válidos (1 ativo, 1 concluído), 1 plano cancelado, e 2 avulsos
    pacientesApi.listarProcedimentosFeitosRaiz.mockResolvedValue([
      {
        id: 'proc-1',
        nome: 'Drenagem de Abscesso',
        planejamentoItemId: 'plan-item-1',
        data: '2026-10-24T14:00:00Z',
        catalogoProcedimentoSaudeId: 'cat-1',
      },
      {
        id: 'proc-2',
        nome: 'Biópsia de Pele',
        planejamentoItemId: 'plan-item-2',
        data: '2026-10-24T14:30:00Z',
        catalogoProcedimentoSaudeId: 'cat-2',
      },
      {
        id: 'proc-3',
        nome: 'Exérese de Lesão Cutânea',
        planejamentoItemId: 'plan-item-3',
        data: '2026-09-10T10:00:00Z',
        catalogoProcedimentoSaudeId: 'cat-3',
      },
      {
        id: 'proc-4',
        nome: 'Crioterapia Facial',
        planejamentoItemId: null, // Avulso
        data: '2026-10-05T16:00:00Z',
        catalogoProcedimentoSaudeId: 'cat-4',
      },
      {
        id: 'proc-5',
        nome: 'Remoção de Sinal',
        planejamentoItemId: null, // Avulso
        data: '2026-08-20T11:00:00Z',
        catalogoProcedimentoSaudeId: 'cat-5',
      },
      {
        id: 'proc-cancelado',
        nome: 'Procedimento Cancelado',
        planejamentoItemId: 'plan-item-cancelado',
        data: '2026-08-01T09:00:00Z',
        catalogoProcedimentoSaudeId: 'cat-canc',
      },
    ]);

    planejamentosApi.listarPorPaciente.mockResolvedValue([
      {
        id: 'plano-ativo',
        nome: 'Plano de Tratamento',
        criadoEm: '2026-10-24T12:00:00Z',
        statusCodigo: 'em_andamento',
        itens: [
          { id: 'plan-item-1', planejamentoItemId: 'plan-item-1' },
          { id: 'plan-item-2', planejamentoItemId: 'plan-item-2' },
        ],
      },
      {
        id: 'plano-concluido',
        nome: 'Plano de Tratamento',
        criadoEm: '2026-09-10T09:00:00Z',
        statusCodigo: 'concluido',
        itens: [{ id: 'plan-item-3', planejamentoItemId: 'plan-item-3' }],
      },
      {
        id: 'plano-cancelado',
        nome: 'Plano de Tratamento',
        criadoEm: '2026-08-01T08:00:00Z',
        statusCodigo: 'cancelado',
        itens: [{ id: 'plan-item-cancelado', planejamentoItemId: 'plan-item-cancelado' }],
      },
    ]);

    procedimentosApi.byPaciente.mockResolvedValue([]);
  });

  it('renderiza as abas com contagens corretas e oculta planos cancelados', async () => {
    render(
      <ConsultaRetornoOrigemModal
        open={true}
        pacienteId={pacienteId}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Planos de Tratamento/i })).toBeInTheDocument();
    });

    // 2 planos válidos (o cancelado foi descartado)
    expect(screen.getByRole('tab', { name: /Planos de Tratamento 2/i })).toBeInTheDocument();
    // 2 avulsos
    expect(screen.getByRole('tab', { name: /Sem Plano \(Avulsos\) 2/i })).toBeInTheDocument();

    // O plano cancelado não deve aparecer
    expect(screen.queryByText('Procedimento Cancelado')).not.toBeInTheDocument();
  });

  it('inicia na aba de Planos com o plano em andamento já expandido por padrão', async () => {
    render(
      <ConsultaRetornoOrigemModal
        open={true}
        pacienteId={pacienteId}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Drenagem de Abscesso')).toBeInTheDocument();
      expect(screen.getByText('Biópsia de Pele')).toBeInTheDocument();
    });

    // O badge 'Em andamento' deve estar visível
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    // O badge 'Concluído' deve estar visível no outro plano
    expect(screen.getByText('Concluído')).toBeInTheDocument();
  });

  it('comporta-se como sanfona única: ao clicar no outro plano, fecha o primeiro e abre o segundo', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaRetornoOrigemModal
        open={true}
        pacienteId={pacienteId}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Drenagem de Abscesso')).toBeInTheDocument();
    });

    // Clica no cabeçalho do plano concluído (segundo plano)
    const headers = screen.getAllByRole('button', { name: /Plano de Tratamento/i });
    expect(headers.length).toBe(2);

    await user.click(headers[1]);

    // Agora o item do plano concluído ('Exérese') deve estar visível
    expect(screen.getByText('Exérese de Lesão Cutânea')).toBeInTheDocument();
    // E o primeiro plano recolheu (itens não mais no DOM visível)
    expect(screen.queryByText('Drenagem de Abscesso')).not.toBeInTheDocument();
  });

  it('aplica trava inteligente de escopo ao selecionar item do plano e bloqueia outro plano', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaRetornoOrigemModal
        open={true}
        pacienteId={pacienteId}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Drenagem de Abscesso')).toBeInTheDocument();
    });

    // Seleciona o primeiro procedimento
    const itemDrenagem = screen.getByRole('checkbox', { name: /Drenagem de Abscesso/i });
    await user.click(itemDrenagem);

    // Permite multi-seleção no mesmo plano
    const itemBiopsia = screen.getByRole('checkbox', { name: /Biópsia de Pele/i });
    await user.click(itemBiopsia);

    // O botão de confirmar deve indicar 2 procedimentos
    expect(screen.getByRole('button', { name: /Iniciar Retorno \(2\)/i })).toBeInTheDocument();

    // Abre o segundo plano
    const headers = screen.getAllByRole('button', { name: /Plano de Tratamento/i });
    await user.click(headers[1]);

    // O item do segundo plano deve estar travado (aria-disabled=true)
    const itemExerese = screen.getByRole('checkbox', { name: /Exérese de Lesão Cutânea/i });
    expect(itemExerese).toHaveAttribute('aria-disabled', 'true');

    // Clicar nele não adiciona à seleção
    await user.click(itemExerese);
    expect(screen.getByRole('button', { name: /Iniciar Retorno \(2\)/i })).toBeInTheDocument();
  });

  it('exibe diálogo de confirmação ao tentar mudar de aba com itens já selecionados', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaRetornoOrigemModal
        open={true}
        pacienteId={pacienteId}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Drenagem de Abscesso')).toBeInTheDocument();
    });

    // Seleciona 1 procedimento
    const itemDrenagem = screen.getByRole('checkbox', { name: /Drenagem de Abscesso/i });
    await user.click(itemDrenagem);

    // Clica na aba Sem Plano
    const tabAvulsos = screen.getByRole('tab', { name: /Sem Plano \(Avulsos\)/i });
    await user.click(tabAvulsos);

    // Deve exibir o aviso de confirmação
    expect(
      screen.getByText(/Deseja desmarcar para alternar para a aba/i),
    ).toBeInTheDocument();

    // Se clicar em 'Cancelar', permanece na aba Planos
    const btnCancelar = screen.getByRole('button', { name: /Cancelar/i });
    await user.click(btnCancelar);
    expect(screen.getByRole('tab', { name: /Planos de Tratamento/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Clica de novo e confirma a troca
    await user.click(tabAvulsos);
    const btnConfirmarTroca = screen.getByRole('button', { name: /Sim, desmarcar/i });
    await user.click(btnConfirmarTroca);

    // Agora está na aba de Avulsos e a seleção foi limpa
    expect(screen.getByRole('tab', { name: /Sem Plano \(Avulsos\)/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Crioterapia Facial')).toBeInTheDocument();
    expect(screen.getByText('Nenhum procedimento selecionado')).toBeInTheDocument();
  });

  it('chama onConfirm passando os itens selecionados com o planoId associado', async () => {
    const user = userEvent.setup();
    const onConfirmMock = vi.fn();

    render(
      <ConsultaRetornoOrigemModal
        open={true}
        pacienteId={pacienteId}
        onClose={vi.fn()}
        onConfirm={onConfirmMock}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Drenagem de Abscesso')).toBeInTheDocument();
    });

    // Seleciona Drenagem e Biópsia
    await user.click(screen.getByRole('checkbox', { name: /Drenagem de Abscesso/i }));
    await user.click(screen.getByRole('checkbox', { name: /Biópsia de Pele/i }));

    // Clica em Iniciar Retorno
    const btnIniciar = screen.getByRole('button', { name: /Iniciar Retorno \(2\)/i });
    await user.click(btnIniciar);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    const itensChamados = onConfirmMock.mock.calls[0][0];
    expect(itensChamados).toHaveLength(2);
    expect(itensChamados[0].planoId).toBe('plano-ativo');
    expect(itensChamados[1].planoId).toBe('plano-ativo');
    expect(itensChamados[0].tipoOrigem).toBe('plano');
  });
});

