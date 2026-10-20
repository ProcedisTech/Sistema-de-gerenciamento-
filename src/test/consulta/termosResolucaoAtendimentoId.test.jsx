/**
 * Item 3 (decisão: "Assinado nesta consulta"): dentro da consulta aberta, a requisição a
 * GET /termos/resolucao leva `atendimentoId` da consulta (hub e validação por catálogo).
 * Fora da consulta (agenda) não leva.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { limparMidia } from '../encerrar/ambienteMidia.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
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

describe('resolução de termos leva o atendimentoId da consulta', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('dentro da consulta: o GET /termos/resolucao carrega atendimentoId da consulta aberta', async () => {
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
    expect(consultas.length).toBeGreaterThan(0);
    const comAtendimento = consultas.filter((q) => q.get('atendimentoId') === ATENDIMENTO_ID);
    expect(comAtendimento.length).toBeGreaterThan(0);
    // Nenhuma chamada feita depois que a consulta existe pode ir sem o id.
    const ultima = consultas[consultas.length - 1];
    expect(ultima.get('atendimentoId')).toBe(ATENDIMENTO_ID);
  }, TIMEOUT);

  it('fora da consulta (agenda): nenhuma chamada a /termos/resolucao leva atendimentoId', async () => {
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
