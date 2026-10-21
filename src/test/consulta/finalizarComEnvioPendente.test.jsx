/**
 * B-42 rodada 3, item 1: "Finalizar Atendimento" com alteração da consulta que ainda não chegou ao servidor não
 * encerra: toast com a mensagem exata, nenhum POST /encerrar, e a tela fica na consulta. Quando a conexão volta,
 * o mesmo Finalizar envia o que faltava e encerra.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
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
const MODULO = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/modulo$`);
const MENSAGEM_PENDENTE = 'Há alterações que ainda não chegaram ao servidor. Verifique a conexão e tente encerrar de novo.';
const TOAST_SUCESSO = 'Jornada finalizada com sucesso.';

async function finalizarPeloHub() {
  clicarBotao(/Encerrar consulta/);
  await assentarMuito();
  clicarBotao(/^Finalizar Atendimento$/);
  await assentarMuito(6);
}

describe('"Finalizar Atendimento" com envio pendente (item 1)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sem conexão: toast exato, 0 POST /encerrar, fica na consulta; com a conexão de volta, o Finalizar encerra', async () => {
    const estado = { dto: consultaDto(), moduloFora: true };
    const srv = await montarApp({
      rotas: [
        ['POST', ENCERRAR, () => ({ atendimentoId: ATENDIMENTO_ID, status: 'encerrado', procedimentos: [], orientacoes: [] })],
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
        ['PATCH', MODULO, () => (estado.moduloFora ? { status: 503, corpo: { message: 'Fora do ar' } } : {})],
      ],
    });
    await iniciarPeloPaciente();
    // Troca de módulo que não chega ao servidor (fica na fila em retentativa).
    clicarBotao(/^Procedimento/);
    await assentarMuito();
    clicarBotao(/Voltar ao hub/);
    await assentarMuito();
    expect(emConsulta()).toBe(true);
    expect(escritasDe(srv, 'PATCH', MODULO).length).toBeGreaterThanOrEqual(1);

    await finalizarPeloHub();

    expect(await screen.findByText(MENSAGEM_PENDENTE)).toBeTruthy();
    expect(screen.queryByText(/Sem conexão/)).toBeNull();
    expect(escritasDe(srv, 'POST', ENCERRAR)).toEqual([]);
    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
    expect(emConsulta()).toBe(true);

    // A conexão volta: o mesmo Finalizar envia o que faltava e encerra.
    estado.moduloFora = false;
    clicarBotao(/^Finalizar Atendimento$/);
    await assentarMuito(6);

    expect(escritasDe(srv, 'POST', ENCERRAR)).toHaveLength(1);
    expect(await screen.findByText(TOAST_SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);
});
