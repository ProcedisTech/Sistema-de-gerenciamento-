/**
 * Item 3 (lacuna do Step4LGPD): com a aba Termos aberta DENTRO da consulta, o GET /termos/resolucao
 * feito pelo Step3Termos (Step4LGPD.jsx) leva `atendimentoId` da consulta. Fora da consulta não leva.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { limparMidia } from '../encerrar/ambienteMidia.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ITEM_TOXINA = {
  id: 'i-1',
  ordem: 0,
  agendaId: null,
  agendaTipoProcedimentoCodigo: null,
  agendaProcedimentoFeitoOrigemId: null,
  catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
  procedimentoNome: 'Toxina botulínica',
  planejamentoItemId: null,
  nomeLivre: null,
  observacaoExecucao: null,
  orientacoes: null,
};

describe('aba Termos (Step4LGPD) leva o atendimentoId na resolução', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('dentro da consulta, ao abrir a aba Termos: toda chamada a /termos/resolucao leva o atendimentoId', async () => {
    const consultas = [];
    const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [ITEM_TOXINA], termos: [] }) };
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
        ['GET', /^\/api\/v1\/termos\/resolucao$/, ({ query }) => {
          consultas.push(new URLSearchParams(query));
          return { faltantes: [], termosExigidos: [], procedimentosSemVinculo: [] };
        }],
      ],
    });
    await iniciarPeloPaciente();
    await assentarMuito();
    consultas.length = 0;
    clicarBotao(/^Termos/);
    await assentarMuito();
    expect(screen.queryAllByText('Voltar ao hub').length).toBeGreaterThan(0);
    expect(consultas.length).toBeGreaterThan(0);
    expect(consultas.filter((q) => q.get('atendimentoId') !== ATENDIMENTO_ID)).toHaveLength(0);
  }, TIMEOUT);

  it('fora da consulta: nenhuma chamada leva atendimentoId', async () => {
    const consultas = [];
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['GET', /^\/api\/v1\/termos\/resolucao$/, ({ query }) => {
          consultas.push(new URLSearchParams(query));
          return { faltantes: [], termosExigidos: [], procedimentosSemVinculo: [] };
        }],
      ],
    });
    await assentarMuito();
    expect(consultas.filter((q) => q.has('atendimentoId'))).toHaveLength(0);
  }, TIMEOUT);
});
