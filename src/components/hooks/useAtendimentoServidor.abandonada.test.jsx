/**
 * Item 3 (testador): a consulta abandonada com a tela aberta conta como fechada em TODOS os caminhos de rebusca
 * (aviso ATENDIMENTO, aviso GALERIA e envio da fila recusado com 409), sem avisos de cancelada/encerrada.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { consultaFechada } from '../consulta/consultaServidor.js';
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

function dto(extras) {
  return { id: 'c-1', pacienteId: PACIENTE, status: 'aberto', modulo: 'hub', itens: [], ...extras };
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

async function montarComConsultaAberta() {
  const avisos = criarAvisosFalsos();
  const onCanceladaPorOutra = vi.fn();
  const onEncerradaEmOutroAparelho = vi.fn();
  const onAbandonada = vi.fn();
  const props = {
    habilitado: true,
    orgId: 'org-1',
    userId: 'u-1',
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    onCanceladaPorOutra,
    onEncerradaEmOutroAparelho,
    onAbandonada,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: props, wrapper: avisos.Wrapper });
  await assentar();
  await act(async () => {
    await r.result.current.abrir({ pacienteId: PACIENTE });
  });
  await assentar();
  return { ...r, avisos, onCanceladaPorOutra, onEncerradaEmOutroAparelho, onAbandonada };
}

describe('consultaFechada (regra única)', () => {
  it.each([
    ['encerrado', true],
    ['cancelado', true],
    ['abandonado', true],
    ['aberto', false],
    [undefined, false],
  ])('status %s → fechada %s', (status, esperado) => {
    expect(consultaFechada(status === undefined ? null : { status })).toBe(esperado);
  });
});

describe('useAtendimentoServidor: abandonada com a tela aberta (item 3)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('aviso de foto (GALERIA) que rebusca e acha abandonada: esquece, recarrega "minhas", só o callback de abandonada (0 pendentes)', async () => {
    const { result, avisos, onCanceladaPorOutra, onEncerradaEmOutroAparelho, onAbandonada } = await montarComConsultaAberta();
    const minhasAntes = vi.mocked(atendimentosApi.minhas).mock.calls.length;

    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    act(() => avisos.emitirAviso('GALERIA.FOTO_ADICIONADA', 'f-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();

    expect(atendimentosApi.detalhe).toHaveBeenCalledWith('c-1');
    expect(result.current.atual).toBeNull();
    expect(vi.mocked(atendimentosApi.minhas).mock.calls.length).toBe(minhasAntes + 1);
    expect(onCanceladaPorOutra).not.toHaveBeenCalled();
    expect(onEncerradaEmOutroAparelho).not.toHaveBeenCalled();
    expect(onAbandonada).toHaveBeenCalledTimes(1);
    expect(onAbandonada.mock.calls[0][0].pendentes).toBe(0);
    expect(typeof onAbandonada.mock.calls[0][0].descartarPendentes).toBe('function');
  });

  it('envio da fila recusado com 409 rebusca e acha abandonada: esquece, recarrega "minhas", só o callback de abandonada (0 pendentes)', async () => {
    const { result, onCanceladaPorOutra, onEncerradaEmOutroAparelho, onAbandonada } = await montarComConsultaAberta();
    const minhasAntes = vi.mocked(atendimentosApi.minhas).mock.calls.length;

    vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(Object.assign(new Error('abandonada'), { status: 409 }));
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    act(() => result.current.trocarModulo('procedimento'));
    await esperar(50);
    await assentar();

    expect(atendimentosApi.trocarModulo).toHaveBeenCalledWith('c-1', 'procedimento');
    expect(atendimentosApi.detalhe).toHaveBeenCalledWith('c-1');
    expect(result.current.atual).toBeNull();
    expect(vi.mocked(atendimentosApi.minhas).mock.calls.length).toBe(minhasAntes + 1);
    expect(onCanceladaPorOutra).not.toHaveBeenCalled();
    expect(onEncerradaEmOutroAparelho).not.toHaveBeenCalled();
    // O 409 já tirou a entrada da fila: nada pendente.
    expect(onAbandonada).toHaveBeenCalledTimes(1);
    expect(onAbandonada.mock.calls[0][0].pendentes).toBe(0);
  });

  it.each([
    ['sem conexão (503)', 503],
    ['401 em retentativa', 401],
  ])('abandonada com envio pendente (%s): conta ANTES de esquecer, não apaga sozinho; descartarPendentes apaga o storage', async (_nome, status) => {
    const { result, avisos, onAbandonada } = await montarComConsultaAberta();
    const chave = 'procedi_consulta_fila_u-1_c-1';
    vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(Object.assign(new Error('falhou'), { status }));
    act(() => result.current.trocarModulo('procedimento'));
    await esperar(50);
    await assentar();
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(chave))).toHaveLength(1);

    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();

    expect(result.current.atual).toBeNull();
    expect(onAbandonada).toHaveBeenCalledTimes(1);
    const { pendentes, descartarPendentes } = onAbandonada.mock.calls[0][0];
    expect(pendentes).toBe(1);
    // O hook não apaga: quem recebe decide (a tela apaga depois do toast).
    expect(JSON.parse(sessionStorage.getItem(chave))).toHaveLength(1);

    act(() => descartarPendentes());
    expect(sessionStorage.getItem(chave)).toBeNull();
    await esperar(3100);
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);
  }, 10000);


  it('depois de esquecer a abandonada, encerrar e "Apenas Sair" lançam "Consulta não encontrada" sem chamar o servidor', async () => {
    const { result, avisos } = await montarComConsultaAberta();

    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();
    expect(result.current.atual).toBeNull();

    const erroEncerrar = await result.current.encerrar({ modo: 'COMPLETO' }).catch((e) => e);
    const erroSair = await result.current.guardarAntesDeSair().catch((e) => e);
    expect(erroEncerrar?.message).toBe('Consulta não encontrada no servidor. Recarregue a página.');
    expect(erroSair?.message).toBe('Consulta não encontrada no servidor. Recarregue a página.');
    expect(atendimentosApi.encerrar).not.toHaveBeenCalled();
  });
});
