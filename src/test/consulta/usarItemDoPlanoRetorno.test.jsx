/**
 * P15: "Iniciar Retorno" no item do plano, dentro da consulta, não lança erro; tipo e origem vêm da resposta do
 * PUT /itens/plano, e a consulta continua retorno depois do F5.
 */
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  escritasDe,
  iniciarPelaAgenda,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const PF_ORIGEM = '99999999-9999-4999-8999-999999999991';
const AGENDA_ORIGEM = '99999999-9999-4999-8999-999999999992';
const AGENDA_RETORNO = '99999999-9999-4999-8999-999999999993';

const plano = {
  id: IDS.PLANO_1,
  titulo: 'Rejuvenescimento facial',
  statusCodigo: 'ATIVO',
  statusNome: 'Ativo',
  criadoEm: '2026-09-01T13:00:00.000Z',
  valorTotal: 1500,
  progresso: 0,
  itens: [
    {
      id: IDS.PLANO_ITEM_1,
      planejamentoItemId: IDS.PLANO_ITEM_1,
      planejamentoId: IDS.PLANO_1,
      catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
      catalogoNome: 'Toxina botulínica',
      dataPlanejada: '2026-09-20',
      statusItem: 'FINALIZADO',
      statusItemNome: 'Finalizado',
      valorOrcado: 1500,
      procedimentoFeitoId: PF_ORIGEM,
      sessoes: [
        {
          agendaId: AGENDA_ORIGEM,
          dataAgendamento: '2026-09-20',
          horaInicio: '10:00:00',
          statusCodigo: 'realizado',
          tipoProcedimentoCodigo: 'procedimento',
          procedimentoFeitoId: PF_ORIGEM,
        },
        {
          agendaId: AGENDA_RETORNO,
          dataAgendamento: '2026-10-06',
          horaInicio: '15:00:00',
          statusCodigo: 'pendente',
          tipoProcedimentoCodigo: 'retorno',
          procedimentoFeitoOrigemId: PF_ORIGEM,
        },
      ],
    },
  ],
};

const rotasDoPlano = [
  ['GET', /^\/api\/v1\/planejamentos$/, () => [plano]],
  ['GET', /^\/api\/v1\/planejamentos\/[^/]+$/, () => plano],
  ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => ({})],
];

describe('usar item do plano de retorno (P15)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('não lança erro, fica retorno com tipo e origem do servidor e continua retorno depois do F5', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_1, tipoCodigo: 'CONSULTA', tipoNome: 'Consulta', catalogoId: null, catalogoNome: null }),
    ];
    const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1 }) };
    const daResposta = consultaDto({
      agendaPrincipalId: IDS.AGENDA_1,
      tipoProcedimentoCodigo: 'retorno',
      procedimentoFeitoOrigemId: PF_ORIGEM,
      itens: [{ id: 'i-1', ordem: 1, agendaId: null, catalogoProcedimentoSaudeId: IDS.CATALOGO_1, procedimentoNome: 'Toxina botulínica' }],
    });
    const srv = await montarApp({
      agendas,
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
        ['PUT', /\/itens\/plano$/, () => {
          estado.dto = daResposta;
          return daResposta;
        }],
        ...rotasDoPlano,
      ],
    });
    await iniciarPelaAgenda();
    clicarBotao(/(^|sessões)Planejamento/);
    await assentarMuito();
    clicarBotao(/^Iniciar Retorno$/);
    await assentarMuito(6);

    const put = escritasDe(srv, 'PUT', /\/itens\/plano$/);
    expect(put).toHaveLength(1);
    expect(put[0].body).toMatchObject({
      planejamentoItemId: IDS.PLANO_ITEM_1,
      tipoProcedimentoCodigo: 'retorno',
      procedimentoFeitoOrigemId: PF_ORIGEM,
    });
    expect(screen.getByText(/Retorno Clínico de ".*" selecionado para o atendimento\./)).toBeTruthy();
    expect(screen.getAllByText('Retorno').length).toBeGreaterThan(0);

    // F5: a tela fica fora da consulta; pela barra do topo, a consulta volta do servidor como retorno.
    cleanup();
    const noF5 = { ...daResposta, modulo: 'hub' };
    await montarApp({
      view: 'consulta',
      agendas,
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(noF5)]],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => noF5],
        ...rotasDoPlano,
      ],
    });
    await assentarMuito(4);
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);
    expect(screen.queryAllByText(/Retorno em andamento/).length).toBeGreaterThan(0);
  }, TIMEOUT);
});
