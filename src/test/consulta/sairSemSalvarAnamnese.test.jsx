/**
 * F4-front: "Sair sem salvar?" ao voltar do módulo Anamnese para o hub só abre com texto que NÃO está no servidor
 * (avaliacaoTemNaoSalvo): depois do blur (PATCH aceito) volta direto; digitado sem blur abre o modal.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  esperarEmConsulta,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());


const FICHA_BASICA = IDS.FICHA_BASICA;
const AVALIACAO_TEXTO = /^\/api\/v1\/atendimentos\/[^/]+\/avaliacao-texto$/;

function rotasDaAvaliacao() {
  const textos = { queixa: null, expectativas: null, observacoesAvaliacao: null, preenchimentoAnamneseId: null };
  return [
    ['PATCH', AVALIACAO_TEXTO, ({ body }) => {
      for (const campo of ['queixa', 'expectativas', 'observacoesAvaliacao']) {
        if (body && Object.hasOwn(body, campo)) textos[campo] = body[campo] === '' ? null : body[campo];
      }
      return { ...textos };
    }],
    ['GET', /^\/api\/v1\/anamnese\/fichas\/basica$/, () => ({ id: FICHA_BASICA, nome: 'Ficha básica' })],
  ];
}

async function abrirAnamnese() {
  await montarApp({ rotas: rotasDaAvaliacao() });
  await iniciarPeloPaciente();
  esperarEmConsulta();
  clicarBotao(/(^|sessões|assinatura)Anamnese/);
  await assentarMuito();
}

describe('F4-front: Sair sem salvar? só com o que não está no servidor', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('queixa salva pelo blur (PATCH aceito): Voltar ao hub vai direto, sem o modal', async () => {
    await abrirAnamnese();
    const queixa = screen.getAllByPlaceholderText(/O que trouxe o paciente|Descreva o motivo da consulta/)[0];
    fireEvent.change(queixa, { target: { value: 'Rugas na testa' } });
    fireEvent.blur(queixa);
    await assentarMuito();

    clicarBotao(/Voltar ao hub/);
    await assentarMuito();
    expect(screen.queryByText('Sair sem salvar?')).toBeNull();
    expect(screen.queryByText('Voltar ao hub')).toBeNull();
  }, TIMEOUT);

  it('queixa digitada sem blur: Voltar ao hub abre o modal', async () => {
    await abrirAnamnese();
    const queixa = screen.getAllByPlaceholderText(/O que trouxe o paciente|Descreva o motivo da consulta/)[0];
    fireEvent.change(queixa, { target: { value: 'Rugas na testa' } });

    clicarBotao(/Voltar ao hub/);
    await assentarMuito();
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy();
  }, TIMEOUT);
});
