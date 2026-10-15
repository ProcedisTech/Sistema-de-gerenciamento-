import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chaveDaFila, contarFilaGuardada, criarFilaConsulta, removerFilaGuardada, temFilaGuardada,
} from './filaConsulta.js';

const ID = 'c0000000-0000-4000-8000-000000000001';
const USUARIO = 'u0000000-0000-4000-8000-000000000001';
const OUTRO_USUARIO = 'u0000000-0000-4000-8000-000000000002';

function storageFalso(inicial = {}) {
  const mapa = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    key: (i) => [...mapa.keys()][i] ?? null,
    get length() {
      return mapa.size;
    },
    mapa,
  };
}

const ENTRADA_ITEM = { chave: 'item:1:obs', grupo: 'item:1', tipo: 'item', dados: { itemId: '1', campos: { observacaoExecucao: 'x' } } };
const ENTRADA_ITEM_NOVO = { chave: 'item:novo:0', grupo: 'item:novo', tipo: 'itemNovo', dados: { indice: 0, corpo: {} } };

function erro(status) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe('filaConsulta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('digitação: um envio só, com o último valor, depois do debounce', async () => {
    const executar = vi.fn().mockResolvedValue({});
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage: storageFalso() });

    for (const texto of ['a', 'ab', 'abc']) {
      fila.enfileirar({ chave: 'item:1:obs', tipo: 'item', dados: { obs: texto }, debounceMs: 700 });
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(executar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(700);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar.mock.calls[0][0].dados).toEqual({ obs: 'abc' });
  });

  it('mesmo grupo sai na ordem de entrada', async () => {
    const ordem = [];
    const executar = vi.fn(async (e) => {
      ordem.push(e.chave);
    });
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage: storageFalso() });
    fila.enfileirar({ chave: 'item:L1:novo', grupo: 'item:L1', tipo: 'itemNovo', dados: {}, debounceMs: 500 });
    fila.enfileirar({ chave: 'item:L1:obs', grupo: 'item:L1', tipo: 'item', dados: {} });

    await vi.advanceTimersByTimeAsync(600);
    expect(ordem).toEqual(['item:L1:novo', 'item:L1:obs']);
  });

  it('4xx definitivo tira a entrada da fila e avisa; 5xx tenta de novo', async () => {
    const onDescartada = vi.fn();
    const executar = vi.fn()
      .mockRejectedValueOnce(erro(409))
      .mockRejectedValueOnce(erro(503))
      .mockResolvedValue({});
    const storage = storageFalso();
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, onDescartada, storage });

    fila.enfileirar({ chave: 'a', tipo: 'item', dados: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(onDescartada).toHaveBeenCalledTimes(1);
    expect(fila.temPendente('a')).toBe(false);

    fila.enfileirar({ chave: 'b', tipo: 'item', dados: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(fila.temPendente('b')).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(executar).toHaveBeenCalledTimes(3);
    expect(fila.temPendente('b')).toBe(false);
    expect(storage.mapa.has(chaveDaFila(USUARIO, ID))).toBe(false);
  });

  it('401 = falha de rede: a entrada fica (mesma chave), sem onDescartada, espera 3000 ms e tenta de novo; no sucesso sai do storage', async () => {
    const onDescartada = vi.fn();
    const executar = vi.fn().mockRejectedValueOnce(erro(401)).mockResolvedValue({});
    const chave = chaveDaFila(USUARIO, ID);
    const storage = storageFalso({ [chave]: JSON.stringify([ENTRADA_ITEM]) });
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, onDescartada, storage });

    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(onDescartada).not.toHaveBeenCalled();
    expect(fila.temPendente(ENTRADA_ITEM.chave)).toBe(true);
    expect(JSON.parse(storage.mapa.get(chave))).toEqual([ENTRADA_ITEM]);

    // Antes dos 3000 ms, nada sai de novo.
    await vi.advanceTimersByTimeAsync(2999);
    expect(executar).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(executar).toHaveBeenCalledTimes(2);
    expect(executar.mock.calls[1][0]).toEqual(ENTRADA_ITEM);
    expect(onDescartada).not.toHaveBeenCalled();
    expect(fila.tamanho()).toBe(0);
    expect(storage.mapa.has(chave)).toBe(false);
  });

  it('401 e o esvaziar: resolve false na falha (não fica pendurado) e a fila continua tentando', async () => {
    const executar = vi.fn().mockRejectedValueOnce(erro(401)).mockResolvedValue({});
    const chave = chaveDaFila(USUARIO, ID);
    const storage = storageFalso({ [chave]: JSON.stringify([ENTRADA_ITEM]) });
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage });

    const primeiro = fila.esvaziar();
    await vi.advanceTimersByTimeAsync(0);
    await expect(primeiro).resolves.toBe(false);
    expect(JSON.parse(storage.mapa.get(chave))).toEqual([ENTRADA_ITEM]);

    await vi.advanceTimersByTimeAsync(3000);
    expect(executar).toHaveBeenCalledTimes(2);
    await expect(fila.esvaziar()).resolves.toBe(true);
    expect(storage.mapa.has(chave)).toBe(false);
  });

  it('401 seguido de saída (parar): a entrada fica intacta no storage, nenhum envio depois; o novo login da mesma pessoa envia', async () => {
    const onDescartada = vi.fn();
    const executar = vi.fn().mockRejectedValue(erro(401));
    const chave = chaveDaFila(USUARIO, ID);
    const storage = storageFalso({ [chave]: JSON.stringify([ENTRADA_ITEM]) });
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, onDescartada, storage });

    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    fila.parar();
    await vi.advanceTimersByTimeAsync(60000);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(onDescartada).not.toHaveBeenCalled();
    expect(JSON.parse(storage.mapa.get(chave))).toEqual([ENTRADA_ITEM]);

    const executarDepois = vi.fn().mockResolvedValue({});
    criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar: executarDepois, storage });
    await vi.advanceTimersByTimeAsync(10);
    expect(executarDepois.mock.calls.map(([e]) => e.chave)).toEqual([ENTRADA_ITEM.chave]);
    expect(storage.mapa.has(chave)).toBe(false);
  });

  it('tiposPendentes diz o que ainda não saiu (sem repetir), inclusive o que está em envio', async () => {
    let liberar;
    const executar = vi.fn(() => new Promise((r) => { liberar = r; }));
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage: storageFalso() });
    expect(fila.tiposPendentes()).toEqual([]);
    fila.enfileirar({ chave: 'item:1:obs', grupo: 'item:1', tipo: 'item', dados: 1 });
    fila.enfileirar({ chave: 'item:1:proc', grupo: 'item:1', tipo: 'item', dados: 2 });
    fila.enfileirar({ chave: 'item:novo:0', grupo: 'item:novo', tipo: 'itemNovo', dados: 3, debounceMs: 5000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(fila.tiposPendentes().sort()).toEqual(['item', 'itemNovo']);
    liberar({});
    await vi.advanceTimersByTimeAsync(0);
    liberar({});
    await vi.advanceTimersByTimeAsync(10);
    expect(fila.tiposPendentes()).toEqual(['itemNovo']);
  });

  it('guarda só o pendente e retoma depois de um F5', async () => {
    const storage = storageFalso();
    const parada = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar: vi.fn(), storage });
    parada.enfileirar({ chave: 'item:1:obs', tipo: 'item', dados: { obs: 'x' }, debounceMs: 700 });
    parada.parar();
    expect(JSON.parse(storage.mapa.get(chaveDaFila(USUARIO, ID)))).toEqual([
      { chave: 'item:1:obs', grupo: 'item:1:obs', tipo: 'item', dados: { obs: 'x' } },
    ]);

    const executar = vi.fn().mockResolvedValue({});
    criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage }).esvaziar();
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(storage.mapa.has(chaveDaFila(USUARIO, ID))).toBe(false);
  });

  it('esvaziar envia já, sem esperar o debounce', async () => {
    const executar = vi.fn().mockResolvedValue({});
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage: storageFalso() });
    fila.enfileirar({ chave: 'x', tipo: 'item', dados: 1, debounceMs: 5000 });

    const pronto = fila.esvaziar();
    await vi.advanceTimersByTimeAsync(0);
    await expect(pronto).resolves.toBe(true);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('F5: o que foi lido do storage sai sozinho, sem novo enfileirar nem esvaziar', async () => {
    const storage = storageFalso({ [chaveDaFila(USUARIO, ID)]: JSON.stringify([ENTRADA_ITEM]) });
    const executar = vi.fn().mockResolvedValue({});
    criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage });

    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(executar.mock.calls[0][0]).toEqual(ENTRADA_ITEM);
    expect(storage.mapa.has(chaveDaFila(USUARIO, ID))).toBe(false);
  });

  it('a fila é da pessoa: a de outra pessoa na mesma aba não é lida nem enviada', async () => {
    const guardada = JSON.stringify([ENTRADA_ITEM]);
    const storage = storageFalso({ [chaveDaFila(OUTRO_USUARIO, ID)]: guardada });
    const executar = vi.fn().mockResolvedValue({});

    expect(temFilaGuardada({ userId: USUARIO, atendimentoId: ID, storage })).toBe(false);
    expect(temFilaGuardada({ userId: OUTRO_USUARIO, atendimentoId: ID, storage })).toBe(true);
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage });
    await vi.advanceTimersByTimeAsync(5000);

    expect(executar).not.toHaveBeenCalled();
    expect(fila.tamanho()).toBe(0);
    expect(storage.mapa.get(chaveDaFila(OUTRO_USUARIO, ID))).toBe(guardada);
  });

  it('chave antiga (sem a pessoa) é removida na primeira leitura e nunca enviada', async () => {
    const antiga = `procedi_consulta_fila_${ID}`;
    const storage = storageFalso({ [antiga]: JSON.stringify([ENTRADA_ITEM]) });
    const executar = vi.fn().mockResolvedValue({});

    expect(temFilaGuardada({ userId: USUARIO, atendimentoId: ID, storage })).toBe(false);
    expect(storage.mapa.has(antiga)).toBe(false);

    storage.mapa.set(antiga, JSON.stringify([ENTRADA_ITEM]));
    criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage });
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.mapa.has(antiga)).toBe(false);
    expect(executar).not.toHaveBeenCalled();
  });

  it('sem a pessoa, a fila fica só em memória (nada vai ao storage)', async () => {
    const storage = storageFalso();
    const fila = criarFilaConsulta({ userId: null, atendimentoId: ID, executar: vi.fn(), storage });
    fila.enfileirar({ chave: 'x', tipo: 'item', dados: 1, debounceMs: 5000 });
    expect(storage.mapa.size).toBe(0);
    expect(fila.temPendente('x')).toBe(true);
  });

  it('podeEnviar segura a entrada (o resto do grupo espera) sem travar outros grupos; reagendar libera', async () => {
    const storage = storageFalso({ [chaveDaFila(USUARIO, ID)]: JSON.stringify([ENTRADA_ITEM_NOVO, ENTRADA_ITEM]) });
    let liberado = false;
    const executar = vi.fn().mockResolvedValue({});
    const fila = criarFilaConsulta({
      userId: USUARIO,
      atendimentoId: ID,
      executar,
      storage,
      podeEnviar: (e) => e.tipo !== 'itemNovo' || liberado,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(executar.mock.calls.map(([e]) => e.tipo)).toEqual(['item']);
    expect(fila.temPendente('item:novo')).toBe(true);
    // O esvaziar não fica preso no que está segurado.
    await expect(fila.esvaziar()).resolves.toBe(false);

    liberado = true;
    fila.reagendar();
    await vi.advanceTimersByTimeAsync(0);
    expect(executar.mock.calls.map(([e]) => e.tipo)).toEqual(['item', 'itemNovo']);
    expect(storage.mapa.has(chaveDaFila(USUARIO, ID))).toBe(false);
  });

  // --- Testador do item 1 ("401 apaga a fila") ---

  it.each([400, 403, 404, 409, 410, 422])('[testador] %i é definitivo: sai da fila, avisa onDescartada e não tenta de novo', async (status) => {
    const onDescartada = vi.fn();
    const executar = vi.fn().mockRejectedValue(erro(status));
    const chave = chaveDaFila(USUARIO, ID);
    const storage = storageFalso({ [chave]: JSON.stringify([ENTRADA_ITEM]) });
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, onDescartada, storage });

    await vi.advanceTimersByTimeAsync(10000);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(onDescartada).toHaveBeenCalledTimes(1);
    expect(onDescartada.mock.calls[0][1].status).toBe(status);
    expect(fila.temPendente(ENTRADA_ITEM.chave)).toBe(false);
    expect(storage.mapa.has(chave)).toBe(false);
  });

  it.each([408, 429, 500, 503])('[testador] %i é retentável: fica na fila, sem onDescartada, e sai na retentativa', async (status) => {
    const onDescartada = vi.fn();
    const executar = vi.fn().mockRejectedValueOnce(erro(status)).mockResolvedValue({});
    const chave = chaveDaFila(USUARIO, ID);
    const storage = storageFalso({ [chave]: JSON.stringify([ENTRADA_ITEM]) });
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, onDescartada, storage });

    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(fila.temPendente(ENTRADA_ITEM.chave)).toBe(true);
    expect(JSON.parse(storage.mapa.get(chave))).toEqual([ENTRADA_ITEM]);

    await vi.advanceTimersByTimeAsync(3000);
    expect(executar).toHaveBeenCalledTimes(2);
    expect(onDescartada).not.toHaveBeenCalled();
    expect(storage.mapa.has(chave)).toBe(false);
  });

  it('[testador] 401 durante o envio com versão nova da mesma chave: a versão nova fica e sai na retentativa (só ela)', async () => {
    let rejeitar;
    const executar = vi.fn()
      .mockImplementationOnce(() => new Promise((_, r) => { rejeitar = r; }))
      .mockResolvedValue({});
    const onDescartada = vi.fn();
    const chave = chaveDaFila(USUARIO, ID);
    const storage = storageFalso();
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, onDescartada, storage });

    fila.enfileirar({ chave: 'item:1:obs', grupo: 'item:1', tipo: 'item', dados: { obs: 'v1' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    // Enquanto o v1 está no ar, a pessoa digita v2.
    fila.enfileirar({ chave: 'item:1:obs', grupo: 'item:1', tipo: 'item', dados: { obs: 'v2' } });
    rejeitar(erro(401));
    await vi.advanceTimersByTimeAsync(0);

    expect(executar).toHaveBeenCalledTimes(1);
    expect(onDescartada).not.toHaveBeenCalled();
    expect(fila.tamanho()).toBe(1);
    expect(JSON.parse(storage.mapa.get(chave))).toEqual([
      { chave: 'item:1:obs', grupo: 'item:1', tipo: 'item', dados: { obs: 'v2' } },
    ]);

    await vi.advanceTimersByTimeAsync(3000);
    expect(executar).toHaveBeenCalledTimes(2);
    expect(executar.mock.calls[1][0].dados).toEqual({ obs: 'v2' });
    expect(onDescartada).not.toHaveBeenCalled();
    expect(storage.mapa.has(chave)).toBe(false);
  });

  it('[testador] 401 numa consulta não afeta a fila de outra consulta (mesma pessoa, mesmo storage)', async () => {
    const ID2 = 'c0000000-0000-4000-8000-000000000002';
    const chaveA = chaveDaFila(USUARIO, ID);
    const chaveB = chaveDaFila(USUARIO, ID2);
    const storage = storageFalso({
      [chaveA]: JSON.stringify([ENTRADA_ITEM]),
      [chaveB]: JSON.stringify([ENTRADA_ITEM]),
    });
    const executarA = vi.fn().mockRejectedValueOnce(erro(401)).mockResolvedValue({});
    const executarB = vi.fn().mockResolvedValue({});
    const filaA = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar: executarA, storage });
    const filaB = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID2, executar: executarB, storage });

    await vi.advanceTimersByTimeAsync(0);
    expect(executarA).toHaveBeenCalledTimes(1);
    expect(executarB).toHaveBeenCalledTimes(1);
    expect(storage.mapa.has(chaveB)).toBe(false);
    expect(JSON.parse(storage.mapa.get(chaveA))).toEqual([ENTRADA_ITEM]);

    // A outra consulta segue enviando normalmente, sem esperar a retentativa da primeira.
    filaB.enfileirar({ chave: 'modulo', tipo: 'modulo', dados: { modulo: 'hub' } });
    await vi.advanceTimersByTimeAsync(10);
    expect(executarB).toHaveBeenCalledTimes(2);
    expect(executarA).toHaveBeenCalledTimes(1);
    expect(filaA.tamanho()).toBe(1);

    // A primeira tenta de novo depois da espera e esvazia.
    await vi.advanceTimersByTimeAsync(3000);
    expect(executarA).toHaveBeenCalledTimes(2);
    expect(filaA.tamanho()).toBe(0);
    expect(storage.mapa.has(chaveA)).toBe(false);
  });

  it('[testador] 401 na primeira de dois grupos: esvaziar resolve false, nada sai durante a espera, depois as duas saem', async () => {
    const chave = chaveDaFila(USUARIO, ID);
    const storage = storageFalso({ [chave]: JSON.stringify([ENTRADA_ITEM, { ...ENTRADA_ITEM_NOVO }]) });
    const executar = vi.fn().mockRejectedValueOnce(erro(401)).mockResolvedValue({});
    const onDescartada = vi.fn();
    let resolvido = 'pendente';
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, onDescartada, storage });
    fila.esvaziar().then((ok) => { resolvido = ok; });

    await vi.advanceTimersByTimeAsync(2999);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(resolvido).toBe(false);
    expect(JSON.parse(storage.mapa.get(chave)).map((e) => e.chave)).toEqual([ENTRADA_ITEM.chave, ENTRADA_ITEM_NOVO.chave]);

    const vazia = fila.esvaziar();
    await vi.advanceTimersByTimeAsync(10);
    await expect(vazia).resolves.toBe(true);
    expect(executar.mock.calls.map(([e]) => e.chave)).toEqual([ENTRADA_ITEM.chave, ENTRADA_ITEM.chave, ENTRADA_ITEM_NOVO.chave]);
    expect(onDescartada).not.toHaveBeenCalled();
    expect(storage.mapa.has(chave)).toBe(false);
  });

  it('contarFilaGuardada e removerFilaGuardada: só a chave da pessoa e da consulta', () => {
    const chave = chaveDaFila(USUARIO, ID);
    const daOutra = chaveDaFila(OUTRO_USUARIO, ID);
    const storage = storageFalso({
      [chave]: JSON.stringify([ENTRADA_ITEM, ENTRADA_ITEM_NOVO]),
      [daOutra]: JSON.stringify([ENTRADA_ITEM]),
    });
    expect(contarFilaGuardada({ userId: USUARIO, atendimentoId: ID, storage })).toBe(2);
    expect(contarFilaGuardada({ userId: null, atendimentoId: ID, storage })).toBe(0);

    removerFilaGuardada({ userId: USUARIO, atendimentoId: ID, storage });
    expect(storage.mapa.has(chave)).toBe(false);
    expect(contarFilaGuardada({ userId: USUARIO, atendimentoId: ID, storage })).toBe(0);
    expect(storage.mapa.has(daOutra)).toBe(true);
  });

  it('onda 0: aoMudarPendencia dispara só na virada vazio ↔ com pendência, contando o envio em curso', async () => {
    let responder;
    const executar = vi.fn(() => new Promise((r) => {
      responder = r;
    }));
    const aoMudarPendencia = vi.fn();
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, aoMudarPendencia, storage: storageFalso() });
    expect(aoMudarPendencia).not.toHaveBeenCalled();

    fila.enfileirar({ chave: 'item:1:obs', tipo: 'item', dados: { obs: 'a' }, debounceMs: 100 });
    fila.enfileirar({ chave: 'item:1:obs', tipo: 'item', dados: { obs: 'ab' }, debounceMs: 100 });
    fila.enfileirar({ chave: 'modulo', tipo: 'modulo', dados: { modulo: 'hub' } });
    expect(aoMudarPendencia.mock.calls).toEqual([[true]]);

    // O módulo saiu para o servidor e ainda não respondeu: a pendência continua (nada dispara).
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    fila.descartar('item:');
    expect(fila.tamanho()).toBe(1);
    expect(aoMudarPendencia).toHaveBeenCalledTimes(1);

    responder({});
    await vi.advanceTimersByTimeAsync(0);
    expect(aoMudarPendencia.mock.calls).toEqual([[true], [false]]);

    fila.enfileirar({ chave: 'modulo', tipo: 'modulo', dados: { modulo: 'procedimento' } });
    expect(aoMudarPendencia.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('onda 0: a fila que nasce com entradas guardadas (F5) avisa a pendência ao nascer', () => {
    const storage = storageFalso({ [chaveDaFila(USUARIO, ID)]: JSON.stringify([ENTRADA_ITEM]) });
    const aoMudarPendencia = vi.fn();
    criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar: vi.fn().mockResolvedValue({}), aoMudarPendencia, storage });
    expect(aoMudarPendencia.mock.calls).toEqual([[true]]);
  });

  it('onda 0: enviosConcluidos conta só os envios aceitos pelo servidor (falha de rede e 4xx não contam)', async () => {
    const executar = vi.fn()
      .mockRejectedValueOnce(erro(503))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(erro(422))
      .mockResolvedValueOnce({});
    const fila = criarFilaConsulta({ userId: USUARIO, atendimentoId: ID, executar, storage: storageFalso() });
    expect(fila.enviosConcluidos()).toBe(0);

    fila.enfileirar({ chave: 'modulo', tipo: 'modulo', dados: { modulo: 'hub' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(fila.enviosConcluidos()).toBe(0);
    // Retentativa depois da espera: aceita.
    await vi.advanceTimersByTimeAsync(3000);
    expect(executar).toHaveBeenCalledTimes(2);
    expect(fila.enviosConcluidos()).toBe(1);

    fila.enfileirar({ chave: 'item:1:obs', tipo: 'item', dados: { obs: 'a' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(fila.enviosConcluidos()).toBe(1);
    fila.enfileirar({ chave: 'item:2:obs', tipo: 'item', dados: { obs: 'b' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(fila.enviosConcluidos()).toBe(2);
    expect(fila.tamanho()).toBe(0);
  });
});
