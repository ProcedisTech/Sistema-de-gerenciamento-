/**
 * Horário de início sem CPF no storage (decisão de 11/10). O app não grava nem lê mais o horário numa chave com o CPF
 * do paciente; as chaves antigas são removidas na primeira leitura. Depois do F5, ao voltar pela barra, o horário de
 * início é o `iniciadoEm` da consulta no servidor, e o retorno avulso continua recebendo esse horário (agenda avulsa).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  iniciarPeloPaciente,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const CHAVE_ANTIGA = `procedis_start_time_${pacienteDto.cpf}`;
const PF_ORIGEM = '99999999-9999-4999-8999-999999999991';

/** Chaves do sessionStorage que contêm o CPF do paciente (com ou sem pontuação). */
function chavesComCpf() {
  return Object.keys(sessionStorage).filter((k) => k.replace(/\D/g, '').includes(pacienteDto.cpf));
}

describe('horário de início sem CPF no storage', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('chave antiga do horário com o CPF é removida na primeira leitura', async () => {
    await montarApp({
      view: 'pacientes',
      sessao: { [CHAVE_ANTIGA]: JSON.stringify({ time: '2026-10-06T11:00:00Z', date: '2026-10-06' }) },
    });

    expect(sessionStorage.getItem(CHAVE_ANTIGA)).toBeNull();
    expect(chavesComCpf()).toEqual([]);
  }, TIMEOUT);

  it('pelo paciente → hub → Apenas Sair: nenhuma chave do sessionStorage contém o CPF', async () => {
    const estado = { dto: consultaDto() };
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ],
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito(6);

    expect(emConsulta()).toBe(false);
    expect(Object.keys(sessionStorage).length).toBeGreaterThan(0);
    expect(chavesComCpf()).toEqual([]);
  }, TIMEOUT);

  it('retorno avulso depois do F5 e de voltar pela barra: a agenda avulsa começa no iniciadoEm do servidor', async () => {
    // iniciadoEm 12:30Z = 09:30 na clínica (America/Sao_Paulo); agora = 10:00.
    const retorno = consultaDto({
      modulo: 'retorno',
      tipoProcedimentoCodigo: 'retorno',
      procedimentoFeitoOrigemId: PF_ORIGEM,
      agendaPrincipalId: null,
      itens: [{ id: 'i-1', ordem: 1, agendaId: null, catalogoProcedimentoSaudeId: IDS.CATALOGO_1, procedimentoNome: 'Toxina botulínica' }],
    });
    const srv = await montarApp({
      view: 'consulta',
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(retorno)]],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => retorno],
        ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => ({})],
      ],
    });
    await assentarMuito(4);

    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    const avulsas = srv.escritas.filter((e) => e.method === 'POST' && /^\/api\/v1\/agendas(\?|$)/.test(e.path));
    expect(avulsas).toHaveLength(1);
    expect(avulsas[0].body).toMatchObject({ horaInicio: '09:30', horaFim: '10:00', statusCodigo: 'realizado' });
    expect(chavesComCpf()).toEqual([]);
  }, TIMEOUT);
});
