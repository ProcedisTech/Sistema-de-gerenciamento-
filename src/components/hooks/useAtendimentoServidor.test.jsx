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
const FILA = `procedi_consulta_fila_${USUARIO}_c-1`;

function dto(extras) {
  return {
    id: 'c-1',
    pacienteId: PACIENTE,
    status: 'aberto',
    modulo: 'hub',
    itens: [],
    ...extras,
  };
}

function aparelhoFalso() {
  return {
    setProcedimentosSessao: vi.fn(),
  };
}

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

function montar(props) {
  const avisos = criarAvisosFalsos();
  const base = {
    habilitado: true,
    orgId: 'org-1',
    userId: USUARIO,
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [{ nomeProcedimento: 'Botox', observacoesExecucao: 'aplicado 20U' }],
    aparelho: aparelhoFalso(),
    ...props,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  return { ...r, base, avisos };
}

describe('useAtendimentoServidor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
    vi.mocked(atendimentosApi.novoItem).mockResolvedValue({
      id: 'item-mock',
      ordem: 0,
      agendaId: null,
      nomeLivre: 'Botox',
      catalogoProcedimentoSaudeId: null,
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('F5: detalhe vazio do servidor não apaga o que está no aparelho', async () => {
    const { result, base } = montar();
    await assentar();

    act(() => {
      result.current.adotar(dto());
    });
    await assentar();

    expect(result.current.atual?.id).toBe('c-1');
    const zerouSessao = base.aparelho.setProcedimentosSessao.mock.calls.some(([s]) => Array.isArray(s) && s.length === 0);
    expect(zerouSessao).toBe(false);
  });

  it('trocar o paciente da tela não fecha a consulta', async () => {
    const { result, rerender, base } = montar();
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();

    rerender({ ...base, pacienteId: 'p-outro', emConsulta: false });
    await assentar();

    expect(result.current.atual?.id).toBe('c-1');
  });

  it('desabilitado (sem permissão) não busca "minhas"', async () => {
    const { result } = montar({ habilitado: false });
    await assentar();
    expect(atendimentosApi.minhas).not.toHaveBeenCalled();
    expect(result.current.minhasCarregadas).toBe(false);
  });

  it('guardarAntesDeSair espera a fila, recarrega "minhas" e não esquece a consulta (nenhuma rota de consulta)', async () => {
    vi.mocked(atendimentosApi.novoItem).mockResolvedValue({ id: 'item-1', ordem: 0, nomeLivre: 'Botox' });
    const { result } = montar();
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();
    // O item da linha "Botox" ainda está no debounce da fila.
    expect(atendimentosApi.novoItem).not.toHaveBeenCalled();
    const minhasAntes = vi.mocked(atendimentosApi.minhas).mock.calls.length;

    let saida;
    await act(async () => {
      saida = await result.current.guardarAntesDeSair();
    });

    expect(saida).toEqual({ esvaziou: true, tiposPendentes: [] });
    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(1);
    expect(vi.mocked(atendimentosApi.minhas).mock.calls.length).toBe(minhasAntes + 1);
    expect(result.current.atual?.id).toBe('c-1');
    // F5b: a observação digitada antes de o item nascer (o POST não a leva) sai no PATCH logo depois, no mesmo esvaziar.
    expect(soAbrirEMinhas()).toEqual(['novoItem', 'alterarItem']);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'item-1', { observacaoExecucao: 'aplicado 20U' });
    expect(sessionStorage.getItem(FILA)).toBeNull();
  });

  it('guardarAntesDeSair devolve esvaziou false e o tipo que sobrou quando o envio não sai (servidor fora): fica guardado neste aparelho', async () => {
    vi.mocked(atendimentosApi.novoItem).mockRejectedValueOnce(Object.assign(new Error('Fora do ar'), { status: 503 }));
    const { result } = montar();
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();

    let saida;
    await act(async () => {
      saida = await result.current.guardarAntesDeSair();
    });

    // O item da linha "Botox" é um procedimento novo (POST): só sai quando a pessoa abrir esta consulta de novo.
    expect(saida).toEqual({ esvaziou: false, tiposPendentes: ['itemNovo'] });
    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(1);
    expect(result.current.atual?.id).toBe('c-1');
    expect(JSON.parse(sessionStorage.getItem(FILA))).toHaveLength(1);
  });

  it('guardarAntesDeSair sem consulta acompanhada lança erro (a tela não sai calada)', async () => {
    const { result } = montar();
    await assentar();

    let erro = null;
    await act(async () => {
      try {
        await result.current.guardarAntesDeSair();
      } catch (e) {
        erro = e;
      }
    });

    expect(erro?.message).toBe('Consulta não encontrada no servidor. Recarregue a página.');
    expect(soAbrirEMinhas()).toEqual([]);
  });

  it('o efeito de habilitar rodando de novo na mesma clínica não esquece a consulta; trocar de clínica esquece', async () => {
    const { result, rerender, base } = montar();
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();

    rerender({ ...base, habilitado: false });
    await assentar();
    rerender({ ...base, habilitado: true });
    await assentar();
    expect(result.current.atual?.id).toBe('c-1');

    rerender({ ...base, orgId: 'org-2' });
    await assentar();
    expect(result.current.atual).toBeNull();
  });

  it('encerrar chama a rota com o corpo, devolve o resultado e esquece a consulta', async () => {
    const resultado = { atendimentoId: 'c-1', status: 'encerrado', procedimentos: [], orientacoes: [] };
    vi.mocked(atendimentosApi.encerrar).mockResolvedValue(resultado);
    const { result } = montar();
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });

    let devolvido;
    await act(async () => {
      devolvido = await result.current.encerrar({ modo: 'COMPLETO', pularGateTermos: true, itemAtivoId: null });
    });

    expect(atendimentosApi.encerrar).toHaveBeenCalledWith(
      'c-1',
      { modo: 'COMPLETO', pularGateTermos: true, itemAtivoId: null },
      { abaId: expect.any(String) },
    );
    expect(devolvido).toBe(resultado);
    expect(result.current.atual).toBeNull();
  });

  it('FF1 b: o item da linha ativa que só nasce no esvaziar da fila vai no POST /encerrar como itemAtivoId', async () => {
    const resultado = { atendimentoId: 'c-1', status: 'encerrado', procedimentos: [], orientacoes: [] };
    vi.mocked(atendimentosApi.encerrar).mockResolvedValue(resultado);
    let criarItem;
    vi.mocked(atendimentosApi.novoItem).mockReturnValue(new Promise((r) => {
      criarItem = r;
    }));
    const { result } = montar();
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();
    // A linha "Botox" ainda não tem item no servidor: o POST do item está no debounce da fila.
    expect(atendimentosApi.novoItem).not.toHaveBeenCalled();

    let pedido;
    act(() => {
      pedido = result.current.encerrar({ modo: 'COMPLETO', pularGateTermos: true, indiceItemAtivo: 0, criarProcedimentos: true });
    });
    await assentar();
    // O esvaziar mandou o item já; o encerrar espera a resposta antes do POST.
    expect(atendimentosApi.novoItem).toHaveBeenCalledWith('c-1', { catalogoProcedimentoSaudeId: null, nomeLivre: 'Botox' });
    expect(atendimentosApi.encerrar).not.toHaveBeenCalled();

    await act(async () => {
      criarItem({ id: 'item-novo', ordem: 0, agendaId: null, nomeLivre: 'Botox', catalogoProcedimentoSaudeId: null });
      await pedido;
    });

    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.encerrar).toHaveBeenCalledWith('c-1', {
      modo: 'COMPLETO',
      pularGateTermos: true,
      itemAtivoId: 'item-novo',
      criarProcedimentos: true,
    }, { abaId: expect.any(String) });
    expect(result.current.atual).toBeNull();
  });

  it('ND18: o aviso ENCERRADO do encerrar pedido aqui não faz a tela sair de novo', async () => {
    let responder;
    vi.mocked(atendimentosApi.encerrar).mockReturnValue(new Promise((r) => {
      responder = r;
    }));
    const onEncerradaEmOutroAparelho = vi.fn();
    const { result, avisos } = montar({ onEncerradaEmOutroAparelho });
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });

    let pedido;
    act(() => {
      pedido = result.current.encerrar({ modo: 'COMPLETO' });
    });
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.ENCERRADO', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();
    expect(atendimentosApi.detalhe).toHaveBeenCalledWith('c-1');
    expect(onEncerradaEmOutroAparelho).not.toHaveBeenCalled();

    await act(async () => {
      responder({ atendimentoId: 'c-1', status: 'encerrado', procedimentos: [], orientacoes: [] });
      await pedido;
    });
    expect(onEncerradaEmOutroAparelho).not.toHaveBeenCalled();
    expect(result.current.atual).toBeNull();
  });

  it('ND18: encerrada em outro aparelho avisa com o CPF; depois de um encerrar que falhou aqui, também', async () => {
    vi.mocked(atendimentosApi.encerrar).mockRejectedValue(Object.assign(new Error('falhou'), { status: 422 }));
    const onEncerradaEmOutroAparelho = vi.fn();
    const { result, avisos } = montar({ onEncerradaEmOutroAparelho });
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });

    let erro;
    await act(async () => {
      erro = await result.current.encerrar({ modo: 'COMPLETO' }).catch((e) => e);
    });
    expect(erro?.status).toBe(422);
    expect(result.current.atual?.id).toBe('c-1');

    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado', pacienteCpf: '52998224725' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.ENCERRADO', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();

    expect(onEncerradaEmOutroAparelho).toHaveBeenCalledTimes(1);
    expect(onEncerradaEmOutroAparelho).toHaveBeenCalledWith({ pacienteId: PACIENTE, pacienteCpf: '52998224725' });
    expect(result.current.atual).toBeNull();
  });

  it('abandonada com a tela aberta conta como fechada: esquece a consulta e recarrega "minhas", sem avisos de cancelada/encerrada', async () => {
    const onCanceladaPorOutra = vi.fn();
    const onEncerradaEmOutroAparelho = vi.fn();
    const { result, avisos } = montar({ onCanceladaPorOutra, onEncerradaEmOutroAparelho });
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();
    const minhasAntes = vi.mocked(atendimentosApi.minhas).mock.calls.length;

    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();

    expect(atendimentosApi.detalhe).toHaveBeenCalled();
    expect(result.current.atual).toBeNull();
    expect(vi.mocked(atendimentosApi.minhas).mock.calls.length).toBeGreaterThan(minhasAntes + 1);
    expect(onCanceladaPorOutra).not.toHaveBeenCalled();
    expect(onEncerradaEmOutroAparelho).not.toHaveBeenCalled();
  });

  /** Nenhuma rota da consulta foi chamada além de abrir e "minhas". */
  function soAbrirEMinhas() {
    return Object.entries(atendimentosApi)
      .filter(([nome]) => !['abrir', 'minhas'].includes(nome))
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([nome]) => nome);
  }

  it('F5b: orientação da linha vai no PATCH do item com a lista inteira (modelo recém-carregado espera o debounce)', async () => {
    const ITEM = { id: 'i-1', ordem: 0, agendaId: null, nomeLivre: 'Botox', catalogoProcedimentoSaudeId: null, observacaoExecucao: '', orientacoes: null };
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto({ itens: [ITEM] }));
    vi.mocked(atendimentosApi.alterarItem).mockImplementation(async (_id, itemId, campos) => ({ ...ITEM, id: itemId, ...campos }));
    const { result, rerender, base } = montar({ procedimentosSessao: [] });
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();
    // A hidratação põe a linha do item (com `itemId` e `orient` nula) no aparelho.
    const [sessao] = base.aparelho.setProcedimentosSessao.mock.calls.at(-1);
    expect(sessao[0]).toMatchObject({ itemId: 'i-1', orient: null });

    // A tela carregou o modelo e a pessoa marcou a 1ª caixa: a lista inteira sai no PATCH (`orientacoes`).
    const orient = [{ id: 'local-1', descricao: 'Evitar sol', checado: true, ordem: 0 }, { id: 'local-2', descricao: 'Não deitar', checado: false, ordem: 1 }];
    rerender({ ...base, procedimentosSessao: [{ ...sessao[0], orient }] });
    await esperar(800);
    await assentar();

    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'i-1', {
      orientacoes: [
        { descricao: 'Evitar sol', checado: true, ordem: 0 },
        { descricao: 'Não deitar', checado: false, ordem: 1 },
      ],
    });
    expect(sessionStorage.getItem(FILA)).toBeNull();
  });

  it('envio de orientação guardado no sessionStorage por uma versão anterior sai da fila sem chamar o servidor', async () => {
    vi.mocked(atendimentosApi.encerrar).mockResolvedValue({ atendimentoId: 'c-1', status: 'encerrado', procedimentos: [], orientacoes: [] });
    sessionStorage.setItem(FILA, JSON.stringify([
      { chave: 'orient:L1:nova', grupo: 'orient:L1', tipo: 'orientNova', dados: { localId: 'L1', corpo: { descricao: 'x' } } },
      { chave: 'orient:S1:chk', grupo: 'orient:S1', tipo: 'orient', dados: { ref: 'S1', campos: { checado: true } } },
      { chave: 'orient:S2:del', grupo: 'orient:S2', tipo: 'orientDel', dados: { ref: 'S2' } },
    ]));
    const { result } = montar({ procedimentosSessao: [] });
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();

    // O encerrar esvazia a fila: as entradas antigas saem sem rota e o POST /encerrar segue.
    await act(async () => {
      await result.current.encerrar({ modo: 'COMPLETO' });
    });

    expect(soAbrirEMinhas()).toEqual(['encerrar']);
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(FILA)).toBeNull();
  });

  it('F5b: o encerrar não leva `orientacoes` no corpo (mesmo que o pedido traga)', async () => {
    vi.mocked(atendimentosApi.encerrar).mockResolvedValue({ atendimentoId: 'c-1', status: 'encerrado', procedimentos: [], orientacoes: [] });
    const { result } = montar({ procedimentosSessao: [] });
    await assentar();
    await act(async () => {
      await result.current.abrir({ pacienteId: PACIENTE });
    });

    const orientacoes = [{ descricao: 'Evitar sol', checado: true, ordem: 0 }];
    await act(async () => {
      await result.current.encerrar({ modo: 'COMPLETO', pularGateTermos: false, itemAtivoId: null, orientacoes });
    });

    expect(atendimentosApi.encerrar).toHaveBeenCalledWith('c-1', {
      modo: 'COMPLETO',
      pularGateTermos: false,
      itemAtivoId: null,
    }, { abaId: expect.any(String) });
  });
});
