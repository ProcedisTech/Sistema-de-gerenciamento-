/**
 * Testador T-FC-front (12/10): dois buracos que as mutações próprias mostraram na fila em segundo plano.
 * 1) A troca de pessoa na mesma aba para a fila em SEGUNDO PLANO de quem saiu (não só a da consulta acompanhada):
 *    a retentativa dela nunca sai com o acesso da outra pessoa (mutação: tirar `pararTodas()` da troca de dono).
 * 2) `itemNovo` só sai com a sessão hidratada: adotar a consulta (acompanhada) sem entrar na tela não libera o item
 *    novo, nem quando outro envio da mesma fila acorda o agendador (mutação: `podeEnviar` sem `hidratadoRef`).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
  },
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const USUARIO = 'u-1';
const OUTRA_PESSOA = 'u-2';
const fila = (userId) => `procedi_consulta_fila_${userId}_c-1`;

const ENVIO_ITEM = {
  chave: 'item:item-1:obs',
  grupo: 'item:item-1',
  tipo: 'item',
  dados: { itemId: 'item-1', campos: { observacaoExecucao: 'ab' } },
};
const ENVIO_ITEM_NOVO = {
  chave: 'item:novo:0',
  grupo: 'item:novo',
  tipo: 'itemNovo',
  dados: { indice: 0, corpo: { catalogoProcedimentoSaudeId: null, nomeLivre: 'Botox' } },
};

const resumo = () => ({ id: 'c-1', pacienteId: PACIENTE, status: 'aberto' });
const dto = () => ({ id: 'c-1', pacienteId: PACIENTE, status: 'aberto', modulo: 'hub', itens: [] });

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function montar(props) {
  const avisos = criarAvisosFalsos();
  const base = {
    habilitado: true,
    orgId: 'org-1',
    userId: USUARIO,
    emConsulta: false,
    pacienteId: null,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    ...props,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  return { ...r, base };
}

describe('useAtendimentoServidor: fila em segundo plano (testador)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo()]);
    vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});
    vi.mocked(atendimentosApi.novoItem).mockResolvedValue({ id: 'item-novo' });
  });
  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('troca de pessoa: a retentativa da fila em segundo plano de quem saiu não sai com o acesso da outra', async () => {
    // Servidor fora: o PATCH guardado falha e a fila agenda nova tentativa em 3 s.
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(Object.assign(new Error('fora'), { status: 503 }));
    sessionStorage.setItem(fila(USUARIO), JSON.stringify([ENVIO_ITEM]));
    const { rerender, base } = montar();
    await assentar();
    await esperar(100);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);

    // Outra pessoa entra na mesma aba (sem consultas); o servidor volta.
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.alterarItem).mockResolvedValue({});
    rerender({ ...base, userId: OUTRA_PESSOA });
    await assentar();
    await esperar(3500);

    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(fila(USUARIO))).not.toBeNull();
  }, 10000);

  it('consulta adotada mas não hidratada: outro envio da fila não libera o itemNovo', async () => {
    sessionStorage.setItem(fila(USUARIO), JSON.stringify([ENVIO_ITEM_NOVO]));
    const { result } = montar();
    await assentar();
    await esperar(100);
    expect(atendimentosApi.novoItem).not.toHaveBeenCalled();

    // Acompanha a consulta sem a tela entrar nela (emConsulta=false: nada hidratado) e um módulo entra na fila.
    act(() => {
      result.current.adotar(dto());
    });
    act(() => {
      result.current.trocarModulo('procedimento');
    });
    await assentar();
    await esperar(300);

    expect(atendimentosApi.trocarModulo).toHaveBeenCalledWith('c-1', 'procedimento');
    expect(atendimentosApi.novoItem).not.toHaveBeenCalled();
    expect(atendimentosApi.alterarItem).not.toHaveBeenCalled();
  });
});
