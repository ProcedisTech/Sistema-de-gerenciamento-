// Regressão prevenida: duplo clique em "Bloquear" não pode enviar o bloqueio duas vezes.
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
  bloquearPeriodo: vi.fn(),
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
vi.mock('../../hooks/useProcedimentosOptions', () => ({ useProcedimentosOptions: () => ({ options: [] }) }));
vi.mock('./ConfirmacaoForaDispModal', () => ({
  useConfirmacaoForaDisp: () => ({ modal: null, abrirConfirmacao: vi.fn() }),
}));
vi.mock('../../utils/agendaTipoProcedimento.js', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveTipoProcedimentoIdByCodigo: vi.fn().mockResolvedValue('tipo-1'),
}));
vi.mock('../../utils/agendaCancelamentoMotivo.js', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveMotivoCancelamentoIdByCodigo: vi.fn().mockResolvedValue('motivo-1'),
}));

vi.mock('../../services/api', () => {
  const genericApi = new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) });
  return {
    agendasApi: {
      create: vi.fn(),
      byRange: vi.fn().mockResolvedValue([]),
      byProfissional: vi.fn().mockResolvedValue([]),
      ocupacoes: vi.fn().mockResolvedValue([]),
      bloquearPeriodo: (...args) => mockState.bloquearPeriodo(...args),
    },
    planejamentosApi: genericApi,
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

vi.mock('../../utils/agendaDashboardMapping', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDashboardAppointmentsForRange: vi.fn().mockResolvedValue([]),
}));

describe('useAgendaPage — saveBloqueio com duplo clique', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T09:00:00-03:00'));
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dois saveBloqueio seguidos chamam bloquearPeriodo uma vez só', async () => {
    let liberar;
    mockState.bloquearPeriodo.mockImplementation(
      () => new Promise((resolve) => { liberar = () => resolve({ quantidadeCancelada: 0 }); }),
    );
    const canal = criarAvisosFalsos();
    const { result } = renderHook(() => useAgendaPage({ authEnabled: true }), { wrapper: canal.Wrapper });

    await act(async () => {
      result.current.openBloqueioModal('2029-10-25', '10:00');
    });
    await act(async () => {
      result.current.updateBloqueioForm('motivo', 'Congresso');
      await vi.advanceTimersByTimeAsync(400); // espera a contagem de conflitos (debounce)
    });

    const resultados = [];
    await act(async () => {
      resultados.push(result.current.saveBloqueio(), result.current.saveBloqueio());
      await vi.advanceTimersByTimeAsync(50);
    });
    // sinal positivo: o primeiro envio chegou ao backend
    expect(mockState.bloquearPeriodo).toHaveBeenCalledTimes(1);

    await act(async () => {
      liberar();
      await Promise.all(resultados);
    });
    expect(mockState.bloquearPeriodo).toHaveBeenCalledTimes(1);
    expect(await resultados[1]).toBe(false);
  });
});
