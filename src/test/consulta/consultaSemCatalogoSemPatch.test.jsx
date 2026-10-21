/**
 * B-42 F3 na tela real (AppRefactored): Iniciar pela Agenda numa agenda Consulta/Avaliação/Retorno sem catálogo
 * entra na consulta e, com 3 s de relógio falso, nenhum PATCH de item sai pela fila: o rótulo é só de tela.
 */
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import {
  AGORA,
  TIMEOUT,
  consultaDto,
  emConsulta,
  escritasDe,
  iniciarPelaAgenda,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

/** O item que o abrir cria para a agenda sem catálogo: sem nome e sem catálogo. */
function consultaDaAgenda(codigo, nomeNaAgenda) {
  return consultaDto({
    tipoProcedimentoCodigo: codigo,
    agendaPrincipalId: IDS.AGENDA_1,
    itens: [{
      id: 'item-da-agenda',
      ordem: 1,
      agendaId: IDS.AGENDA_1,
      agendaTipoProcedimentoCodigo: codigo,
      agendaProcedimentoFeitoOrigemId: codigo === 'retorno' ? IDS.PF_ORIGEM : null,
      catalogoProcedimentoSaudeId: null,
      procedimentoNome: null,
      planejamentoItemId: null,
      nomeLivre: null,
      observacaoExecucao: null,
      agendaCatalogoProcedimentoNome: nomeNaAgenda,
    }],
  });
}

async function esperarReal(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('Consulta sem catálogo pela Agenda: 0 PATCH do item (B-42 F3)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it.each([
    ['CONSULTA', 'Consulta', null],
    ['avaliacao', 'Avaliação', null],
    ['retorno', 'Retorno', null],
    ['retorno', 'Retorno: Toxina botulínica', 'Toxina botulínica'],
  ])('%s sem catálogo ("%s"): entra e nenhum PATCH de item depois do debounce', async (codigo, _rotulo, nomeNaAgenda) => {
    const agenda = {
      ...agendaDto({
        id: IDS.AGENDA_1,
        tipoCodigo: codigo,
        tipoNome: codigo,
        catalogoId: null,
        catalogoNome: nomeNaAgenda,
        procedimentoFeitoOrigemId: codigo === 'retorno' ? IDS.PF_ORIGEM : null,
      }),
    };
    const dto = consultaDaAgenda(codigo, nomeNaAgenda);
    const srv = await montarApp({
      agendas: [agenda],
      view: 'agenda',
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${dto.id}$`), () => dto],
      ],
    });
    await iniciarPelaAgenda();
    expect(emConsulta()).toBe(true);

    // A fila da consulta mede o debounce com Date.now() (só o Date é falso aqui): 3 s de relógio falso e o tempo
    // real do timer da fila (700 ms) passar.
    vi.setSystemTime(new Date(new Date(AGORA).getTime() + 3000));
    await esperarReal(1200);

    expect(escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/)).toHaveLength(1);
    expect(escritasDe(srv, 'PATCH', /^\/api\/v1\/atendimentos\/[^/]+\/itens\//)).toEqual([]);
    expect(escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos\/[^/]+\/itens$/)).toEqual([]);
  }, TIMEOUT);
});
