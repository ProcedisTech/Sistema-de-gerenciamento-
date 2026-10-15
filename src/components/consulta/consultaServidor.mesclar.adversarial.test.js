/**
 * F3 (testador independente): mescla da sessão com a ordem do servidor, sem item fantasma, idempotente
 * e sem PATCH/criar espúrio depois de reordenar.
 */
import { describe, expect, it } from 'vitest';
import { baseDosItens, diferencasDosItens, mapearItensDaSessao, mesclarSessao } from './consultaServidor.js';

const item = (id, ordem, nome, extras = {}) => ({
  id,
  ordem,
  agendaId: null,
  nomeLivre: nome,
  catalogoProcedimentoSaudeId: null,
  observacaoExecucao: '',
  orientacoes: null,
  ...extras,
});
const linha = (itemId, nome, extras = {}) => ({
  ...(itemId ? { itemId } : {}),
  nomeProcedimento: nome,
  procedimentoNome: nome,
  observacoesExecucao: '',
  ...extras,
});
const nunca = () => false;
const ids = (s) => s.map((l) => l.itemId ?? null);

describe('mesclarSessao F3 adversarial', () => {
  it('reordenação com 4 itens: ordem final = ordem do servidor, nenhuma linha perde dados', () => {
    const itens = [item('a', 0, 'A'), item('b', 1, 'B'), item('c', 2, 'C'), item('d', 3, 'D')];
    const sessao = [
      linha('d', 'D', { observacoesExecucao: 'obs-d' }),
      linha('b', 'B'),
      linha('a', 'A'),
      linha('c', 'C'),
    ];
    const r = mesclarSessao(sessao, itens, (k) => k === 'item:d:obs');
    expect(r.mudou).toBe(true);
    expect(ids(r.sessao)).toEqual(['a', 'b', 'c', 'd']);
    expect(r.sessao[3].observacoesExecucao).toBe('obs-d');
    expect(r.sessao).toHaveLength(4);
  });

  it('item novo do servidor no meio entra na posição do servidor', () => {
    const itens = [item('a', 0, 'A'), item('x', 1, 'X'), item('c', 2, 'C')];
    const sessao = [linha('a', 'A'), linha('c', 'C')];
    const r = mesclarSessao(sessao, itens, nunca);
    expect(ids(r.sessao)).toEqual(['a', 'x', 'c']);
    expect(r.sessao[1].nomeProcedimento).toBe('X');
  });

  it('linha local sem itemId + outra com itemId: a sem id casa com o item livre, não com o da outra', () => {
    const itens = [item('i-1', 0, 'Botox'), item('i-2', 1, 'Peeling')];
    const sessao = [linha(null, 'Botox', { agendaId: 'ag-1' }), linha('i-2', 'Peeling')];
    expect(mapearItensDaSessao(sessao, itens)).toEqual(['i-1', 'i-2']);
    const r = mesclarSessao(sessao, itens, nunca);
    expect(r.sessao).toHaveLength(2);
    expect(ids(r.sessao)).toEqual(['i-1', 'i-2']);
  });

  it('linha sem id vem DEPOIS da com id mas o item livre tem ordem ANTES: ordem do servidor vence', () => {
    const itens = [item('i-1', 0, 'Botox'), item('i-2', 1, 'Peeling')];
    const sessao = [linha('i-2', 'Peeling'), linha(null, 'Botox')];
    const r = mesclarSessao(sessao, itens, nunca);
    expect(ids(r.sessao)).toEqual(['i-1', 'i-2']);
  });

  it('agenda local != null vs servidor sem agenda, 2 linhas livres: casa por posição, sem duplicar', () => {
    const itens = [item('i-1', 0, 'A'), item('i-2', 1, 'B')];
    const sessao = [linha(null, 'A', { agendaId: 'ag-1' }), linha(null, 'B', { agendaId: 'ag-2' })];
    expect(mapearItensDaSessao(sessao, itens)).toEqual(['i-1', 'i-2']);
    const r = mesclarSessao(sessao, itens, nunca);
    expect(r.sessao).toHaveLength(2);
    expect(ids(r.sessao)).toEqual(['i-1', 'i-2']);
    expect(r.sessao.map((l) => l.agendaId)).toEqual(['ag-1', 'ag-2']);
  });

  it('mais linhas locais livres que itens: a sobra fica local, sem id, e não vira item duplicado', () => {
    const itens = [item('i-1', 0, 'A')];
    const sessao = [linha(null, 'A', { agendaId: 'ag-1' }), linha(null, 'Extra')];
    const r = mesclarSessao(sessao, itens, nunca);
    expect(ids(r.sessao)).toEqual(['i-1', null]);
  });

  it('idempotente: 2ª chamada com o resultado da 1ª tem mudou=false e devolve a mesma referência', () => {
    const itens = [item('a', 0, 'A'), item('x', 1, 'X'), item('c', 2, 'C')];
    const sessao = [linha('c', 'C'), linha(null, 'A', { agendaId: 'ag-1' })];
    const r1 = mesclarSessao(sessao, itens, nunca);
    expect(r1.mudou).toBe(true);
    const r2 = mesclarSessao(r1.sessao, itens, nunca);
    expect(r2.mudou).toBe(false);
    expect(r2.sessao).toBe(r1.sessao);
    const r3 = mesclarSessao(r2.sessao, itens, nunca);
    expect(r3.mudou).toBe(false);
  });

  it('sessão já na ordem do servidor: mudou=false e mesma referência', () => {
    const itens = [item('a', 0, 'A'), item('b', 1, 'B')];
    const sessao = [linha('a', 'A'), linha('b', 'B')];
    const r = mesclarSessao(sessao, itens, nunca);
    expect(r.mudou).toBe(false);
    expect(r.sessao).toBe(sessao);
  });

  it('só a ordem mudou (conteúdo igual): mudou=true', () => {
    const itens = [item('a', 0, 'A'), item('b', 1, 'B')];
    const r = mesclarSessao([linha('b', 'B'), linha('a', 'A')], itens, nunca);
    expect(r.mudou).toBe(true);
    expect(ids(r.sessao)).toEqual(['a', 'b']);
  });
});

