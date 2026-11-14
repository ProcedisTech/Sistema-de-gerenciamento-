import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { useAtendimentoServidor } from './useAtendimentoServidor.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: {
    abrir: vi.fn(),
    minhas: vi.fn(),
    detalhe: vi.fn(),
    trocarModulo: vi.fn(),
    novoItem: vi.fn(),
    alterarItem: vi.fn(),
    removerItem: vi.fn(),
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
  },
}));

const { atendimentosApi } = await import('../../services/api');

describe('useAtendimentoServidor — itemNovo vínculo por _uid', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.removerItem).mockResolvedValue({});
  });

  it('vincula itemId pela identidade _uid mesmo após remoção concorrente de item anterior enquanto POST estava em voo', async () => {
    const avisos = criarAvisosFalsos();
    const catA = '11111111-1111-4111-8111-111111111111';
    const catB = 'ae05fd5a-3362-46ff-9c0f-2846190ccb87';

    const consultaInicial = {
      id: 'c-1',
      pacienteId: 'pac-1',
      status: 'aberto',
      modulo: 'procedimento',
      itens: [
        {
          id: 'srv-a',
          ordem: 0,
          agendaId: null,
          catalogoProcedimentoSaudeId: catA,
          nomeLivre: null,
          observacaoExecucao: '',
          orientacoes: null,
        },
      ],
    };
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(consultaInicial);

    let resolverNovoB;
    vi.mocked(atendimentosApi.novoItem).mockImplementation(
      () => new Promise((resolve) => {
        resolverNovoB = resolve;
      }),
    );

    const props = {
      habilitado: true,
      orgId: 'org-1',
      userId: 'u-1',
      emConsulta: true,
      pacienteId: 'pac-1',
      procedimentosSessao: [
        { itemId: 'srv-a', _uid: 'uid-a', catalogoProcedimentoSaudeId: catA, nomeProcedimento: 'Botox', observacoesExecucao: '' },
      ],
      aparelho: {
        setProcedimentosSessao: vi.fn((sessao) => {
          props.procedimentosSessao = sessao;
        }),
      },
    };

    const { result, rerender } = renderHook((p) => useAtendimentoServidor(p), {
      initialProps: props,
      wrapper: avisos.Wrapper,
    });

    await act(async () => {
      result.current.adotar(consultaInicial);
    });

    await act(async () => {
      for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0));
    });

    // Adiciona item B no índice 1 e aguarda enfileiramento + POST em voo
    props.procedimentosSessao = [
      ...props.procedimentosSessao,
      { _uid: 'uid-b', catalogoProcedimentoSaudeId: catB, nomeProcedimento: 'Biópsia', observacoesExecucao: '' },
    ];
    rerender({ ...props });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 850));
    });

    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(1);

    // Enquanto POST de B estava em voo, o usuário remove A -> B desloca para o índice 0
    props.procedimentosSessao = [
      { _uid: 'uid-b', catalogoProcedimentoSaudeId: catB, nomeProcedimento: 'Biópsia', observacoesExecucao: '' },
    ];
    rerender({ ...props });

    // Resposta do POST de B retorna com id 'srv-b'
    await act(async () => {
      resolverNovoB({
        id: 'srv-b',
        ordem: 1,
        agendaId: null,
        catalogoProcedimentoSaudeId: catB,
        nomeLivre: null,
        observacaoExecucao: '',
        orientacoes: null,
      });
      for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0));
    });

    expect(props.procedimentosSessao).toHaveLength(1);
    expect(props.procedimentosSessao[0]._uid).toBe('uid-b');
    expect(props.procedimentosSessao[0].itemId).toBe('srv-b');
    expect(atendimentosApi.removerItem).not.toHaveBeenCalledWith('c-1', 'srv-b');
  });
});
