/**
 * Concluir Anamnese espera a fila de envio da avaliação: com o PATCH avaliacao-texto preso num portão, o Concluir
 * não grava anamnese (nem POST nem PUT); depois do PATCH, usa o preenchimento devolvido pelo servidor (PUT, nunca
 * POST em /anamnese/paciente = nenhuma segunda ficha).
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

const PREENCHIMENTO_DO_SERVIDOR = 'b5000000-0000-4000-8000-0000000000a2';
const AVALIACAO_TEXTO = /^\/api\/v1\/atendimentos\/[^/]+\/avaliacao-texto$/;

const escritasDaAnamnese = (srv) => srv.escritas.filter((e) => e.path.startsWith('/api/v1/anamnese/paciente/'));

describe('concluir espera a fila da avaliação', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('Concluir Anamnese só grava depois do PATCH preso e usa o preenchimento devolvido', async () => {
    let abrir;
    const portao = new Promise((r) => {
      abrir = r;
    });
    const textos = { queixa: null, expectativas: null, preenchimentoAnamneseId: null };
    const srv = await montarApp({
      rotas: [
        ['PATCH', AVALIACAO_TEXTO, async ({ body }) => {
          await portao;
          for (const campo of ['queixa', 'expectativas']) {
            if (body && Object.hasOwn(body, campo)) textos[campo] = body[campo] === '' ? null : body[campo];
          }
          if (!textos.preenchimentoAnamneseId && (textos.queixa || textos.expectativas)) {
            textos.preenchimentoAnamneseId = PREENCHIMENTO_DO_SERVIDOR;
          }
          return { ...textos };
        }],
        ['GET', /^\/api\/v1\/anamnese\/fichas\/basica$/, () => ({ id: IDS.FICHA_BASICA, nome: 'Ficha básica' })],
      ],
    });
    // Conta as chamadas ao fetch (o servidor falso só registra depois que o handler preso retorna).
    const chamadasPatch = [];
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      const caminho = new URL(String(url), 'http://localhost').pathname;
      if (metodo === 'PATCH' && AVALIACAO_TEXTO.test(caminho)) chamadasPatch.push(caminho);
      return srv.fetchFalso(url, init);
    });
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

    clicarBotao(/Concluir Anamnese/);
    await assentarMuito(6);
    // PATCH realmente saiu e está preso no portão (nada devolvido ao servidor falso ainda).
    expect(chamadasPatch.length).toBeGreaterThanOrEqual(1);
    expect(escritasDe(srv, 'PATCH', AVALIACAO_TEXTO)).toEqual([]);
    // PATCH preso: o Concluir ainda espera; nada de anamnese gravado.
    expect(escritasDaAnamnese(srv)).toEqual([]);

    abrir();
    await assentarMuito(10);

    const anamnese = escritasDaAnamnese(srv);
    expect(anamnese.filter((e) => e.method === 'POST')).toEqual([]);
    const puts = anamnese.filter((e) => e.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toMatch(
      new RegExp(`^/api/v1/anamnese/paciente/${IDS.PACIENTE}/${PREENCHIMENTO_DO_SERVIDOR}\\?roleUserId=`),
    );
  }, TIMEOUT);
});
