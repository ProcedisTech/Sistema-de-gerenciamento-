/** Menu lateral empilha histórico: Voltar/Avançar do navegador andam tela a tela e o app nunca sai. */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const caminho = () => ultimoRoteador().state.location.pathname;
const clicarMenu = async (nome) => {
  fireEvent.click(screen.getAllByRole('button', { name: nome })[0]);
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
    expect(caminho()).toBe(caminhos.pacientes());

    await clicarMenu(/^Agenda$/);
    expect(caminho()).toBe(caminhos.agenda());
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    await clicarMenu(/^Equipe$/);
    expect(caminho()).toBe(caminhos.equipe());
    expect(screen.getByText('Quem trabalha na clínica, o que cada um faz e o que pode acessar.')).toBeTruthy();

    await clicarMenu(/^Configurações$/);
    expect(caminho()).toBe(caminhos.configuracoes());
    expect(screen.getAllByText('Selecione uma área para configurar').length).toBeGreaterThan(0);

    await irPara(-1);
    expect(caminho()).toBe(caminhos.equipe());
    expect(screen.getByText('Quem trabalha na clínica, o que cada um faz e o que pode acessar.')).toBeTruthy();

    await irPara(-1);
    expect(caminho()).toBe(caminhos.agenda());
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    await irPara(-1);
    expect(caminho()).toBe(caminhos.pacientes());
    expect(screen.getAllByText('Próximos aniversários').length).toBeGreaterThan(0);

    await irPara(1);
    expect(caminho()).toBe(caminhos.agenda());
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    await irPara(1);
    await irPara(1);
    expect(caminho()).toBe(caminhos.configuracoes());
    expect(screen.getAllByText('Selecione uma área para configurar').length).toBeGreaterThan(0);
  }, TIMEOUT);
});
