/**
 * B-42 F2 (testador T2): o atalho "Iniciar consulta" → escolher paciente, no AppRefactored real.
 * Entre os cards de hoje do paciente com agenda ativa e não iniciada: em andamento → atrasado mais recente →
 * próximo → nenhum (avulsa). O pedido do abrir leva só as agendas do card escolhido, no fuso da clínica.
 * E o 409 do lote misturado (problem+json, texto em `detail`) vira toast legível.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { TIMEOUT, assentarMuito, clicarBotao, emConsulta, escritasDe, montarApp } from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const LOTE_MISTURADO = 'As agendas escolhidas são de dias ou profissionais diferentes. Escolha agendas do mesmo dia e da mesma profissional.';
const A05 = IDS.AGENDA_1;
const A08 = IDS.AGENDA_2;
const A16 = IDS.AGENDA_3;
const A18 = IDS.AGENDA_4;

const abrirDe = (srv) => escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/);

/** Atalho do cabeçalho → busca → Maria Souza. */
async function escolherPeloAtalho() {
  clicarBotao('Iniciar consulta');
  await assentarMuito();
  const dialogo = screen.getByRole('dialog');
  fireEvent.click(within(dialogo).getByRole('combobox'));
  await assentarMuito();
  fireEvent.click(within(dialogo).getAllByRole('option').find((o) => /Maria Souza/.test(o.textContent)));
  await assentarMuito();
}

/** Modal de tolerância (adiantado: "Manter e iniciar"; atrasado: "Iniciar atendimento" dentro do modal). */
async function confirmarTolerancia() {
  const manter = screen.queryAllByRole('button', { name: /Manter e iniciar/ });
  if (manter.length) {
    fireEvent.click(manter[0]);
  } else {
    const modal = screen.getByText('Iniciar mesmo assim?').closest('[role="dialog"]') ?? document.body;
    const botoes = within(modal).getAllByRole('button', { name: 'Iniciar atendimento' });
    fireEvent.click(botoes[botoes.length - 1]);
  }
  await assentarMuito();
}

describe('atalho "escolher paciente" no AppRefactored real (B-42 F2)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('em andamento, no fuso da clínica: 05:03 em Brasília (08:03 UTC) vai a das 05:00, nunca a das 08:00 nem a das 16:00', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      agora: '2026-10-06T08:03:00.000Z',
      agendas: [
        agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00' }),
        agendaDto({ id: A08, horaInicio: '08:00:00', horaFim: '08:30:00' }),
        agendaDto({ id: A16, horaInicio: '16:00:00', horaFim: '16:30:00' }),
      ],
    });
    await escolherPeloAtalho();

    expect(abrirDe(srv)).toHaveLength(1);
    const corpo = abrirDe(srv)[0].body;
    expect(corpo.pacienteId).toBe(IDS.PACIENTE);
    expect(corpo.agendaIds).toEqual([A05]);
    expect(corpo.agendaClicadaId).toBe(A05);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('dois atrasados: vai o mais recente (08:00) e ele ganha do próximo (16:00)', async () => {
    // 10:00 em Brasília (AGORA padrão do appConsulta).
    const srv = await montarApp({
      view: 'pacientes',
      agendas: [
        agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00' }),
        agendaDto({ id: A08, horaInicio: '08:00:00', horaFim: '08:30:00' }),
        agendaDto({ id: A16, horaInicio: '16:00:00', horaFim: '16:30:00' }),
      ],
    });
    await escolherPeloAtalho();
    expect(abrirDe(srv)).toHaveLength(0);
    await confirmarTolerancia();

    expect(abrirDe(srv)).toHaveLength(1);
    expect(abrirDe(srv)[0].body.agendaIds).toEqual([A08]);
    expect(abrirDe(srv)[0].body.agendaClicadaId).toBe(A08);
  }, TIMEOUT);

  it('nenhum em andamento nem atrasado: vai o próximo (16:00), não o das 18:00', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      agendas: [
        agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00', status: 'realizado' }),
        agendaDto({ id: A18, horaInicio: '18:00:00', horaFim: '18:30:00' }),
        agendaDto({ id: A16, horaInicio: '16:00:00', horaFim: '16:30:00' }),
      ],
    });
    await escolherPeloAtalho();
    await confirmarTolerancia();

    expect(abrirDe(srv)).toHaveLength(1);
    expect(abrirDe(srv)[0].body.agendaIds).toEqual([A16]);
    expect(abrirDe(srv)[0].body.agendaClicadaId).toBe(A16);
  }, TIMEOUT);

  it('nenhum card ativo e não iniciado: abre sem agenda (avulsa)', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      agendas: [
        agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00', status: 'realizado' }),
        agendaDto({ id: A16, horaInicio: '16:00:00', horaFim: '16:30:00', status: 'cancelado' }),
      ],
    });
    await escolherPeloAtalho();

    expect(abrirDe(srv)).toHaveLength(1);
    const corpo = abrirDe(srv)[0].body;
    expect(corpo.agendaIds).toEqual([]);
    expect(corpo.agendaClicadaId).toBeNull();
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('409 do lote misturado (problem+json, texto em detail) vira toast com o texto exato e não entra', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      agora: '2026-10-06T08:03:00.000Z',
      agendas: [agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00' })],
      rotas: [[
        'POST',
        /^\/api\/v1\/atendimentos$/,
        () => ({
          status: 409,
          corpo: { type: 'about:blank', title: 'Conflict', status: 409, detail: LOTE_MISTURADO, instance: '/api/v1/atendimentos' },
        }),
      ]],
    });
    await escolherPeloAtalho();

    expect(abrirDe(srv)).toHaveLength(1);
    expect(abrirDe(srv)[0].status).toBe(409);
    expect(await screen.findByText(LOTE_MISTURADO)).toBeTruthy();
    expect(screen.queryByText(/\[HTTP 409\]/)).toBeNull();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);
});
