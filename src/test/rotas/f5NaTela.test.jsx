/** F5 na tela: o endereço manda; remontar no mesmo caminho mostra a mesma tela e nada de activeView no storage. */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('F5 na tela', () => {
  it('Agenda continua Agenda depois de remontar no mesmo caminho; activeView não é gravado', async () => {
    const primeira = await montarApp({ view: 'agenda' });
    expect(primeira).toBeTruthy();
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.agenda());
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    cleanup();
    sessionStorage.clear();
    await montarApp({ view: 'agenda' });
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.agenda());
    expect(screen.getAllByText('Dia livre').length).toBeGreaterThan(0);

    sessionStorage.removeItem('activeView'); // semeado pelo montarApp; o app não pode regravar
    fireEvent.click(screen.getAllByRole('button', { name: /^Pacientes$/ })[0]);
    await assentarMuito();
    await waitFor(() => expect(ultimoRoteador().state.location.pathname).toBe(caminhos.pacientes()));
    await waitFor(() => expect(sessionStorage.getItem('activeView')).toBeNull());
  }, TIMEOUT);
});
