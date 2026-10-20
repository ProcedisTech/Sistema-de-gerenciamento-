/**
 * F5b: a mescla pura da sessão com o detalhe do servidor.
 * - a linha é ligada ao item pelo `itemId`; linha com `itemId` cujo item sumiu é removida; linha sem id fica;
 * - observação vazia do servidor é aplicada (salvo `pendente('item:{id}:obs')`);
 * - `orient` do servidor (nula ou lista) entra na linha (salvo `pendente('item:{id}:orient')`);
 * - `diferencasDosItens` gera `orient` com a lista inteira e `imediato` só quando mudou apenas o `checado`.
 */
import { describe, expect, it } from 'vitest';
import {
  baseDosItens,
  diferencasDosItens,
  itensSemOrientacaoMarcada,
  linhaDoItemServidor,
  mapearItensDaSessao,
  mesclarSessao,
  orientacoesPorItemParaPadrao,
} from './consultaServidor.js';

const item = (id, extras = {}) => ({
  id,
  ordem: 0,
  agendaId: null,
  nomeLivre: null,
  catalogoProcedimentoSaudeId: null,
  observacaoExecucao: '',
  orientacoes: null,
  ...extras,
});
const EVITAR_SOL = { descricao: 'Evitar sol', checado: false, ordem: 0 };
const NAO_DEITAR = { descricao: 'Não deitar', checado: false, ordem: 1 };
const nunca = () => false;

describe('mesclarSessao (F5b)', () => {
  it('liga a linha ao item pelo itemId (não pela posição) e grava o id na linha que ainda não tinha', () => {
    const itens = [item('i-1', { ordem: 0, nomeLivre: 'Botox' }), item('i-2', { ordem: 1, nomeLivre: 'Peeling' })];
    // A sessão está na ordem inversa: a linha do i-2 vem primeiro e a ligação continua pelo id.
    const sessao = [
      { itemId: 'i-2', nomeProcedimento: 'Peeling', observacoesExecucao: '' },
      { itemId: 'i-1', nomeProcedimento: 'Botox', observacoesExecucao: '' },
    ];
    expect(mapearItensDaSessao(sessao, itens)).toEqual(['i-2', 'i-1']);
    // F3: a ordem final é a do servidor (i-1, i-2); a ligação segue pelo id.
    const { sessao: out, mudou } = mesclarSessao(sessao, itens, nunca);
    expect(mudou).toBe(true);
    expect(out.map((l) => l.itemId)).toEqual(['i-1', 'i-2']);
    const { sessao: estavel, mudou: mudou2 } = mesclarSessao(out, itens, nunca);
    expect(mudou2).toBe(false);
    expect(estavel).toBe(out);

    const semId = [{ nomeProcedimento: 'Botox', observacoesExecucao: '' }];
    const r = mesclarSessao(semId, [itens[0]], nunca);
    expect(r.mudou).toBe(true);
    expect(r.sessao[0].itemId).toBe('i-1');
  });

  it('linha com itemId cujo item sumiu do servidor é removida; linha local sem itemId fica', () => {
    const sessao = [
      { itemId: 'i-1', nomeProcedimento: 'Botox', observacoesExecucao: '' },
      { itemId: 'i-2', nomeProcedimento: 'Peeling', observacoesExecucao: 'x' },
      { nomeProcedimento: 'Novo local', observacoesExecucao: '' },
    ];
    const { sessao: out, mudou } = mesclarSessao(sessao, [item('i-1', { nomeLivre: 'Botox' })], nunca);
    expect(mudou).toBe(true);
    expect(out.map((l) => l.nomeProcedimento)).toEqual(['Botox', 'Novo local']);
    expect(out[1].itemId).toBeUndefined();
  });

  it('observação vazia do servidor é aplicada; com envio pendente da observação, a linha fica como está', () => {
    const sessao = [{ itemId: 'i-1', nomeProcedimento: 'Botox', observacoesExecucao: 'aplicado 20U' }];
    const itens = [item('i-1', { nomeLivre: 'Botox', observacaoExecucao: '' })];
    const aplicada = mesclarSessao(sessao, itens, nunca);
    expect(aplicada.mudou).toBe(true);
    expect(aplicada.sessao[0].observacoesExecucao).toBe('');

    const protegida = mesclarSessao(sessao, itens, (chave) => chave === 'item:i-1:obs');
    expect(protegida.mudou).toBe(false);
    expect(protegida.sessao[0].observacoesExecucao).toBe('aplicado 20U');
  });

  it('orient do servidor entra na linha (lista ou nula), salvo envio pendente de orientação', () => {
    const sessao = [{ itemId: 'i-1', nomeProcedimento: 'Botox', observacoesExecucao: '', orient: null }];
    const marcada = { ...EVITAR_SOL, checado: true };
    const comLista = mesclarSessao(sessao, [item('i-1', { nomeLivre: 'Botox', orientacoes: [marcada, NAO_DEITAR] })], nunca);
    expect(comLista.mudou).toBe(true);
    expect(comLista.sessao[0].orient).toEqual([marcada, NAO_DEITAR]);

    // Mesma lista com `id` local na linha: nada muda (compara por descrição, checado e ordem).
    const comIds = [{ ...sessao[0], orient: [{ id: 'L1', ...marcada }, { id: 'L2', ...NAO_DEITAR }] }];
    expect(mesclarSessao(comIds, [item('i-1', { nomeLivre: 'Botox', orientacoes: [marcada, NAO_DEITAR] })], nunca).mudou).toBe(false);

    // Servidor voltou a nulo (nunca definidas): a linha segue o servidor, salvo pendência.
    const paraNulo = mesclarSessao(comIds, [item('i-1', { nomeLivre: 'Botox', orientacoes: null })], nunca);
    expect(paraNulo.sessao[0].orient).toBeNull();
    const pendente = mesclarSessao(comIds, [item('i-1', { nomeLivre: 'Botox' })], (chave) => chave === 'item:i-1:orient');
    expect(pendente.mudou).toBe(false);
  });

  it('sessão vazia nasce do servidor com itemId, orient e legado=false', () => {
    const { sessao } = mesclarSessao([], [item('i-1', { nomeLivre: 'Botox', orientacoes: [EVITAR_SOL] })], nunca);
    expect(sessao[0]).toMatchObject({ itemId: 'i-1', orient: [EVITAR_SOL], legado: false });
    expect(linhaDoItemServidor(item('i-9')).orient).toBeNull();
  });
});

