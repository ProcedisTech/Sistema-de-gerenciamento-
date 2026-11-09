/** Link direto sem sessão: o endereço fica; o login entra na mesma tela, sem passar por /entrar. */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { montarApp, assentarMuito, TIMEOUT } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';
import { IDS, pacienteDto } from '../encerrar/cenariosEncerrar.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

describe('link direto deslogado', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('em /agenda sem sessão mostra o login, mantém /agenda e, ao entrar, abre a Agenda sem passar por /entrar', async () => {
    sessaoFalsa.definir(null);
    await montarApp({ view: 'agenda' });
    const r = ultimoRoteador();
    const visitados = [r.state.location.pathname];
    r.subscribe((s) => visitados.push(s.location.pathname));

    expect(screen.getByText('Entrar no Sistema')).toBeTruthy();
    expect(r.state.location.pathname).toBe(caminhos.agenda());
    expect(sessionStorage.getItem('procedi_saida_manual')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('E-mail ou nome cadastrado'), { target: { value: 'usr-1@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Sua senha'), { target: { value: 'segredo' } });
    fireEvent.click(screen.getByText('Entrar no Sistema'));
    await assentarMuito(8);

    await waitFor(() => expect(r.state.location.pathname).toBe(caminhos.agenda()));
    await waitFor(() => expect(screen.queryByText('Entrar no Sistema')).toBeNull());
    await waitFor(() => expect(visitados).not.toContain('/entrar'));
    expect(screen.getAllByText('Agenda').length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('em /pacientes/<id>/prontuario sem sessão mostra o login no mesmo endereço e, ao entrar, abre o Prontuário daquele paciente sem CPF no endereço', async () => {
    sessaoFalsa.definir(null);
    const alvo = caminhos.paciente(IDS.PACIENTE, 'prontuario');
    await montarApp({ caminho: alvo });
    const r = ultimoRoteador();
    const visitados = [r.state.location.pathname];
    r.subscribe((s) => visitados.push(s.location.pathname));

    expect(screen.getByText('Entrar no Sistema')).toBeTruthy();
    expect(r.state.location.pathname).toBe(alvo);

    fireEvent.change(screen.getByPlaceholderText('E-mail ou nome cadastrado'), { target: { value: 'usr-1@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Sua senha'), { target: { value: 'segredo' } });
    fireEvent.click(screen.getByText('Entrar no Sistema'));
    await assentarMuito(8);

    await waitFor(() => expect(r.state.location.pathname).toBe(alvo));
    await waitFor(() => expect(screen.queryByText('Entrar no Sistema')).toBeNull());
    await waitFor(() => expect(r.state.location.pathname).not.toContain(pacienteDto.cpf));
    await waitFor(() => expect(visitados).not.toContain('/entrar'));
    expect(screen.getAllByText(pacienteDto.nomeCompleto).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prontuário').length).toBeGreaterThan(0);
  }, TIMEOUT);
});
