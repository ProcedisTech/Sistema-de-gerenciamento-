/**
 * Onda E (testador E2), app inteiro:
 *  - "Concluir Avaliação" espera a fila avaliacao:* esvaziar: com o PATCH avaliacao-texto preso num portão, o PATCH
 *    /atendimentos/{id}/modulo (hub) não sai; depois do portão, sai.
 *  - Falha definitiva do PATCH (500 ou rede): toast "Aguarde: ainda enviando a avaliação…" e o módulo não muda.
 *  - "Motivo da consulta" (ficha com perguntas): grava a queixa só ao sair do campo (1 PATCH {queixa}); sem blur, 0.
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

const AVALIACAO_TEXTO = /^\/api\/v1\/atendimentos\/[^/]+\/avaliacao-texto$/;
const MODULO = /^\/api\/v1\/atendimentos\/[^/]+\/modulo$/;
const AVISO_FILA = 'Aguarde: ainda enviando a avaliação…';

/** Embrulha o fetch do servidor falso: conta as chamadas e deixa o PATCH da avaliação passar por `intercepta`. */
function embrulharFetch(srv, intercepta) {
  const chamadas = { patchAvaliacao: [], patchModulo: [] };
  vi.stubGlobal('fetch', async (url, init = {}) => {
    const metodo = String(init.method || 'GET').toUpperCase();
    const caminho = new URL(String(url), 'http://localhost').pathname;
    if (metodo === 'PATCH' && AVALIACAO_TEXTO.test(caminho)) {
      chamadas.patchAvaliacao.push(caminho);
      if (intercepta) await intercepta();
    }
    if (metodo === 'PATCH' && MODULO.test(caminho)) chamadas.patchModulo.push(caminho);
    return srv.fetchFalso(url, init);
  });
  return chamadas;
}

async function irParaAvaliacaoEDigitar(texto = 'Rugas na testa') {
  await iniciarPeloPaciente();
  esperarEmConsulta();
  clicarBotao(/(^|sessões|assinatura)Avaliação/);
  await assentarMuito();
  const queixa = screen.getAllByPlaceholderText('Descreva o motivo da consulta...')[0];
  fireEvent.change(queixa, { target: { value: texto } });
  return queixa;
}

