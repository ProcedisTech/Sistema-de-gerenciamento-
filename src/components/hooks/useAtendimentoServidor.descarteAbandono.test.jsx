/**
 * Decisao do Johnn: ao abandonar, o que nao chegou ao servidor se perde, sempre (tambem fora da tela); retomar pelo
 * Iniciar nao reenvia nada do aparelho. Hook real, fila real, so a API e falsa.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { useAtendimentoServidor } from './useAtendimentoServidor.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: {
    abrir: vi.fn(), minhas: vi.fn(), detalhe: vi.fn(), trocarModulo: vi.fn(), novoItem: vi.fn(), alterarItem: vi.fn(),
    alterarAvaliacaoTexto: vi.fn(), salvarTermos: vi.fn(), substituirPeloPlano: vi.fn(), encerrar: vi.fn(), pendencia: vi.fn(),
  },
  termoAssinaturaApi: { criar: vi.fn() },
}));
const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const USUARIO = 'u-1';
const CHAVE = `procedi_consulta_fila_${USUARIO}_c-1`;
const ITEM = { chave: 'item:item-1:obs', grupo: 'item:item-1', tipo: 'item', dados: { itemId: 'item-1', campos: { observacaoExecucao: 'ab' } } };
const TEXTO = { chave: 'avaliacao:queixa', grupo: 'avaliacao', tipo: 'avaliacao', dados: { queixa: 'dor' } };
const dto = (extras) => ({ id: 'c-1', pacienteId: PACIENTE, status: 'aberto', modulo: 'hub', itens: [{ id: 'item-1', nomeLivre: 'Botox' }], ...extras });
const resumo = (status) => ({ id: 'c-1', pacienteId: PACIENTE, status });
const guardar = (...e) => sessionStorage.setItem(CHAVE, JSON.stringify(e));
const envios = () => [
  atendimentosApi.alterarItem, atendimentosApi.alterarAvaliacaoTexto, atendimentosApi.trocarModulo, atendimentosApi.novoItem,
].reduce((n, f) => n + f.mock.calls.length, 0);
const pendencias = () => vi.mocked(atendimentosApi.pendencia).mock.calls.map((c) => c[1].pendente);

async function assentar() {
  await act(async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); });
}
async function esperar(ms) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}
/** Passa debounce (700 ms) e retentativa (3 s) da fila. */
const alemDaRetentativa = () => esperar(3400);

function montar(props, { onAbandonada } = {}) {
  const avisos = criarAvisosFalsos();
  const base = {
    habilitado: true, orgId: 'org-1', userId: USUARIO, emConsulta: false, pacienteId: null, procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() }, onAbandonada, ...props,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  return { ...r, avisos, base };
}

describe('descarte ao abandonar (tambem fora da tela)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
    vi.mocked(atendimentosApi.alterarItem).mockResolvedValue({});
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockResolvedValue({});
    vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it.each(['abandonado'])('1. nao acompanhada (F5), minhas "%s": Iniciar abre outra consulta e nao reenvia nada e o storage fica vazio', async (status) => {
    guardar(ITEM, TEXTO);
    let soltar;
    vi.mocked(atendimentosApi.minhas).mockReturnValue(new Promise((r) => { soltar = () => r([resumo(status)]); }));
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto({ id: 'c-2' }));
    const { result } = montar();
    await assentar();
    await act(async () => { await result.current.abrir({ pacienteId: PACIENTE }); });
    await assentar();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo(status)]);
    await act(async () => { soltar(); });
    await assentar();
    await alemDaRetentativa();
    expect(envios()).toBe(0);
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  }, 15000);

  it('2. acompanhada fora da tela: abandono descarta (storage vazio) e o Iniciar seguinte nao reenvia', async () => {
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
    vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(Object.assign(new Error('x'), { status: 503 }));
    const onAbandonada = vi.fn(({ descartarPendentes }) => descartarPendentes());
    const { result, avisos } = montar({}, { onAbandonada });
    await assentar();
    await act(async () => { await result.current.abrir({ pacienteId: PACIENTE }); });
    await assentar();
    act(() => result.current.trocarModulo('procedimento'));
    await esperar(50);
    expect(JSON.parse(sessionStorage.getItem(CHAVE))).toHaveLength(1);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();
    expect(onAbandonada).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    const antes = atendimentosApi.trocarModulo.mock.calls.length;
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto({ id: 'c-2' }));
    await act(async () => { await result.current.abrir({ pacienteId: PACIENTE }); });
    await assentar();
    await alemDaRetentativa();
    expect(atendimentosApi.trocarModulo).toHaveBeenCalledTimes(antes);
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  }, 15000);

  it('3. fila em segundo plano viva (retentativa) e minhas volta "abandonado": fila parada, sem envio depois', async () => {
    guardar(ITEM);
    vi.mocked(atendimentosApi.alterarItem).mockRejectedValue(Object.assign(new Error('x'), { status: 503 }));
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo('aberto')]);
    const { result } = montar();
    await assentar();
    await esperar(100);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHAVE)).not.toBeNull();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo('abandonado')]);
    await act(async () => { await result.current.recarregarMinhas(); });
    await assentar();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    await alemDaRetentativa();
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
  }, 15000);

  it('4. minhas "abandonado" com guardado, sem Iniciar: storage vazio e pendencia desmarcada; cancelada e encerrada intactas; aberto reenvia', async () => {
    guardar(ITEM);
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo('abandonado')]);
    montar();
    await assentar();
    await esperar(100);
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    expect(envios()).toBe(0);
    // 6 (caminho sem fila em memoria): o servidor ouve pendente=false
    expect(vi.mocked(atendimentosApi.pendencia)).toHaveBeenCalledWith('c-1', expect.objectContaining({ pendente: false }), expect.anything());
  });

  it.each(['cancelado', 'encerrado'])('4. controle: "%s" com guardado fica intacto e nada e enviado', async (status) => {
    guardar(ITEM);
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo(status)]);
    montar();
    await assentar();
    await esperar(100);
    expect(JSON.parse(sessionStorage.getItem(CHAVE))).toHaveLength(1);
    expect(envios()).toBe(0);
  });

  it('4. controle: "aberto" com guardado segue reenviando', async () => {
    guardar(ITEM);
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo('aberto')]);
    montar();
    await assentar();
    await esperar(100);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });

  it('6. descartar com envio EM VOO desmarca a pendencia no servidor (declararPendencia false)', async () => {
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
    vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(new Promise(() => {}));
    const onAbandonada = vi.fn();
    const { result, avisos } = montar({ emConsulta: true, pacienteId: PACIENTE }, { onAbandonada });
    await assentar();
    await act(async () => { await result.current.abrir({ pacienteId: PACIENTE }); });
    await assentar();
    act(() => result.current.trocarModulo('procedimento'));
    await esperar(100);
    expect(pendencias()).toContain(true);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
    act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
    await esperar(400);
    await assentar();
    expect(pendencias().at(-1)).toBe(true);
    act(() => onAbandonada.mock.calls[0][0].descartarPendentes());
    await assentar();
    expect(vi.mocked(atendimentosApi.pendencia)).toHaveBeenLastCalledWith('c-1', expect.objectContaining({ pendente: false }), expect.anything());
  }, 15000);

  it('7. abrir aberta normal, mesmo id: o guardado e reenviado', async () => {
    guardar(ITEM);
    vi.mocked(atendimentosApi.minhas).mockReturnValue(new Promise(() => {}));
    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
    const { result } = montar();
    await assentar();
    await act(async () => { await result.current.abrir({ pacienteId: PACIENTE }); });
    await assentar();
    await esperar(100);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });
});