describe('mesclarSessao (F3): ordem do servidor e sem item fantasma', () => {
  it('a ordem final é a `ordem` do servidor, não a do aparelho', () => {
    const itens = [
      item('i-a', { ordem: 0, nomeLivre: 'A' }),
      item('i-b', { ordem: 1, nomeLivre: 'B' }),
      item('i-c', { ordem: 2, nomeLivre: 'C' }),
    ];
    const sessao = [
      { itemId: 'i-c', nomeProcedimento: 'C', observacoesExecucao: '' },
      { itemId: 'i-a', nomeProcedimento: 'A', observacoesExecucao: '' },
    ];
    const r = mesclarSessao(sessao, itens, nunca);
    expect(r.sessao.map((l) => l.itemId)).toEqual(['i-a', 'i-b', 'i-c']);
  });

  it('linha local sem itemId e com agendaId casa por posição com o item do servidor sem agenda (sem aba fantasma)', () => {
    const itens = [item('i-1', { ordem: 0, agendaId: null, nomeLivre: 'Botox' })];
    const sessao = [{ agendaId: 'ag-1', nomeProcedimento: 'Botox', observacoesExecucao: '' }];
    expect(mapearItensDaSessao(sessao, itens)).toEqual(['i-1']);
    const r = mesclarSessao(sessao, itens, nunca);
    expect(r.sessao).toHaveLength(1);
    expect(r.sessao[0].itemId).toBe('i-1');
  });

  it('linha local ainda sem item (nova) fica depois das ligadas', () => {
    const itens = [item('i-1', { ordem: 0, nomeLivre: 'A' })];
    const sessao = [
      { nomeProcedimento: 'Nova', observacoesExecucao: '', itemId: null, agendaId: 'ag-9' },
      { itemId: 'i-1', nomeProcedimento: 'A', observacoesExecucao: '' },
    ];
    const r = mesclarSessao(sessao, itens, nunca);
    // a 1ª linha (sem itemId, com agenda) casa por posição com o único item livre: i-1 fica ligado a ela? não:
    // o i-1 já está usado pela linha 2 (por id); a linha nova segue local e vai depois.
    expect(r.sessao.map((l) => l.itemId ?? null)).toEqual(['i-1', null]);
  });
});

