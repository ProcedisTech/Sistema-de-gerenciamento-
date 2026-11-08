/** Guarda de alterações não salvas nos horários: Voltar (POP) abre o modal; atalho da agenda (sem guarda) não. */
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
const caminho = () => ultimoRoteador().state.location.pathname;

async function abrirHorariosSujos() {
  await montarApp({ view: 'pacientes', rotas });
  fireEvent.click(screen.getAllByRole('button', { name: /^Configurações$/ })[0]);
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários, feriados e mensagens/)[0]);
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários de funcionamento/)[0]);
  await assentarMuito();
  fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
  await assentarMuito();
}

const voltar = async () => {
  act(() => {
    ultimoRoteador().navigate(-1);
  });
  await assentarMuito();
};

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Guarda de horários não salvos', () => {
  it('Voltar com horários sujos abre o modal; Continuar editando fica; Sair sem salvar sai', async () => {
    await abrirHorariosSujos();
    const aqui = caminho();
    await waitFor(() => expect(aqui.startsWith(caminhos.configuracoes())).toBe(true));

    await voltar();
    await waitFor(() => expect(modal()).not.toBeNull());
    expect(await screen.findByText(MODAL)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar editando' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).toBeNull()); // sinal positivo: o aviso fechou; só então a negativa
    expect(caminho()).toBe(aqui);
    expect(await screen.findByRole('switch', { name: 'Terça-feira ativo' })).toBeTruthy();

    await voltar();
    expect(await screen.findByText(MODAL)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    await waitFor(() => expect(modal()).toBeNull());
    await waitFor(() => expect(caminho()).not.toBe(aqui));
  }, TIMEOUT);

  it('atalho da agenda de dentro de Configurações (sem guarda) não mostra o modal', async () => {
    await abrirHorariosSujos();
    // mesma chamada do onNavigateAgenda do App: navigate(caminhos.agenda()), sem state.guarda
    act(() => {
      ultimoRoteador().navigate(caminhos.agenda());
    });
    await assentarMuito();
    await waitFor(() => expect(caminho()).toBe(caminhos.agenda())); // sinal positivo antes da negativa
    expect(modal()).toBeNull();
  }, TIMEOUT);
});
