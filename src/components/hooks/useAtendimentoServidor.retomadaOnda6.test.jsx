/**
 * Onda 6 (F1, F3, F4), hook e fila reais, so a API e falsa.
 * Regra do Johnn: ao abandonar, o que nao chegou ao servidor se perde.
 *  F1: controles: releitura "abandonado" ou 404 tiram a consulta da tela.
 *  F3: recusas 409 CONSULTA_ABANDONADA (corpo real) entram na contagem do aviso, sem a mensagem de "nao entrou".
 *  F4: um unico PUT de pendencia false por descarte; com envio em voo tambem sai o false.
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
const NAO_ENTROU = 'Sua alteração não foi salva: a consulta foi atualizada. Confira e digite novamente.';
const CORPO_ABANDONO = {
  error: 'CONSULTA_ABANDONADA',
  message: 'Esta consulta foi abandonada após 4 h sem atividade. Use Iniciar para retomar.',
  status: 409,
};
const erro = (status, body) => Object.assign(new Error(`HTTP ${status}`), { status, ...(body ? { body } : {}) });
const entradaItem = (n) => ({
  chave: `item:item-${n}:obs`, grupo: `item:item-${n}`, tipo: 'item',
  dados: { itemId: `item-${n}`, campos: { observacaoExecucao: `texto ${n}` } },
});
const dto = (extras) => ({
  id: 'c-1', pacienteId: PACIENTE, status: 'aberto', modulo: 'hub',
  itens: [1, 2, 3].map((n) => ({ id: `item-${n}`, nomeLivre: `Item ${n}` })), ...extras,
});
const diferido = () => {
  let resolver; let rejeitar;
  const promessa = new Promise((res, rej) => { resolver = res; rejeitar = rej; });
  return { promessa, resolver, rejeitar };
};
const guardadas = () => JSON.parse(sessionStorage.getItem(CHAVE) ?? '[]');
const pendencias = () => vi.mocked(atendimentosApi.pendencia).mock.calls.map((c) => c[1].pendente);

async function assentar() {
  await act(async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); });
}
async function esperar(ms) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

function montar({ onAbandonada = vi.fn(), ...props } = {}) {
  const avisos = criarAvisosFalsos();
  const avisar = vi.fn();
  const base = {
    habilitado: true, orgId: 'org-1', userId: USUARIO, emConsulta: true, pacienteId: PACIENTE, procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() }, onAbandonada, avisar, ...props,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  return { ...r, avisos, avisar, onAbandonada };
}
const abrirNormal = async (r) => {
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(dto());
  await act(async () => { await r.result.current.abrir({ pacienteId: PACIENTE }); });
  await assentar();
};
const avisoDaSessao = async (r) => {
  act(() => r.avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
  await esperar(400);
};
const mensagensNaoEntrou = (r) => r.avisar.mock.calls.filter((c) => c[1] === NAO_ENTROU).length;

describe('Onda 6', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.pendencia).mockResolvedValue(null);
    vi.mocked(atendimentosApi.alterarItem).mockResolvedValue({});
    vi.mocked(atendimentosApi.trocarModulo).mockResolvedValue({});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  describe('F1: releitura que volta "abandonado"', () => {
    it('controle: o mesmo "abandonado" tira a consulta da tela', async () => {
      const detalhe = diferido();
      vi.mocked(atendimentosApi.detalhe).mockReturnValue(detalhe.promessa);
      const r = montar();
      await assentar();
      await abrirNormal(r);
      await avisoDaSessao(r);
      await act(async () => { detalhe.resolver(dto({ status: 'abandonado' })); });
      await assentar();
      expect(r.onAbandonada).toHaveBeenCalledTimes(1);
      expect(r.result.current.atual).toBeNull();
    }, 15000);

    it('controle do catch: 404 do detalhe esquece a consulta', async () => {
      const detalhe = diferido();
      vi.mocked(atendimentosApi.detalhe).mockReturnValue(detalhe.promessa);
      const r = montar();
      await assentar();
      await abrirNormal(r);
      await avisoDaSessao(r);
      await act(async () => { detalhe.rejeitar(erro(404)); });
      await assentar();
      expect(r.result.current.atual).toBeNull();
    }, 15000);
  });
  describe('F3: recusas por abandono entram na contagem do aviso', () => {
    /** 3 entradas guardadas: as duas primeiras levam 409 CONSULTA_ABANDONADA; a terceira fica na fila (503). */
    async function tresEntradas() {
      sessionStorage.setItem(CHAVE, JSON.stringify([entradaItem(1), entradaItem(2), entradaItem(3)]));
      vi.mocked(atendimentosApi.alterarItem)
        .mockRejectedValueOnce(erro(409, CORPO_ABANDONO))
        .mockRejectedValueOnce(erro(409, CORPO_ABANDONO))
        .mockRejectedValue(erro(503));
      const detalhe = diferido();
      vi.mocked(atendimentosApi.detalhe).mockReturnValue(detalhe.promessa);
      const r = montar();
      await assentar();
      await abrirNormal(r);
      await esperar(200);
      expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(3);
      expect(atendimentosApi.detalhe).toHaveBeenCalled();
      return { r, detalhe };
    }

    it('detalhe "abandonado": aviso com 3 alteracoes e nenhuma mensagem de "nao entrou"', async () => {
      const { r, detalhe } = await tresEntradas();
      await act(async () => { detalhe.resolver(dto({ status: 'abandonado' })); });
      await assentar();
      expect(r.onAbandonada).toHaveBeenCalledTimes(1);
      expect(r.onAbandonada.mock.calls[0][0].pendentes).toBe(3);
      expect(mensagensNaoEntrou(r)).toBe(0);
    }, 15000);

    it('contador zera ao fechar: abrir de novo e reler "aberto" nao diz "nao entrou"', async () => {
      const { r, detalhe } = await tresEntradas();
      await act(async () => { detalhe.resolver(dto({ status: 'abandonado' })); });
      await assentar();
      expect(r.onAbandonada).toHaveBeenCalledTimes(1);
      await abrirNormal(r);
      vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto());
      await avisoDaSessao(r);
      await assentar();
      expect(mensagensNaoEntrou(r)).toBe(0);
    }, 15000);

  });

  describe('F4: PUT de pendencia no descarte', () => {
    async function abandonar(r) {
      vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ status: 'abandonado' }));
      await avisoDaSessao(r);
      await assentar();
      expect(r.onAbandonada).toHaveBeenCalledTimes(1);
      act(() => r.onAbandonada.mock.calls[0][0].descartarPendentes());
      await assentar();
    }

    it('fila com entrada parada (503): um unico PUT false por descarte', async () => {
      const r = montar();
      await assentar();
      await abrirNormal(r);
      vi.mocked(atendimentosApi.trocarModulo).mockRejectedValue(erro(503));
      act(() => r.result.current.trocarModulo('procedimento'));
      await esperar(100);
      expect(guardadas()).toHaveLength(1);
      expect(pendencias()).toContain(true);
      await abandonar(r);
      expect(sessionStorage.getItem(CHAVE)).toBeNull();
      expect(pendencias().filter((p) => p === false)).toHaveLength(1);
    }, 15000);

    it('envio EM VOO: tambem sai o PUT false (limpar nao o anuncia), uma vez so', async () => {
      const r = montar();
      await assentar();
      await abrirNormal(r);
      vi.mocked(atendimentosApi.trocarModulo).mockReturnValue(new Promise(() => {}));
      act(() => r.result.current.trocarModulo('procedimento'));
      await esperar(100);
      expect(pendencias().at(-1)).toBe(true);
      await abandonar(r);
      expect(pendencias().at(-1)).toBe(false);
      expect(pendencias().filter((p) => p === false)).toHaveLength(1);
    }, 15000);
  });
});
