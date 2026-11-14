import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { Step4Procedimento } from './Step4LGPD.jsx';
import { useJourneyState } from '../hooks/useJourneyState.js';
import { useMapaAplicacaoState } from '../hooks/useMapaAplicacaoState.js';
import { MapeamentoFullscreenOverlay } from './mapeamento/MapeamentoFullscreenOverlay.jsx';
import { baseDosItens, diferencasDosItens, mapearItensDaSessao } from '../consulta/consultaServidor.js';

const CAT_BOTOX = '11111111-1111-4111-8111-111111111111';
const CAT_BIO = '22222222-2222-4222-8222-222222222222';
const PAC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FOTO_UUID = '33333333-3333-4333-8333-333333333333';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: CAT_BOTOX, nome: 'Toxina Botulínica', nomeProcedimento: 'Toxina Botulínica', unidadeMedida: 'U' },
      { id: CAT_BIO, nome: 'Bioestimulador', nomeProcedimento: 'Bioestimulador', unidadeMedida: 'ml' },
    ],
    loading: false,
  }),
}));

vi.mock('../../hooks/useCatalogoMapeamentoOptions.js', () => ({
  useCatalogoMapeamentoOptions: () => ({
    options: [
      { id: CAT_BOTOX, nome: 'Toxina Botulínica', unidadeMedida: 'U' },
      { id: CAT_BIO, nome: 'Bioestimulador', unidadeMedida: 'ml' },
    ],
    loading: false,
  }),
}));

vi.mock('../../services/api', () => ({
  authHeadersForFetch: () => ({}),
  termoAssinaturaApi: { listar: vi.fn().mockResolvedValue([]) },
  assinaturaExternaApi: {},
  termosApi: { resolver: vi.fn().mockResolvedValue({ termos: [] }) },
  organizacaoApi: {},
  catalogosApi: {
    get: vi.fn().mockResolvedValue({}),
    buscarPorId: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
  planejamentosApi: {
    listarPorPaciente: vi.fn().mockResolvedValue([]),
  },
  mapasApi: {
    salvar: vi.fn().mockResolvedValue({ id: 'mapa-1' }),
    limparPorFotoGaleria: vi.fn().mockResolvedValue({}),
  },
  pacientesGaleriaApi: {
    list: vi.fn().mockResolvedValue([]),
    fetchArquivoBlob: vi.fn(),
  },
}));

vi.mock('../../services/api.js', () => ({
  authHeadersForFetch: () => ({}),
  termoAssinaturaApi: { listar: vi.fn().mockResolvedValue([]) },
  assinaturaExternaApi: {},
  termosApi: { resolver: vi.fn().mockResolvedValue({ termos: [] }) },
  organizacaoApi: {},
  catalogosApi: {
    get: vi.fn().mockResolvedValue({}),
    buscarPorId: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
  planejamentosApi: {
    listarPorPaciente: vi.fn().mockResolvedValue([]),
  },
  mapasApi: {
    salvar: vi.fn().mockResolvedValue({ id: 'mapa-1' }),
    limparPorFotoGaleria: vi.fn().mockResolvedValue({}),
  },
  pacientesGaleriaApi: {
    list: vi.fn().mockResolvedValue([]),
    fetchArquivoBlob: vi.fn(),
  },
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() }),
}));

vi.mock('./PhotoCarouselLane.jsx', () => ({
  PhotoCarouselLane: () => <div data-testid="photo-lane" />,
}));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
    }));
  }
});

function Step4RemocaoHarness({ initialSessao, onState }) {
  const journey = useJourneyState();
  const mapaState = useMapaAplicacaoState();

  useEffect(() => {
    journey.setProcedimentosSessao(initialSessao);
    journey.setActiveProcedureIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onState?.({ journey, mapaState });
  });

  return (
    <Step4Procedimento
      pacienteIdForProcedures={PAC_A}
      procedimentosSessao={journey.procedimentosSessao}
      setProcedimentosSessao={journey.setProcedimentosSessao}
      activeProcedimentoIndex={journey.activeProcedureIndex}
      setActiveProcedimentoIndex={journey.setActiveProcedureIndex}
      nomeProcedimento={journey.nomeProcedimento}
      setNomeProcedimento={journey.setNomeProcedimento}
      setNomeProcedimentoCatalogoId={journey.setNomeProcedimentoCatalogoId}
      setProcedimentoDoCatalogo={journey.setProcedimentoDoCatalogo}
      catalogoId={journey.nomeProcedimentoCatalogoId}
      onValidarTermosCatalogo={vi.fn().mockResolvedValue(true)}
      mapaState={mapaState}
      execucaoBloqueadaPorTermos={false}
    />
  );
}

