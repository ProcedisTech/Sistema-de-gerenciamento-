/**
 * Inatividade (decisão do Johnn): "em atendimento" vale só com a consulta NA TELA. Saiu pela Sidebar, o
 * consultaModule fica preenchido (goToView não zera); a consulta encerrada em outro aparelho com a pessoa fora da tela
 * também não zera. Mesmo assim o relógio de inatividade corre e a sessão sai no limite.
 *
 * Timers reais (o setInterval de 1 s do useIdleTimer roda de verdade). O Date fica congelado pelo montarApp
 * (fake só de Date): o tempo de inatividade passa movendo o relógio com vi.setSystemTime.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { avisos } from './canalAvisosTeste.jsx';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  consultaDto,
  emConsulta,
  iniciarPeloPaciente,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../config/sessionTimeout', () => ({
  SESSION_TIMEOUT_MS: 6000,
  SESSION_WARNING_BEFORE_MS: 2000,
  ACTIVITY_THROTTLE_MS: 100,
  SESSION_STORAGE_KEY: 'procedi_last_activity',
}));
// Tela de computador: a Sidebar só mostra os itens no desktop (o matchMedia do ambiente responde sempre "não") e,
// na consulta, a navegação do celular some.
vi.mock('../../hooks/useMediaQuery.js', () => ({ useMediaQuery: (q) => q === '(min-width: 1024px)' }));

const TOAST_SAIDA = 'Sessão encerrada.';
/** Passa do limite de 6 s do mock. */
const PASSA_DO_LIMITE_MS = 7500;

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Move o relógio da tela além do limite e espera o tique real (1 s) do useIdleTimer. */
async function ficarParado(ms) {
  vi.setSystemTime(Date.now() + ms);
  await esperar(1500);
  await assentarMuito(2);
}

function clicarSidebar(rotulo) {
  const sidebar = document.querySelector('aside');
  if (!sidebar) throw new Error('Sidebar não encontrada');
  fireEvent.click(within(sidebar).getByTitle(rotulo));
}

async function abrirConsulta() {
  // "minhas" só traz a consulta depois do POST: antes, clicar no paciente entraria direto na consulta já aberta.
  const estado = { dto: consultaDto(), criada: false };
  const srv = await montarApp({
    agendas: [agendaDto({ id: IDS.AGENDA_1 })],
    rotas: [
      ['POST', /^\/api\/v1\/atendimentos$/, () => {
        estado.criada = true;
        return estado.dto;
      }],
      ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => (
        estado.criada && estado.dto.status === 'aberto' ? [resumoDto(estado.dto)] : []
      )],
      ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
    ],
  });
  await iniciarPeloPaciente();
  expect(emConsulta()).toBe(true);
  return { estado, srv };
}

describe('inatividade fora da tela da consulta', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('I: saiu pela Sidebar e a consulta foi encerrada em outro aparelho → passa do limite → sessão encerrada', async () => {
    const { estado } = await abrirConsulta();

    clicarSidebar('Agenda');
    await assentarMuito(4);
    expect(emConsulta()).toBe(false);

    estado.dto = consultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:05:00Z' });
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await esperar(400);
    await assentarMuito(4);
    expect(screen.queryByText(TOAST_SAIDA)).toBeNull();

    await ficarParado(PASSA_DO_LIMITE_MS);

    expect(await screen.findByText(TOAST_SAIDA)).toBeTruthy();
  }, TIMEOUT);

  it('I-controle: fica na consulta o mesmo tempo → continua em consulta, sem sair', async () => {
    await abrirConsulta();

    await ficarParado(PASSA_DO_LIMITE_MS);

    expect(emConsulta()).toBe(true);
    expect(screen.queryByText(TOAST_SAIDA)).toBeNull();
  }, TIMEOUT);

  it('J: saiu pela Sidebar → o atalho "Voltar à consulta de" leva de volta à consulta', async () => {
    await abrirConsulta();

    clicarSidebar('Agenda');
    await assentarMuito(4);
    expect(emConsulta()).toBe(false);

    const atalho = await screen.findByRole('button', { name: /^Voltar à consulta de/ });
    fireEvent.click(atalho);
    await assentarMuito(6);

    expect(emConsulta()).toBe(true);
  }, TIMEOUT);
});
