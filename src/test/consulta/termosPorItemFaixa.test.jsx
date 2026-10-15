/**
 * F3-front: o bloqueio por termo é por item e vem da releitura da consulta: termo ASSINADO em `termos[]` da
 * consulta tira o faltante da resolução (mesmo com a resolução do catálogo ainda "velha"); sem assinatura, bloqueia.
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
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ITEM_TOXINA = {
  id: 'i-1',
  ordem: 0,
  agendaId: null,
  agendaTipoProcedimentoCodigo: null,
  agendaProcedimentoFeitoOrigemId: null,
  catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
  procedimentoNome: 'Toxina botulínica',
  planejamentoItemId: null,
  nomeLivre: null,
  observacaoExecucao: null,
  orientacoes: null,
};
const FALTANTE = { termoId: IDS.TERMO_1, titulo: 'Termo de toxina botulínica' };
const linhaTermo = (extras) => ({
  termoId: IDS.TERMO_1,
  titulo: 'Termo de toxina botulínica',
  ordem: 0,
  lido: true,
  lidoEm: '2026-10-06T12:40:00Z',
  escolhido: true,
  termoAssinaturaId: null,
  statusAssinatura: null,
  ...extras,
});

async function montarComTermos(termos) {
  const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [ITEM_TOXINA], termos }) };
  const srv = await montarApp({
    agendas: [agendaDto({ id: IDS.AGENDA_1 })],
    rotas: [
      ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
      ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ['GET', /^\/api\/v1\/termos\/resolucao$/, () => ({
        faltantes: [FALTANTE],
        termosExigidos: [FALTANTE],
        procedimentosSemVinculo: [],
      })],
    ],
  });
  await iniciarPeloPaciente();
  clicarBotao(/(^|sessões|assinatura)Procedimento/);
  await assentarMuito();
  return srv;
}

describe('F3-front: bloqueio por termo por item (releitura da consulta)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('termo ainda não assinado na consulta: a resolução bloqueia (modal de termos pendentes)', async () => {
    await montarComTermos([linhaTermo({})]);
    expect(
      screen.getByRole('button', { name: /Ir para a aba de termos e assinar o termo de Toxina botulínica/ }),
    ).toBeTruthy();
    expect(screen.queryByText('Voltar ao hub')).toBeNull();
  }, TIMEOUT);

  it('termo ASSINADO na consulta: o faltante da resolução some e nada bloqueia', async () => {
    await montarComTermos([linhaTermo({ termoAssinaturaId: 'as-1', statusAssinatura: 'ASSINADO' })]);
    expect(
      screen.queryByRole('button', { name: /Ir para a aba de termos e assinar o termo de Toxina botulínica/ }),
    ).toBeNull();
    expect(screen.queryByText(/Procedimento bloqueado/)).toBeNull();
    // Entrou no módulo Procedimento (o cabeçalho do módulo mostra "Voltar ao hub"); a pessoa não ficou no hub.
    expect(screen.getByText('Voltar ao hub')).toBeTruthy();
  }, TIMEOUT);
});
