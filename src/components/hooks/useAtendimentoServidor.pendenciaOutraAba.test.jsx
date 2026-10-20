/**
 * F7 (lógica): declaração de pendência ao servidor, redeclaração a cada `conectado`, encerrar que espera a outra aba
 * da pessoa liberar os envios e alterações que não entraram (409 de consulta encerrada não descarta calado).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { ESPERA_OUTRA_ABA_MS, useAtendimentoServidor } from './useAtendimentoServidor.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: {
    abrir: vi.fn(),
    minhas: vi.fn(),
    detalhe: vi.fn(),
    trocarModulo: vi.fn(),
    novoItem: vi.fn(),
    alterarItem: vi.fn(),
    salvarTermos: vi.fn(),
    alterarAvaliacaoTexto: vi.fn(),
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
    pendencia: vi.fn(),
  },
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const USUARIO = 'u-1';
const ABA = 'aba-teste-1';
const FILA = `procedi_consulta_fila_${USUARIO}_c-1`;
const NAO_ENTRARAM = `procedi_consulta_naoentraram_${USUARIO}_c-1`;
const dto = (extras) => ({ id: 'c-1', pacienteId: PACIENTE, status: 'aberto', modulo: 'hub', itens: [], ...extras });
const erroHttp = (status, body) => Object.assign(new Error(`[HTTP ${status}]`), { status, body });
const erroRede = () => new Error('Failed to fetch');
const CONSULTA_FECHADA = () => erroHttp(409, { error: 'Esta consulta já foi fechada.', status: 409 });
const OUTRA_ABA = () => erroHttp(409, {
  error: 'ENVIO_PENDENTE_OUTRA_ABA',
  message: 'Há envios pendentes em outro aparelho',
  status: 409,
});

/** Promessa que o teste resolve/rejeita quando quiser. */
function segurada() {
  let resolve;
  let reject;
  const promessa = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promessa, resolve, reject };
}

