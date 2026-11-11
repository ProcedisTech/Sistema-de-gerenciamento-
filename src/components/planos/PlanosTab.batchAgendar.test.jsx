import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanosTab } from './PlanosTab.jsx';

const MOCK_CATALOGO_OPTIONS = [
  { id: 'cat-1', nomeProcedimento: 'Botox Testa', valorPadrao: 1200 },
  { id: 'cat-2', nomeProcedimento: 'Preenchimento Labial', valorPadrao: 1800 },
];

vi.mock('../../services/api.js', () => ({
  planejamentosApi: {
    listarPorPaciente: vi.fn(),
    detalhe: vi.fn(),
    atualizarItem: vi.fn(),
    adicionarItem: vi.fn(),
    removerItem: vi.fn(),
    alterarStatus: vi.fn(),
    criar: vi.fn(),
    salvar: vi.fn(),
  },
  procedimentosApi: {
    byPaciente: vi.fn().mockResolvedValue([]),
  },
  pacientesGaleriaApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  pacientesApi: {
    get: vi.fn().mockResolvedValue({ id: 'pac-1', nome: 'Paciente Teste' }),
  },
  termosApi: {
    resolver: vi.fn().mockResolvedValue({ faltantes: [] }),
  },
  getApiErrorDetail: () => '',
}));

vi.mock('../../hooks/useProcedimentosOptions.js', () => ({
  useProcedimentosOptions: () => ({
    options: MOCK_CATALOGO_OPTIONS,
    loading: false,
  }),
}));

vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: () => ({
    canSeeOrcamentos: true,
    canEditPrecosOrcados: true,
  }),
}));

vi.mock('../hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }),
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const { planejamentosApi } = await import('../../services/api.js');

const PACIENTE_ID = 'pac-1';

const planoComDoisItens = {
  id: '00000000-0000-0000-0000-000000000001',
  planejamentoId: '00000000-0000-0000-0000-000000000001',
  statusCodigo: 'ativo',
  statusNome: 'Em andamento',
  observacao: 'Protocolo Harmonização',
  itens: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      planejamentoItemId: '11111111-1111-1111-1111-111111111111',
      catalogoProcedimentoSaudeId: 'cat-1',
      catalogoNome: 'Botox Testa',
      valorOrcado: 1200,
      dataPlanejada: null,
      statusItem: null,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      planejamentoItemId: '22222222-2222-2222-2222-222222222222',
      catalogoProcedimentoSaudeId: 'cat-2',
      catalogoNome: 'Preenchimento Labial',
      valorOrcado: 1800,
      dataPlanejada: null,
      statusItem: null,
    },
  ],
};

