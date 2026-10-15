import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgendaPage } from './useAgendaPage';

const state = vi.hoisted(() => ({
  org: { orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', roleUserId: '', roleNome: '', apareceNaAgenda: false, fusoHorario: 'America/Sao_Paulo' },
  equipeList: vi.fn(),
  apiResult: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../contexts/OrgContext', () => ({ useOrg: () => state.org }));
vi.mock('../../contexts/useDisponibilidadeRevision.js', () => ({ useDisponibilidadeRevision: () => ({ bumpRevision: vi.fn() }) }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => ({ isNivel1: false, canSeeAgendaMulti: true, canSeeAgendaPropria: true, canEncaixarForaDisp: false, canDeleteAgenda: false, canAparecerNaAgenda: false }) }));
vi.mock('../../hooks/useProcedimentosOptions', () => ({ useProcedimentosOptions: () => ({ options: [] }) }));
vi.mock('./ConfirmacaoForaDispModal', () => ({ useConfirmacaoForaDisp: () => ({ modal: null, abrirConfirmacao: vi.fn() }) }));
vi.mock('../../services/api', () => {
  const service = new Proxy({}, { get: () => state.apiResult });
  return ({
  agendasApi: service, anamneseApi: service, catalogosApi: service, confirmacaoApi: service,
  disponibilidadeApi: service, equipeApi: { list: state.equipeList },
  getApiErrorToastMessage: () => 'Erro', isAbortError: () => false,
  organizacoesHorariosApi: service, pacientesApi: service, planejamentosApi: service, procedimentosApi: service,
  });
});

describe('agenda ao trocar de clínica', () => {
  beforeEach(() => {
    state.org = { orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', roleUserId: '', roleNome: '', apareceNaAgenda: false, fusoHorario: 'America/Sao_Paulo' };
    state.equipeList.mockReset();
    state.equipeList
      .mockResolvedValueOnce([{ id: 'profissional-a', nome: 'Profissional A', apareceNaAgenda: true }])
      .mockResolvedValueOnce([{ id: 'profissional-b', nome: 'Profissional B', apareceNaAgenda: true }]);
  });

  it('limpa a equipe anterior e busca a equipe da nova clínica', async () => {
    const { result, rerender } = renderHook(() => useAgendaPage({ authEnabled: true }));
    await waitFor(() => expect(result.current.equipeList.map(p => p.nome)).toEqual(['Profissional A']));

    act(() => { state.org = { ...state.org, orgId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }; });
    rerender();

    await waitFor(() => expect(result.current.equipeList.map(p => p.nome)).toEqual(['Profissional B']));
    expect(state.equipeList).toHaveBeenCalledTimes(2);
  });
});
