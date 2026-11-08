/** Menu "Configurações" (e atalhos do catálogo) dentro de Configurações com horários sujos: guarda igual à antiga. */
import { act, fireEvent, screen } from '@testing-library/react';
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
    expect(noHorarios()).toBe(true);

    menuConfig();
    await assentarMuito();
    expect(modal()).not.toBeNull();
    expect(screen.getByText(MODAL)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    await assentarMuito();
    expect(modal()).toBeNull();
    expect(noHorarios()).toBe(true);
    expect(screen.getByRole('switch', { name: 'Terça-feira ativo' })).toBeTruthy();

    menuConfig();
    await assentarMuito();
    expect(screen.getByText(MODAL)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    expect(modal()).toBeNull();
    expect(noHorarios()).toBe(false);
    expect(screen.getAllByText(/Horários, feriados e mensagens/).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('(c) atalho do catálogo (mesma chamada de irParaTela com guarda e secao) abre o modal e não troca a seção', async () => {
    await abrirHorarios({ sujar: true });
    // handleNavigateToCatalogo só é ligado a telas fora de Configurações: reproduz a chamada de irParaTela.
    act(() => {
      ultimoRoteador().navigate(caminhos.configuracoes('procedimentos'), { state: { guarda: true } });
    });
    await assentarMuito();
    expect(screen.getByText(MODAL)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    await assentarMuito();
    expect(noHorarios()).toBe(true);
  }, TIMEOUT);

  it('(d) sem alteração, Configurações no menu volta ao hub sem modal', async () => {
    await abrirHorarios({ sujar: false });
    expect(noHorarios()).toBe(true);
    menuConfig();
    await assentarMuito();
    expect(modal()).toBeNull();
    expect(noHorarios()).toBe(false);
    expect(screen.getAllByText(/Horários, feriados e mensagens/).length).toBeGreaterThan(0);
  }, TIMEOUT);
});
