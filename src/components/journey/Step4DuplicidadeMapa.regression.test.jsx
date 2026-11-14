import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { Step4Procedimento } from './Step4LGPD.jsx';
import { useJourneyState } from '../hooks/useJourneyState.js';
import { useMapaAplicacaoState } from '../hooks/useMapaAplicacaoState.js';
import { MapeamentoFullscreenOverlay } from './mapeamento/MapeamentoFullscreenOverlay.jsx';
import { ConsultaProcedimentoFlow } from '../consulta/ConsultaProcedimentoFlow.jsx';
import { baseDosItens, diferencasDosItens, mapearItensDaSessao } from '../consulta/consultaServidor.js';

const CAT_BIOPSIA = 'ae05fd5a-3362-46ff-9c0f-2846190ccb87';
const CAT_BOTOX = '11111111-1111-4111-8111-111111111111';
const PAC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAC_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: CAT_BIOPSIA, nome: 'Biópsia', nomeProcedimento: 'Biópsia', unidadeMedida: 'un' },
      { id: CAT_BOTOX, nome: 'Toxina Botulínica', nomeProcedimento: 'Toxina Botulínica', unidadeMedida: 'U' },
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

function Step4Harness({ initialSessao, onState }) {
  const journey = useJourneyState();
  const mapaState = useMapaAplicacaoState();

  useEffect(() => {
    journey.setProcedimentosSessao(initialSessao);
    journey.setActiveProcedureIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onState?.({ journey, mapaState });
  }, [journey, mapaState, onState]);

  return (
    <Step4Procedimento
      pacienteIdForProcedures={PAC_A}
      nomeProcedimento={journey.nomeProcedimento}
      setNomeProcedimento={journey.setNomeProcedimento}
      setNomeProcedimentoCatalogoId={journey.setNomeProcedimentoCatalogoId}
      setProcedimentoDoCatalogo={journey.setProcedimentoDoCatalogo}
      procedimentosSessao={journey.procedimentosSessao}
      setProcedimentosSessao={journey.setProcedimentosSessao}
      activeProcedimentoIndex={journey.activeProcedureIndex}
      setActiveProcedimentoIndex={journey.setActiveProcedureIndex}
      mapaState={mapaState}
      journeyPlanejamentoCtx={{
        planejamentoId: 'plan-1',
        titulo: 'Plano Teste',
        itens: [
          {
            id: 'pi-biopsia',
            catalogoProcedimentoSaudeId: CAT_BIOPSIA,
            nomeProcedimento: 'Biópsia',
            statusItem: 'pendente',
          },
        ],
      }}
      onValidarTermosCatalogo={vi.fn().mockResolvedValue(true)}
    />
  );
}

