/**
 * F4: textos da avaliação (queixa, expectativas, observações) entre o detalhe do servidor e o aparelho.
 * - chave fixa da fila por campo (`CHAVE_AVALIACAO`);
 * - `textosDaAvaliacao(dto)` com `null`/ausente → `''`;
 * - `mesclarAvaliacao` aplica cada campo do servidor (mesmo vazio), salvo o pendente.
 */
import { describe, expect, it } from 'vitest';
import { CHAVE_AVALIACAO, mesclarAvaliacao, textosDaAvaliacao } from './consultaServidor.js';

const nada = () => false;

describe('CHAVE_AVALIACAO', () => {
  it('mapa fixo campo → chave da fila', () => {
    expect(CHAVE_AVALIACAO).toEqual({
      queixa: 'avaliacao:queixa',
      expectativas: 'avaliacao:expectativas',
      observacoesAvaliacao: 'avaliacao:observacoes',
    });
    expect(Object.isFrozen(CHAVE_AVALIACAO)).toBe(true);
  });
});

describe('textosDaAvaliacao', () => {
  it('lê os 3 campos do detalhe', () => {
    expect(textosDaAvaliacao({ queixa: 'Manchas', expectativas: 'Clarear', observacoesAvaliacao: 'Pele fina', outro: 1 }))
      .toEqual({ queixa: 'Manchas', expectativas: 'Clarear', observacoesAvaliacao: 'Pele fina' });
  });

  it('null, ausente ou dto nulo viram texto vazio', () => {
    expect(textosDaAvaliacao({ queixa: null })).toEqual({ queixa: '', expectativas: '', observacoesAvaliacao: '' });
    expect(textosDaAvaliacao(null)).toEqual({ queixa: '', expectativas: '', observacoesAvaliacao: '' });
  });
});

describe('mesclarAvaliacao', () => {
  const servidor = { queixa: 'Do servidor', expectativas: '', observacoesAvaliacao: 'Obs servidor' };

  it('sem pendente: aplica cada campo do servidor, inclusive o vazio, e diz que mudou', () => {
    const local = { queixa: 'Local', expectativas: 'Local exp', observacoesAvaliacao: 'Obs servidor' };
    expect(mesclarAvaliacao(local, servidor, nada)).toEqual({ valores: servidor, mudou: true });
  });

  it('campo pendente fica com o valor do aparelho; os outros vêm do servidor', () => {
    const local = { queixa: 'Digitada aqui', expectativas: 'Local exp', observacoesAvaliacao: 'x' };
    const pendentes = new Set(['avaliacao:queixa']);
    const consultadas = [];
    const r = mesclarAvaliacao(local, servidor, (chave) => {
      consultadas.push(chave);
      return pendentes.has(chave);
    });
    expect(r).toEqual({
      valores: { queixa: 'Digitada aqui', expectativas: '', observacoesAvaliacao: 'Obs servidor' },
      mudou: true,
    });
    expect(consultadas).toEqual(expect.arrayContaining(['avaliacao:queixa', 'avaliacao:expectativas', 'avaliacao:observacoes']));
  });

  it('todos pendentes: nada muda', () => {
    const local = { queixa: 'a', expectativas: 'b', observacoesAvaliacao: 'c' };
    expect(mesclarAvaliacao(local, servidor, () => true)).toEqual({ valores: local, mudou: false });
  });

  it('valores iguais: mudou false', () => {
    expect(mesclarAvaliacao({ ...servidor }, servidor, nada)).toEqual({ valores: servidor, mudou: false });
  });

  it('local nulo ou com campos ausentes conta como vazio', () => {
    expect(mesclarAvaliacao(null, { queixa: '', expectativas: '', observacoesAvaliacao: '' }, nada))
      .toEqual({ valores: { queixa: '', expectativas: '', observacoesAvaliacao: '' }, mudou: false });
  });
});
