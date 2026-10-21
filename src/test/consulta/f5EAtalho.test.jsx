/**
 * F5 (decisão de 11/10): a tela não volta sozinha para a consulta; fica fora (Pacientes), sem buscar o detalhe, e a
 * consulta aberta continua na barra do topo. V1: o atalho do cabeçalho leva de volta à consulta sem abrir outra.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { pacienteDto } from '../encerrar/cenariosEncerrar.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const OUTRA_ID = 'c0000000-0000-4000-8000-0000000000bb';
const OUTRO_PACIENTE_ID = '44444444-4444-4444-8444-444444444444';

function rotas({ minhas, detalhes }) {
  return [
    ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => minhas],
    ...detalhes.map((d) => ['GET', new RegExp(`^/api/v1/atendimentos/${d.id}$`), () => d]),
  ];
}

const abrirDe = (srv) => escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/);

const detalheLido = (srv, id) => srv.leituras.some((l) => l.path === `/api/v1/atendimentos/${id}`);

describe('F5 e atalho da consulta (V1)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  const minha = consultaDto();
  const outra = consultaDto({
    id: OUTRA_ID,
    pacienteId: OUTRO_PACIENTE_ID,
    pacienteNome: 'João Lima',
    pacienteCpf: '11144477735',
  });

  it('F5 com uma consulta aberta (e o paciente selecionado) fica fora: 0 GET de detalhe e a barra mostra a consulta', async () => {
    const srv = await montarApp({
      view: 'consulta',
      sessao: { selectedPatientCpf: pacienteDto.cpf },
      rotas: rotas({ minhas: [resumoDto(minha)], detalhes: [minha] }),
    });
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(abrirDe(srv)).toHaveLength(0);
    expect(detalheLido(srv, ATENDIMENTO_ID)).toBe(false);
    expect(sessionStorage.getItem('activeView')).toBe('pacientes');
    expect(screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' })).toBeTruthy();
  }, TIMEOUT);

  it('F5 com duas abertas fica fora da consulta, sem buscar nenhum detalhe', async () => {
    const srv = await montarApp({
      view: 'consulta',
      sessao: { selectedPatientCpf: pacienteDto.cpf },
      rotas: rotas({ minhas: [resumoDto(outra), resumoDto(minha)], detalhes: [minha, outra] }),
    });
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(abrirDe(srv)).toHaveLength(0);
    expect(detalheLido(srv, ATENDIMENTO_ID)).toBe(false);
    expect(detalheLido(srv, OUTRA_ID)).toBe(false);
    expect(screen.getByRole('button', { name: '2 consultas em andamento' })).toBeTruthy();
  }, TIMEOUT);

  it('F5 num retorno avulso: fica fora; pela barra volta como retorno (M6)', async () => {
    const retorno = consultaDto({ tipoProcedimentoCodigo: 'retorno', modulo: 'hub' });
    const srv = await montarApp({
      view: 'consulta',
      rotas: rotas({ minhas: [resumoDto(retorno)], detalhes: [retorno] }),
    });
    await assentarMuito(4);
    expect(emConsulta()).toBe(false);

    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    expect(screen.queryAllByText(/Retorno em andamento/).length).toBeGreaterThan(0);
    expect(abrirDe(srv)).toHaveLength(0);
  }, TIMEOUT);

  it('atalho numa consulta que virou abandonada: não entra e recarrega a barra (abandonada some)', async () => {
    const minhas = [resumoDto(minha)];
    const abandonada = consultaDto({ status: 'abandonado' });
    const srv = await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => minhas],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => abandonada],
      ],
    });
    const lidasAntes = srv.leituras.filter((l) => l.path === '/api/v1/atendimentos/minhas').length;

    minhas.splice(0, minhas.length, resumoDto(abandonada));
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(abrirDe(srv)).toHaveLength(0);
    expect(srv.leituras.filter((l) => l.path === '/api/v1/atendimentos/minhas').length).toBeGreaterThan(lidasAntes);
    expect(screen.getByRole('button', { name: 'Iniciar consulta' })).toBeTruthy();
  }, TIMEOUT);

  it('atalho com uma consulta leva de volta a ela sem abrir outra (V1)', async () => {
    const srv = await montarApp({
      view: 'pacientes',
      rotas: rotas({ minhas: [resumoDto(minha)], detalhes: [minha] }),
    });
    expect(emConsulta()).toBe(false);

    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    expect(emConsulta()).toBe(true);
    expect(abrirDe(srv)).toHaveLength(0);
  }, TIMEOUT);

  it('atalho sem consulta abre a busca de paciente, sem abrir nada no servidor (V1)', async () => {
    const srv = await montarApp({ view: 'pacientes' });

    clicarBotao('Iniciar consulta');
    await assentarMuito();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(abrirDe(srv)).toHaveLength(0);
  }, TIMEOUT);
});
