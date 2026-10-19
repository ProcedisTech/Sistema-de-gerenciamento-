// Regressão prevenida: Agendamento sem plano não deve criar plano fantasma no perfil do paciente.
// Agendamento com plano permite escolher entre procedimentos do plano e da clínica.
// Seleção mista não vaza planejamentoItemId para procedimentos da clínica (prevenção contra 422).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgendaPage } from './useAgendaPage';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';

const mockState = vi.hoisted(() => ({
  org: {
    orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roleUserId: 'prof-role-1',
    roleNome: 'Dr. Teste',
    apareceNaAgenda: true,
    fusoHorario: 'America/Sao_Paulo',
  },
  agendasCreate: vi.fn(),
  planejamentosListar: vi.fn(),
  planejamentosCriar: vi.fn(),
  pacientesListar: vi.fn(),
}));

vi.mock('../../contexts/OrgContext', () => ({ useOrg: () => mockState.org }));
vi.mock('../../contexts/useDisponibilidadeRevision.js', () => ({
  useDisponibilidadeRevision: () => ({ bumpRevision: vi.fn() }),
}));
vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({
    isNivel1: false,
    canSeeAgendaMulti: true,
    canSeeAgendaPropria: true,
    canEncaixarForaDisp: true,
    canDeleteAgenda: false,
    canAparecerNaAgenda: true,
  }),
}));
vi.mock('../../hooks/useProcedimentosOptions', () => ({
  useProcedimentosOptions: () => ({
    options: [
      { id: 'cat-toxina', nome: 'Toxina Botulínica', duracaoMin: 30, tipoCodigo: 'procedimento' },
      { id: 'cat-preenchimento', nome: 'Preenchimento Labial', duracaoMin: 45, tipoCodigo: 'procedimento' },
    ],
  }),
}));
vi.mock('./ConfirmacaoForaDispModal', () => ({
  useConfirmacaoForaDisp: () => ({ modal: null, abrirConfirmacao: vi.fn() }),
}));

vi.mock('../../services/api', () => {
  const genericApi = new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) });
  return {
    agendasApi: {
      create: (...args) => mockState.agendasCreate(...args),
      byRange: vi.fn().mockResolvedValue([]),
      byProfissional: vi.fn().mockResolvedValue([]),
      ocupacoes: vi.fn().mockResolvedValue([]),
    },
    planejamentosApi: {
      listarPorPaciente: (...args) => mockState.planejamentosListar(...args),
      criar: (...args) => mockState.planejamentosCriar(...args),
    },
    pacientesApi: genericApi,
    catalogosApi: genericApi,
    anamneseApi: genericApi,
    confirmacaoApi: genericApi,
    disponibilidadeApi: genericApi,
    equipeApi: { list: vi.fn().mockResolvedValue([]) },
    organizacoesHorariosApi: genericApi,
    procedimentosApi: genericApi,
    getApiErrorToastMessage: () => 'Erro',
    isAbortError: () => false,
  };
});

vi.mock('../../utils/agendaDashboardMapping', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    fetchDashboardAppointmentsForRange: vi.fn().mockResolvedValue([]),
  };
});