describe('diferencasDosItens (orient)', () => {
  const base = () => baseDosItens([item('i-1', { nomeLivre: 'Botox', orientacoes: [EVITAR_SOL, NAO_DEITAR] })]);

  it('linha com orient nula não gera diferença; lista igual não gera diferença', () => {
    const nula = [{ itemId: 'i-1', nomeProcedimento: 'Botox', observacoesExecucao: '', orient: null }];
    expect(diferencasDosItens(nula, ['i-1'], base()).alterar).toEqual([]);
    const igual = [{ ...nula[0], orient: [{ id: 'a', ...EVITAR_SOL }, { id: 'b', ...NAO_DEITAR }] }];
    expect(diferencasDosItens(igual, ['i-1'], base()).alterar).toEqual([]);
  });

  it('só o checado mudou: a lista inteira vai com imediato=true; texto novo vai sem imediato', () => {
    const marcou = [{ itemId: 'i-1', nomeProcedimento: 'Botox', observacoesExecucao: '', orient: [{ ...EVITAR_SOL, checado: true }, NAO_DEITAR] }];
    expect(diferencasDosItens(marcou, ['i-1'], base()).alterar).toEqual([
      { itemId: 'i-1', campo: 'orient', campos: { orientacoes: [{ ...EVITAR_SOL, checado: true }, NAO_DEITAR] }, imediato: true },
    ]);

    const digitou = [{ ...marcou[0], orient: [EVITAR_SOL, { ...NAO_DEITAR, descricao: 'Não deitar por 4 h' }, { descricao: '  ' }] }];
    const [dif] = diferencasDosItens(digitou, ['i-1'], base()).alterar;
    expect(dif.imediato).toBe(false);
    // Vazia fora; a lista normalizada é o corpo do PATCH.
    expect(dif.campos.orientacoes).toEqual([EVITAR_SOL, { ...NAO_DEITAR, descricao: 'Não deitar por 4 h' }]);
  });

  it('modelo carregado na linha de um item que nunca teve orientação: diferença sem imediato', () => {
    const b = baseDosItens([item('i-1', { nomeLivre: 'Botox' })]);
    const carregou = [{ itemId: 'i-1', nomeProcedimento: 'Botox', observacoesExecucao: '', orient: [EVITAR_SOL] }];
    const [dif] = diferencasDosItens(carregou, ['i-1'], b).alterar;
    expect(dif).toMatchObject({ campo: 'orient', imediato: false, campos: { orientacoes: [EVITAR_SOL] } });
  });
});

describe('regras da tela (decisões 6 e 7)', () => {
  it('itensSemOrientacaoMarcada: só item com catálogo ou retorno e não legado; marcada libera', () => {
    const sessao = [
      { itemId: 'i-1', nomeProcedimento: 'Toxina', nomeProcedimentoCatalogoId: 'cat-1', orient: [EVITAR_SOL] },
      { itemId: 'i-2', nomeProcedimento: 'Peeling caseiro', orient: null },
      { itemId: 'i-3', nomeProcedimento: 'Retorno', isAgendaRetorno: true, orient: null },
      { itemId: 'i-4', nomeProcedimento: 'Antigo', nomeProcedimentoCatalogoId: 'cat-2', legado: true, orient: null },
      { itemId: 'i-5', nomeProcedimento: 'Fios', catalogoProcedimentoSaudeId: 'cat-3', orient: [{ ...EVITAR_SOL, checado: true }] },
    ];
    expect(itensSemOrientacaoMarcada(sessao)).toEqual([
      { indice: 0, itemId: 'i-1', nome: 'Toxina' },
      { indice: 2, itemId: 'i-3', nome: 'Retorno' },
    ]);
    // Consulta de retorno: a regra vale para todas as linhas não legadas.
    expect(itensSemOrientacaoMarcada([sessao[1]], { retorno: true })).toEqual([{ indice: 0, itemId: 'i-2', nome: 'Peeling caseiro' }]);
  });

  it('orientacoesPorItemParaPadrao: um bloco por item com orient definida, com a lista devolvida pelo encerrar', () => {
    const sessao = [
      { itemId: 'i-1', nomeProcedimento: 'Toxina', nomeProcedimentoCatalogoId: 'cat-1', orient: [{ ...EVITAR_SOL, checado: true }] },
      { itemId: 'i-2', nomeProcedimento: 'Peeling', orient: null },
      { itemId: 'i-3', nomeProcedimento: 'Fios', orient: [] },
      { itemId: 'i-4', nomeProcedimento: 'Antigo', legado: true, orient: [EVITAR_SOL] },
    ];
    const procedimentos = [
      { procedimentoFeitoId: 'p-1', atendimentoItemId: 'i-1', orientacoes: [{ descricao: 'Evitar sol por 48 h', checado: true, ordem: 0 }] },
    ];
    expect(orientacoesPorItemParaPadrao(sessao, procedimentos)).toEqual([
      {
        itemId: 'i-1',
        nome: 'Toxina',
        catalogoProcedimentoSaudeId: 'cat-1',
        orientacoes: [{ descricao: 'Evitar sol por 48 h', checado: true, ordem: 0 }],
      },
    ]);
    // Sem procedimento devolvido para o item, vale a lista da linha.
    expect(orientacoesPorItemParaPadrao([sessao[0]], [])[0].orientacoes).toEqual([{ ...EVITAR_SOL, checado: true }]);
  });
});
