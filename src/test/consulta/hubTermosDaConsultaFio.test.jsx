/**
 * Fio do hub: AppRefactored repassa `termosDaConsulta` (releitura da consulta) ao <ConsultaHub>.
 * Com o termo ASSINADO na consulta e a resolução do catálogo ainda "velha" (faltante + exigido vigente),
 * o hub filtra o gate sozinho: o selo "Consentimento válido" aparece e o clique em Procedimento navega.
 * Com PENDENTE, o clique abre o modal de termos pendentes.
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
const EXIGIDO_VIGENTE = { ...FALTANTE, vigente: true, assinaturaId: 'as-1', assinadoEm: '2026-10-06T12:40:00Z' };
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

async function montarNoHub(termos) {
  const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [ITEM_TOXINA], termos }) };
  const srv = await montarApp({
    agendas: [agendaDto({ id: IDS.AGENDA_1 })],
    rotas: [
      ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
      ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ['GET', /^\/api\/v1\/termos\/resolucao$/, () => ({
        faltantes: [FALTANTE],
        termosExigidos: [EXIGIDO_VIGENTE],
        procedimentosSemVinculo: [],
      })],
    ],
  });
  await iniciarPeloPaciente();
  await assentarMuito();
  return srv;
}

describe('fio do hub: termosDaConsulta chega ao ConsultaHub', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('ASSINADO na consulta: o hub não bloqueia (selo válido) e o clique em Procedimento navega', async () => {
    await montarNoHub([linhaTermo({ termoAssinaturaId: 'as-1', statusAssinatura: 'ASSINADO' })]);
    expect(screen.getAllByLabelText('Consentimento válido aguardando execução').length).toBeGreaterThan(0);
    clicarBotao(/ProcedimentoRegistro, fotos/);
    await assentarMuito();
    expect(
      screen.queryByRole('button', { name: /Ir para a aba de termos e assinar o termo de Toxina botulínica/ }),
    ).toBeNull();
    expect(screen.getByText('Voltar ao hub')).toBeTruthy();
  }, TIMEOUT);

  it('PENDENTE na consulta: sem selo válido e o clique em Procedimento abre o modal de termos', async () => {
    await montarNoHub([linhaTermo({})]);
    expect(screen.queryAllByLabelText('Consentimento válido aguardando execução')).toHaveLength(0);
    clicarBotao(/ProcedimentoRegistro, fotos/);
    await assentarMuito();
    expect(
      screen.getByRole('button', { name: /Ir para a aba de termos e assinar o termo de Toxina botulínica/ }),
    ).toBeTruthy();
    expect(screen.queryByText('Voltar ao hub')).toBeNull();
  }, TIMEOUT);
});