describe('useAgendaPage — Regras de Vínculo entre Agenda e Plano de Tratamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.agendasCreate.mockImplementation(async (body) => ({
      id: `agenda-${Math.random().toString(36).substring(2, 7)}`,
      ...body,
    }));
    mockState.planejamentosListar.mockResolvedValue([]);
    mockState.planejamentosCriar.mockResolvedValue({ id: 'plano-novo' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Cenário 1 (Zero Planos Criados): agendamento de paciente SEM plano NÃO cria plano nem envia planejamentoItemId', async () => {
    mockState.planejamentosListar.mockResolvedValue([]);
    const canal = criarAvisosFalsos();
    const { result } = renderHook(() => useAgendaPage({ authEnabled: true }), {
      wrapper: canal.Wrapper,
    });

    // Abre modal de criação
    act(() => {
      result.current.openCreateModal('2026-10-25');
    });

    // Seleciona paciente sem plano
    await act(async () => {
      result.current.selectPaciente('pac-1', { id: 'pac-1', nome: 'Paciente Sem Plano' });
    });

    expect(mockState.planejamentosListar).toHaveBeenCalledWith('pac-1');
    expect(result.current.itensPlanoDisponiveis).toEqual([]);

    // Configura formulário para procedimento da clínica
    act(() => {
      result.current.setTipoAtendimento('procedimento');
      result.current.updateForm('horaInicio', '10:00');
      result.current.updateForm('horaFimSlot', '10:30');
      result.current.updateForm('catalogoProcedimentoSaudeIds', ['cat-toxina']);
    });

    // Salva agendamento
    let saveSuccess = false;
    await act(async () => {
      saveSuccess = await result.current.saveAppointment();
    });

    expect(saveSuccess).toBe(true);

    // Assert de Regressão Zero: NENHUM plano foi criado no backend!
    expect(mockState.planejamentosCriar).not.toHaveBeenCalled();

    // Assert: agendamento criado sem vínculo com plano
    expect(mockState.agendasCreate).toHaveBeenCalledTimes(1);
    const createPayload = mockState.agendasCreate.mock.calls[0][0];
    expect(createPayload.pacienteId).toBe('pac-1');
    expect(createPayload.catalogoProcedimentoSaudeId).toBe('cat-toxina');
    expect(createPayload.planejamentoItemId).toBeUndefined();
  });

  it('Cenário 2 (Com Plano Ativo): selecionar procedimento do plano envia planejamentoItemId e mantém isModoPlanejamento false', async () => {
    const planoMock = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        statusCodigo: 'ativo',
        titulo: 'Harmonização Facial',
        itens: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            catalogoProcedimentoSaudeId: 'cat-toxina',
            catalogoNome: 'Toxina Botulínica',
            sessaoNumero: 1,
            numeroSessoesTotal: 2,
            dataPlanejada: '2026-10-25',
            duracaoMin: 30,
            statusItem: 'planejado',
            sessaoAtiva: null,
            sessaoRealizada: null,
          },
        ],
      },
    ];
    mockState.planejamentosListar.mockResolvedValue(planoMock);

    const canal = criarAvisosFalsos();
    const { result } = renderHook(() => useAgendaPage({ authEnabled: true }), {
      wrapper: canal.Wrapper,
    });

    act(() => {
      result.current.openCreateModal('2026-10-25');
    });

    await act(async () => {
      result.current.selectPaciente('pac-com-plano', { id: 'pac-com-plano', nome: 'Paciente Com Plano' });
    });

    // Itens agendáveis do plano carregados
    expect(result.current.itensPlanoDisponiveis).toHaveLength(1);
    expect(result.current.itensPlanoDisponiveis[0].planejamentoItemId).toBe('22222222-2222-4222-8222-222222222222');
    expect(result.current.itensPlanoDisponiveis[0].catalogoProcedimentoSaudeId).toBe('cat-toxina');

    // Usuário escolhe o procedimento do plano no modal
    act(() => {
      result.current.setTipoAtendimento('procedimento');
      result.current.updateForm('horaInicio', '14:00');
      result.current.updateForm('horaFimSlot', '14:30');
      result.current.updateForm('catalogoProcedimentoSaudeIds', ['cat-toxina']);
      result.current.setPlanoItemEscolhidoPorCatalogo({ 'cat-toxina': '22222222-2222-4222-8222-222222222222' });
    });

    // Regra F2 prevenida: escolher item do plano pelo seletor NÃO trava o modal (isModoPlanejamento false)
    expect(result.current.isModoPlanejamento).toBe(false);

    let saveSuccess = false;
    await act(async () => {
      saveSuccess = await result.current.saveAppointment();
    });

    expect(saveSuccess).toBe(true);
    expect(mockState.planejamentosCriar).not.toHaveBeenCalled();
    expect(mockState.agendasCreate).toHaveBeenCalledTimes(1);
    const createPayload = mockState.agendasCreate.mock.calls[0][0];
    expect(createPayload.catalogoProcedimentoSaudeId).toBe('cat-toxina');
    expect(createPayload.planejamentoItemId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('Cenário 3 (Seleção Mista / Prevenção F3): Procedimento A leva planejamentoItemId e Procedimento B da clínica NÃO leva', async () => {
    // Paciente tem no plano apenas a Toxina. Preenchimento será avulso da clínica.
    const planoMock = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        statusCodigo: 'ativo',
        itens: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            catalogoProcedimentoSaudeId: 'cat-toxina',
            catalogoNome: 'Toxina Botulínica',
            statusItem: 'planejado',
            sessaoAtiva: null,
            sessaoRealizada: null,
          },
        ],
      },
    ];
    mockState.planejamentosListar.mockResolvedValue(planoMock);

    const canal = criarAvisosFalsos();
    const { result } = renderHook(() => useAgendaPage({ authEnabled: true }), {
      wrapper: canal.Wrapper,
    });

    act(() => {
      result.current.openCreateModal('2026-10-25');
    });

    await act(async () => {
      result.current.selectPaciente('pac-misto', { id: 'pac-misto', nome: 'Paciente Misto' });
    });

    // Seleciona 2 procedimentos no mesmo agendamento: Toxina (do plano) e Preenchimento (da clínica)
    act(() => {
      result.current.setTipoAtendimento('procedimento');
      result.current.updateForm('horaInicio', '09:00');
      result.current.updateForm('horaFimSlot', '10:00');
      result.current.updateForm('catalogoProcedimentoSaudeIds', ['cat-toxina', 'cat-preenchimento']);
      // Apenas cat-toxina está mapeada no planoItemEscolhidoPorCatalogo
      result.current.setPlanoItemEscolhidoPorCatalogo({ 'cat-toxina': '22222222-2222-4222-8222-222222222222' });
    });

    let saveSuccess = false;
    await act(async () => {
      saveSuccess = await result.current.saveAppointment();
    });

    expect(saveSuccess).toBe(true);
    expect(mockState.agendasCreate).toHaveBeenCalledTimes(2);

    const callToxina = mockState.agendasCreate.mock.calls.find(
      (c) => c[0].catalogoProcedimentoSaudeId === 'cat-toxina',
    )[0];
    const callPreenchimento = mockState.agendasCreate.mock.calls.find(
      (c) => c[0].catalogoProcedimentoSaudeId === 'cat-preenchimento',
    )[0];

    // Toxina foi vinculada ao item do plano
    expect(callToxina.planejamentoItemId).toBe('22222222-2222-4222-8222-222222222222');

    // Preenchimento NÃO foi contaminado com o item de toxina (zero erro 422 PLANEJAMENTO_ITEM_CATALOGO_DIVERGENTE)
    expect(callPreenchimento.planejamentoItemId).toBeUndefined();
  });

  it('Cenário 4 (Prevenção F6): itens com sessaoAtiva ou já agendados NÃO aparecem em itensPlanoDisponiveis', async () => {
    const planoMock = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        statusCodigo: 'ativo',
        itens: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            catalogoProcedimentoSaudeId: 'cat-toxina',
            catalogoNome: 'Toxina Aberta',
            statusItem: 'planejado',
            sessaoAtiva: null,
            sessaoRealizada: null,
          },
          {
            id: '33333333-3333-4333-8333-333333333333',
            catalogoProcedimentoSaudeId: 'cat-toxina',
            catalogoNome: 'Toxina Já Agendada',
            statusItem: 'agendado',
            sessaoAtiva: { id: 'sess-1', dataAgendamento: '2026-10-26' },
            sessaoRealizada: null,
          },
          {
            id: '44444444-4444-4444-8444-444444444444',
            catalogoProcedimentoSaudeId: 'cat-preenchimento',
            catalogoNome: 'Preenchimento Finalizado',
            statusItem: 'finalizado',
            sessaoAtiva: null,
            sessaoRealizada: { id: 'sess-2', dataAgendamento: '2026-10-10' },
          },
        ],
      },
    ];
    mockState.planejamentosListar.mockResolvedValue(planoMock);

    const canal = criarAvisosFalsos();
    const { result } = renderHook(() => useAgendaPage({ authEnabled: true }), {
      wrapper: canal.Wrapper,
    });

    act(() => {
      result.current.openCreateModal('2026-10-25');
    });

    await act(async () => {
      result.current.selectPaciente('pac-com-agendados', { id: 'pac-com-agendados', nome: 'Paciente' });
    });

    // Somente o item aberto pode ser agendado!
    expect(result.current.itensPlanoDisponiveis).toHaveLength(1);
    expect(result.current.itensPlanoDisponiveis[0].planejamentoItemId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('Cenário 5 (Prevenção F5 & Anti-Corrida): troca de paciente limpa seleções e descarta resposta assíncrona atrasada', async () => {
    let resolverPacienteA;
    const promiseA = new Promise((resolve) => {
      resolverPacienteA = resolve;
    });

    mockState.planejamentosListar.mockImplementation((id) => {
      if (id === 'pac-A') return promiseA;
      return Promise.resolve([
        {
          id: '11111111-1111-4111-8111-111111111111',
          statusCodigo: 'ativo',
          itens: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              catalogoProcedimentoSaudeId: 'cat-preenchimento',
              catalogoNome: 'Preenchimento B',
              statusItem: 'planejado',
              sessaoAtiva: null,
            },
          ],
        },
      ]);
    });

    const canal = criarAvisosFalsos();
    const { result } = renderHook(() => useAgendaPage({ authEnabled: true }), {
      wrapper: canal.Wrapper,
    });

    act(() => {
      result.current.openCreateModal('2026-10-25');
    });

    // Seleciona paciente A (requisição lenta pendente)
    act(() => {
      result.current.selectPaciente('pac-A', { id: 'pac-A', nome: 'Paciente A' });
    });

    // Usuário imediatamente troca para paciente B antes de A responder
    await act(async () => {
      result.current.selectPaciente('pac-B', { id: 'pac-B', nome: 'Paciente B' });
    });

    expect(result.current.itensPlanoDisponiveis).toHaveLength(1);
    expect(result.current.itensPlanoDisponiveis[0].planejamentoItemId).toBe('22222222-2222-4222-8222-222222222222');

    // Agora paciente A responde tardiamente com seus itens
    await act(async () => {
      resolverPacienteA([
        {
          id: '33333333-3333-4333-8333-333333333333',
          statusCodigo: 'ativo',
          itens: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              catalogoProcedimentoSaudeId: 'cat-toxina',
              catalogoNome: 'Toxina A',
              statusItem: 'planejado',
              sessaoAtiva: null,
            },
          ],
        },
      ]);
    });

    // Assert: O token anti-corrida descartou a resposta de A! Itens permanecem os do paciente B.
    expect(result.current.itensPlanoDisponiveis).toHaveLength(1);
    expect(result.current.itensPlanoDisponiveis[0].planejamentoItemId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('Cenário 6 (Preservação de Modo Travado de Origem): modal aberto a partir da aba Planos preserva isModoPlanejamento true', async () => {
    const canal = criarAvisosFalsos();
    const { result } = renderHook(() => useAgendaPage({ authEnabled: true }), {
      wrapper: canal.Wrapper,
    });

    act(() => {
      result.current.openCreateModalForPatient(
        { id: 'pac-origem-plano', nome: 'Paciente Origem' },
        {
          planejamentoItemIdPorCatalogo: { 'cat-toxina': '11111111-1111-4111-8111-111111111111' },
          catalogoProcedimentoSaudeIds: ['cat-toxina'],
          data: '2026-10-25',
        },
      );
    });

    // Quando aberto explicitamente pela aba planos com mapa pré-definido, isModoPlanejamento é true
    expect(result.current.isModoPlanejamento).toBe(true);
    expect(result.current.patientSelectLocked).toBe(true);

    act(() => {
      result.current.setTipoAtendimento('procedimento');
      result.current.updateForm('horaInicio', '11:00');
      result.current.updateForm('horaFimSlot', '11:30');
    });

    let saveSuccess = false;
    await act(async () => {
      saveSuccess = await result.current.saveAppointment();
    });

    expect(saveSuccess).toBe(true);
    expect(mockState.agendasCreate).toHaveBeenCalledTimes(1);
    const createPayload = mockState.agendasCreate.mock.calls[0][0];
    expect(createPayload.planejamentoItemId).toBe('11111111-1111-4111-8111-111111111111');
  });
});
