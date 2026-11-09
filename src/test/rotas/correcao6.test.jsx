/** Correção 6: paciente que não carrega, plano com busca falhando e encerramento com a recarga da Agenda falhando. */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { ATENDIMENTO_ID, TIMEOUT, assentarMuito, clicarBotao, consultaDto, emConsulta, montarApp } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

// A recarga da Agenda trata o 500 por dentro e nunca rejeita; para provar a saída, o teste faz a recarga rejeitar.
const falha = vi.hoisted(() => ({ recarga: false }));
vi.mock('../../components/agenda/useAgendaPage.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useAgendaPage: (...args) => {
      const agenda = mod.useAgendaPage(...args);
      return {
        ...agenda,
        refreshDashboard: async (...a) => {
          if (falha.recarga) throw new Error('recarga da Agenda falhou');
          return agenda.refreshDashboard(...a);
        },
      };
    },
  };
});

const ID_FORA = '44444444-4444-4444-8444-4444444444dd';
const erro500 = () => ({ status: 500, corpo: { error: 'Erro interno', status: 500 } });
const temTexto = (t) => document.body.textContent.includes(t);
const caminho = () => ultimoRoteador().state.location.pathname;

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Correção 6', () => {
  it('1) paciente fora da página com a API em 500: mostra o erro e Voltar leva a /pacientes', async () => {
    await montarApp({
      caminho: caminhos.paciente(ID_FORA, 'avulsos'),
      rotas: [['GET', new RegExp(`^/api/v1/pacientes/${ID_FORA}$`), erro500]],
    });
    await assentarMuito(6);
    await waitFor(() => expect(temTexto('Não foi possível carregar o paciente')).toBe(true));
    await waitFor(() => expect(temTexto('Carregando paciente')).toBe(false));
    clicarBotao(/^Voltar$/);
    await assentarMuito();
    await waitFor(() => expect(caminho()).toBe('/pacientes'));
  }, TIMEOUT);

  it('2) plano do endereço com a busca de planos em erro: não mostra "Não encontrado"', async () => {
    await montarApp({
      caminho: caminhos.pacientePlano(IDS.PACIENTE, 'b0000000-0000-4000-8000-000000000009'),
      rotas: [['GET', /^\/api\/v1\/planejamentos$/, erro500]],
    });
    await assentarMuito(8);
    await waitFor(() => expect(screen.queryByText('Não encontrado')).toBeNull());
  }, TIMEOUT);

  it('3) encerrar com a recarga da Agenda falhando depois de gravar: sai da consulta para o perfil', async () => {
    falha.recarga = false;
    const estado = { dto: consultaDto() };
    const srv = await montarApp({
      caminho: caminhos.paciente(IDS.PACIENTE, 'avulsos'),
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['GET', /^\/api\/v1\/agendas\/(by-range|by-date|ocupacoes|by-profissional)$/, () => [agendaDto({ id: IDS.AGENDA_1 })]],
        ['POST', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`), () => {
          falha.recarga = true;
          return { atendimentoId: ATENDIMENTO_ID, status: 'encerrado', encerradoEm: '2026-10-06T13:10:00Z', procedimentos: [], orientacoes: [] };
        }],
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ],
    });
    clicarBotao(/Iniciar atendimento/i);
    await assentarMuito();
    expect(emConsulta()).toBe(true);
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao(/^Finalizar Atendimento$/);
    await assentarMuito(10);
    expect(srv.escritasConsulta.some((e) => /encerrar$/.test(e.path))).toBe(true);
    await waitFor(() => expect(emConsulta()).toBe(false));
    await waitFor(() => expect(caminho()).not.toBe('/consulta'));
    await waitFor(() => expect(caminho()).toMatch(new RegExp(`^/pacientes/${IDS.PACIENTE}`)));
  }, TIMEOUT);
});
