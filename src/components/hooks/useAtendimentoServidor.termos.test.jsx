/**
 * Onda E: termos da consulta pelo useAtendimentoServidor.
 * - `salvarTermosConsulta` enfileira 1 PUT (chave `termos`, o último vence) e a resposta vira `termosDaConsulta`;
 * - a releitura (aviso ATENDIMENTO) atualiza `termosDaConsulta`, salvo com `termos` pendente;
 * - assinatura pela fila: falha de rede fica guardada e sobe na volta; 200 e 201 são sucesso;
 * - `esperarFilaAvaliacao` espera o PATCH sair e devolve o `preenchimentoAnamneseId` da resposta.
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
    alterarAvaliacaoTexto: vi.fn(),
    salvarTermos: vi.fn(),
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
  },
  termoAssinaturaApi: { criar: vi.fn() },
}));

const { atendimentosApi, termoAssinaturaApi } = await import('../../services/api');

const PACIENTE = 'p-maria';

function linha(termoId, extras = {}) {
  return {
    termoId,
    ordem: 0,
    lido: false,
    lidoEm: null,
    escolhido: false,
    termoAssinaturaId: null,
    statusAssinatura: null,
    ...extras,
  };
}

function dto(extras) {
  return {
    id: 'c-1',
    pacienteId: PACIENTE,
    status: 'aberto',
    modulo: 'hub',
    itens: [],
    queixa: null,
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
    termos: [],
    ...extras,
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

async function montar(inicial = dto()) {
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(inicial);
  const avisos = criarAvisosFalsos();
  const props = {
    habilitado: true,
    orgId: 'org-1',
    userId: 'u-1',
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: props, wrapper: avisos.Wrapper });
  await assentar();
  await act(async () => {
    await r.result.current.abrir({ pacienteId: PACIENTE });
  });
  await assentar();
  return { ...r, avisos };
}

describe('useAtendimentoServidor: termos da consulta', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('termosDaConsulta vem do detalhe e é [] quando o detalhe não traz nada', async () => {
    const a = await montar(dto({ termos: [linha('t-1', { escolhido: true })] }));
    expect(a.result.current.termosDaConsulta).toEqual([linha('t-1', { escolhido: true })]);
    a.unmount();
    const b = await montar(dto({ termos: undefined }));
    expect(b.result.current.termosDaConsulta).toEqual([]);
  });

  it('salvarTermosConsulta enfileira 1 PUT (o último vence) e a resposta vira termosDaConsulta', async () => {
    const resposta = [linha('t-1', { ordem: 0 }), linha('t-2', { ordem: 1, escolhido: true, lido: true, lidoEm: 'x' })];
    vi.mocked(atendimentosApi.salvarTermos).mockResolvedValue(dto({ termos: resposta }));
    const { result } = await montar();

    act(() => {
      result.current.salvarTermosConsulta({ termoSelecionadoId: 't-1', termoLido: false, termosPendentesIds: ['t-1'] });
      result.current.salvarTermosConsulta({ termoSelecionadoId: 't-2', termoLido: true, termosPendentesIds: ['t-1', 't-2'] });
    });
    // A base já reflete o clique, antes de o PUT sair.
    expect(result.current.termosDaConsulta.map((t) => t.termoId)).toEqual(['t-1', 't-2']);
    expect(atendimentosApi.salvarTermos).not.toHaveBeenCalled();

    await esperar(500);
    await assentar();

    expect(atendimentosApi.salvarTermos).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.salvarTermos).toHaveBeenCalledWith('c-1', {
      termoSelecionadoId: 't-2',
      termoLido: true,
      termosPendentesIds: ['t-1', 't-2'],
    });
    expect(result.current.termosDaConsulta).toEqual(resposta);
  });

  it('a releitura atualiza termosDaConsulta; com termos pendente, não aplica', async () => {
    let liberar;
    vi.mocked(atendimentosApi.salvarTermos).mockImplementation(
      () => new Promise((r) => {
        liberar = r;
      }),
    );
    const { result, avisos } = await montar(dto({ termos: [linha('t-1')] }));

    // Outra aba escolheu o t-2: a releitura traz.
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ termos: [linha('t-2', { escolhido: true })] }));
    act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();
    expect(result.current.termosDaConsulta.map((t) => t.termoId)).toEqual(['t-2']);

    // Clique local ainda na fila (PUT no ar): a releitura mais velha não o apaga.
    act(() => {
      result.current.salvarTermosConsulta({ termoSelecionadoId: 't-3', termoLido: false, termosPendentesIds: ['t-3'] });
    });
    await esperar(400);
    expect(atendimentosApi.salvarTermos).toHaveBeenCalledTimes(1);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ termos: [linha('t-9')] }));
    act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();
    expect(result.current.termosDaConsulta.map((t) => t.termoId)).toEqual(['t-3']);

    await act(async () => {
      liberar(dto({ termos: [linha('t-3', { escolhido: true })] }));
    });
    await assentar();
    expect(result.current.termosDaConsulta).toEqual([linha('t-3', { escolhido: true })]);
  });

  it('assinatura offline: 1ª tentativa falha por rede, fica na fila e sobe quando a rede volta', async () => {
    vi.mocked(termoAssinaturaApi.criar)
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue({ id: 'ass-1', statusCodigo: 'PENDENTE' });
    const { result } = await montar(dto({ termos: [linha('t-1', { escolhido: true })] }));
    const corpo = { termoId: 't-1', pacienteId: PACIENTE, assinaturaPaciente: 'data:image/png;base64,AAAA', statusCodigo: 'ASSINADO' };

    let primeiro;
    await act(async () => {
      primeiro = await result.current.enviarAssinaturaPelaFila(corpo);
    });
    expect(primeiro).toMatchObject({ ok: false, naFila: true });
    expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(1);
    expect(termoAssinaturaApi.criar).toHaveBeenCalledWith({ ...corpo, atendimentoId: 'c-1' });
    // Guardada no sessionStorage com o corpo (sobrevive a F5).
    expect(sessionStorage.getItem('procedi_consulta_fila_u-1_c-1')).toContain('assinatura:t-1');

    // A fila retenta sozinha depois da espera (3 s).
    await vi.waitFor(() => expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(2), { timeout: 5000 });
    await assentar();
    expect(result.current.termosDaConsulta[0]).toMatchObject({ termoAssinaturaId: 'ass-1', statusAssinatura: 'PENDENTE' });
    expect(sessionStorage.getItem('procedi_consulta_fila_u-1_c-1')).toBeNull();
  }, 15000);

  // O `request` da api devolve só o corpo (200 e 201 iguais): o código HTTP de sucesso não é exposto, status = null.
  it.each([[200, 'ass-existente'], [201, 'ass-nova']])('(a) a resposta %i da assinatura é sucesso com envelope completo', async (_status, idAss) => {
    const corpoResposta = { id: idAss, statusCodigo: 'ASSINADO', jaExistia: _status === 200 };
    vi.mocked(termoAssinaturaApi.criar).mockResolvedValue(corpoResposta);
    const { result } = await montar(dto({ termos: [linha('t-1', { escolhido: true })] }));

    let r;
    await act(async () => {
      r = await result.current.enviarAssinaturaPelaFila({ termoId: 't-1', pacienteId: PACIENTE, statusCodigo: 'ASSINADO' });
    });

    expect(r).toEqual({ ok: true, assinatura: corpoResposta, naFila: false, status: null, erro: null });
    expect(result.current.termosDaConsulta[0]).toMatchObject({ termoAssinaturaId: idAss, statusAssinatura: 'ASSINADO' });
  });

  it('(b) falha de rede: naFila true, ok false, sem status, com o erro', async () => {
    const erroRede = new Error('Failed to fetch');
    vi.mocked(termoAssinaturaApi.criar).mockRejectedValue(erroRede);
    const { result } = await montar(dto({ termos: [linha('t-1')] }));

    let r;
    await act(async () => {
      r = await result.current.enviarAssinaturaPelaFila({ termoId: 't-1', pacienteId: PACIENTE });
    });

    expect(r).toEqual({ ok: false, assinatura: null, naFila: true, status: null, erro: erroRede });
    expect(r.naoEntrou).toBeUndefined();
  });

  it('(c) 409 genérico ("Termo já assinado") é descartado com status 409 e sem naoEntrou', async () => {
    const erro409 = Object.assign(new Error('Termo já assinado'), { status: 409, body: { error: 'Termo já assinado' } });
    vi.mocked(termoAssinaturaApi.criar).mockRejectedValue(erro409);
    const { result } = await montar(dto({ termos: [linha('t-1')] }));

    let r;
    await act(async () => {
      r = await result.current.enviarAssinaturaPelaFila({ termoId: 't-1', pacienteId: PACIENTE });
    });

    expect(r).toEqual({ ok: false, assinatura: null, naFila: false, status: 409, erro: erro409 });
    expect(r.naoEntrou).toBeUndefined();
    expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(1);
    expect(result.current.alteracoesNaoEntraram).toBeNull();
  });

  it('(d) assinatura recusada com 422 é descartada (não retenta) e traz status 422', async () => {
    const erro422 = Object.assign(new Error('inválido'), { status: 422 });
    vi.mocked(termoAssinaturaApi.criar).mockRejectedValue(erro422);
    const { result } = await montar(dto({ termos: [linha('t-1')] }));

    let r;
    await act(async () => {
      r = await result.current.enviarAssinaturaPelaFila({ termoId: 't-1', pacienteId: PACIENTE });
    });

    expect(r).toEqual({ ok: false, assinatura: null, naFila: false, status: 422, erro: erro422 });
    expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(1);
  });

  it('(e) 409 "Esta consulta já foi fechada." traz naoEntrou e vai para alteracoesNaoEntraram', async () => {
    const erroFechada = Object.assign(new Error('Esta consulta já foi fechada.'), {
      status: 409,
      body: { error: 'Esta consulta já foi fechada.' },
    });
    vi.mocked(termoAssinaturaApi.criar).mockRejectedValue(erroFechada);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado' }));
    const { result } = await montar(dto({ termos: [linha('t-1')] }));

    let r;
    await act(async () => {
      r = await result.current.enviarAssinaturaPelaFila({ termoId: 't-1', pacienteId: PACIENTE });
    });
    await assentar();

    expect(r).toEqual({ ok: false, assinatura: null, naFila: false, status: 409, erro: erroFechada, naoEntrou: true });
    expect(termoAssinaturaApi.criar).toHaveBeenCalledTimes(1);
    expect(result.current.alteracoesNaoEntraram?.itens.map((i) => i.chave)).toEqual(['assinatura:t-1']);
  });
});

describe('useAtendimentoServidor: esperarFilaAvaliacao com a opção avaliacao', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('espera o PATCH em voo e resolve com o id da resposta', async () => {
    let liberar;
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockImplementation(
      () => new Promise((r) => {
        liberar = r;
      }),
    );
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
    const avisos = criarAvisosFalsos();
    const valores = { queixa: 'Manchas', expectativas: '', observacoesAvaliacao: '' };
    const r = renderHook(
      () => useAtendimentoServidor({
        habilitado: true,
        orgId: 'org-1',
        userId: 'u-1',
        emConsulta: true,
        pacienteId: PACIENTE,
        procedimentosSessao: [],
        aparelho: { setProcedimentosSessao: vi.fn() },
        avaliacao: { valores, aplicar: vi.fn() },
      }),
      { wrapper: avisos.Wrapper },
    );
    await assentar();
    await act(async () => {
      await r.result.current.abrir({ pacienteId: PACIENTE });
    });
    await assentar();

    // Sem nada pendente: resolve na hora.
    await act(async () => {
      expect(await r.result.current.esperarFilaAvaliacao()).toEqual({ ok: true, preenchimentoAnamneseId: null });
    });

    act(() => {
      r.result.current.onCampoAvaliacaoBlur('queixa');
    });
    await esperar(20);
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);

    let resolvido = null;
    let promessa;
    act(() => {
      promessa = r.result.current.esperarFilaAvaliacao().then((v) => {
        resolvido = v;
      });
    });
    await esperar(50);
    expect(resolvido).toBeNull();

    await act(async () => {
      liberar(dto({ queixa: 'Manchas', preenchimentoAnamneseId: 'pa-77' }));
      await promessa;
    });

    expect(resolvido).toEqual({ ok: true, preenchimentoAnamneseId: 'pa-77' });
  });
});
