/**
 * F6a: nova tentativa da releitura com espera crescente (rede/5xx), 403/404 sem tentar de novo, cancelamento da
 * tentativa pendente e descarte da releitura velha (envio da fila aceito enquanto o GET estava em voo).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { ESPERAS_RELEITURA_MS, useAtendimentoServidor } from './useAtendimentoServidor.js';

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

async function avancar(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function propsBase(extras) {
  return {
    habilitado: true,
    orgId: 'org-1',
    userId: 'u-1',
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    ...extras,
  };
}

async function montar(extras) {
  const avisos = criarAvisosFalsos();
  const r = renderHook((p) => useAtendimentoServidor(p), {
    initialProps: propsBase(extras),
    wrapper: avisos.Wrapper,
  });
  await avancar(10);
  await act(async () => {
    await r.result.current.abrir({ pacienteId: PACIENTE });
  });
  await avancar(10);
  return { ...r, avisos };
}

const erroRede = () => new TypeError('Failed to fetch');
const erro = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

describe('useAtendimentoServidor: releitura com nova tentativa (F6a)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('constante exportada com as esperas 1, 2, 5, 10 e 30 s', () => {
    expect(ESPERAS_RELEITURA_MS).toEqual([1000, 2000, 5000, 10000, 30000]);
  });

  it('(a) falha de rede 1x: nova tentativa em ~1 s e o dado e aplicado', async () => {
    const { result, avisos } = await montar();
    vi.mocked(atendimentosApi.detalhe)
      .mockRejectedValueOnce(erroRede())
      .mockResolvedValue(dto({ modulo: 'procedimento' }));

    avisos.emitirRecarregar();
    await avancar(300);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
    expect(result.current.atual.modulo).toBe('hub');

    await avancar(900);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
    await avancar(100);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(2);
    expect(result.current.atual.modulo).toBe('procedimento');

    // deu certo: nada mais agendado
    await avancar(60000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(2);
  });

  it('(a) falhas seguidas respeitam 1, 2 e 5 s (5xx conta como falha)', async () => {
    const { avisos } = await montar();
    vi.mocked(atendimentosApi.detalhe).mockRejectedValue(erro(503));

    avisos.emitirRecarregar();
    await avancar(300);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
    await avancar(1000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(2);
    await avancar(1900);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(2);
    await avancar(100);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(3);
    await avancar(4900);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(3);
    await avancar(100);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(4);
  });

  it('esperasReleituraMs injetado vale no lugar do padrao', async () => {
    const { avisos } = await montar({ esperasReleituraMs: [20] });
    vi.mocked(atendimentosApi.detalhe).mockRejectedValue(erroRede());
    avisos.emitirRecarregar();
    await avancar(300);
    const antes = vi.mocked(atendimentosApi.detalhe).mock.calls.length;
    await avancar(100);
    expect(vi.mocked(atendimentosApi.detalhe).mock.calls.length).toBeGreaterThan(antes + 1);
  });

  it.each([[404], [403]])('(b) %i nao tenta de novo: esquece a consulta', async (status) => {
    const { result, avisos } = await montar();
    vi.mocked(atendimentosApi.detalhe).mockRejectedValue(erro(status));

    avisos.emitirRecarregar();
    await avancar(300);
    expect(result.current.atual).toBeNull();
    await avancar(60000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
  });

  it('(c) esquecer a consulta cancela a nova tentativa pendente', async () => {
    const { result, avisos } = await montar();
    vi.mocked(atendimentosApi.detalhe).mockRejectedValue(erroRede());

    avisos.emitirRecarregar();
    await avancar(300);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
    act(() => result.current.esquecer());
    await avancar(60000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
  });

  it('(c) trocar de consulta cancela a nova tentativa da anterior', async () => {
    const { result, avisos } = await montar();
    vi.mocked(atendimentosApi.detalhe).mockRejectedValue(erroRede());
    avisos.emitirRecarregar();
    await avancar(300);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);

    act(() => result.current.adotar(dto({ id: 'c-2' })));
    await avancar(60000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
  });

  it('(c) desmontar cancela a nova tentativa pendente', async () => {
    const { unmount, avisos } = await montar();
    vi.mocked(atendimentosApi.detalhe).mockRejectedValue(erroRede());
    avisos.emitirRecarregar();
    await avancar(300);
    unmount();
    await avancar(60000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);
  });

  it('uma releitura nova (aviso) zera a contagem e a espera volta a 1 s', async () => {
    const { avisos } = await montar();
    vi.mocked(atendimentosApi.detalhe).mockRejectedValue(erroRede());
    avisos.emitirRecarregar();
    await avancar(300);
    await avancar(1000); // 2a chamada; a proxima espera seria 2 s
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(2);

    avisos.emitirRecarregar();
    await avancar(300);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(3);
    await avancar(1000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(4);
  });

  it('(d) envio concluido durante o GET: resposta velha descartada e UM novo GET (sem espera)', async () => {
    const { result, avisos } = await montar();
    let soltarVelha;
    vi.mocked(atendimentosApi.detalhe)
      .mockImplementationOnce(() => new Promise((r) => { soltarVelha = r; }))
      .mockResolvedValue(dto({ modulo: 'procedimento' }));
    vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});

    avisos.emitirRecarregar();
    await avancar(300);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(1);

    // o envio sai e e aceito enquanto o GET esta em voo
    act(() => result.current.trocarModulo('procedimento'));
    await avancar(500);
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(1);

    await act(async () => {
      soltarVelha(dto({ modulo: 'hub' }));
      await vi.advanceTimersByTimeAsync(0);
    });
    await avancar(10);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(2);
    expect(result.current.atual.modulo).toBe('procedimento');
    await avancar(60000);
    expect(atendimentosApi.detalhe).toHaveBeenCalledTimes(2);
  });
});
