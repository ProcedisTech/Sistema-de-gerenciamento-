/** Caminho desconhecido logado: "Página não encontrada" dentro do shell; /entrar logado sem marca volta a /pacientes. */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, montarApp } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

describe('rota desconhecida e /entrar logado', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('/xyz logado → "Página não encontrada" COM o menu lateral; o link leva a /pacientes', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp();
    const r = ultimoRoteador();
    await r.navigate('/xyz');
    await assentarMuito(8);

    expect(screen.getByText('Página não encontrada')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Sair do sistema/i }).length).toBeGreaterThan(0);
    expect(r.state.location.pathname).toBe('/xyz');

    fireEvent.click(screen.getByText('Ir para Pacientes'));
    await assentarMuito(8);
    expect(r.state.location.pathname).toBe(caminhos.pacientes());
    expect(screen.queryByText('Página não encontrada')).toBeNull();
  }, TIMEOUT);

  it('/entrar logado sem marca de saída manual → /pacientes (replace)', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ view: 'agenda' });
    const r = ultimoRoteador();
    await r.navigate(caminhos.entrar());
    await assentarMuito(8);

    expect(r.state.location.pathname).toBe(caminhos.pacientes());
    expect(r.state.historyAction).toBe('REPLACE');
  }, TIMEOUT);
});
