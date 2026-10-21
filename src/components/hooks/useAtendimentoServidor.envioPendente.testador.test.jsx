/**
 * Testador T1 (B-42 rodada 3, item 1): pontos do item que os testes do implementador não travam.
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

async function montar(extras = {}) {
  const avisos = criarAvisosFalsos();
  const props = {
    habilitado: true,
    orgId: 'org-1',
    userId: USUARIO,
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    ...extras,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: props, wrapper: avisos.Wrapper });
  await assentar();
  await act(async () => {
    await r.result.current.abrir({ pacienteId: PACIENTE });
  });
  await assentar();
  return { ...r, props, avisos };
}

async function deixarEnvioPendente(result, status) {
  vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(Object.assign(new Error('falhou'), { status }));
  act(() => result.current.trocarModulo('procedimento'));
  await esperar(50);
  await assentar();
  expect(JSON.parse(sessionStorage.getItem(FILA))).toHaveLength(1);
}

describe('[testador T1] item 1 no hook', () => {
  let warn;
  beforeEach(() => {
    sessionStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
    vi.mocked(atendimentosApi.encerrar).mockResolvedValue({ atendimentoId: 'c-1', status: 'encerrado', procedimentos: [] });
  });
  afterEach(() => {
    warn.mockRestore();
    vi.resetAllMocks();
  });

  it('encerrar recusado por pendência não marca a consulta como "encerrada aqui": o ENCERRADO de outro aparelho ainda tira a tela', async () => {
    const onEncerradaEmOutroAparelho = vi.fn();
    const { result, avisos } = await montar({ onEncerradaEmOutroAparelho });
    await deixarEnvioPendente(result, 401);

    const erro = await act(async () => result.current.encerrar({ modo: 'COMPLETO' }).catch((e) => e));
    expect(erro?.codigo).toBe('ENVIO_PENDENTE');
    expect(atendimentosApi.encerrar).not.toHaveBeenCalled();

    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'encerrado', pacienteCpf: '52998224725' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.ENCERRADO', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();

    expect(onEncerradaEmOutroAparelho).toHaveBeenCalledTimes(1);
    expect(result.current.atual).toBeNull();
  });

  it('401 no hook: não é tratado como recusa (sem aviso de descarte), tenta de novo depois de ~3000 ms e esvazia o storage', async () => {
    const { result } = await montar();
    vi.mocked(atendimentosApi.trocarModulo)
      .mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }))
      .mockResolvedValue({});
    act(() => result.current.trocarModulo('procedimento'));
    await esperar(50);
    await assentar();
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(FILA))).toHaveLength(1);

    await esperar(2500);
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);

    await esperar(800);
    await assentar();
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(FILA)).toBeNull();
    expect(warn.mock.calls.some((c) => String(c[0]).includes('Envio recusado'))).toBe(false);
    expect(result.current.atual?.id).toBe('c-1');
  }, 10000);

  it('401 em retentativa, saída (userId null) e novo login da mesma pessoa: a fila em segundo plano retoma e envia', async () => {
    const { result, rerender, props } = await montar();
    await deixarEnvioPendente(result, 401);

    rerender({ ...props, userId: null });
    await assentar();
    expect(JSON.parse(sessionStorage.getItem(FILA))).toHaveLength(1);
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);

    vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([dto()]);
    rerender({ ...props, userId: USUARIO, emConsulta: false });
    await esperar(200);
    await assentar();

    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem(FILA)).toBeNull();
  }, 10000);
});
