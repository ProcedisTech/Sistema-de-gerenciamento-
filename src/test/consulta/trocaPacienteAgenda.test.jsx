/**
 * B-60 (Fase 0 -> definitiva): iniciar atendimento de B pela Agenda enquanto A está selecionado não pode
 * apagar `agendaId` / sessão de B ao trocar A → B — especialmente em Retorno agendado (onde `hidratar` não
 * restaura `agendaId` e `handleConcluirRetorno` criaria uma agenda avulsa duplicada deixando a original Confirmada).
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const PACIENTE_A = pacienteDto;
const PACIENTE_B = {
  id: '33333333-3333-4333-8333-333333333399',
  nomeCompleto: 'Carlos Eduardo',
  cpf: '11144477735',
  telefone: '68999991111',
  sexo: 'M',
  dataNascimento: '1988-08-20',
  ativo: true,
};
const AGENDA_RETORNO_B = IDS.AGENDA_2;
const PF_ORIGEM_B = IDS.PF_ORIGEM;
const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);
const AGENDAS_POST = /^\/api\/v1\/agendas(\?|$)/;
const PROC_INICIAR = /^\/api\/v1\/procedimentos\/iniciar$/;
const PROC_FINALIZAR = /^\/api\/v1\/procedimentos\/[^/]+\/finalizar$/;
const GALERIA = new RegExp(`^/api/v1/pacientes/${PACIENTE_B.id}/galeria$`);

function retornoAgendaB({ data = '2026-10-06', horaInicio = '10:00:00', horaFim = '11:00:00' } = {}) {
  return {
    ...agendaDto({
      id: AGENDA_RETORNO_B,
      data,
      horaInicio,
      horaFim,
      tipoCodigo: 'retorno',
      tipoNome: 'Retorno',
      catalogoId: IDS.CATALOGO_1,
      catalogoNome: 'Toxina botulínica',
      procedimentoFeitoOrigemId: PF_ORIGEM_B,
    }),
    pacienteId: PACIENTE_B.id,
    pacienteNome: PACIENTE_B.nomeCompleto,
    pacienteCpf: PACIENTE_B.cpf,
  };
}

function retornoConsultaDto(agendaId = AGENDA_RETORNO_B) {
  return consultaDto({
    id: ATENDIMENTO_ID,
    pacienteId: PACIENTE_B.id,
    pacienteNome: PACIENTE_B.nomeCompleto,
    pacienteCpf: PACIENTE_B.cpf,
    agendaPrincipalId: agendaId,
    tipoProcedimentoCodigo: 'retorno',
    procedimentoFeitoOrigemId: PF_ORIGEM_B,
    itens: [{
      id: 'item-ret-b',
      ordem: 1,
      agendaId,
      catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
      procedimentoNome: 'Toxina botulínica',
    }],
  });
}

function rotasBaseTroca(dto, extras = []) {
  return [
    ...extras,
    ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({
      content: [PACIENTE_A, PACIENTE_B],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 20,
    })],
    ['GET', new RegExp(`^/api/v1/pacientes/${PACIENTE_A.id}$`), () => PACIENTE_A],
    ['GET', new RegExp(`^/api/v1/pacientes/${PACIENTE_B.id}$`), () => PACIENTE_B],
    ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => ({})],
    ['POST', /^\/api\/v1\/atendimentos$/, () => dto],
    ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => dto],
    ['POST', ENCERRAR, () => ({
      atendimentoId: ATENDIMENTO_ID,
      status: 'encerrado',
      encerradoEm: '2026-10-06T13:10:00Z',
      procedimentos: [],
      orientacoes: [],
    })],
  ];
}

async function selecionarPacienteAEIrParaAgenda() {
  fireEvent.click(screen.getAllByText(PACIENTE_A.nomeCompleto)[0]);
  await assentarMuito();
  clicarBotao('Agenda');
  await assentarMuito(6);
}

async function concluirRetornoDoHub() {
  expect(emConsulta()).toBe(true);
  clicarBotao(/Retorno \/ Retoque/);
  await assentarMuito(4);
  clicarBotao(/^Concluir Retorno$/);
  await assentarMuito(6);
}

function assertSemAgendaAvulsaDuplicada(srv) {
  const agendasCriadas = srv.escritas.filter((e) => e.method === 'POST' && AGENDAS_POST.test(e.path));
  expect(agendasCriadas).toEqual([]);

  const iniciar = srv.escritas.filter((e) => e.method === 'POST' && PROC_INICIAR.test(e.path));
  expect(iniciar).toHaveLength(1);
  expect(iniciar[0].body.agendaId).toBe(AGENDA_RETORNO_B);

  const finalizar = srv.escritas.filter((e) => e.method === 'PATCH' && PROC_FINALIZAR.test(e.path));
  expect(finalizar).toHaveLength(1);

  const encerrar = escritasDe(srv, 'POST', ENCERRAR);
  expect(encerrar).toHaveLength(1);
  expect(encerrar[0].body).toMatchObject({ modo: 'SOMENTE_FECHAR' });
}

describe('B-60: troca de paciente A → B pela Agenda preserva agendaId no Retorno', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('início direto no horário: A selecionado → Agenda → Retorno de B não cria agenda avulsa duplicada', async () => {
    const srv = await montarApp({
      agendas: [retornoAgendaB()],
      view: 'pacientes',
      rotas: rotasBaseTroca(retornoConsultaDto()),
    });

    await selecionarPacienteAEIrParaAgenda();
    clicarBotao('Iniciar atendimento');
    await assentarMuito(6);
    await concluirRetornoDoHub();

    assertSemAgendaAvulsaDuplicada(srv);
  }, TIMEOUT);

  it('data futura: A selecionado → Agenda (dia seguinte) → Retorno de B preserva agenda original', async () => {
    const srv = await montarApp({
      agendas: [retornoAgendaB({ data: '2026-10-07' })],
      view: 'pacientes',
      rotas: rotasBaseTroca(retornoConsultaDto()),
    });

    await selecionarPacienteAEIrParaAgenda();
    fireEvent.click(screen.getByRole('gridcell', { name: /^7 de outubro/i }));
    await assentarMuito(4);
    clicarBotao('Iniciar atendimento');
    await assentarMuito(6);
    await concluirRetornoDoHub();

    assertSemAgendaAvulsaDuplicada(srv);
  }, TIMEOUT);

  it('modal tolerância adiantado ("Manter e iniciar"): A → Retorno de B não cria agenda avulsa', async () => {
    const srv = await montarApp({
      agendas: [retornoAgendaB({ horaInicio: '10:00:00', horaFim: '11:00:00' })],
      agora: '2026-10-06T11:00:00.000Z',
      view: 'pacientes',
      rotas: rotasBaseTroca(retornoConsultaDto()),
    });

    await selecionarPacienteAEIrParaAgenda();
    clicarBotao('Iniciar atendimento');
    await assentarMuito();
    clicarBotao(/^Manter e iniciar$/);
    await assentarMuito(6);
    await concluirRetornoDoHub();

    assertSemAgendaAvulsaDuplicada(srv);
  }, TIMEOUT);

  it('modal tolerância adiantado ("Adiantar para agora"): A → Retorno de B não cria agenda avulsa', async () => {
    const srv = await montarApp({
      agendas: [retornoAgendaB({ horaInicio: '10:00:00', horaFim: '11:00:00' })],
      agora: '2026-10-06T11:00:00.000Z',
      view: 'pacientes',
      rotas: rotasBaseTroca(retornoConsultaDto()),
    });

    await selecionarPacienteAEIrParaAgenda();
    clicarBotao('Iniciar atendimento');
    await assentarMuito();
    clicarBotao(/^Adiantar para agora$/);
    await assentarMuito(6);
    await concluirRetornoDoHub();

    assertSemAgendaAvulsaDuplicada(srv);
  }, TIMEOUT);

  it('modal tolerância atrasado ("Iniciar atendimento"): A → Retorno de B não cria agenda avulsa', async () => {
    const srv = await montarApp({
      agendas: [retornoAgendaB({ horaInicio: '10:00:00', horaFim: '11:00:00' })],
      agora: '2026-10-06T16:00:00.000Z',
      view: 'pacientes',
      rotas: rotasBaseTroca(retornoConsultaDto()),
    });

    await selecionarPacienteAEIrParaAgenda();
    clicarBotao('Iniciar atendimento');
    await assentarMuito();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar atendimento' }));
    await assentarMuito(6);
    await concluirRetornoDoHub();

    assertSemAgendaAvulsaDuplicada(srv);
  }, TIMEOUT);

  it('React.StrictMode ativo: A → Retorno de B pela Agenda preserva agenda original', async () => {
    const srv = await montarApp({
      agendas: [retornoAgendaB()],
      view: 'pacientes',
      strictMode: true,
      rotas: rotasBaseTroca(retornoConsultaDto()),
    });

    await selecionarPacienteAEIrParaAgenda();
    clicarBotao('Iniciar atendimento');
    await assentarMuito(6);
    await concluirRetornoDoHub();

    assertSemAgendaAvulsaDuplicada(srv);
  }, TIMEOUT);

  it('Retorno Avulso (sem agenda prévia) com foto de resultado cria 1 avulsa e envia agendaId na foto', async () => {
    prepararMidia();
    const enviadas = [];
    const retornoAvulsoDto = consultaDto({
      id: ATENDIMENTO_ID,
      pacienteId: PACIENTE_B.id,
      pacienteNome: PACIENTE_B.nomeCompleto,
      pacienteCpf: PACIENTE_B.cpf,
      agendaPrincipalId: null,
      tipoProcedimentoCodigo: 'retorno',
      procedimentoFeitoOrigemId: PF_ORIGEM_B,
      itens: [{
        id: 'item-ret-avulso',
        ordem: 1,
        agendaId: null,
        catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
        procedimentoNome: 'Toxina botulínica',
      }],
    });
    const srv = await montarApp({
      view: 'consulta',
      rotas: rotasBaseTroca(retornoAvulsoDto, [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(retornoAvulsoDto)]],
      ]),
    });

    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      const caminho = new URL(String(url), 'http://localhost').pathname;
      if (metodo === 'POST' && GALERIA.test(caminho) && init.body instanceof FormData) {
        enviadas.push({ agendaId: init.body.get('agendaId') });
      }
      return originalFetch(url, init);
    });

    clicarBotao(`Voltar à consulta de ${PACIENTE_B.nomeCompleto}`);
    await assentarMuito(6);
    clicarBotao(/Retorno \/ Retoque/);
    await assentarMuito(4);

    const secao = screen.getByText('Foto do resultado').closest('.rounded-2xl');
    fireEvent.change(secao.querySelector('input[type="file"]'), { target: { files: [arquivoPng('res.png')] } });
    await assentarMuito();

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    const avulsas = srv.escritas.filter((e) => e.method === 'POST' && AGENDAS_POST.test(e.path));
    expect(avulsas).toHaveLength(1);
    const iniciar = srv.escritas.filter((e) => e.method === 'POST' && PROC_INICIAR.test(e.path));
    expect(iniciar).toHaveLength(1);
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0].agendaId).toBe(iniciar[0].body.agendaId);
  }, TIMEOUT);

  it('troca manual fora de consulta (A → B na lista de pacientes) continua limpando rascunho anterior', async () => {
    await montarApp({
      agendas: [],
      view: 'pacientes',
      rotas: rotasBaseTroca(retornoConsultaDto()),
    });

    // Seleciona A manualmente na lista e volta para a lista (ou alterna A → B)
    fireEvent.click(screen.getAllByText(PACIENTE_A.nomeCompleto)[0]);
    await assentarMuito();
    fireEvent.click(screen.getAllByText(PACIENTE_B.nomeCompleto)[0]);
    await assentarMuito();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);
});
