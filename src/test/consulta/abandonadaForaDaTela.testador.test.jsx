/**
 * B-42 rodada 3, item 2 (testador T2): a consulta vira "abandonado" com a tela FORA da consulta (depois do "Apenas
 * Sair", com envio guardado). Nada muda: nenhum toast de abandonada, a tela não vai para o perfil e o que está guardado
 * no aparelho continua lá.
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
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  iniciarPelaAgenda,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const DETALHE = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`);
const MINHAS = /^\/api\/v1\/atendimentos\/minhas$/;
const ITENS = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/itens$`);
const BASE = 'Esta consulta foi encerrada por falta de atividade.';

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function entradasGuardadas() {
  return Object.keys(sessionStorage)
    .filter((k) => k.startsWith('procedi_consulta_fila_') && k.endsWith(`_${ATENDIMENTO_ID}`))
    .flatMap((k) => JSON.parse(sessionStorage.getItem(k)) || []);
}

describe('T2: abandonada com a tela fora da consulta', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('depois do "Apenas Sair" com item novo guardado: abandonada não dá toast, não leva ao perfil e não apaga o storage', async () => {
    const estado = { dto: consultaDto(), itensFora: true };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      view: 'agenda',
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', DETALHE, () => estado.dto],
        ['GET', MINHAS, () => (estado.dto.status === 'aberto' ? [resumoDto(estado.dto)] : [])],
        ['POST', ITENS, () => (estado.itensFora ? { status: 503, corpo: { message: 'Fora do ar' } } : { id: 'item-1', ordem: 0 })],
      ],
    });
    await iniciarPelaAgenda();
    expect(emConsulta()).toBe(true);
    clicarBotao(/^Procedimento/);
    await assentarMuito(6);
    clicarBotao(/Voltar ao hub/);
    await assentarMuito();
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito(6);
    expect(emConsulta()).toBe(false);
    const guardadasAntes = entradasGuardadas();
    expect(guardadasAntes.length).toBeGreaterThan(0);
    const patientViewAntes = sessionStorage.getItem('patientView');
    const activeViewAntes = sessionStorage.getItem('activeView');
    const detalhesAntes = srv.leituras.filter((l) => DETALHE.test(l.path.split('?')[0])).length;

    estado.dto = consultaDto({ status: 'abandonado' });
    avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await esperar(400);
    await assentarMuito(6);

    // A rebusca do detalhe aconteceu (a abandonada foi de fato detectada pelo hook).
    expect(srv.leituras.filter((l) => DETALHE.test(l.path.split('?')[0])).length).toBeGreaterThan(detalhesAntes);
    expect(screen.queryByText(new RegExp(BASE.replace('.', '\\.')))).toBeNull();
    expect(sessionStorage.getItem('patientView')).toBe(patientViewAntes);
    expect(sessionStorage.getItem('activeView')).toBe(activeViewAntes);
    expect(entradasGuardadas()).toEqual(guardadasAntes);
    expect(escritasDe(srv, 'POST', /\/encerrar$/)).toEqual([]);
  }, TIMEOUT);
});
