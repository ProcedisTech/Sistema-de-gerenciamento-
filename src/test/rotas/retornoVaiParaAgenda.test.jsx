/** Encerrar consulta que sinaliza plano pronto: concluir -> "Marcar retorno à clínica" cai em /agenda; analisar -> cai no perfil em Planos sem concluir. */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { ATENDIMENTO_ID, TIMEOUT, assentarMuito, clicarBotao, consultaDto, iniciarPeloPaciente, montarApp } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);
const STATUS_PLANO = new RegExp(`^/api/v1/planejamentos/${IDS.PLANO_1}/status$`);
const PLANOS_PACIENTE = /^\/api\/v1\/planejamentos(\?.*)?$/;

const resultado = () => ({
  atendimentoId: ATENDIMENTO_ID,
  status: 'encerrado',
  encerradoEm: '2026-10-06T13:10:00Z',
  procedimentos: [{ procedimentoFeitoId: 'pf-1', atendimentoItemId: 'i-1', catalogoProcedimentoSaudeId: IDS.CATALOGO_1, nome: 'Toxina botulínica', planoConcluidoNesteFinalizar: true, orientacoes: [] }],
  orientacoes: [],
});

const planoAtivoMock = () => ([
  {
    id: IDS.PLANO_1,
    statusCodigo: 'ativo',
    statusNome: 'Ativo',
    itens: [
      { id: 'item-1', catalogoProcedimentoSaudeId: IDS.CATALOGO_1, statusItem: 'finalizado' },
    ],
  },
]);

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

async function encerrarConsultaAtePopupPlano(rotasExtras = []) {
  const estado = { dto: consultaDto() };
  await montarApp({
    agendas: [agendaDto({ id: IDS.AGENDA_1 })],
    rotas: [
      ['POST', ENCERRAR, resultado],
      ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
      ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ['GET', PLANOS_PACIENTE, planoAtivoMock],
      ...rotasExtras,
    ],
  });
  await iniciarPeloPaciente();
  clicarBotao(/Encerrar consulta/);
  await assentarMuito();
  clicarBotao(/^Finalizar Atendimento$/);
  await assentarMuito(6);
  // perguntas de depois (padrão/catálogo), se aparecerem, são dispensadas
  for (let i = 0; i < 4 && !screen.queryByText('Todos os procedimentos foram realizados'); i += 1) {
    const nao = screen.queryAllByRole('button', { name: /^(Não|Agora não|Pular|Não salvar)/ })[0];
    if (!nao) break;
    nao.click();
    await assentarMuito(6);
  }
  expect(await screen.findByText('Todos os procedimentos foram realizados')).toBeTruthy();
}

describe('Decisão ao finalizar o último item do plano', () => {
  it('concluir plano e aceitar "Marcar retorno à clínica" termina em /agenda, não em /pacientes', async () => {
    const patchSpy = vi.fn(() => ({ id: IDS.PLANO_1, statusCodigo: 'concluido', itens: [] }));
    await encerrarConsultaAtePopupPlano([['PATCH', STATUS_PLANO, patchSpy]]);

    clicarBotao(/Encerrar \/ Concluir plano/);
    expect(await screen.findByText('Plano concluído com êxito')).toBeTruthy();
    expect(patchSpy).toHaveBeenCalledTimes(1);

    clicarBotao(/Marcar retorno à clínica/);
    await assentarMuito(8);
    await waitFor(() => expect(ultimoRoteador().state.location.pathname).toBe(caminhos.agenda()));
  }, TIMEOUT);

  it('escolher "Analisar plano uma última vez" NÃO conclui plano e navega para aba planos do paciente', async () => {
    const patchSpy = vi.fn(() => ({ id: IDS.PLANO_1, statusCodigo: 'concluido', itens: [] }));
    await encerrarConsultaAtePopupPlano([['PATCH', STATUS_PLANO, patchSpy]]);

    clicarBotao(/Analisar plano uma última vez/);
    await assentarMuito(8);
    expect(patchSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      const loc = ultimoRoteador().state.location;
      expect(loc.pathname).toMatch(/^\/pacientes\/[^/]+$/);
      expect(loc.pathname).not.toContain('/avulsos');
    });
    expect(await screen.findByText(/Pronto para concluir · 100%/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Concluir plano/i })).toBeTruthy();
  }, TIMEOUT);
});
