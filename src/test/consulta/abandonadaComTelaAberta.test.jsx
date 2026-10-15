/**
 * B-42 rodada 3, item 2: a consulta aberta na tela vira "abandonado" no servidor. A tela volta ao perfil do paciente,
 * o toast diz que a consulta foi encerrada por falta de atividade e quantas alterações deste aparelho não chegaram ao
 * servidor; só depois do toast essas alterações são apagadas do aparelho. "Consulta não encontrada" não aparece e
 * nenhum POST /encerrar sai. (Antes, este teste caracterizava a tela presa na consulta.)
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
  iniciarPelaAgenda,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);
const MODULO = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/modulo$`);
const ITENS = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/itens$`);
const TOAST_NAO_ENCONTRADA = 'Consulta não encontrada no servidor. Recarregue a página.';
const BASE = 'Esta consulta foi encerrada por falta de atividade.';
const FORA = () => ({ status: 503, corpo: { message: 'Fora do ar' } });

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Tela da consulta: o hub ("Consulta em andamento") ou um módulo ("Voltar ao hub"). */
function naTelaDaConsulta() {
  return emConsulta() || screen.queryAllByText('Voltar ao hub').length > 0;
}

/** Entradas da fila desta consulta guardadas no aparelho (qualquer pessoa). */
function entradasGuardadas() {
  return Object.keys(sessionStorage)
    .filter((k) => k.startsWith('procedi_consulta_fila_') && k.endsWith(`_${ATENDIMENTO_ID}`))
    .flatMap((k) => JSON.parse(sessionStorage.getItem(k)) || []);
}

function rotas(estado) {
  return [
    ['POST', ENCERRAR, () => ({ atendimentoId: ATENDIMENTO_ID, status: 'encerrado', procedimentos: [], orientacoes: [] })],
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
    ['PATCH', MODULO, () => (estado.moduloFora ? FORA() : {})],
    ['POST', ITENS, () => (estado.itensFora ? FORA() : { id: 'item-1', ordem: 0 })],
  ];
}

async function abandonarNoServidor(estado) {
  estado.dto = consultaDto({ status: 'abandonado' });
  avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
  await esperar(400);
  await assentarMuito(6);
}

describe('consulta abandonada com a tela aberta (item 2)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sem pendência: volta ao perfil, toast só com a frase base, sem "Consulta não encontrada" e sem POST /encerrar', async () => {
    const estado = { dto: consultaDto() };
    // Sem agenda: nenhuma linha de procedimento, nada na fila.
    const srv = await montarApp({ rotas: rotas(estado) });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);
    expect(entradasGuardadas()).toEqual([]);

    await abandonarNoServidor(estado);

    expect(naTelaDaConsulta()).toBe(false);
    expect(sessionStorage.getItem('patientView')).toBe('profile');
    expect(await screen.findByText(BASE)).toBeTruthy();
    expect(screen.queryByText(/alteraç(ão|ões) feita/)).toBeNull();
    expect(screen.queryByText(TOAST_NAO_ENCONTRADA)).toBeNull();
    expect(screen.queryByText(/foi fechada porque/)).toBeNull();
    expect(screen.queryByText('Jornada finalizada com sucesso.')).toBeNull();
    expect(srv.escritasConsulta.filter((e) => ENCERRAR.test(e.path))).toEqual([]);
  }, TIMEOUT);

  it('1 alteração que não chegou (troca de módulo sem conexão): toast no singular e o aparelho fica sem a fila', async () => {
    const estado = { dto: consultaDto(), moduloFora: true };
    await montarApp({ rotas: rotas(estado) });
    await iniciarPeloPaciente();
    clicarBotao(/^Procedimento/);
    await assentarMuito(6);
    expect(naTelaDaConsulta()).toBe(true);
    expect(entradasGuardadas().map((e) => e.tipo)).toEqual(['modulo']);

    await abandonarNoServidor(estado);

    expect(naTelaDaConsulta()).toBe(false);
    expect(sessionStorage.getItem('patientView')).toBe('profile');
    expect(await screen.findByText(`${BASE} 1 alteração feita neste aparelho não chegou ao servidor.`)).toBeTruthy();
    expect(entradasGuardadas()).toEqual([]);
    expect(screen.queryByText(TOAST_NAO_ENCONTRADA)).toBeNull();
  }, TIMEOUT);

  it('2 alterações que não chegaram (item novo e módulo sem conexão): toast no plural e o aparelho fica sem a fila', async () => {
    const estado = { dto: consultaDto(), moduloFora: true, itensFora: true };
    await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], view: 'agenda', rotas: rotas(estado) });
    await iniciarPelaAgenda();
    expect(emConsulta()).toBe(true);
    clicarBotao(/^Procedimento/);
    await assentarMuito(6);
    expect(naTelaDaConsulta()).toBe(true);
    expect(entradasGuardadas().map((e) => e.tipo).sort()).toEqual(['itemNovo', 'modulo']);

    await abandonarNoServidor(estado);

    expect(naTelaDaConsulta()).toBe(false);
    expect(sessionStorage.getItem('patientView')).toBe('profile');
    expect(await screen.findByText(`${BASE} 2 alterações feitas neste aparelho não chegaram ao servidor.`)).toBeTruthy();
    expect(entradasGuardadas()).toEqual([]);
    expect(screen.queryByText(TOAST_NAO_ENCONTRADA)).toBeNull();
  }, TIMEOUT);
});