async function andar(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function montar(props) {
  const avisos = criarAvisosFalsos();
  const avisar = vi.fn();
  const base = {
    habilitado: true,
    orgId: 'org-1',
    userId: USUARIO,
    emConsulta: false,
    pacienteId: null,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    idDaAba: () => ABA,
    avisar,
    ...props,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  const emitir = (msg) => act(() => {
    for (const f of Array.from(avisos.inscritos)) f(msg);
  });
  return { ...r, avisos, avisar, emitir, base };
}

const chamadasPendencia = () => vi.mocked(atendimentosApi.pendencia).mock.calls.map(([id, corpo, opcoes]) => ({
  id,
  pendente: corpo.pendente,
  seq: corpo.seq,
  abaId: opcoes.abaId,
}));

async function abrirConsulta(r) {
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
  await act(async () => {
    await r.result.current.abrir({ pacienteId: PACIENTE });
  });
}

describe('useAtendimentoServidor: pendência declarada ao servidor (F7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
    vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('a: uma declaração por virada vazio/com pendência, com seq crescente e X-Aba-Id', async () => {
    const envio = segurada();
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(envio.promessa);
    const r = montar();
    await abrirConsulta(r);
    await andar(0);
    expect(chamadasPendencia()).toEqual([]);

    act(() => {
      r.result.current.trocarModulo('anamnese');
    });
    await andar(0);
    // Segundo clique enquanto há envio: não é virada.
    act(() => {
      r.result.current.trocarModulo('hub');
    });
    await andar(0);
    expect(chamadasPendencia()).toHaveLength(1);
    expect(chamadasPendencia()[0]).toMatchObject({ id: 'c-1', pendente: true, abaId: ABA });

    await act(async () => {
      envio.resolve({});
      vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});
    });
    await andar(10);
    const todas = chamadasPendencia();
    expect(todas.map((c) => c.pendente)).toEqual([true, false]);
    expect(todas[1].seq).toBeGreaterThan(todas[0].seq);
  });

  it('a: sem rede a declaração retenta em 1 s, 2 s... e a última declaração por consulta vence', async () => {
    vi.mocked(atendimentosApi.pendencia)
      .mockRejectedValueOnce(erroRede())
      .mockRejectedValueOnce(erroRede())
      .mockResolvedValue(null);
    const envio = segurada();
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(envio.promessa);
    const r = montar();
    await abrirConsulta(r);
    act(() => {
      r.result.current.trocarModulo('anamnese');
    });
    await andar(0);
    expect(chamadasPendencia()).toHaveLength(1);
    await andar(999);
    expect(chamadasPendencia()).toHaveLength(1);
    await andar(1);
    expect(chamadasPendencia()).toHaveLength(2);
    await andar(1999);
    expect(chamadasPendencia()).toHaveLength(2);
    await andar(1);
    expect(chamadasPendencia()).toHaveLength(3);
    expect(chamadasPendencia().every((c) => c.pendente === true)).toBe(true);
    // Sem novas tentativas depois do sucesso.
    await andar(60000);
    expect(chamadasPendencia()).toHaveLength(3);

    // A fila esvazia: a declaração `false` é a última.
    envio.resolve({});
    await andar(10);
    expect(chamadasPendencia().at(-1)).toMatchObject({ pendente: false });
  });

  it('a: declaração antiga que está retentando não reenvia quando há uma mais nova', async () => {
    vi.mocked(atendimentosApi.pendencia).mockRejectedValueOnce(erroRede()).mockResolvedValue(null);
    const envio = segurada();
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(envio.promessa);
    const r = montar();
    await abrirConsulta(r);
    act(() => {
      r.result.current.trocarModulo('anamnese');
    });
    await andar(0);
    expect(chamadasPendencia()).toHaveLength(1);
    envio.resolve({});
    await andar(10);
    expect(chamadasPendencia().map((c) => c.pendente)).toEqual([true, false]);
    await andar(60000);
    // O `true` que estava para retentar não saiu de novo.
    expect(chamadasPendencia().map((c) => c.pendente)).toEqual([true, false]);
  });

  it('a: esquecer a consulta cancela as novas tentativas (sem PUT)', async () => {
    vi.mocked(atendimentosApi.pendencia).mockRejectedValue(erroRede());
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(segurada().promessa);
    const r = montar();
    await abrirConsulta(r);
    act(() => {
      r.result.current.trocarModulo('anamnese');
    });
    await andar(0);
    expect(chamadasPendencia()).toHaveLength(1);
    act(() => {
      r.result.current.esquecer();
    });
    await andar(60000);
    expect(chamadasPendencia()).toHaveLength(1);
  });

  it('a: 409/403/404 param (consulta fechada ou esquecida): sem nova tentativa', async () => {
    vi.mocked(atendimentosApi.pendencia).mockRejectedValue(erroHttp(409, { error: 'Esta consulta já foi fechada.' }));
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(segurada().promessa);
    const r = montar();
    await abrirConsulta(r);
    act(() => {
      r.result.current.trocarModulo('anamnese');
    });
    await andar(60000);
    expect(chamadasPendencia()).toHaveLength(1);
  });

  it('b: a cada `conectado` redeclara pendente:true quando há fila', async () => {
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(segurada().promessa);
    const r = montar();
    await abrirConsulta(r);
    act(() => {
      r.result.current.trocarModulo('anamnese');
    });
    await andar(0);
    expect(chamadasPendencia()).toHaveLength(1);

    r.emitir({ tipo: 'conectado', primeiro: false });
    await andar(0);
    const todas = chamadasPendencia();
    expect(todas).toHaveLength(2);
    expect(todas[1]).toMatchObject({ id: 'c-1', pendente: true, abaId: ABA });
    expect(todas[1].seq).toBeGreaterThan(todas[0].seq);
  });

  it('b: no `conectado`, se a última declarada foi true e a fila está vazia, declara pendente:false', async () => {
    const envio = segurada();
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(envio.promessa);
    const r = montar();
    await abrirConsulta(r);
    act(() => {
      r.result.current.trocarModulo('anamnese');
    });
    await andar(0);
    expect(chamadasPendencia().map((c) => c.pendente)).toEqual([true]);

    // Esvazia, mas a declaração `false` não chega (sem rede): o servidor ainda acha que há pendência.
    vi.mocked(atendimentosApi.pendencia).mockRejectedValueOnce(erroRede());
    envio.resolve({});
    await andar(10);
    expect(chamadasPendencia().map((c) => c.pendente)).toEqual([true, false]);

    r.emitir({ tipo: 'conectado', primeiro: false });
    await andar(0);
    const todas = chamadasPendencia();
    expect(todas.map((c) => c.pendente)).toEqual([true, false, false]);
    expect(todas[2].seq).toBeGreaterThan(todas[1].seq);
    // A nova declaração foi aceita: a retentativa antiga não reenvia.
    await andar(60000);
    expect(chamadasPendencia()).toHaveLength(3);
  });

  it('b: `conectado` sem pendência nenhuma não declara nada', async () => {
    const r = montar();
    await abrirConsulta(r);
    r.emitir({ tipo: 'conectado', primeiro: true });
    await andar(0);
    expect(chamadasPendencia()).toEqual([]);
  });
});

