/** F5 em Configurações: a seção vem do endereço; o state do histórico (guarda do atalho) não a sobrepõe. */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { flushSync } from 'react-dom';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import AppRoot from '../../components/AppRoot.jsx';
import { ToastProvider } from '../../contexts/ToastContext.jsx';
import { criarRotas } from '../../rotas/roteador.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotas = [['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade]];
const noHorarios = () => screen.queryByRole('switch', { name: /Terça-feira (in)?ativo/ }) !== null;

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('F5 em Configurações', () => {
  it('atalho do catálogo no histórico não reabre a seção antiga depois do F5', async () => {
    await montarApp({ view: 'pacientes', rotas });
    // atalho do catálogo: irParaTela('configuracoes', { guarda, secao: 'procedimentos' })
    act(() => {
      ultimoRoteador().navigate(caminhos.configuracoes('procedimentos'), { state: { guarda: true } });
    });
    await assentarMuito();
    // a pessoa troca de seção dentro da tela (sem navegar): hub pelo breadcrumb, depois Horários de funcionamento
    fireEvent.click(screen.getAllByRole('button', { name: /^Configurações$/ })[0]);
    await assentarMuito();
    fireEvent.click(screen.getAllByText(/Horários, feriados e mensagens/)[0]);
    await assentarMuito();
    fireEvent.click(screen.getAllByText(/Horários de funcionamento/)[0]);
    await assentarMuito();
    await waitFor(() => expect(noHorarios()).toBe(true));

    // F5: desmonta e monta de novo no mesmo endereço, com o mesmo history state
    const { pathname, state } = ultimoRoteador().state.location;
    expect(pathname).toBe('/configuracoes/horarios');
    cleanup();
    const roteador = createMemoryRouter(criarRotas(<AppRoot />), { initialEntries: [{ pathname, state }] });
    render(
      <ToastProvider>
        <RouterProvider router={roteador} flushSync={flushSync} />
      </ToastProvider>,
    );
    await assentarMuito(6);

    await waitFor(() => expect(roteador.state.location.pathname).toBe(pathname));
    await waitFor(() => expect(noHorarios()).toBe(true));
  }, TIMEOUT);
});
