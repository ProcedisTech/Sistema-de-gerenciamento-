/**
 * C1: toda entrada na consulta chama o abrir no servidor antes de mudar a tela; recusa → toast e nada muda.
 * O modal de tolerância da agenda continua antes do abrir.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  iniciarPelaAgenda,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const abrirDe = (srv) => escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/);

describe('entradas da consulta chamam o abrir (C1)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('pelo resumo do paciente: abre com as agendas ativas do dia e entra na consulta', async () => {
    const agendas = [
      agendaDto({ id: IDS.AGENDA_2, horaInicio: '08:00:00', horaFim: '09:00:00', status: 'realizado' }),
      agendaDto({ id: IDS.AGENDA_1 }),
    ];
    const srv = await montarApp({ agendas, view: 'pacientes' });
    await iniciarPeloPaciente();

    expect(abrirDe(srv)).toHaveLength(1);
    const corpo = abrirDe(srv)[0].body;
    expect(corpo.pacienteId).toBe(IDS.PACIENTE);
    expect(corpo.agendaIds).toEqual([IDS.AGENDA_1]);
    expect(corpo.modulo).toBe('hub');
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('pela agenda: abre com a agenda clicada', async () => {
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], view: 'agenda' });
    await iniciarPelaAgenda();

    expect(abrirDe(srv)).toHaveLength(1);
    expect(abrirDe(srv)[0].body.agendaClicadaId).toBe(IDS.AGENDA_1);
    expect(abrirDe(srv)[0].body.agendaIds).toContain(IDS.AGENDA_1);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('abrir recusado: mostra o erro do servidor e não entra na consulta nem grava nada do encerrar', async () => {
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      view: 'pacientes',
      rotas: [['POST', /^\/api\/v1\/atendimentos$/, () => ({ status: 409, corpo: { message: 'Agendamento de outro paciente.' } })]],
    });
    const antes = srv.escritas.length;
    await iniciarPeloPaciente();

    expect(await screen.findByText('Agendamento de outro paciente.')).toBeTruthy();
    expect(emConsulta()).toBe(false);
    expect(srv.escritas.length).toBe(antes);
  }, TIMEOUT);

  it('agenda adiantada: o modal de tolerância vem antes e o abrir só sai depois da escolha', async () => {
    // 08:00 na clínica, agenda às 10:00.
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      view: 'agenda',
      agora: '2026-10-06T11:00:00.000Z',
    });
    clicarBotao('Iniciar atendimento');
    await assentarMuito();

    expect(screen.getByText(/Manter e iniciar/)).toBeTruthy();
    expect(abrirDe(srv)).toHaveLength(0);
    expect(emConsulta()).toBe(false);

    clicarBotao(/Manter e iniciar/);
    await assentarMuito();
    expect(abrirDe(srv)).toHaveLength(1);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  // ---- Camada 2: "Voltar à consulta" e recusa do servidor ----

  const OUTRA_PROFISSIONAL = '22222222-2222-4222-8222-2222222222ff';
  const RECUSA = 'Consulta em andamento com Ana Souza, iniciada em 06/10 11:00';
  /** Agenda de hoje ligada a uma consulta que já existe no servidor. */
  const agendaEmConsulta = ({ status = 'aberto', anfitriao = ROLE_USER_ID } = {}) => ({
    ...agendaDto({ id: IDS.AGENDA_1 }),
    atendimentoId: ATENDIMENTO_ID,
    atendimentoStatusCodigo: status,
    atendimentoAnfitriaoRoleUserId: anfitriao,
  });
  const detalheDe = (srv) => srv.leituras.filter((l) => l.path === `/api/v1/atendimentos/${ATENDIMENTO_ID}`);
  const rotaDetalhe = (extras = {}) => [
    'GET',
    new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`),
    () => consultaDto({ agendaPrincipalId: IDS.AGENDA_1, ...extras }),
  ];
  const rotaRecusa = ['POST', /^\/api\/v1\/atendimentos$/, () => ({ status: 409, corpo: { error: RECUSA } })];
  const botoes = (nome) => screen.queryAllByRole('button', { name: nome });
  /** Modal de tolerância, nas duas variantes (adiantado: "Manter e iniciar"; atrasado: "Iniciar mesmo assim?"). */
  const modalTolerancia = () => screen.queryByText(/Manter e iniciar/) ?? screen.queryByText('Iniciar mesmo assim?');
  /** emConsulta() sem contar o toast da recusa (o texto do servidor também diz "Consulta em andamento"). */
  const emConsultaForaDoToast = () =>
    screen.queryAllByText(/(Consulta|Retorno) em andamento/).some((el) => el.textContent.trim() !== RECUSA);

  it('agenda: consulta aberta minha → "Em andamento" + "Voltar à consulta"; o clique entra sem abrir nem tolerância', async () => {
    // 08:00 na clínica, agenda às 10:00: se o clique fosse pelo "iniciar", o modal de tolerância apareceria.
    const srv = await montarApp({
      agendas: [agendaEmConsulta()],
      view: 'agenda',
      agora: '2026-10-06T11:00:00.000Z',
      rotas: [rotaDetalhe()],
    });

    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    expect(botoes('Iniciar atendimento')).toHaveLength(0);
    const antesDetalhe = detalheDe(srv).length;
    clicarBotao('Voltar à consulta');
    await assentarMuito();

    expect(abrirDe(srv)).toHaveLength(0);
    expect(modalTolerancia()).toBeNull();
    expect(detalheDe(srv).length).toBeGreaterThan(antesDetalhe);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('agenda, card comum (fora do "próximo"): consulta aberta minha → "Voltar à consulta" entra sem abrir', async () => {
    // Agenda 08:00-09:00, agora 10:00: não é a "próxima", o card é o comum (handlePrimary, não handleCheckIn).
    const srv = await montarApp({
      agendas: [{ ...agendaEmConsulta(), horaInicio: '08:00:00', horaFim: '09:00:00' }],
      view: 'agenda',
      rotas: [rotaDetalhe()],
    });

    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    expect(botoes('Iniciar atendimento')).toHaveLength(0);
    const antesDetalhe = detalheDe(srv).length;
    clicarBotao('Voltar à consulta');
    await assentarMuito();

    expect(abrirDe(srv)).toHaveLength(0);
    expect(modalTolerancia()).toBeNull();
    expect(detalheDe(srv).length).toBeGreaterThan(antesDetalhe);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('sidebar "Agendamentos de hoje" (Pacientes): consulta aberta minha → "Voltar à consulta" entra sem abrir', async () => {
    const srv = await montarApp({
      agendas: [agendaEmConsulta()],
      view: 'pacientes',
      agora: '2026-10-06T11:00:00.000Z',
      rotas: [rotaDetalhe()],
    });

    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    const antesDetalhe = detalheDe(srv).length;
    clicarBotao('Voltar à consulta');
    await assentarMuito();

    expect(abrirDe(srv)).toHaveLength(0);
    expect(modalTolerancia()).toBeNull();
    expect(detalheDe(srv).length).toBeGreaterThan(antesDetalhe);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('agenda: consulta de outra profissional → "Em andamento" e nenhum "Iniciar atendimento" no card', async () => {
    const srv = await montarApp({
      agendas: [agendaEmConsulta({ anfitriao: OUTRA_PROFISSIONAL })],
      view: 'agenda',
      rotas: [rotaDetalhe({ anfitriaoRoleUserId: OUTRA_PROFISSIONAL })],
    });

    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    expect(botoes('Iniciar atendimento')).toHaveLength(0);
    expect(botoes('Voltar à consulta')).toHaveLength(0);
    expect(abrirDe(srv)).toHaveLength(0);
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('prévia do paciente, consulta de outra profissional: 409 do servidor vira toast com o texto exato e não entra', async () => {
    const srv = await montarApp({
      agendas: [agendaEmConsulta({ anfitriao: OUTRA_PROFISSIONAL })],
      view: 'pacientes',
      rotas: [rotaRecusa, rotaDetalhe({ anfitriaoRoleUserId: OUTRA_PROFISSIONAL })],
    });
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    await assentarMuito();
    fireEvent.click(screen.getAllByTitle('Iniciar Atendimento')[0]);
    await assentarMuito();

    expect(abrirDe(srv)).toHaveLength(1);
    expect(abrirDe(srv)[0].status).toBe(409);
    expect(await screen.findByText(RECUSA)).toBeTruthy();
    expect(screen.queryByText(/\[HTTP 409\]/)).toBeNull();
    expect(emConsultaForaDoToast()).toBe(false);
  }, TIMEOUT);

  it('agenda: 409 no "Iniciar atendimento" mostra o texto do servidor no toast e não entra', async () => {
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      view: 'agenda',
      rotas: [rotaRecusa],
    });
    await iniciarPelaAgenda();

    expect(abrirDe(srv)).toHaveLength(1);
    expect(await screen.findByText(RECUSA)).toBeTruthy();
    expect(screen.queryByText(/\[HTTP 409\]/)).toBeNull();
    expect(emConsultaForaDoToast()).toBe(false);
  }, TIMEOUT);
});
