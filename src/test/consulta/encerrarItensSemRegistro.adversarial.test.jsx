/**
 * F1-front (adversarial, testador independente): bordas do aviso de itensSemRegistro e do erro do 'finalizar'.
 * Reaproveita o ambiente de encerrarItensSemRegistro.test.jsx sem alterá-lo.
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
  emConsulta,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);

function item(id, ordem, catalogo, nome) {
  return {
    id, ordem, agendaId: null, agendaTipoProcedimentoCodigo: null, agendaProcedimentoFeitoOrigemId: null,
    catalogoProcedimentoSaudeId: catalogo, procedimentoNome: nome, planejamentoItemId: null, nomeLivre: null,
    observacaoExecucao: null, orientacoes: null,
  };
}
function pf(id, itemId, catalogo, nome) {
  return { procedimentoFeitoId: id, atendimentoItemId: itemId, catalogoProcedimentoSaudeId: catalogo, nome, planoConcluidoNesteFinalizar: false, orientacoes: [] };
}
function resultado(extra = {}) {
  return { atendimentoId: ATENDIMENTO_ID, status: 'encerrado', encerradoEm: '2026-10-06T13:10:00Z', procedimentos: [], orientacoes: [], ...extra };
}
function rotas(estado, resposta) {
  return [
    ['POST', ENCERRAR, () => resposta()],
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
  ];
}
async function finalizarPeloHub() {
  clicarBotao(/Encerrar consulta/);
  await assentarMuito();
  clicarBotao(/^Finalizar Atendimento$/);
  await assentarMuito(6);
}
async function cenario(resposta, dto = consultaDto()) {
  const estado = { dto };
  const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotas(estado, resposta) });
  await iniciarPeloPaciente();
  await finalizarPeloHub();
  return srv;
}

describe('F1-front adversarial: itensSemRegistro e erro do finalizar', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('procedimentoNome nulo/vazio: aviso conta o item e não mostra null nem parênteses vazios', async () => {
    await cenario(() => resultado({
      itensSemRegistro: [
        { itemId: 'i-1', procedimentoNome: null, motivo: 'SEM_TERMO' },
        { itemId: 'i-2', procedimentoNome: '   ', motivo: 'SEM_TERMO' },
      ],
    }));
    const aviso = await screen.findByText(/2 procedimento\(s\) não registrado\(s\): sem termo assinado/);
    expect(aviso.textContent).not.toMatch(/null|undefined/);
    expect(aviso.textContent).not.toContain('()');
    expect(aviso.textContent).toMatch(/assinado\.$/);
  }, TIMEOUT);

  it('1 item sem registro + 1 criado: UM só toast de aviso, 1 procedimento(s), com o nome; sem aviso de zero', async () => {
    const dto = consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [item('i-1', 0, IDS.CATALOGO_1, 'Toxina botulínica'), item('i-2', 1, IDS.CATALOGO_2, 'Preenchimento labial')] });
    await cenario(() => resultado({
      procedimentos: [pf('pf-1', 'i-1', IDS.CATALOGO_1, 'Toxina botulínica')],
      itensSemRegistro: [{ itemId: 'i-2', procedimentoNome: 'Preenchimento labial', motivo: 'SEM_TERMO' }],
    }), dto);
    const avisos = await screen.findAllByText(/não registrado\(s\)/);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].textContent).toContain('1 procedimento(s) não registrado(s): sem termo assinado (Preenchimento labial).');
    expect(avisos[0].textContent).not.toContain('Toxina botulínica');
    expect(screen.queryByText(/Nenhum procedimento foi registrado/)).toBeNull();
  }, TIMEOUT);

  it('resposta sem o campo itensSemRegistro (servidor antigo): não quebra e não avisa nada de não registrado', async () => {
    const dto = consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [item('i-1', 0, IDS.CATALOGO_1, 'Toxina botulínica')] });
    await cenario(() => resultado({ procedimentos: [pf('pf-1', 'i-1', IDS.CATALOGO_1, 'Toxina botulínica')] }), dto);
    expect(screen.queryByText(/não registrado/)).toBeNull();
    expect(screen.queryByText(/Erro ao encerrar/)).toBeNull();
    expect(screen.queryByText(/Nenhum procedimento foi registrado/)).toBeNull();
    expect(screen.queryByText(/erro|não foi possível/i)).toBeNull();
  }, TIMEOUT);

  it('resposta sem o campo e sem procedimentos (servidor antigo): cai no aviso de zero, uma vez', async () => {
    await cenario(() => resultado());
    expect(await screen.findAllByText('Nenhum procedimento foi registrado nesta consulta.')).toHaveLength(1);
    expect(screen.queryByText(/não registrado\(s\)/)).toBeNull();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('itensSemRegistro não-array (string): tratado como vazio, sem quebrar', async () => {
    await cenario(() => resultado({ itensSemRegistro: 'SEM_TERMO' }));
    expect(await screen.findByText('Nenhum procedimento foi registrado nesta consulta.')).toBeTruthy();
    expect(screen.queryByText(/não registrado\(s\)/)).toBeNull();
  }, TIMEOUT);

  it('só itens sem registro e zero procedimentos: aviso dos itens e NÃO o de zero procedimentos', async () => {
    await cenario(() => resultado({
      procedimentos: [],
      itensSemRegistro: [{ itemId: 'i-1', procedimentoNome: 'Toxina botulínica', motivo: 'SEM_TERMO' }],
    }));
    expect(await screen.findByText(/1 procedimento\(s\) não registrado\(s\)/)).toBeTruthy();
    expect(screen.queryByText('Nenhum procedimento foi registrado nesta consulta.')).toBeNull();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('falha de rede (fetch rejeita, não é 422) no finalizar: UM toast de erro e a tela fica', async () => {
    let chamadas = 0;
    await cenario(() => { chamadas += 1; throw new TypeError('Failed to fetch'); });
    const erros = await screen.findAllByText(/Sem conex|Erro ao encerrar|Failed to fetch|conex/i);
    expect(erros).toHaveLength(1);
    expect(emConsulta()).toBe(true);
    expect(chamadas).toBe(1);
    expect(screen.queryByText(/Nenhum procedimento foi registrado/)).toBeNull();
  }, TIMEOUT);

  it('erro 500 sem mensagem no finalizar: toast de erro, sem duplicata, e a tela fica', async () => {
    await cenario(() => ({ status: 500, corpo: { status: 500 } }));
    const erros = await screen.findAllByText(/erro|não foi possível|tente novamente|conex/i);
    expect(new Set(erros.map((e) => e.textContent)).size).toBe(erros.length);
    expect(emConsulta()).toBe(true);
    expect(screen.queryByText(/não registrado\(s\)/)).toBeNull();
  }, TIMEOUT);
});
