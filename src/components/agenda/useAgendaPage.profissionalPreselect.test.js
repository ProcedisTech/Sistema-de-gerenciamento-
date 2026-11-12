import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgendaPage } from './useAgendaPage';

const mockState = vi.hoisted(() => ({
  org: {
    orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roleUserId: 'prof-role-default',
    roleNome: 'Dr. Padrão',
    apareceNaAgenda: true,
    fusoHorario: 'America/Sao_Paulo',
  },
  equipeApiList: vi.fn(),
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
  useProcedimentosOptions: () => ({ options: [] }),
}));
vi.mock('./ConfirmacaoForaDispModal', () => ({
  useConfirmacaoForaDisp: () => ({ modal: null, abrirConfirmacao: vi.fn() }),
}));

vi.mock('../../services/api', () => {
  return {
    agendasApi: {
      create: vi.fn().mockResolvedValue({ id: 'agenda-1' }),
      byRange: vi.fn().mockResolvedValue([]),
      byProfissional: vi.fn().mockResolvedValue([]),
      ocupacoes: vi.fn().mockResolvedValue([]),
    },
    equipeApi: {
      list: (...args) => mockState.equipeApiList(...args),
    },
    planejamentosApi: {
      listarPorPaciente: vi.fn().mockResolvedValue([]),
    },
    pacientesApi: {
      list: vi.fn().mockResolvedValue([]),
    },
    procedimentosFeitosApi: {
      listarRaizesPorPaciente: vi.fn().mockResolvedValue([]),
    },
    procedimentosApi: {
      list: vi.fn().mockResolvedValue([]),
    },
  };
});

describe('useAgendaPage — Pré-seleção de Profissional no Agendamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.equipeApiList.mockResolvedValue([
      { roleUserId: 'prof-camila-id', nome: 'Dra. Camila Souza', apareceNaAgenda: true },
      { roleUserId: 'prof-bruno-id', nome: 'Dr. Bruno Lima', apareceNaAgenda: true },
    ]);
  });

  it('openCreateModal com data e opts.profissionalRoleUserId define roleUserIdAgenda', () => {
    const { result } = renderHook(() =>
      useAgendaPage({ patients: [], authEnabled: true })
    );

    act(() => {
      result.current.openCreateModal('2026-10-28', {
        profissionalRoleUserId: 'prof-camila-id',
      });
    });

    expect(result.current.modalMode).toBe('create');
    expect(result.current.roleUserIdAgenda).toBe('prof-camila-id');
    expect(result.current.selectedDay).toBeDefined();
  });

  it('openCreateModal passando apenas objeto de opções preserva selectedDay e define roleUserIdAgenda', () => {
    const { result } = renderHook(() =>
      useAgendaPage({ patients: [], authEnabled: true })
    );

    act(() => {
      result.current.openCreateModal({
        profissionalRoleUserId: 'prof-bruno-id',
      });
    });

    expect(result.current.modalMode).toBe('create');
    expect(result.current.roleUserIdAgenda).toBe('prof-bruno-id');
  });

  it('openCreateModalForProfissional extrai o id da pessoa e define roleUserIdAgenda', () => {
    const { result } = renderHook(() =>
      useAgendaPage({ patients: [], authEnabled: true })
    );

    const pessoa = { id: 'prof-camila-id', nomeCompleto: 'Dra. Camila Souza' };

    act(() => {
      result.current.openCreateModalForProfissional(pessoa);
    });

    expect(result.current.modalMode).toBe('create');
    expect(result.current.roleUserIdAgenda).toBe('prof-camila-id');
  });
});
