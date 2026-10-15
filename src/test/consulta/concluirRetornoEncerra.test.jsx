/**
 * Etapa 3 (Y13): o "Concluir Retorno" grava o retorno como hoje e, depois do sucesso, fecha a consulta no servidor
 * com POST /atendimentos/{id}/encerrar no modo SOMENTE_FECHAR.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  iniciarPelaAgenda,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);
const PF_ORIGEM = '99999999-9999-4999-8999-999999999991';
const AGENDA_ORIGEM = '99999999-9999-4999-8999-999999999992';
const AGENDA_RETORNO = '99999999-9999-4999-8999-999999999993';

/** Plano com o item já feito e a sessão de retorno pendente (como em usarItemDoPlanoRetorno.test.jsx). */
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

describe('"Concluir Retorno" fecha a consulta no servidor (Y13)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('depois do retorno gravado sai um POST /encerrar com modo SOMENTE_FECHAR', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_1, tipoCodigo: 'CONSULTA', tipoNome: 'Consulta', catalogoId: null, catalogoNome: null }),
    ];
    const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1 }) };
    const retorno = consultaDto({
      agendaPrincipalId: IDS.AGENDA_1,
      tipoProcedimentoCodigo: 'retorno',
      procedimentoFeitoOrigemId: PF_ORIGEM,
      itens: [{ id: 'i-1', ordem: 1, agendaId: null, catalogoProcedimentoSaudeId: IDS.CATALOGO_1, procedimentoNome: 'Toxina botulínica' }],
    });
    const srv = await montarApp({
      agendas,
      rotas: [
        ['POST', ENCERRAR, () => ({
          atendimentoId: ATENDIMENTO_ID,
          status: 'encerrado',
          encerradoEm: '2026-10-06T13:10:00Z',
          procedimentos: [],
          orientacoes: [],
        })],
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
        ['PUT', /\/itens\/plano$/, () => {
          estado.dto = retorno;
          return retorno;
        }],
        ['GET', /^\/api\/v1\/planejamentos$/, () => [plano]],
        ['GET', /^\/api\/v1\/planejamentos\/[^/]+$/, () => plano],
        ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => ({})],
      ],
    });
    await iniciarPelaAgenda();
    clicarBotao(/(^|sessões)Planejamento/);
    await assentarMuito();
    clicarBotao(/^Iniciar Retorno$/);
    await assentarMuito(6);

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    const finalizar = srv.escritas.filter((e) => e.method === 'PATCH' && /\/procedimentos\/[^/]+\/finalizar$/.test(e.path));
    expect(finalizar).toHaveLength(1);
    const encerrar = escritasDe(srv, 'POST', ENCERRAR);
    expect(encerrar).toHaveLength(1);
    expect(encerrar[0].body).toEqual({
      modo: 'SOMENTE_FECHAR',
      pularGateTermos: false,
      itemAtivoId: null,
    });
    expect(await screen.findByText('Retorno registrado com sucesso.')).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);
});
