/** Encerrar consulta que conclui o plano + "Marcar retorno à clínica" cai na Agenda (flushSync efetivo), não em Pacientes. */
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
const resultado = () => ({
  atendimentoId: ATENDIMENTO_ID,
  status: 'encerrado',
  encerradoEm: '2026-10-06T13:10:00Z',
  procedimentos: [{ procedimentoFeitoId: 'pf-1', atendimentoItemId: 'i-1', catalogoProcedimentoSaudeId: IDS.CATALOGO_1, nome: 'Toxina botulínica', planoConcluidoNesteFinalizar: true, orientacoes: [] }],
  orientacoes: [],
});

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Retorno à clínica depois de concluir o plano', () => {
  it('aceitar "Marcar retorno à clínica" termina em /agenda, não em /pacientes', async () => {
    const estado = { dto: consultaDto() };
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', ENCERRAR, resultado],
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ],
    });
    await iniciarPeloPaciente();
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao(/^Finalizar Atendimento$/);
    await assentarMuito(6);
    // perguntas de depois (padrão/catálogo), se aparecerem, são dispensadas
    for (let i = 0; i < 4 && !screen.queryByText('Plano concluído com êxito'); i += 1) {
      const nao = screen.queryAllByRole('button', { name: /^(Não|Agora não|Pular|Não salvar)/ })[0];
      if (!nao) break;
      nao.click();
      await assentarMuito(6);
    }
    expect(await screen.findByText('Plano concluído com êxito')).toBeTruthy();
    clicarBotao(/Marcar retorno à clínica/);
    await assentarMuito(8);
    await waitFor(() => expect(ultimoRoteador().state.location.pathname).toBe(caminhos.agenda()));
  }, TIMEOUT);
});
