/**
 * Testador T1 (B-42 rodada 4, item 1): `textoRetornoSemEncerrar` não tinha teste de unidade. Trava cada ramo.
 */
import { describe, expect, it } from 'vitest';
import { textoRetornoSemEncerrar } from './consultaServidor.js';

const CONEXAO =
  'O retorno foi registrado, mas a consulta ainda não foi encerrada. Verifique a conexão e clique em Concluir Retorno de novo.';
const SEM_MSG = 'O retorno foi registrado, mas a consulta ainda não foi encerrada. Clique em Concluir Retorno de novo.';
const comMsg = (m) => `O retorno foi registrado, mas a consulta ainda não foi encerrada: ${m}`;

describe('textoRetornoSemEncerrar (testador T1)', () => {
  it.each([
    ['ENVIO_PENDENTE sem status', { codigo: 'ENVIO_PENDENTE' }, 'x'],
    ['ENVIO_PENDENTE com status 409 (o código manda)', { codigo: 'ENVIO_PENDENTE', status: 409 }, 'conflito'],
    ['erro de rede (TypeError, sem status)', new TypeError('Failed to fetch'), ''],
    ['Error sem status (ex.: consulta não encontrada)', new Error('Consulta não encontrada no servidor.'), 'algo'],
    ['err null', null, 'mensagem ignorada'],
    ['err undefined', undefined, undefined],
    ['err string', 'falhou', 'mensagem'],
    ['401 comum', { status: 401 }, 'Não autorizado'],
    ['401 com sessaoExpirada', { status: 401, sessaoExpirada: true }, ''],
    ['408', { status: 408 }, 'Timeout'],
    ['429', { status: 429 }, 'Muitas requisições'],
    ['500', { status: 500 }, 'Erro interno'],
    ['502', { status: 502 }, ''],
    ['503', { status: 503 }, 'Fora do ar'],
    ['504', { status: 504 }, ''],
  ])('%s → texto de conexão', (_nome, err, msg) => {
    expect(textoRetornoSemEncerrar(err, msg)).toBe(CONEXAO);
  });

  it.each([
    ['400', 400],
    ['403', 403],
    ['404', 404],
    ['409', 409],
    ['422', 422],
  ])('%s com mensagem → aviso com a mensagem (aparada)', (_nome, status) => {
    expect(textoRetornoSemEncerrar({ status }, '  A consulta mudou.  ')).toBe(comMsg('A consulta mudou.'));
  });

  it.each([
    ['409 sem mensagem', { status: 409 }, undefined],
    ['409 mensagem vazia', { status: 409 }, ''],
    ['422 só espaços', { status: 422 }, '   '],
    ['403 mensagem null', { status: 403 }, null],
  ])('%s → "Clique em Concluir Retorno de novo." (sem "Verifique a conexão")', (_nome, err, msg) => {
    expect(textoRetornoSemEncerrar(err, msg)).toBe(SEM_MSG);
  });

  it('nenhum ramo diz "sucesso"', () => {
    for (const err of [null, { status: 503 }, { status: 409 }, { codigo: 'ENVIO_PENDENTE' }]) {
      expect(textoRetornoSemEncerrar(err, 'ok')).not.toMatch(/sucesso/i);
    }
  });
});
