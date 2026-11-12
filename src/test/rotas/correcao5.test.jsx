/** Correção 5 (Testador-C5): perfil pelo id da rota, saída da consulta sem piscar a lista e sem empilhar. */
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { ATENDIMENTO_ID, TIMEOUT, assentarMuito, clicarBotao, consultaDto, emConsulta, montarApp } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const ID_B = '33333333-3333-4333-8333-3333333333bb';
const dtoB = { ...pacienteDto, id: ID_B, nomeCompleto: 'Beatriz Lima', cpf: '11144477735' };
const temNome = (nome) => document.body.textContent.includes(nome);
const caminho = () => ultimoRoteador().state.location.pathname;
const ir = async (d) => { await act(async () => { await ultimoRoteador().navigate(d); }); await assentarMuito(); };

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Correção 5', () => {
  it('1) perfil B (fora da página) por link: enquanto carrega não mostra A; depois mostra B', async () => {
    let liberar;
    const preso = new Promise((r) => { liberar = r; });
    await montarApp({
      view: 'pacientes',
      rotas: [['GET', new RegExp(`^/api/v1/pacientes/${ID_B}$`), async () => { await preso; return dtoB; }]],
    });
    await ir(caminhos.paciente(IDS.PACIENTE, 'avulsos'));
    expect(temNome('Maria Souza')).toBe(true);
    await ir(-1);
    expect(caminho()).toBe('/pacientes');
    await ir(caminhos.paciente(ID_B, 'avulsos'));
    expect(caminho()).toBe(`/pacientes/${ID_B}/avulsos`);
    expect(temNome('Maria Souza')).toBe(false);
    expect(temNome('Carregando paciente')).toBe(true);
    await act(async () => { liberar(); });
    await assentarMuito(6);
    expect(temNome('Beatriz Lima')).toBe(true);
    expect(temNome('Maria Souza')).toBe(false);
  }, TIMEOUT);

  it('2) encerrar com a recarga da Agenda atrasada: lista nunca aparece e histórico sem /pacientes', async () => {
    let segurar = false;
    let liberar;
    const preso = new Promise((r) => { liberar = r; });
    const estado = { dto: consultaDto() };
    const srv = await montarApp({
      caminho: caminhos.paciente(IDS.PACIENTE, 'avulsos'),
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['GET', /^\/api\/v1\/agendas\/(by-range|by-date|ocupacoes|by-profissional)$/, async () => { if (segurar) await preso; return [agendaDto({ id: IDS.AGENDA_1 })]; }],
        ['POST', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`), () => ({ atendimentoId: ATENDIMENTO_ID, status: 'encerrado', encerradoEm: '2026-10-06T13:10:00Z', procedimentos: [], orientacoes: [] })],
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ],
    });
    clicarBotao(/Iniciar atendimento/i);
    await assentarMuito();
    expect(emConsulta()).toBe(true);
    const r = ultimoRoteador();
    const caminhos_ = [];
    const quadros = [];
    const obs = new MutationObserver(() => { if (segurar) quadros.push(`${r.state.location.pathname}`); });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    const un = r.subscribe((s) => { if (segurar) caminhos_.push(s.location.pathname); });
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    segurar = true;
    clicarBotao(/^Finalizar Atendimento$/);
    await assentarMuito(6);
    await act(async () => { liberar(); });
    await assentarMuito(8);
    obs.disconnect(); un();
    expect(srv.escritasConsulta.some((e) => /encerrar$/.test(e.path))).toBe(true);
    expect(quadros.length).toBeGreaterThan(0); // houve quadros durante a espera
    expect(quadros.filter((q) => q === '/pacientes')).toEqual([]);
    expect(caminhos_.filter((p) => p === '/pacientes')).toEqual([]);
    expect(caminho()).toMatch(new RegExp(`^/pacientes/${IDS.PACIENTE}`));
    expect(emConsulta()).toBe(false);
    await ir(-1); // volta uma entrada: nunca a lista pelo meio do caminho
    expect(caminho()).not.toBe('/consulta');
  }, TIMEOUT);

  it('3) perfil P > Iniciar consulta > Apenas sair > Voltar: volta ao perfil P', async () => {
    const estado = { dto: consultaDto() };
    await montarApp({
      caminho: caminhos.paciente(IDS.PACIENTE, 'planos'),
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => []],
      ],
    });
    const perfil = caminho();
    expect(perfil).toBe(`/pacientes/${IDS.PACIENTE}`);
    clicarBotao(/Iniciar atendimento/i);
    await assentarMuito();
    expect(emConsulta()).toBe(true);
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito(8);
    expect(emConsulta()).toBe(false);
    await ir(-1);
    expect(caminho()).toBe(perfil);
    expect(temNome('Maria Souza')).toBe(true);
  }, TIMEOUT);
});
