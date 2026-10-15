/**
 * B-42 F2 (testador T2): no AppRefactored real, "Iniciar" pela sidebar e pela prévia leva ao abrir só as agendas
 * do card clicado (PulseSidebar → PatientsListView.buildAgendaSlotOptions(slot, linhas); prévia → linhasDoCard com
 * `kpi.entradasHoje`). O grupo consecutivo vai inteiro; o card das 16:00 nunca entra.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { TIMEOUT, assentarMuito, escritasDe, montarApp } from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const A05 = IDS.AGENDA_1;
const A0530 = IDS.AGENDA_2;
const A16 = IDS.AGENDA_3;
/** 05:03 em Brasília: as 05:00 estão dentro da margem técnica (sem modal de tolerância). */
const AGORA_0503 = '2026-10-06T08:03:00.000Z';

const abrirDe = (srv) => escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/);

/** Botão "Iniciar atendimento" do card (div.rounded-xl) que mostra a hora pedida. */
function iniciarDoCardDas(hora) {
  const botoes = screen.queryAllByRole('button', { name: 'Iniciar atendimento' });
  const alvo = botoes.find((b) => {
    const card = b.closest('div.rounded-xl');
    return card && Array.from(card.querySelectorAll('span')).some((s) => s.textContent.trim() === hora);
  });
  if (!alvo) throw new Error(`Card das ${hora} sem "Iniciar atendimento" (${botoes.length} botões)`);
  return alvo;
}

describe('sidebar e prévia: Iniciar leva só o card (B-42 F2, AppRefactored real)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sidebar: Ana 05:00 e 16:00, Iniciar no card das 05:00 → abrir só com 05:00', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      agora: AGORA_0503,
      agendas: [
        agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00' }),
        agendaDto({ id: A16, horaInicio: '16:00:00', horaFim: '16:30:00' }),
      ],
    });
    fireEvent.click(iniciarDoCardDas('05:00'));
    await assentarMuito();

    expect(abrirDe(srv)).toHaveLength(1);
    expect(abrirDe(srv)[0].body.agendaIds).toEqual([A05]);
    expect(abrirDe(srv)[0].body.agendaClicadaId).toBe(A05);
  }, TIMEOUT);

  it('sidebar: grupo 05:00+05:30 e card das 16:00 → abrir com o grupo inteiro, sem as 16:00', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      agora: AGORA_0503,
      agendas: [
        agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00' }),
        agendaDto({ id: A0530, horaInicio: '05:30:00', horaFim: '06:00:00' }),
        agendaDto({ id: A16, horaInicio: '16:00:00', horaFim: '16:30:00' }),
      ],
    });
    fireEvent.click(iniciarDoCardDas('05:00'));
    await assentarMuito();

    expect(abrirDe(srv)).toHaveLength(1);
    expect([...abrirDe(srv)[0].body.agendaIds].sort()).toEqual([A05, A0530].sort());
    expect(abrirDe(srv)[0].body.agendaIds).not.toContain(A16);
  }, TIMEOUT);

  it('prévia (via tira de hoje): grupo 05:00+05:30 e 16:00 → "Iniciar atendimento" leva o grupo, sem as 16:00', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      agora: AGORA_0503,
      agendas: [
        agendaDto({ id: A05, horaInicio: '05:00:00', horaFim: '05:30:00' }),
        agendaDto({ id: A0530, horaInicio: '05:30:00', horaFim: '06:00:00' }),
        agendaDto({ id: A16, horaInicio: '16:00:00', horaFim: '16:30:00' }),
      ],
    });
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    await assentarMuito();
    const iniciar = screen.getAllByTitle('Iniciar Atendimento')[0];
    fireEvent.click(iniciar);
    await assentarMuito();

    expect(abrirDe(srv)).toHaveLength(1);
    const corpo = abrirDe(srv)[0].body;
    expect(corpo.agendaIds).not.toContain(A16);
    expect([...corpo.agendaIds].sort()).toEqual([A05, A0530].sort());
  }, TIMEOUT);
});
