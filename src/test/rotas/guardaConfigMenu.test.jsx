/** Menu "Configurações" (e atalhos do catálogo) dentro de Configurações com horários sujos: guarda igual à antiga. */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotas = [['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade]];
const MODAL = 'Você tem alterações não salvas no horário de atendimento. Deseja sair sem salvar?';
const modal = () => screen.queryByRole('heading', { name: 'Alterações não salvas' });
const noHorarios = () => screen.queryByRole('switch', { name: /Terça-feira (in)?ativo/ }) !== null;
// Último botão por nome = menu de navegação (no jsdom, o móvel); o 1º dentro de Configurações é o breadcrumb da tela.
const menuConfig = () => fireEvent.click(screen.getAllByRole('button', { name: /^Configurações$/ }).at(-1));

async function abrirHorarios({ sujar }) {
  await montarApp({ view: 'pacientes', rotas });
  menuConfig();
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários, feriados e mensagens/)[0]);
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários de funcionamento/)[0]);
  await assentarMuito();
  if (sujar) {
    fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
    await assentarMuito();
  }
}

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Guarda de horários não salvos ao clicar Configurações no menu', () => {
  it('(a)(b) com horários sujos abre o modal; Continuar editando mantém a seção; Sair sem salvar vai ao hub', async () => {
    await abrirHorarios({ sujar: true });
    await waitFor(() => expect(noHorarios()).toBe(true));

    menuConfig();
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    expect(await screen.findByText(MODAL)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar editando' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).toBeNull()); // sinal positivo: o aviso fechou; só então a negativa
    expect(noHorarios()).toBe(true);
    expect(await screen.findByRole('switch', { name: 'Terça-feira ativo' })).toBeTruthy();

    menuConfig();
    await assentarMuito();
    expect(await screen.findByText(MODAL)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).toBeNull());
    await waitFor(() => expect(noHorarios()).toBe(false));
    await waitFor(() => expect(screen.getAllByText(/Horários, feriados e mensagens/).length).toBeGreaterThan(0));
  }, TIMEOUT);

  it('(c) atalho do catálogo (mesma chamada de irParaTela com guarda e secao) abre o modal e não troca a seção', async () => {
    await abrirHorarios({ sujar: true });
    // handleNavigateToCatalogo só é ligado a telas fora de Configurações: reproduz a chamada de irParaTela.
    act(() => {
      ultimoRoteador().navigate(caminhos.configuracoes('procedimentos'), { state: { guarda: true } });
    });
    await assentarMuito();
    expect(await screen.findByText(MODAL)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar editando' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).toBeNull()); // sinal positivo: o aviso fechou; só então a negativa
    expect(noHorarios()).toBe(true);
  }, TIMEOUT);

  it('(d) sem alteração, Configurações no menu volta ao hub sem modal', async () => {
    await abrirHorarios({ sujar: false });
    await waitFor(() => expect(noHorarios()).toBe(true));
    menuConfig();
    await assentarMuito();
    await waitFor(() => expect(noHorarios()).toBe(false)); // sinal positivo antes da negativa
    expect(modal()).toBeNull();
    await waitFor(() => expect(screen.getAllByText(/Horários, feriados e mensagens/).length).toBeGreaterThan(0));
  }, TIMEOUT);
});