async function esperar(ms = 50) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('PlanosTab — Agendar Juntos & Escolher na Agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoComDoisItens]);
    planejamentosApi.detalhe.mockResolvedValue(planoComDoisItens);
    planejamentosApi.salvar.mockResolvedValue(planoComDoisItens);

    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exibe as opções padronizadas no popover "Agendar juntos"', async () => {
    render(
      <PlanosTab
        variant="profile"
        pacienteId={PACIENTE_ID}
        paciente={{ id: PACIENTE_ID, nome: 'Paciente Teste' }}
        roleUserId="ru-1"
      />
    );

    await esperar(60);

    // Seleciona os dois botões de seleção dos itens
    const btnSelecionar = screen.getAllByLabelText('Selecionar procedimento');
    expect(btnSelecionar.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(btnSelecionar[0]);
    fireEvent.click(btnSelecionar[1]);

    await esperar(30);

    // O botão de lote "Agendar juntos" deve estar visível
    const btnAgendarJuntos = screen.getByRole('button', { name: /agendar juntos/i });
    expect(btnAgendarJuntos).toBeDefined();

    // Clica para abrir o popover
    fireEvent.click(btnAgendarJuntos);
    await esperar(30);

    // Verifica opções de presets e "Escolher na Agenda..."
    expect(screen.getByText('Hoje')).toBeDefined();
    expect(screen.getByText('Amanhã')).toBeDefined();
    expect(screen.getByText('Em 7 dias')).toBeDefined();
    expect(screen.getByText('Em 15 dias')).toBeDefined();
    expect(screen.getByText('Em 30 dias')).toBeDefined();
    expect(screen.getByText('Escolher na Agenda...')).toBeDefined();
  });

  it('ao clicar em "Escolher na Agenda...", chama onAgendarItem com o lote de itens e sincroniza data pós agendamento', async () => {
    const onAgendarItemMock = vi.fn((itens, onSaved) => {
      // Simula salvar na agenda com data escolhida
      onSaved({
        dataAgendamento: '2026-11-15',
        horaInicio: '14:00',
        horaFim: '15:00',
      });
    });

    render(
      <PlanosTab
        variant="profile"
        pacienteId={PACIENTE_ID}
        paciente={{ id: PACIENTE_ID, nome: 'Paciente Teste' }}
        roleUserId="ru-1"
        onAgendarItem={onAgendarItemMock}
      />
    );

    await esperar(60);

    const btnSelecionar = screen.getAllByLabelText('Selecionar procedimento');
    fireEvent.click(btnSelecionar[0]);
    fireEvent.click(btnSelecionar[1]);
    await esperar(30);

    const btnAgendarJuntos = screen.getByRole('button', { name: /agendar juntos/i });
    fireEvent.click(btnAgendarJuntos);
    await esperar(30);

    const btnEscolher = screen.getByText('Escolher na Agenda...');
    fireEvent.click(btnEscolher);
    await esperar(50);

    expect(onAgendarItemMock).toHaveBeenCalled();
    const calledItens = onAgendarItemMock.mock.calls[0][0];
    expect(calledItens).toHaveLength(2);

    // Verifica que salvar foi chamado persistindo a data '2026-11-15' para ambos os itens selecionados
    expect(planejamentosApi.salvar).toHaveBeenCalledWith(
      planoComDoisItens.id,
      expect.objectContaining({
        itens: expect.arrayContaining([
          expect.objectContaining({
            id: '11111111-1111-1111-1111-111111111111',
            dataPlanejada: '2026-11-15',
          }),
          expect.objectContaining({
            id: '22222222-2222-2222-2222-222222222222',
            dataPlanejada: '2026-11-15',
          }),
        ]),
      })
    );
  });

  it('ao clicar em preset "Hoje", delega para onAgendarItem com data calculada e persiste após confirmação', async () => {
    const onAgendarItemMock = vi.fn((itens, onSaved) => {
      onSaved({
        dataAgendamento: itens[0].dataPlanejada,
        horaInicio: '09:00',
        horaFim: '10:00',
      });
    });

    render(
      <PlanosTab
        variant="profile"
        pacienteId={PACIENTE_ID}
        paciente={{ id: PACIENTE_ID, nome: 'Paciente Teste' }}
        roleUserId="ru-1"
        onAgendarItem={onAgendarItemMock}
      />
    );

    await esperar(60);

    const btnSelecionar = screen.getAllByLabelText('Selecionar procedimento');
    fireEvent.click(btnSelecionar[0]);
    await esperar(30);

    const btnAgendarJuntos = screen.getByRole('button', { name: /agendar juntos/i });
    fireEvent.click(btnAgendarJuntos);
    await esperar(30);

    const btnHoje = screen.getByText('Hoje');
    fireEvent.click(btnHoje);
    await esperar(50);

    expect(onAgendarItemMock).toHaveBeenCalled();
    const calledItens = onAgendarItemMock.mock.calls[0][0];
    expect(calledItens[0].dataPlanejada).toBeTruthy();

    // Garante que salvar NÃO foi chamado com itens vazio (o bug que causava DELETE)
    expect(planejamentosApi.salvar).toHaveBeenCalledWith(
      planoComDoisItens.id,
      expect.objectContaining({
        itens: expect.arrayContaining([
          expect.objectContaining({
            id: '11111111-1111-1111-1111-111111111111',
            catalogoProcedimentoSaudeId: 'cat-1',
          }),
          expect.objectContaining({
            id: '22222222-2222-2222-2222-222222222222',
            catalogoProcedimentoSaudeId: 'cat-2',
          }),
        ]),
      })
    );
  });
});
