/** Menu lateral empilha histórico: Voltar/Avançar do navegador andam tela a tela e o app nunca sai. */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { irPeloMenu } from './irPeloMenu.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const caminho = () => ultimoRoteador().state.location.pathname;
const clicarMenu = async (nome) => {
  if (String(nome) === String(/^Configurações$/)) await irPeloMenu(nome); else fireEvent.click(screen.getAllByRole('button', { name: nome })[0]);
  await assentarMuito();
};
const irPara = async (delta) => {
  act(() => {
    ultimoRoteador().navigate(delta);
  });
  await assentarMuito();
};

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Voltar e Avançar entre telas do menu', () => {
  it('Pacientes > Agenda > Equipe > Configurações; voltar volta tela a tela; avançar avança', async () => {
    await montarApp({ view: 'pacientes' });
    await waitFor(() => expect(caminho()).toBe(caminhos.pacientes()));

    await clicarMenu(/^Agenda$/);
    await waitFor(() => expect(caminho()).toBe(caminhos.agenda()));
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    await clicarMenu(/^Equipe$/);
    await waitFor(() => expect(caminho()).toBe(caminhos.equipe()));
    expect(await screen.findByLabelText('Filtros rápidos de status')).toBeTruthy();

    await clicarMenu(/^Configurações$/);
    await waitFor(() => expect(caminho()).toBe(caminhos.configuracoes()));
    expect(screen.getAllByText('Selecione uma área para configurar').length).toBeGreaterThan(0);

    await irPara(-1);
    await waitFor(() => expect(caminho()).toBe(caminhos.equipe()));
    expect(await screen.findByLabelText('Filtros rápidos de status')).toBeTruthy();

    await irPara(-1);
    await waitFor(() => expect(caminho()).toBe(caminhos.agenda()));
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    await irPara(-1);
    await waitFor(() => expect(caminho()).toBe(caminhos.pacientes()));
    expect(screen.getAllByText('Próximos aniversários').length).toBeGreaterThan(0);

    await irPara(1);
    await waitFor(() => expect(caminho()).toBe(caminhos.agenda()));
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    await irPara(1);
    await irPara(1);
    await waitFor(() => expect(caminho()).toBe(caminhos.configuracoes()));
    expect(screen.getAllByText('Selecione uma área para configurar').length).toBeGreaterThan(0);
  }, TIMEOUT);
});