describe('useAtendimentoServidor: encerrarAguardandoOutraAba (F7)', () => {
  beforeEach(() => {
    vi.mocked(atendimentosApi.encerrar).mockReset();
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('a constante é 10 s', () => {
    expect(ESPERA_OUTRA_ABA_MS).toBe(10000);
  });

  it('encerrar manda X-Aba-Id e marca o 409 como ENVIO_PENDENTE_OUTRA_ABA', async () => {
    vi.mocked(atendimentosApi.encerrar).mockRejectedValue(OUTRA_ABA());
    const r = montar();
    await abrirConsulta(r);
    let erro = null;
    await act(async () => {
      await r.result.current.encerrar({ modo: 'COMPLETO' }).catch((e) => {
        erro = e;
      });
    });
    expect(erro?.codigo).toBe('ENVIO_PENDENTE_OUTRA_ABA');
    expect(atendimentosApi.encerrar).toHaveBeenCalledWith('c-1', expect.any(Object), { abaId: ABA });
  });

  it('c: 409 liga esperandoOutraAba e avisa uma vez; pendencia-liberada tenta de novo e conclui', async () => {
    vi.mocked(atendimentosApi.encerrar)
      .mockRejectedValueOnce(OUTRA_ABA())
      .mockResolvedValueOnce({ procedimentos: [] });
    const r = montar();
    await abrirConsulta(r);
    let resultado;
    let promessa;
    await act(async () => {
      promessa = r.result.current.encerrarAguardandoOutraAba({ modo: 'COMPLETO' }).then((x) => {
        resultado = x;
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(r.result.current.esperandoOutraAba).toBe(true);
    expect(r.avisar).toHaveBeenCalledTimes(1);
    expect(r.avisar).toHaveBeenCalledWith('warning', 'Há envios pendentes em outro aparelho');
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);

    // Mensagem de outra consulta não acorda.
    r.emitir({ tipo: 'pendencia-liberada', atendimentoId: 'outra' });
    await andar(0);
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);

    r.emitir({ tipo: 'pendencia-liberada', atendimentoId: 'c-1' });
    await act(async () => {
      await promessa;
    });
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual({ procedimentos: [] });
    expect(r.result.current.esperandoOutraAba).toBe(false);
    expect(r.avisar).toHaveBeenCalledTimes(1);
  });

  it('c: sem mensagem, tenta de novo em 10 s (repete) e o aviso sai uma vez só', async () => {
    vi.mocked(atendimentosApi.encerrar)
      .mockRejectedValueOnce(OUTRA_ABA())
      .mockRejectedValueOnce(OUTRA_ABA())
      .mockResolvedValueOnce({ ok: true });
    const r = montar();
    await abrirConsulta(r);
    let resultado;
    let promessa;
    await act(async () => {
      promessa = r.result.current.encerrarAguardandoOutraAba({ modo: 'COMPLETO' }).then((x) => {
        resultado = x;
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);
    await andar(9999);
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);
    await andar(1);
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(2);
    expect(r.result.current.esperandoOutraAba).toBe(true);
    await andar(10000);
    await act(async () => {
      await promessa;
    });
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(3);
    expect(resultado).toEqual({ ok: true });
    expect(r.avisar).toHaveBeenCalledTimes(1);
    expect(r.result.current.esperandoOutraAba).toBe(false);
  });

  it('c: outro erro propaga sem esperar', async () => {
    vi.mocked(atendimentosApi.encerrar).mockRejectedValue(erroHttp(500, { error: 'boom' }));
    const r = montar();
    await abrirConsulta(r);
    let erro = null;
    await act(async () => {
      await r.result.current.encerrarAguardandoOutraAba({ modo: 'COMPLETO' }).catch((e) => {
        erro = e;
      });
    });
    expect(erro?.status).toBe(500);
    expect(r.avisar).not.toHaveBeenCalled();
    expect(r.result.current.esperandoOutraAba).toBe(false);
  });

  it('c: cancelarEsperaOutraAba rejeita com ESPERA_CANCELADA e não tenta de novo', async () => {
    vi.mocked(atendimentosApi.encerrar).mockRejectedValue(OUTRA_ABA());
    const r = montar();
    await abrirConsulta(r);
    let erro = null;
    let promessa;
    await act(async () => {
      promessa = r.result.current.encerrarAguardandoOutraAba({ modo: 'COMPLETO' }).catch((e) => {
        erro = e;
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(r.result.current.esperandoOutraAba).toBe(true);
    act(() => {
      r.result.current.cancelarEsperaOutraAba();
    });
    await act(async () => {
      await promessa;
    });
    expect(erro?.codigo).toBe('ESPERA_CANCELADA');
    expect(r.result.current.esperandoOutraAba).toBe(false);
    await andar(30000);
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);
  });

  it('c: esquecer a consulta e desmontar também cancelam a espera', async () => {
    vi.mocked(atendimentosApi.encerrar).mockRejectedValue(OUTRA_ABA());
    const r = montar();
    await abrirConsulta(r);
    let erro = null;
    let promessa;
    await act(async () => {
      promessa = r.result.current.encerrarAguardandoOutraAba({ modo: 'COMPLETO' }).catch((e) => {
        erro = e;
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    r.unmount();
    await act(async () => {
      await promessa;
    });
    expect(erro?.codigo).toBe('ESPERA_CANCELADA');
    expect(atendimentosApi.encerrar).toHaveBeenCalledTimes(1);
  });
});

describe('useAtendimentoServidor: alterações que não entraram (F7)', () => {
  const ENVIO_OBS = {
    chave: 'item:item-1:obs',
    grupo: 'item:item-1',
    tipo: 'item',
    dados: { itemId: 'item-1', campos: { observacaoExecucao: 'texto que a pessoa digitou' } },
  };
  const ENVIO_QUEIXA = {
    chave: 'avaliacao:queixa',
    grupo: 'avaliacao:queixa',
    tipo: 'avaliacao',
    dados: { queixa: 'rugas na testa' },
  };

  async function assentar() {
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
    });
  }

  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([{ id: 'c-1', pacienteId: PACIENTE, status: 'aberto' }]);
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('d: PATCH com 409 de consulta fechada vai para alteracoesNaoEntraram, persiste e sobrevive ao remount', async () => {
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(CONSULTA_FECHADA());
    sessionStorage.setItem(FILA, JSON.stringify([ENVIO_OBS]));
    const r = montar();
    await assentar();
    await assentar();

    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    const ne = r.result.current.alteracoesNaoEntraram;
    expect(ne.quantidade).toBe(1);
    expect(ne.itens[0]).toMatchObject({
      chave: 'item:item-1:obs',
      tipo: 'item',
      rotulo: expect.stringMatching(/^Observação do procedimento/),
      texto: 'texto que a pessoa digitou',
    });
    expect(ne.textoParaCopiar).toContain('texto que a pessoa digitou');
    // A fila não retenta nem guarda mais a entrada; o texto está guardado em outra chave.
    expect(sessionStorage.getItem(FILA)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(NAO_ENTRARAM))).toHaveLength(1);

    // F5: remonta com o mesmo storage; a consulta já não está em `minhas`.
    r.unmount();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    const r2 = montar();
    await assentar();
    expect(r2.result.current.alteracoesNaoEntraram.quantidade).toBe(1);
    expect(r2.result.current.alteracoesNaoEntraram.itens[0].texto).toBe('texto que a pessoa digitou');
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
  });

  it('d: avaliação com 409 fechada: rótulo "Queixa"; descartar limpa memória e storage', async () => {
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockRejectedValue(CONSULTA_FECHADA());
    sessionStorage.setItem(FILA, JSON.stringify([ENVIO_QUEIXA]));
    const r = montar();
    await assentar();
    await assentar();
    expect(r.result.current.alteracoesNaoEntraram.itens[0]).toMatchObject({ rotulo: 'Queixa', texto: 'rugas na testa' });

    act(() => {
      r.result.current.descartarAlteracoesNaoEntraram();
    });
    expect(r.result.current.alteracoesNaoEntraram).toBeNull();
    expect(sessionStorage.getItem(NAO_ENTRARAM)).toBeNull();
  });

  it('d: copiar usa o clipboard e devolve true; sem clipboard devolve false sem erro', async () => {
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(CONSULTA_FECHADA());
    sessionStorage.setItem(FILA, JSON.stringify([ENVIO_OBS]));
    const r = montar();
    await assentar();
    await assentar();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    let ok;
    await act(async () => {
      ok = await r.result.current.copiarAlteracoesNaoEntraram();
    });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith(r.result.current.alteracoesNaoEntraram.textoParaCopiar);

    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await act(async () => {
      ok = await r.result.current.copiarAlteracoesNaoEntraram();
    });
    expect(ok).toBe(false);
  });

  it('d: outro 4xx definitivo (422) descarta como antes, sem alteracoesNaoEntraram', async () => {
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(erroHttp(422, { error: 'inválido' }));
    sessionStorage.setItem(FILA, JSON.stringify([ENVIO_OBS]));
    const r = montar();
    await assentar();
    await assentar();
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(r.result.current.alteracoesNaoEntraram).toBeNull();
    expect(sessionStorage.getItem(FILA)).toBeNull();
    expect(sessionStorage.getItem(NAO_ENTRARAM)).toBeNull();
  });

  it('d: 409 que não é de consulta fechada (outro motivo) também descarta como antes', async () => {
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(erroHttp(409, { error: 'conflito qualquer' }));
    sessionStorage.setItem(FILA, JSON.stringify([ENVIO_OBS]));
    const r = montar();
    await assentar();
    await assentar();
    expect(r.result.current.alteracoesNaoEntraram).toBeNull();
  });
});
