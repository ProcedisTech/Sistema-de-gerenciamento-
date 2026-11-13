/** Barra de baixo (móvel) com horários não salvos: Agenda e Menu > Auditoria passam pela mesma guarda. */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import fixtures from '../fixtures/equipePrototype.json';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotas = [['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade]];
const modal = () => screen.queryByRole('heading', { name: 'Alterações não salvas' });
const noHorarios = () => screen.queryByRole('switch', { name: /Terça-feira (in)?ativo/ }) !== null;

async function comHorarioSujo() {
  await montarApp({ view: 'pacientes', rotas });
  fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Configurações' }));
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários, feriados e mensagens/)[0]);
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários de funcionamento/)[0]);
  await assentarMuito();
  fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
  await assentarMuito();
  await waitFor(() => expect(noHorarios()).toBe(true));
}

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Guarda de horários não salvos na barra de baixo', () => {
  it('tocar em Agenda abre "Alterações não salvas"', async () => {
    await comHorarioSujo();
    fireEvent.click(await screen.findByRole('button', { name: 'Agenda' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    await waitFor(() => expect(noHorarios()).toBe(true));
  }, TIMEOUT);

  it('Menu > Auditoria abre a mesma janela', async () => {
    await comHorarioSujo();
    fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Auditoria' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    await waitFor(() => expect(noHorarios()).toBe(true));
  }, TIMEOUT);
});

// Editor de perfil de acesso alterado: a mesma guarda vale para a barra de baixo e o menu.
describe('Guarda do editor de perfil na barra de baixo', () => {
  const rotasPerfil = [
    ['GET', /^\/api\/v1\/equipe$/, () => []],
    ['GET', /^\/api\/v1\/dimensoes\/(roles|especialidades)$/, () => []],
    ['GET', /^\/api\/v1\/perfis-acesso$/, () => []],
    ['GET', /^\/api\/v1\/permissoes$/, () => fixtures.catalog],
  ];
  const noEditor = () => screen.queryByRole('heading', { name: 'Novo perfil de acesso' }) !== null;

  async function comPerfilSujo() {
    await montarApp({ view: 'pacientes', rotas: rotasPerfil, caminho: caminhos.equipe('perfis') });
    await assentarMuito();
    const grupo = await screen.findByRole('radiogroup', { name: 'Nível em Agenda' });
    await waitFor(() => expect(within(grupo).getByRole('radio', { name: 'Só ver' })).not.toBeDisabled());
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Só ver' }));
    await assentarMuito();
  }

  it('tocar em Agenda abre "Alterações não salvas"', async () => {
    await comPerfilSujo();
    fireEvent.click(await screen.findByRole('button', { name: 'Agenda' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    await waitFor(() => expect(noEditor()).toBe(true));
  }, TIMEOUT);

  it('Menu > Auditoria abre a mesma janela', async () => {
    await comPerfilSujo();
    fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Auditoria' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    await waitFor(() => expect(noEditor()).toBe(true));
  }, TIMEOUT);
});
