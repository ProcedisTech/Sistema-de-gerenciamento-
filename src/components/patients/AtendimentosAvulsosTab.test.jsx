import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { AtendimentosAvulsosTab } from './AtendimentosAvulsosTab.jsx';
import * as usePlanosHook from '../planos/usePlanosPaciente.js';

// Mocking usePlanosPaciente hook
vi.mock('../planos/usePlanosPaciente.js', () => ({
  usePlanosPaciente: vi.fn(),
}));

describe('AtendimentosAvulsosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exibe estado de carregamento quando loading é true', () => {
    vi.spyOn(usePlanosHook, 'usePlanosPaciente').mockReturnValue({
      planos: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(
      <AtendimentosAvulsosTab
        pacienteId="paciente-123"
        roleUserId="user-456"
        procedimentosFeitos={[]}
        galeriaFotosInicial={[]}
      />
    );

    expect(screen.getByText(/Carregando atendimentos avulsos do paciente\.\.\./i)).toBeInTheDocument();
  });

  it('exibe mensagem de erro e permite tentar novamente', async () => {
    const refreshMock = vi.fn();
    vi.spyOn(usePlanosHook, 'usePlanosPaciente').mockReturnValue({
      planos: [],
      loading: false,
      error: 'Falha na conexão com o servidor',
      refresh: refreshMock,
    });

    render(
      <AtendimentosAvulsosTab
        pacienteId="paciente-123"
        roleUserId="user-456"
        procedimentosFeitos={[]}
        galeriaFotosInicial={[]}
      />
    );

    expect(screen.getByText(/Erro ao carregar atendimentos avulsos/i)).toBeInTheDocument();
    expect(screen.getByText(/Falha na conexão com o servidor/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i });
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio amigável quando o paciente não possui atendimentos avulsos', () => {
    vi.spyOn(usePlanosHook, 'usePlanosPaciente').mockReturnValue({
      planos: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(
      <AtendimentosAvulsosTab
        pacienteId="paciente-123"
        roleUserId="user-456"
        procedimentosFeitos={[]}
        galeriaFotosInicial={[]}
      />
    );

    expect(screen.getByText(/Nenhum atendimento avulso registrado/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Procedimentos, consultas pontuais e fotos registrados fora de um plano/i)
    ).toBeInTheDocument();
  });

  it('isola com rigor procedimentos de planos e renderiza apenas atendimentos avulsos', () => {
    // 1 plano existente com 1 item: itemId = 'item-plano-1'
    const mockPlanos = [
      {
        id: 'plano-1',
        titulo: 'Harmonização Facial Completa',
        itens: [
          {
            id: 'item-plano-1',
            planejamentoItemId: 'item-plano-1',
            procedimentoNome: 'Toxina Botulínica Facial',
          },
        ],
      },
    ];

    // Procedimentos realizados: 1 vinculado ao plano, 1 avulso (sem vínculo)
    const mockProcedimentosFeitos = [
      {
        id: 'proc-plano',
        planejamentoItemId: 'item-plano-1',
        procedimentoNome: 'Toxina Botulínica Facial (Plano)',
        dataExecucao: '2026-09-01T10:00:00Z',
      },
      {
        id: 'proc-avulso-1',
        planejamentoItemId: null,
        procedimentoNome: 'Preenchimento Labial Avulso',
        dataExecucao: '2026-09-05T14:30:00Z',
      },
    ];

    vi.spyOn(usePlanosHook, 'usePlanosPaciente').mockReturnValue({
      planos: mockPlanos,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(
      <AtendimentosAvulsosTab
        pacienteId="paciente-123"
        roleUserId="user-456"
        procedimentosFeitos={mockProcedimentosFeitos}
        galeriaFotosInicial={[]}
      />
    );

    // Deve mostrar o contador "1 atendimento"
    expect(screen.getByText('1 atendimento')).toBeInTheDocument();

    // Deve mostrar o título e a descrição da aba
    expect(screen.getByRole('heading', { level: 3, name: 'Atendimentos Avulsos' })).toBeInTheDocument();

    // Deve renderizar o procedimento avulso
    expect(screen.getByText('Preenchimento Labial Avulso')).toBeInTheDocument();

    // NÃO deve renderizar o procedimento que pertence ao plano de tratamento
    expect(screen.queryByText('Toxina Botulínica Facial (Plano)')).not.toBeInTheDocument();
  });

  it('exibe plural no badge quando há múltiplos atendimentos avulsos', () => {
    vi.spyOn(usePlanosHook, 'usePlanosPaciente').mockReturnValue({
      planos: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    const mockProcedimentosFeitos = [
      {
        id: 'proc-avulso-1',
        planejamentoItemId: null,
        procedimentoNome: 'Bioestimulador de Colágeno',
        dataExecucao: '2026-09-02T10:00:00Z',
      },
      {
        id: 'proc-avulso-2',
        planejamentoItemId: null,
        procedimentoNome: 'Limpeza de Pele Profunda',
        dataExecucao: '2026-09-08T15:00:00Z',
      },
    ];

    render(
      <AtendimentosAvulsosTab
        pacienteId="paciente-123"
        roleUserId="user-456"
        procedimentosFeitos={mockProcedimentosFeitos}
        galeriaFotosInicial={[]}
      />
    );

    expect(screen.getByText('2 atendimentos')).toBeInTheDocument();
    expect(screen.getByText('Bioestimulador de Colágeno')).toBeInTheDocument();
    expect(screen.getByText('Limpeza de Pele Profunda')).toBeInTheDocument();
  });
});
