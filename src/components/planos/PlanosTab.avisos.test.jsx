import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { PlanosTab } from './PlanosTab.jsx';

const MOCK_CATALOGO_OPTIONS = [
  { id: 'cat-1', nomeProcedimento: 'Biópsia de Pele', valorPadrao: 5000 },
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
  },
  procedimentosApi: {
    byPaciente: vi.fn().mockResolvedValue([]),
  },
  pacientesGaleriaApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  pacientesApi: {
    get: vi.fn().mockResolvedValue({ id: 'pac-1', nome: 'Classic Wantankable' }),
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

const planoInicial = {
  id: 'plano-1',
  planejamentoId: 'plano-1',
  statusCodigo: 'ativo',
  statusNome: 'Em andamento',
  observacao: 'Protocolo de Teste',
  itens: [
    {
      id: 'item-1',
      planejamentoItemId: 'item-1',
      catalogoProcedimentoSaudeId: 'cat-1',
      catalogoNome: 'Biópsia de Pele',
      valorOrcado: 5000,
      dataPlanejada: null,
      statusItem: null,
    },
  ],
};

const planoAtualizado = {
  ...planoInicial,
  itens: [
    {
      ...planoInicial.itens[0],
      valorOrcado: 10000,
    },
  ],
};

async function esperar(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('PlanosTab — Sincronização em tempo real via SSE (Zero F5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoInicial]);
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

  it('atualiza o preço do procedimento e total do plano quando recebe aviso PACIENTE.EDITADO', async () => {
    const avisos = criarAvisosFalsos();

    render(
      <avisos.Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId={PACIENTE_ID}
          paciente={{ id: PACIENTE_ID, nome: 'Classic Wantankable' }}
          roleUserId="ru-1"
        />
      </avisos.Wrapper>,
    );

    await esperar(50);
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledWith(PACIENTE_ID);

    // Verifica que o valor inicial (R$ 5.000,00) está na tela
    expect(screen.getAllByText(/5\.000,00/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/10\.000,00/)).toBeNull();

    // Simula atualização no backend (outro aparelho alterou para R$ 10.000,00)
    planejamentosApi.listarPorPaciente.mockResolvedValue([planoAtualizado]);

    // Emite aviso SSE de paciente editado para o paciente ativo
    act(() => {
      avisos.emitirAviso(AVISO.PACIENTE.EDITADO, PACIENTE_ID);
    });

    await esperar(400);

    // Deve ter rebuscado e atualizado o valor na tela sem F5
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText(/10\.000,00/).length).toBeGreaterThan(0);
  });

  it('ignora aviso PACIENTE.EDITADO de outro paciente', async () => {
    const avisos = criarAvisosFalsos();

    render(
      <avisos.Wrapper>
        <PlanosTab
          variant="consulta"
          pacienteId={PACIENTE_ID}
          paciente={{ id: PACIENTE_ID, nome: 'Classic Wantankable' }}
          roleUserId="ru-1"
        />
      </avisos.Wrapper>,
    );

    await esperar(50);
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(1);

    // Emite aviso para outro paciente (pac-999)
    act(() => {
      avisos.emitirAviso(AVISO.PACIENTE.EDITADO, 'pac-999');
    });

    await esperar(400);

    // Não deve rebuscar
    expect(planejamentosApi.listarPorPaciente).toHaveBeenCalledTimes(1);
  });
});
