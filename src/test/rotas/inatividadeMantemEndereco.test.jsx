/** Saída involuntária (inatividade, auth:expired local): mantém o endereço, não grava a marca e NÃO remonta a árvore. */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, montarApp } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';

const chaves = vi.hoisted(() => []);
vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../rotas/useChaveDaSessao.js', async (original) => {
  const real = await original();
  return {
    ...real,
    useChaveDaSessao: () => {
      const k = real.useChaveDaSessao();
      if (chaves[chaves.length - 1] !== k) chaves.push(k);
      return k;
    },
  };
});

describe('inatividade mantém o endereço', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
    chaves.length = 0;
  });

  it('auth:expired local em /agenda → login em /agenda, sem marca; mesma pessoa volta à Agenda sem remontar (chave não muda)', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ view: 'agenda' });
    const r = ultimoRoteador();
    expect(r.state.location.pathname).toBe(caminhos.agenda());
    await waitFor(() => expect(screen.queryByText('Entrar no Sistema')).toBeNull());
    expect(chaves).toEqual(['inicial']);
    const visitados = [];
    r.subscribe((s) => visitados.push(s.location.pathname));

    window.dispatchEvent(new CustomEvent('auth:expired', { detail: { scope: 'local' } }));
    await assentarMuito(8);

    expect(screen.getByText('Entrar no Sistema')).toBeTruthy();
    await waitFor(() => expect(r.state.location.pathname).toBe(caminhos.agenda()));
    await waitFor(() => expect(sessionStorage.getItem('procedi_saida_manual')).toBeNull());
    expect(chaves).toEqual(['inicial']);

    fireEvent.change(screen.getByPlaceholderText('E-mail ou nome cadastrado'), { target: { value: 'usr-1@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Sua senha'), { target: { value: 'segredo' } });
    fireEvent.click(screen.getByText('Entrar no Sistema'));
    await assentarMuito(8);

    await waitFor(() => expect(screen.queryByText('Entrar no Sistema')).toBeNull());
    await waitFor(() => expect(r.state.location.pathname).toBe(caminhos.agenda()));
    await waitFor(() => expect(visitados).not.toContain('/entrar'));
    expect(chaves).toEqual(['inicial']); // Inner não remontou
  }, TIMEOUT);
});
