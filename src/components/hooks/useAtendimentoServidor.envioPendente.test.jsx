/**
 * B-42 rodada 3, item 1: o encerrar nunca segue com envio pendente (confirmarEnvios), e o 401 em retentativa seguido
 * de saída (troca de pessoa) para a fila com o storage intacto.
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
const FILA = `procedi_consulta_fila_${USUARIO}_c-1`;
const MENSAGEM = 'Há alterações que ainda não chegaram ao servidor. Verifique a conexão e tente encerrar de novo.';

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
  const props = {
    habilitado: true,
    orgId: 'org-1',
    userId: USUARIO,
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
  return { ...r, props };
}

/** Uma troca de módulo que não sai (fica na fila em retentativa). */
async function deixarEnvioPendente(result, status) {
  vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(Object.assign(new Error('falhou'), { status }));
  act(() => result.current.trocarModulo('procedimento'));
  await esperar(50);
  await assentar();
  expect(JSON.parse(sessionStorage.getItem(FILA))).toHaveLength(1);
}

describe('useAtendimentoServidor: confirmarEnvios e encerrar com envio pendente (item 1)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
    vi.mocked(atendimentosApi.encerrar).mockResolvedValue({ atendimentoId: 'c-1', status: 'encerrado', procedimentos: [] });
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sem pendência: confirmarEnvios resolve', async () => {
    const { result } = await montarComConsultaAberta();
    await expect(result.current.confirmarEnvios()).resolves.toBeUndefined();
  });

  it.each([503, 401])('encerrar com envio pendente (%i): recusa com a mensagem e o código, 0 POST /encerrar, storage intacto, consulta acompanhada', async (status) => {
    const { result } = await montarComConsultaAberta();
    await deixarEnvioPendente(result, status);

    let erro;
    await act(async () => {
      erro = await result.current.encerrar({ modo: 'COMPLETO' }).catch((e) => e);
    });

    expect(erro?.message).toBe(MENSAGEM);
    expect(erro?.codigo).toBe('ENVIO_PENDENTE');
    expect(atendimentosApi.encerrar).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(FILA))).toHaveLength(1);
    expect(result.current.atual?.id).toBe('c-1');
  });

  it('confirmarEnvios com pendência lança ENVIO_PENDENTE; quando o envio passa, resolve e o encerrar segue', async () => {
    const { result } = await montarComConsultaAberta();
    await deixarEnvioPendente(result, 401);

    const erro = await result.current.confirmarEnvios().catch((e) => e);
    expect(erro?.codigo).toBe('ENVIO_PENDENTE');
    expect(erro?.message).toBe(MENSAGEM);

    vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});
    await act(async () => {
      await result.current.encerrar({ modo: 'COMPLETO' });
    });
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(FILA)).toBeNull();
  });

  it('401 em retentativa seguido de saída (userId vira null): a fila para, a entrada fica no storage e nada mais é enviado', async () => {
    const { result, rerender, props } = await montarComConsultaAberta();
    await deixarEnvioPendente(result, 401);
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);

    rerender({ ...props, userId: null });
    await assentar();
    await esperar(3500);

    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(FILA))).toEqual([
      { chave: 'modulo', grupo: 'modulo', tipo: 'modulo', dados: { modulo: 'procedimento' } },
    ]);
    expect(result.current.atual).toBeNull();
  }, 10000);
});
