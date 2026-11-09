/** "Sair" no menu: vai para /entrar, grava a marca de saída manual, remonta a árvore e o novo login cai em /pacientes. */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { ATENDIMENTO_ID, TIMEOUT, assentarMuito, clicarBotao, consultaDto, emConsulta, iniciarPeloPaciente, montarApp } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';

const chaves = vi.hoisted(() => []);
vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../rotas/useChaveDaSessao.js', async (original) => {
  const real = await original();
  return {
    ...real,
    useChaveDaSessao: () => {
      const k = real.useChaveDaSessao();
      if (chaves[chaves.length - 1] !== k) chaves.push(k);
      return k;
    },
  };
});

const DETALHE = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`);

describe('Sair pelo menu', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
    chaves.length = 0;
  });

  it('dentro da consulta: /entrar + marca; novo login → /pacientes, marca apagada, sem consulta em andamento, chave troca', async () => {
    sessaoFalsa.definir('usr-1');
    const estado = { dto: consultaDto() };
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto], ['GET', DETALHE, () => estado.dto]],
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);
    await waitFor(() => expect(chaves).toEqual(['inicial']));
    const r = ultimoRoteador();
    // Dentro da consulta o menu fica escondido: sai dela com "Apenas Sair" (a consulta segue aberta no servidor).
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito(6);

    fireEvent.click(screen.getAllByRole('button', { name: /Sair do sistema/i })[0]);
    await assentarMuito(8);

    await waitFor(() => expect(r.state.location.pathname).toBe(caminhos.entrar()));
    await waitFor(() => expect(sessionStorage.getItem('procedi_saida_manual')).toBe('1'));
    expect(await screen.findByText('Entrar no Sistema')).toBeTruthy();
    await waitFor(() => expect(chaves).toEqual(['inicial', 'anon']));

    fireEvent.change(screen.getByPlaceholderText('E-mail ou nome cadastrado'), { target: { value: 'usr-1@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Sua senha'), { target: { value: 'segredo' } });
    fireEvent.click(screen.getByText('Entrar no Sistema'));
    await assentarMuito(8);

    await waitFor(() => expect(r.state.location.pathname).toBe(caminhos.pacientes()));
    await waitFor(() => expect(sessionStorage.getItem('procedi_saida_manual')).toBeNull());
    await waitFor(() => expect(screen.queryByText('Entrar no Sistema')).toBeNull());
    await waitFor(() => expect(emConsulta()).toBe(false));
    await waitFor(() => expect(chaves).toEqual(['inicial', 'anon', 'usr-1']));
  }, TIMEOUT);
});