describe('diferencasDosItens depois de reordenar (sem PATCH/criar fantasma)', () => {
  it('após mesclar com reordenação e itens novos: nenhuma diferença e nenhum criar', () => {
    const itens = [item('a', 0, 'A'), item('x', 1, 'X'), item('c', 2, 'C'), item('d', 3, 'D')];
    const sessao = [linha('d', 'D'), linha(null, 'A', { agendaId: 'ag-1' }), linha('c', 'C')];
    const { sessao: out } = mesclarSessao(sessao, itens, nunca);
    const mapa = mapearItensDaSessao(out, itens);
    expect(mapa).toEqual(['a', 'x', 'c', 'd']);
    const d = diferencasDosItens(out, mapa, baseDosItens(itens));
    expect(d.alterar).toEqual([]);
    expect(d.criar).toEqual([]);
  });

  it('o PATCH de obs vai para o item certo (id), não para a posição antiga', () => {
    const itens = [item('a', 0, 'A'), item('b', 1, 'B')];
    const { sessao: out } = mesclarSessao([linha('b', 'B'), linha('a', 'A')], itens, nunca);
    const editada = out.map((l) => (l.itemId === 'b' ? { ...l, observacoesExecucao: 'novo' } : l));
    const d = diferencasDosItens(editada, mapearItensDaSessao(editada, itens), baseDosItens(itens));
    expect(d.criar).toEqual([]);
    expect(d.alterar).toEqual([{ itemId: 'b', campo: 'obs', campos: { observacaoExecucao: 'novo' } }]);
  });

  it('linha local realmente nova ainda gera criar com o índice dela (depois das ligadas)', () => {
    const itens = [item('a', 0, 'A')];
    const { sessao: out } = mesclarSessao([linha(null, 'Nova', { agendaId: 'ag-9' }), linha('a', 'A')], itens, nunca);
    expect(ids(out)).toEqual(['a', null]);
    const d = diferencasDosItens(out, mapearItensDaSessao(out, itens), baseDosItens(itens));
    expect(d.alterar).toEqual([]);
    expect(d.criar).toEqual([{ indice: 1, catalogoProcedimentoSaudeId: null, nomeLivre: 'Nova' }]);
  });
});