describe('Concluir Avaliação espera a fila da avaliação (app inteiro)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('com o PATCH avaliacao-texto preso, o PATCH /modulo não sai; depois do portão, sai', async () => {
    let abrir;
    const portao = new Promise((r) => {
      abrir = r;
    });
    const srv = await montarApp({});
    const chamadas = embrulharFetch(srv, () => portao);
    const queixa = await irParaAvaliacaoEDigitar();
    fireEvent.blur(queixa);
    await assentarMuito();
    expect(chamadas.patchAvaliacao.length).toBeGreaterThanOrEqual(1);

    const modulosAntes = chamadas.patchModulo.length;
    clicarBotao(/Concluir Avaliação/);
    await assentarMuito(6);
    // Preso: o módulo não pode ter mudado para o hub.
    expect(chamadas.patchModulo.length).toBe(modulosAntes);
    expect(escritasDe(srv, 'PATCH', MODULO).filter((e) => e.body?.modulo === 'hub')).toEqual([]);

    abrir();
    await assentarMuito(10);
    expect(escritasDe(srv, 'PATCH', AVALIACAO_TEXTO).map((e) => e.body)).toEqual([{ queixa: 'Rugas na testa' }]);
    const hub = escritasDe(srv, 'PATCH', MODULO).filter((e) => e.body?.modulo === 'hub');
    expect(hub).toHaveLength(1);
    expect(chamadas.patchModulo.length).toBe(modulosAntes + 1);
  }, TIMEOUT);

  it('PATCH da avaliação com 500 definitivo: toast de aguarde e o módulo não muda', async () => {
    const srv = await montarApp({
      rotas: [['PATCH', AVALIACAO_TEXTO, () => ({ status: 500, corpo: { message: 'erro' } })]],
    });
    const chamadas = embrulharFetch(srv);
    const queixa = await irParaAvaliacaoEDigitar();
    fireEvent.blur(queixa);
    await assentarMuito(6);
    expect(chamadas.patchAvaliacao.length).toBeGreaterThanOrEqual(1);

    const modulosAntes = chamadas.patchModulo.length;
    clicarBotao(/Concluir Avaliação/);
    await assentarMuito(8);
    expect(screen.queryAllByText(AVISO_FILA).length).toBeGreaterThan(0);
    expect(chamadas.patchModulo.length).toBe(modulosAntes);
    expect(screen.getAllByPlaceholderText('Descreva o motivo da consulta...').length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('PATCH da avaliação com falha de rede: toast de aguarde e o módulo não muda', async () => {
    const srv = await montarApp({});
    const chamadas = embrulharFetch(srv, () => {
      throw new TypeError('Failed to fetch');
    });
    const queixa = await irParaAvaliacaoEDigitar();
    fireEvent.blur(queixa);
    await assentarMuito(6);
    expect(chamadas.patchAvaliacao.length).toBeGreaterThanOrEqual(1);

    const modulosAntes = chamadas.patchModulo.length;
    clicarBotao(/Concluir Avaliação/);
    await assentarMuito(8);
    expect(screen.queryAllByText(AVISO_FILA).length).toBeGreaterThan(0);
    expect(chamadas.patchModulo.length).toBe(modulosAntes);
    expect(screen.getAllByPlaceholderText('Descreva o motivo da consulta...').length).toBeGreaterThan(0);
  }, TIMEOUT);
});

describe('"Motivo da consulta" grava ao sair do campo (ficha com perguntas, app inteiro)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  const FICHA_COM_PERGUNTAS = {
    id: IDS.FICHA_BASICA,
    nome: 'Ficha básica',
    itens: [
      {
        id: 'it1',
        ordem: 1,
        pergunta: { id: 'perg1', tipoResposta: 'texto', enunciado: 'Alguma alergia?', categoriaSexoAplicavel: null },
      },
    ],
  };
  const rotasFicha = () => [
    ['GET', /^\/api\/v1\/anamnese\/fichas\/basica$/, () => FICHA_COM_PERGUNTAS],
    ['GET', new RegExp(`^/api/v1/anamnese/fichas/${IDS.FICHA_BASICA}$`), () => FICHA_COM_PERGUNTAS],
    ['GET', /^\/api\/v1\/anamnese\/fichas$/, () => [{ id: IDS.FICHA_BASICA, nome: 'Ficha básica' }]],
  ];

  async function abrirAnamneseComFicha() {
    const srv = await montarApp({ rotas: rotasFicha() });
    await iniciarPeloPaciente();
    esperarEmConsulta();
    clicarBotao(/(^|sessões|assinatura)Anamnese/);
    await assentarMuito(6);
    // A ficha com perguntas é escolhida pela pessoa na lista de fichas.
    fireEvent.click(screen.getByText('Selecione uma ficha de anamnese'));
    await assentarMuito(2);
    fireEvent.click(screen.getAllByText('Ficha básica')[0]);
    await assentarMuito(6);
    return srv;
  }

  it('digitar e sair do campo: 1 PATCH avaliacao-texto com {queixa}', async () => {
    const srv = await abrirAnamneseComFicha();
    const motivo = screen.getByPlaceholderText('O que trouxe o paciente nesta consulta…');
    expect(motivo.getAttribute('data-campo-consulta')).toBe('avaliacao:queixa');
    fireEvent.change(motivo, { target: { value: 'Manchas no rosto' } });
    fireEvent.focus(motivo);
    fireEvent.blur(motivo);
    await assentarMuito(6);
    expect(escritasDe(srv, 'PATCH', AVALIACAO_TEXTO).map((e) => e.body)).toEqual([{ queixa: 'Manchas no rosto' }]);
  }, TIMEOUT);

  it('digitar sem sair do campo: nenhum PATCH', async () => {
    const srv = await abrirAnamneseComFicha();
    const motivo = screen.getByPlaceholderText('O que trouxe o paciente nesta consulta…');
    fireEvent.change(motivo, { target: { value: 'Manchas no rosto' } });
    await assentarMuito(6);
    expect(escritasDe(srv, 'PATCH', AVALIACAO_TEXTO)).toEqual([]);
  }, TIMEOUT);
});
