/**
 * Decisões 4 (avaliação no servidor), lado da tela: com consulta na tela, a queixa digitada no módulo Anamnese vai
 * no blur pelo PATCH /atendimentos/{id}/avaliacao-texto (o servidor cria o preenchimento) e o app não grava a
 * anamnese por fora (nenhum POST/PATCH de /anamnese/paciente no blur). O "Concluir Anamnese" usa o preenchimento
 * que veio do servidor: PUT nele, nunca um POST de um segundo preenchimento.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  escritasDe,
  esperarEmConsulta,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const PREENCHIMENTO_DO_SERVIDOR = 'b5000000-0000-4000-8000-0000000000a1';
const FICHA_BASICA = IDS.FICHA_BASICA;
const AVALIACAO_TEXTO = /^\/api\/v1\/atendimentos\/[^/]+\/avaliacao-texto$/;

/**
 * PATCH avaliacao-texto como o servidor: grava os campos presentes. `criaPreenchimento` (ficha com perguntas): o
 * servidor devolve o id do preenchimento na 1ª queixa; sem ele (0 perguntas, contrato novo) o id segue nulo.
 */
function rotasDaAvaliacao({ criaPreenchimento = false } = {}) {
  const textos = { queixa: null, expectativas: null, observacoesAvaliacao: null, preenchimentoAnamneseId: null };
  return [
    ['PATCH', AVALIACAO_TEXTO, ({ body }) => {
      for (const campo of ['queixa', 'expectativas', 'observacoesAvaliacao']) {
        if (body && Object.hasOwn(body, campo)) textos[campo] = body[campo] === '' ? null : body[campo];
      }
      if (criaPreenchimento && !textos.preenchimentoAnamneseId && (textos.queixa || textos.expectativas)) {
        textos.preenchimentoAnamneseId = PREENCHIMENTO_DO_SERVIDOR;
      }
      return { ...textos };
    }],
    ['GET', /^\/api\/v1\/anamnese\/fichas\/basica$/, () => ({ id: FICHA_BASICA, nome: 'Ficha básica' })],
  ];
}

const escritasDaAnamnese = (srv) => srv.escritas.filter((e) => e.path.startsWith('/api/v1/anamnese/paciente/'));

describe('anamnese da consulta no servidor (Decisões 4)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('0 perguntas (preenchimentoAnamneseId nulo): blur manda pela consulta e o Concluir cria o preenchimento com um único POST', async () => {
    const srv = await montarApp({ rotas: rotasDaAvaliacao() });
    await iniciarPeloPaciente();
    esperarEmConsulta();
    clicarBotao(/(^|sessões|assinatura)Anamnese/);
    await assentarMuito();

    const queixa = screen.getAllByPlaceholderText(/O que trouxe o paciente|Descreva o motivo da consulta/)[0];
    fireEvent.change(queixa, { target: { value: 'Rugas na testa' } });
    fireEvent.blur(queixa);
    await assentarMuito();
    const expectativas = screen.getAllByPlaceholderText(/O que o paciente espera/)[0];
    fireEvent.change(expectativas, { target: { value: 'Suavizar' } });
    fireEvent.blur(expectativas);
    await assentarMuito();

    const patches = escritasDe(srv, 'PATCH', AVALIACAO_TEXTO);
    expect(patches.map((e) => e.body)).toEqual([{ queixa: 'Rugas na testa' }, { expectativas: 'Suavizar' }]);
    expect(escritasDaAnamnese(srv)).toEqual([]);

    clicarBotao(/Concluir Anamnese/);
    await assentarMuito(6);

    const anamnese = escritasDaAnamnese(srv);
    expect(anamnese.filter((e) => e.method === 'PUT')).toEqual([]);
    const posts = anamnese.filter((e) => e.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({ observacoes: 'Queixa: Rugas na testa. Expectativas: Suavizar' });
  }, TIMEOUT);

  it('com preenchimento devolvido pelo servidor: o Concluir faz PUT nele, nunca POST', async () => {
    const srv = await montarApp({ rotas: rotasDaAvaliacao({ criaPreenchimento: true }) });
    await iniciarPeloPaciente();
    esperarEmConsulta();
    clicarBotao(/(^|sessões|assinatura)Anamnese/);
    await assentarMuito();

    const queixa = screen.getAllByPlaceholderText(/O que trouxe o paciente|Descreva o motivo da consulta/)[0];
    fireEvent.change(queixa, { target: { value: 'Rugas na testa' } });
    fireEvent.blur(queixa);
    await assentarMuito();
    const expectativas = screen.getAllByPlaceholderText(/O que o paciente espera/)[0];
    fireEvent.change(expectativas, { target: { value: 'Suavizar' } });
    fireEvent.blur(expectativas);
    await assentarMuito();

    const patches = escritasDe(srv, 'PATCH', AVALIACAO_TEXTO);
    expect(patches.map((e) => e.body)).toEqual([{ queixa: 'Rugas na testa' }, { expectativas: 'Suavizar' }]);
    expect(escritasDaAnamnese(srv)).toEqual([]);

    clicarBotao(/Concluir Anamnese/);
    await assentarMuito(6);

    const anamnese = escritasDaAnamnese(srv);
    expect(anamnese.filter((e) => e.method === 'POST')).toEqual([]);
    const puts = anamnese.filter((e) => e.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toMatch(
      new RegExp(`^/api/v1/anamnese/paciente/${IDS.PACIENTE}/${PREENCHIMENTO_DO_SERVIDOR}\\?roleUserId=`),
    );
    expect(puts[0].body).toMatchObject({ observacoes: 'Queixa: Rugas na testa. Expectativas: Suavizar' });
  }, TIMEOUT);
});
