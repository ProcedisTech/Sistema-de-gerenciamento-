/** Onda 2 (Teste-Front): o 409 de abandono em consultaEncerradaPor409. */
import { describe, expect, it } from 'vitest';
import { consultaEncerradaPor409 } from './filaConsulta.js';

const CORPO = {
  error: 'CONSULTA_ABANDONADA',
  message: 'Esta consulta foi encerrada porque ninguém respondeu ao aviso de 4 h. O que não tinha sido salvo se perdeu. Use Iniciar para começar uma nova.',
  status: 409,
};
const erro = (status, body) => Object.assign(new Error(body?.message ?? 'x'), { status, body });

describe('consultaEncerradaPor409', () => {
  it('CONSULTA_ABANDONADA com 409 -> false (segue o caminho normal: rebusca -> tratarFechada)', () => {
    expect(consultaEncerradaPor409(erro(409, CORPO))).toBe(false);
  });
  it.each([[400], [403], [404], [500]])('mesmo código com status %i -> false', (s) => {
    expect(consultaEncerradaPor409(erro(s, CORPO))).toBe(false);
  });
  it('regex "consulta já foi fechada" continua valendo', () => {
    expect(consultaEncerradaPor409(erro(409, { error: 'Esta consulta já foi fechada.' }))).toBe(true);
    expect(consultaEncerradaPor409(erro(409, { message: 'Esta consulta já foi fechada.' }))).toBe(true);
  });
  it('outro 409 (termos obrigatórios) -> false', () => {
    expect(consultaEncerradaPor409(erro(409, { error: 'TERMOS_OBRIGATORIOS', message: 'Faltam termos obrigatórios.' }))).toBe(false);
  });
});