describe('Regressão — Confirmação ao excluir procedimento com traços, bloqueio de termos e limpeza no banco', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pede confirmação ao excluir procedimento com marcações em múltiplas vistas, preserva ao cancelar e apaga pontos + agenda DELETE ao confirmar', async () => {
    const servidorItens = [
      {
        id: 'srv-avulso-1',
        ordem: 0,
        agendaId: null,
        catalogoProcedimentoSaudeId: CAT_BOTOX,
        planejamentoItemId: null,
        nomeLivre: null,
        observacaoExecucao: '',
        orientacoes: null,
      },
    ];
    const base = baseDosItens(servidorItens);

    let capturedState = null;
    render(
      <Step4RemocaoHarness
        initialSessao={[
          {
            itemId: 'srv-avulso-1',
            _uid: 'uid-botox',
            agendaId: null,
            catalogoProcedimentoSaudeId: CAT_BOTOX,
            catalogoId: CAT_BOTOX,
            nomeProcedimento: 'Toxina Botulínica',
            nomeSoDeTela: false,
            isAvulso: true,
          },
        ]}
        onState={(st) => {
          capturedState = st;
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remover Toxina Botulínica' }).length).toBeGreaterThan(0);
    });

    act(() => {
      capturedState.mapaState.adicionarPonto('frontal', {
        posX: 40,
        posY: 40,
        quantidade: 2,
        catalogoProcedimentoSaudeId: CAT_BOTOX,
      });
      capturedState.mapaState.adicionarPonto('lateral_dir', {
        posX: 55,
        posY: 35,
        quantidade: 3,
        catalogoProcedimentoSaudeId: CAT_BOTOX,
      });
    });

    expect(capturedState.mapaState.countPontosVista('frontal')).toBe(1);
    expect(capturedState.mapaState.countPontosVista('lateral_dir')).toBe(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover Toxina Botulínica' })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Apagar procedimento e suas marcações\?/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/2 marcações/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Frontal, Lateral Direita/i)).toBeInTheDocument();

    // Cancelar preserva procedimento e pontos nas duas vistas
    fireEvent.click(within(dialog).getByRole('button', { name: /^Cancelar$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(capturedState.mapaState.countPontosVista('frontal')).toBe(1);
    expect(capturedState.mapaState.countPontosVista('lateral_dir')).toBe(1);
    expect(screen.getAllByRole('button', { name: 'Remover Toxina Botulínica' }).length).toBeGreaterThan(0);

    // Confirmar apaga pontos em TODAS as vistas e limpa itemId do avulso para disparar DELETE
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover Toxina Botulínica' })[0]);
    const dialogConfirm = await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialogConfirm).getByRole('button', { name: /Apagar procedimento e marcações/i }));
    });

    await waitFor(() => {
      expect(capturedState.mapaState.countPontosVista('frontal')).toBe(0);
      expect(capturedState.mapaState.countPontosVista('lateral_dir')).toBe(0);
    });

    const sessaoAtual = capturedState.journey.procedimentosSessao;
    const mapa = mapearItensDaSessao(sessaoAtual, servidorItens);
    const diff = diferencasDosItens(sessaoAtual, mapa, base);
    expect(diff.remover).toContain('srv-avulso-1');
  });

  it('mantém o seletor de catálogo visível no mapa fullscreen e bloqueia Ponto/Traço preservando Borracha e lixeira quando há termo pendente ou termosValidando', () => {
    const onIrParaTermosGate = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <MapeamentoFullscreenOverlay
        open
        scope="procedure"
        pacienteId={PAC_A}
        vistaAtual="frontal"
        foto={{ displayUrl: 'blob:foto-1', url: 'blob:foto-1' }}
        hideProcedimentoPicker={false}
        procedimentosUsados={[
          { id: CAT_BOTOX, catalogoProcedimentoSaudeId: CAT_BOTOX, nome: 'Toxina Botulínica', corHex: '#3b82f6' },
        ]}
        pontosVista={[]}
        onAddPonto={vi.fn()}
        onRemoverProcedimento={vi.fn()}
        onClose={onClose}
        execucaoBloqueadaPorTermos={true}
        termosValidando={false}
        titulosTermosFaltantes={['Termo de Toxina Botulínica']}
        resolucao={{
          itens: [
            {
              termoId: 'termo-1',
              titulo: 'Termo de Toxina Botulínica',
              assinado: false,
              catalogoProcedimentoSaudeId: CAT_BOTOX,
            },
          ],
          temPendencia: true,
        }}
        onIrParaTermosGate={onIrParaTermosGate}
      />
    );

    // Expande a sidebar caso inicie recolhida por default no storage
    const expandBtn = screen.queryByRole('button', { name: /Expandir sidebar/i });
    if (expandBtn) {
      fireEvent.click(expandBtn);
    }

    // Picker continua visível e banner de termo pendente com CTA é exibido
    expect(screen.getByTestId('mapa-termos-bloqueio-banner')).toHaveTextContent(/Desenho bloqueado: termo pendente/i);

    const barra = screen.getByTestId('mapa-ferramentas-barra');
    const [btnPonto, btnTraco, btnBorracha] = within(barra).getAllByRole('button');
    expect(btnPonto).toBeDisabled();
    expect(btnTraco).toBeDisabled();
    expect(btnBorracha).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover Toxina Botulínica' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Assinar Termo Agora/i }));
    expect(onIrParaTermosGate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Estado termosValidando=true também bloqueia Ponto/Traço e mantém Borracha ativa
    rerender(
      <MapeamentoFullscreenOverlay
        open
        scope="procedure"
        pacienteId={PAC_A}
        vistaAtual="frontal"
        foto={{ displayUrl: 'blob:foto-1', url: 'blob:foto-1' }}
        hideProcedimentoPicker={false}
        procedimentosUsados={[
          { id: CAT_BOTOX, catalogoProcedimentoSaudeId: CAT_BOTOX, nome: 'Toxina Botulínica', corHex: '#3b82f6' },
        ]}
        pontosVista={[]}
        onAddPonto={vi.fn()}
        onRemoverProcedimento={vi.fn()}
        onClose={onClose}
        execucaoBloqueadaPorTermos={false}
        termosValidando={true}
        titulosTermosFaltantes={[]}
        resolucao={null}
        onIrParaTermosGate={onIrParaTermosGate}
      />
    );

    expect(screen.getByTestId('mapa-termos-bloqueio-banner')).toHaveTextContent(/Validando termos obrigatórios/i);
    const [btnPontoVal, btnTracoVal, btnBorrachaVal] = within(screen.getByTestId('mapa-ferramentas-barra')).getAllByRole('button');
    expect(btnPontoVal).toBeDisabled();
    expect(btnTracoVal).toBeDisabled();
    expect(btnBorrachaVal).not.toBeDisabled();
  });

  it('ao salvar Avaliação zerada (0 pontos) chama limparPorFotoGaleria sem abrir modal de Criar Plano e marca mapaOverlay: null', async () => {
    const { mapasApi } = await import('../../services/api.js');
    const onSalvarFotoAnotada = vi.fn();
    const onClose = vi.fn();

    render(
      <MapeamentoFullscreenOverlay
        open
        scope="evaluation"
        pacienteId={PAC_A}
        vistaAtual="frontal"
        photos={[
          {
            id: FOTO_UUID,
            fotoId: FOTO_UUID,
            url: 'blob:foto-eval',
            cleanUrl: 'blob:foto-eval',
            pontos: [],
            mapaOverlay: null,
          },
        ]}
        editingIndex={0}
        onSalvarFotoAnotada={onSalvarFotoAnotada}
        onClose={onClose}
      />
    );

    const btnSalvar = screen.getByRole('button', { name: /Salvar anotação/i });
    await act(async () => {
      fireEvent.click(btnSalvar);
    });

    await waitFor(() => {
      expect(mapasApi.limparPorFotoGaleria).toHaveBeenCalledWith(FOTO_UUID, {
        tipoMapaCodigo: 'avaliacao',
        atendimentoId: null,
      });
    });

    expect(screen.queryByText(/Criar Plano de Tratamento\?/i)).toBeNull();
    expect(mapasApi.salvar).not.toHaveBeenCalled();
    expect(onSalvarFotoAnotada).toHaveBeenCalledWith(
      expect.objectContaining({
        isAnnotated: false,
        mapaOverlay: null,
      })
    );
  });
});

