/**
 * A1: o debounce do useAviso guarda só a última mensagem da janela. Um CANCELADO (ou ENCERRADO) da consulta atual
 * seguido de outro aviso em 100 ms não pode se perder: a saída é decidida pelo status que volta na rebusca.
 */
import { act, screen } from '@testing-library/react';
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
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const OUTRA_CONSULTA = 'c0000000-0000-4000-8000-0000000000cc';
const TOAST_ND18 = 'Consulta encerrada em outro aparelho';
const TOAST_D2 =
  'Sua consulta com Maria Souza foi fechada porque Ana Prado iniciou um atendimento. Tudo o que foi registrado continua salvo.';

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('aviso que muda o destino da tela (A1)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it.each([
    ['da mesma consulta', ATENDIMENTO_ID],
    ['de outra consulta', OUTRA_CONSULTA],
  ])('CANCELADO seguido de SESSAO_ALTERADA %s em 100 ms: sai da consulta e mostra o toast do D2', async (_nome, idDoSegundo) => {
    const estado = { dto: consultaDto() };
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ],
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);

    estado.dto = consultaDto({
      status: 'cancelado',
      fechadaPor: { profissionalNome: 'Ana Prado', pacienteNome: 'Maria Souza' },
    });
    avisos.emitirAviso(AVISO.ATENDIMENTO.CANCELADO, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await esperar(100);
    avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, idDoSegundo, { atendimentoId: idDoSegundo });
    await esperar(400);
    await assentarMuito(6);

    expect(emConsulta()).toBe(false);
    expect(await screen.findByText(TOAST_D2)).toBeTruthy();
  }, TIMEOUT);

  it.each([
    ['da mesma consulta', ATENDIMENTO_ID],
    ['de outra consulta', OUTRA_CONSULTA],
  ])('ENCERRADO em outro aparelho seguido de SESSAO_ALTERADA %s em 100 ms: sai como o encerrar, sem perguntas (ND18)', async (_nome, idDoSegundo) => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ],
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);

    estado.dto = consultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:05:00Z' });
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await esperar(100);
    avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, idDoSegundo, { atendimentoId: idDoSegundo });
    await esperar(400);
    await assentarMuito(6);

    expect(emConsulta()).toBe(false);
    expect(await screen.findByText(TOAST_ND18)).toBeTruthy();
    expect(screen.queryAllByText(/^(Salvar como padrão\?|Catálogo)$/)).toEqual([]);
    expect(srv.escritasConsulta.filter((e) => /\/encerrar$/.test(e.path))).toEqual([]);
  }, TIMEOUT);
});
