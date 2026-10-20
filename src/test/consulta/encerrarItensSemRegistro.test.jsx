/**
 * F1-front: o encerrar não manda mais `criarProcedimentos`; o servidor devolve `itensSemRegistro` e a tela avisa
 * (toast de aviso com N e os nomes; aviso quando nenhum procedimento foi criado); o erro do 'finalizar' vira UM toast
 * de erro (sem duplicata).
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
  emConsulta,
  escritasDe,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);


const ENCERRAR_ROTA = ENCERRAR;
function item(id, ordem, catalogo, nome) {
  return {
    id, ordem, agendaId: null, agendaTipoProcedimentoCodigo: null, agendaProcedimentoFeitoOrigemId: null,
    catalogoProcedimentoSaudeId: catalogo, procedimentoNome: nome, planejamentoItemId: null, nomeLivre: null,
    observacaoExecucao: null, orientacoes: null,
  };
}
function resultado(extra = {}) {
  return {
    atendimentoId: ATENDIMENTO_ID,
    status: 'encerrado',
    encerradoEm: '2026-10-06T13:10:00Z',
    procedimentos: [],
    orientacoes: [],
    ...extra,
  };
}
function rotas(estado, resposta) {
  return [
    ['POST', ENCERRAR_ROTA, () => resposta()],
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
  ];
}
async function finalizarPeloHub() {
  clicarBotao(/Encerrar consulta/);
  await assentarMuito();
  clicarBotao(/^Finalizar Atendimento$/);
  await assentarMuito(6);
}

describe('F1-front: encerrar sem criarProcedimentos e com itensSemRegistro', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('itensSemRegistro: toast de aviso com N e os nomes, e o corpo não leva criarProcedimentos', async () => {
    const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [item('i-1', 0, IDS.CATALOGO_1, 'Toxina botulínica'), item('i-2', 1, IDS.CATALOGO_2, 'Preenchimento labial')] }) };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: rotas(estado, () => resultado({
        itensSemRegistro: [
          { itemId: 'i-1', procedimentoNome: 'Toxina botulínica', motivo: 'SEM_TERMO' },
          { itemId: 'i-2', procedimentoNome: 'Preenchimento labial', motivo: 'SEM_TERMO' },
        ],
      })),
    });
    await iniciarPeloPaciente();
    await finalizarPeloHub();

    const enc = escritasDe(srv, 'POST', ENCERRAR_ROTA);
    expect(enc).toHaveLength(1);
    expect(Object.keys(enc[0].body)).not.toContain('criarProcedimentos');
    const aviso = await screen.findByText(/2 procedimento\(s\) não registrado\(s\): sem termo assinado/);
    expect(aviso.textContent).toContain('Toxina botulínica');
    expect(aviso.textContent).toContain('Preenchimento labial');
    expect(screen.queryByText(/Nenhum procedimento foi registrado/)).toBeNull();
  }, TIMEOUT);

  it('0 procedimentos criados (sem itensSemRegistro): toast de aviso', async () => {
    const estado = { dto: consultaDto() };
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: rotas(estado, () => resultado()),
    });
    await iniciarPeloPaciente();
    await finalizarPeloHub();
    expect(await screen.findByText('Nenhum procedimento foi registrado nesta consulta.')).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('com procedimento criado e sem itensSemRegistro: nenhum aviso de não registrado', async () => {
    const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [item('i-1', 0, IDS.CATALOGO_1, 'Toxina botulínica')] }) };
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: rotas(estado, () => resultado({
        procedimentos: [{ procedimentoFeitoId: 'pf-1', atendimentoItemId: 'i-1', catalogoProcedimentoSaudeId: IDS.CATALOGO_1, nome: 'Toxina botulínica', planoConcluidoNesteFinalizar: false, orientacoes: [] }],
      })),
    });
    await iniciarPeloPaciente();
    await finalizarPeloHub();
    expect(screen.queryByText(/não registrado/)).toBeNull();
    expect(screen.queryByText(/Nenhum procedimento foi registrado/)).toBeNull();
  }, TIMEOUT);

  it('erro do finalizar (422) vira UM toast de erro, sem duplicata, e a tela fica', async () => {
    const estado = { dto: consultaDto() };
    const mensagem = 'Não foi possível finalizar o procedimento: a agenda já foi alterada.';
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: rotas(estado, () => ({
        status: 422,
        corpo: { error: 'ENCERRAMENTO_FALHOU', etapa: 'FINALIZAR', message: mensagem, status: 422 },
      })),
    });
    await iniciarPeloPaciente();
    await finalizarPeloHub();
    expect(await screen.findAllByText(mensagem)).toHaveLength(1);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);
});
