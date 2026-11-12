/**
 * Onda 7 (P2), hook e fila reais, so a API e falsa.
 * Regra do Johnn: ao abandonar, o que nao chegou ao servidor se perde; o que foi digitado DEPOIS da retomada nunca se perde.
 * Um GET /minhas antigo, pendurado, com A "abandonado", nao pode descartar o texto guardado de A depois da retomada,
 * mesmo quando A ja nao e a consulta acompanhada (a pessoa abriu B).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { useAtendimentoServidor } from './useAtendimentoServidor.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: {
    abrir: vi.fn(), minhas: vi.fn(), detalhe: vi.fn(), trocarModulo: vi.fn(), novoItem: vi.fn(), alterarItem: vi.fn(),
    alterarAvaliacaoTexto: vi.fn(), salvarTermos: vi.fn(), substituirPeloPlano: vi.fn(), encerrar: vi.fn(), pendencia: vi.fn(), presenca: vi.fn(),
  },
  termoAssinaturaApi: { criar: vi.fn() },
}));
const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const USUARIO = 'u-1';
const CHAVE_A = `procedi_consulta_fila_${USUARIO}_c-1`;
const erro = (status) => Object.assign(new Error(`HTTP ${status}`), { status });
const dto = (id, extras) => ({
  id, pacienteId: PACIENTE, status: 'aberto', modulo: 'hub', itens: [{ id: `${id}-i1`, nomeLivre: 'Item 1' }], ...extras,
});
const guardadasDeA = () => JSON.parse(sessionStorage.getItem(CHAVE_A) ?? '[]');
const pendenciasDeA = () => vi.mocked(atendimentosApi.pendencia).mock.calls
  .filter((c) => c[0] === 'c-1').map((c) => c[1].pendente);

async function assentar() {
  await act(async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); });
}
async function esperar(ms) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

describe('Onda 7 (P2): GET /minhas velho nao descarta o texto novo', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
    vi.mocked(atendimentosApi.alterarItem).mockResolvedValue({});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  async function montarComMinhasPendurada() {
    let soltarVelha;
    const velha = new Promise((res) => { soltarVelha = res; });
    vi.mocked(atendimentosApi.minhas).mockReturnValueOnce(velha).mockResolvedValue([]);
    const avisos = criarAvisosFalsos();
    const r = renderHook((p) => useAtendimentoServidor(p), {
      initialProps: {
        habilitado: true, orgId: 'org-1', userId: USUARIO, emConsulta: true, pacienteId: PACIENTE, procedimentosSessao: [],
        aparelho: { setProcedimentosSessao: vi.fn() }, onAbandonada: vi.fn(), avisar: vi.fn(),
      },
      wrapper: avisos.Wrapper,
    });
    await assentar();
    expect(atendimentosApi.minhas).toHaveBeenCalledTimes(1);
    return { r, soltarVelha };
  }

  it('A retomada, texto guardado (503), abre B, resposta velha com A "abandonado": o guardado de A fica', async () => {
    const { r, soltarVelha } = await montarComMinhasPendurada();

    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto('c-1'));
    await act(async () => { await r.result.current.abrir({ pacienteId: PACIENTE }); });
    await assentar();
    vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(erro(503));
    act(() => r.result.current.trocarModulo('procedimento'));
    await esperar(100);
    expect(guardadasDeA()).toHaveLength(1);

    vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto('c-2'));
    await act(async () => { await r.result.current.abrir({ pacienteId: PACIENTE }); });
    await assentar();
    expect(r.result.current.atual?.id).toBe('c-2');
    expect(guardadasDeA()).toHaveLength(1);
    const pendenciasAntes = pendenciasDeA().length;

    await act(async () => { soltarVelha([{ id: 'c-1', status: 'abandonado' }]); });
    await assentar();
    await esperar(50);

    expect(guardadasDeA()).toHaveLength(1);
    expect(pendenciasDeA().slice(pendenciasAntes)).not.toContain(false);
    // a lista velha nao entrou: A nao aparece como abandonada em `minhas`
    expect(r.result.current.minhas).toEqual([]);
  }, 15000);

  it('controle: a resposta do ULTIMO pedido continua valendo e aplica a lista', async () => {
    const { r, soltarVelha } = await montarComMinhasPendurada();
    await act(async () => { soltarVelha([{ id: 'c-9', status: 'aberto' }]); });
    await assentar();
    expect(r.result.current.minhas).toEqual([{ id: 'c-9', status: 'aberto' }]);
    expect(r.result.current.minhasCarregadas).toBe(true);
  }, 15000);
});

describe('presenca: confirmarPresenca e reler', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    sessionStorage.clear();
  });
  const linha = (id, presencaAte) => ({ id, pacienteId: PACIENTE, status: 'aberto', presencaAte });

  it('aplica o prazo novo so na linha do id e uma minhas velha em voo nao traz o prazo antigo de volta', async () => {
    let soltarVelha;
    const velha = new Promise((res) => { soltarVelha = res; });
    vi.mocked(atendimentosApi.minhas).mockResolvedValueOnce([linha('c-1', 'PRAZO-0'), linha('c-2', 'PRAZO-X')]);
    const avisos = criarAvisosFalsos();
    const r = renderHook((p) => useAtendimentoServidor(p), {
      initialProps: {
        habilitado: true, orgId: 'org-1', userId: USUARIO, emConsulta: false, pacienteId: null, procedimentosSessao: [],
        aparelho: { setProcedimentosSessao: vi.fn() }, onAbandonada: vi.fn(), avisar: vi.fn(),
      },
      wrapper: avisos.Wrapper,
    });
    await assentar();
    expect(r.result.current.minhas.map((c) => c.presencaAte)).toEqual(['PRAZO-0', 'PRAZO-X']);

    vi.mocked(atendimentosApi.minhas).mockReturnValueOnce(velha);
    let releitura;
    act(() => { releitura = r.result.current.reler(); });
    expect(typeof releitura.then).toBe('function');
    atendimentosApi.presenca.mockResolvedValue({ presencaAte: 'PRAZO-1' });
    await act(async () => { await r.result.current.confirmarPresenca('c-1'); });
    expect(atendimentosApi.presenca).toHaveBeenCalledWith('c-1');
    expect(r.result.current.minhas.map((c) => c.presencaAte)).toEqual(['PRAZO-1', 'PRAZO-X']);

    await act(async () => { soltarVelha([linha('c-1', 'PRAZO-0'), linha('c-2', 'PRAZO-X')]); await releitura; });
    await assentar();
    expect(r.result.current.minhas.map((c) => c.presencaAte)).toEqual(['PRAZO-1', 'PRAZO-X']);
  });
});