describe('Regressão — Duplicidade 1:1, CONSULTA no slot 0, Overlay Sync e Remoção', () => {
  let errorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('preserva CONSULTA no slot 0, não duplica Biópsia no mapa nem emite warning de same key mesmo chamando setProcedimentoDoCatalogo', async () => {
    let latestState = null;
    const initialSessao = [
      {
        itemId: 'srv-consulta',
        tipoAgendaCodigo: 'CONSULTA',
        agendaId: 'ag-consulta',
        nomeProcedimento: 'Consulta',
        procedimentoNome: 'Consulta',
        nomeSoDeTela: true,
        catalogoProcedimentoSaudeId: null,
        nomeProcedimentoCatalogoId: null,
      },
    ];

    render(<Step4Harness initialSessao={initialSessao} onState={(s) => { latestState = s; }} />);

    const btnPlano = await screen.findByRole('button', { name: /Realizar pelo Plano/i });
    await act(async () => {
      fireEvent.click(btnPlano);
    });

    await waitFor(() => {
      expect(latestState.journey.procedimentosSessao).toHaveLength(2);
    });

    // Chama setProcedimentoDoCatalogo diretamente enquanto activeProcedureIndex está 0 (CONSULTA) ou atualizado
    await act(async () => {
      latestState.journey.setProcedimentoDoCatalogo('Biópsia', CAT_BIOPSIA);
    });

    const sessao = latestState.journey.procedimentosSessao;
    expect(sessao[0].itemId).toBe('srv-consulta');
    expect(sessao[0].tipoAgendaCodigo).toBe('CONSULTA');
    expect(sessao[0].catalogoProcedimentoSaudeId).toBeNull();
    expect(sessao.filter((p) => p.catalogoProcedimentoSaudeId === CAT_BIOPSIA)).toHaveLength(1);

    // Com apenas 1 procedimento real (Biópsia), o mapa habilita e não exibe pill bar duplicada "Procedimento Marcador"
    expect(screen.queryByText(/para habilitar o mapa/i)).toBeNull();
    expect(screen.queryByText(/Procedimento Marcador:/i)).toBeNull();

    // Seleciona um 2º catálogo pela busca -> "Procedimento Marcador" exibe exatamente 1 pill por procedimento (sem clone de Biópsia)
    const searchInput = screen.getByPlaceholderText(/Buscar procedimento/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: 'Toxina' } });
    const botoxOpt = await screen.findByText(/Toxina Botulínica/i);
    await act(async () => {
      fireEvent.click(botoxOpt);
    });

    expect(await screen.findByText(/Procedimento Marcador:/i)).toBeInTheDocument();
    const mapaButtonsBiopsia = screen
      .getAllByRole('button', { name: /Biópsia/i })
      .filter((b) => !String(b.getAttribute('aria-label') || '').startsWith('Remover'));
    const mapaButtonsBotox = screen
      .getAllByRole('button', { name: /Toxina Botulínica/i })
      .filter((b) => !String(b.getAttribute('aria-label') || '').startsWith('Remover'));
    expect(mapaButtonsBiopsia).toHaveLength(1);
    expect(mapaButtonsBotox).toHaveLength(1);

    const sameKeyCalls = errorSpy.mock.calls.filter((args) =>
      args.some((a) => String(a).includes('same key')),
    );
    expect(sameKeyCalls).toHaveLength(0);
  });

  it('MapeamentoFullscreenOverlay sincroniza remoção em scope="procedure", preserva scope="evaluation" e reseta ao trocar pacienteId', async () => {
    const mapaBase = {
      pontosPorVista: {},
      getPontosVista: () => [],
      getFotoVista: () => null,
      getVistaLabel: () => 'Frontal',
      countPontosVista: () => 0,
      setVistaAtual: vi.fn(),
    };

    const { rerender, unmount } = render(
      <MapeamentoFullscreenOverlay
        open
        onClose={vi.fn()}
        scope="procedure"
        pacienteId={PAC_A}
        vistaAtual="frontal"
        fotoVistaUrl="blob:foto"
        mapaState={mapaBase}
        onAddPonto={vi.fn()}
        procedimentosUsados={[
          { id: CAT_BIOPSIA, catalogoProcedimentoSaudeId: CAT_BIOPSIA, nome: 'Biópsia', corHex: '#d946ef' },
        ]}
        onAdicionarProcedimento={vi.fn()}
        onRemoverProcedimento={vi.fn()}
      />,
    );

    expect(screen.getAllByTitle(/Biópsia/i).length).toBeGreaterThan(0);

    // Remoção externa limpa procedimentosLocais quando scope="procedure"
    rerender(
      <MapeamentoFullscreenOverlay
        open
        onClose={vi.fn()}
        scope="procedure"
        pacienteId={PAC_A}
        vistaAtual="frontal"
        fotoVistaUrl="blob:foto"
        mapaState={mapaBase}
        onAddPonto={vi.fn()}
        procedimentosUsados={[]}
        onAdicionarProcedimento={vi.fn()}
        onRemoverProcedimento={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTitle(/Biópsia/i)).toBeNull();
    });

    unmount();

    // Monta nova instância em scope="evaluation" com item inicial e depois troca pacienteId -> limpa estado da ficha anterior
    const evalRender = render(
      <MapeamentoFullscreenOverlay
        open
        onClose={vi.fn()}
        scope="evaluation"
        pacienteId={PAC_A}
        vistaAtual="frontal"
        fotoVistaUrl="blob:foto"
        mapaState={mapaBase}
        procedimentosIniciais={[
          { id: CAT_BOTOX, catalogoProcedimentoSaudeId: CAT_BOTOX, nome: 'Toxina Botulínica', corHex: '#3b82f6' },
        ]}
      />,
    );
    expect(screen.getAllByTitle(/Toxina Botulínica/i).length).toBeGreaterThan(0);

    // Mesmo recebendo [], em scope="evaluation" mantém itens locais até trocar de paciente
    evalRender.rerender(
      <MapeamentoFullscreenOverlay
        open
        onClose={vi.fn()}
        scope="evaluation"
        pacienteId={PAC_A}
        vistaAtual="frontal"
        fotoVistaUrl="blob:foto"
        mapaState={mapaBase}
        procedimentosIniciais={[]}
      />,
    );
    expect(screen.getAllByTitle(/Toxina Botulínica/i).length).toBeGreaterThan(0);

    // Ao trocar para PAC_B, o procedimento de PAC_A é limpo
    evalRender.rerender(
      <MapeamentoFullscreenOverlay
        open
        onClose={vi.fn()}
        scope="evaluation"
        pacienteId={PAC_B}
        vistaAtual="frontal"
        fotoVistaUrl="blob:foto"
        mapaState={mapaBase}
        procedimentosIniciais={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTitle(/Toxina Botulínica/i)).toBeNull();
    });
  });

  it('ConsultaProcedimentoFlow ao remover último procedimento real no modal de revisão mantém CONSULTA/placeholder com itemId para disparar DELETE /itens/{itemId}', async () => {
    const servidorItens = [
      {
        id: 'srv-consulta',
        ordem: 0,
        agendaId: 'ag-c',
        agendaTipoProcedimentoCodigo: 'CONSULTA',
        catalogoProcedimentoSaudeId: null,
        nomeLivre: null,
        observacaoExecucao: '',
        orientacoes: null,
      },
      {
        id: 'srv-biopsia',
        ordem: 1,
        agendaId: null,
        catalogoProcedimentoSaudeId: CAT_BIOPSIA,
        planejamentoItemId: 'pi-1',
        nomeLivre: null,
        observacaoExecucao: '',
        orientacoes: [{ descricao: 'Evitar sol', checado: true, ordem: 0 }],
      },
    ];
    const base = baseDosItens(servidorItens);

    let loteAtual = [
      {
        itemId: 'srv-consulta',
        agendaId: 'ag-c',
        tipoAgendaCodigo: 'CONSULTA',
        nomeProcedimento: 'Consulta',
        nomeSoDeTela: true,
        catalogoProcedimentoSaudeId: null,
      },
      {
        itemId: 'srv-biopsia',
        _uid: 'uid-b',
        catalogoProcedimentoSaudeId: CAT_BIOPSIA,
        catalogoId: CAT_BIOPSIA,
        planejamentoItemId: 'pi-1',
        nomeProcedimento: 'Biópsia',
        nomeSoDeTela: false,
        orient: [{ descricao: 'Evitar sol', checado: true, ordem: 0 }],
      },
    ];
    const setProcedimentosLote = vi.fn((next) => {
      loteAtual = next;
    });

    const { rerender } = render(
      <ConsultaProcedimentoFlow
        pacienteIdForProcedures={PAC_A}
        nomeProcedimento="Biópsia"
        setNomeProcedimento={vi.fn()}
        setNomeProcedimentoCatalogoId={vi.fn()}
        setProcedimentoDoCatalogo={vi.fn()}
        procedimentosLote={loteAtual}
        setProcedimentosLote={setProcedimentosLote}
        activeProcedimentoIndex={1}
        setActiveProcedimentoIndex={vi.fn()}
        observacoesExecucao=""
        setObservacoesExecucao={vi.fn()}
        procedureCapturedPhotos={[]}
        procedurePhotoMax={8}
        step4Errors={{}}
        setStep4Errors={vi.fn()}
        catalogoId={CAT_BIOPSIA}
        onValidarTermosCatalogo={vi.fn().mockResolvedValue(true)}
        itensOrientacoes={[
          { itemId: 'srv-biopsia', nome: 'Biópsia', orient: [{ descricao: 'Evitar sol', checado: true, ordem: 0 }], legado: false },
        ]}
        itensSemOrientacaoMarcada={[]}
        encerrarAtendimento={vi.fn()}
        toast={{ error: vi.fn(), success: vi.fn(), info: vi.fn() }}
      />,
    );

    // Vai para Finalização e abre o Review Gate Modal (tem item de plano -> precisaConfirmacao === true)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Ir para Finalização e Orientações/i }));
    });
    const btnFinalizar = await screen.findByRole('button', { name: /Finalizar|Encerrar|Concluir/i });
    await act(async () => {
      fireEvent.click(btnFinalizar);
    });

    const btnRemover = await screen.findByTitle(/Remover deste atendimento/i);
    await act(async () => {
      fireEvent.click(btnRemover);
    });

    expect(setProcedimentosLote).toHaveBeenCalled();
    expect(loteAtual).toHaveLength(1);
    expect(loteAtual[0].itemId).toBe('srv-consulta');

    const mapa = mapearItensDaSessao(loteAtual, servidorItens);
    const diff = diferencasDosItens(loteAtual, mapa, base);
    expect(diff.remover).toContain('srv-biopsia');

    // Caso sem CONSULTA (apenas srv-biopsia na sessão): restaura placeholder nomeSoDeTela mantendo itemId
    loteAtual = [
      {
        itemId: 'srv-biopsia',
        _uid: 'uid-b2',
        catalogoProcedimentoSaudeId: CAT_BIOPSIA,
        catalogoId: CAT_BIOPSIA,
        planejamentoItemId: 'pi-1',
        nomeProcedimento: 'Biópsia',
        nomeSoDeTela: false,
      },
    ];
    rerender(
      <ConsultaProcedimentoFlow
        pacienteIdForProcedures={PAC_A}
        nomeProcedimento="Biópsia"
        setNomeProcedimento={vi.fn()}
        setNomeProcedimentoCatalogoId={vi.fn()}
        setProcedimentoDoCatalogo={vi.fn()}
        procedimentosLote={loteAtual}
        setProcedimentosLote={setProcedimentosLote}
        activeProcedimentoIndex={0}
        setActiveProcedimentoIndex={vi.fn()}
        observacoesExecucao=""
        setObservacoesExecucao={vi.fn()}
        procedureCapturedPhotos={[]}
        procedurePhotoMax={8}
        step4Errors={{}}
        setStep4Errors={vi.fn()}
        catalogoId={CAT_BIOPSIA}
        onValidarTermosCatalogo={vi.fn().mockResolvedValue(true)}
        itensOrientacoes={[]}
        itensSemOrientacaoMarcada={[]}
        encerrarAtendimento={vi.fn()}
        toast={{ error: vi.fn(), success: vi.fn(), info: vi.fn() }}
      />,
    );
    expect(screen.getAllByTestId('photo-lane').length).toBeGreaterThan(0);
  });
});
