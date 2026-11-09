/** /pacientes/<id> que a API não acha: "Não encontrado" no lugar do perfil, mesmo endereço, menu de pé; erro 500 não vira "não encontrado". */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, montarApp } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const ID = 'c0000000-0000-4000-8000-0000000000ee';
const montar = (status) => montarApp({
  caminho: caminhos.paciente(ID),
  rotas: [['GET', new RegExp(`^/api/v1/pacientes/${ID}$`), () => ({ status, corpo: { error: 'x', status } })]],
});

describe('paciente do endereço que a API não devolve', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('404 → "Não encontrado" no lugar do perfil, mesmo endereço, menu lateral de pé', async () => {
    sessaoFalsa.definir('usr-1');
    await montar(404);
    expect(await screen.findByText('Não encontrado', {}, { timeout: 8000 })).toBeTruthy();
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.paciente(ID));
    expect(screen.getAllByRole('button', { name: /Sair do sistema/i }).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('500 → NÃO mostra "Não encontrado" (falha de servidor não é paciente inexistente)', async () => {
    sessaoFalsa.definir('usr-1');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await montar(500);
    await waitFor(() => expect(aviso).toHaveBeenCalledWith('usePacientePorId: falha ao buscar paciente', 500), { timeout: 8000 });
    await assentarMuito(8);
    await waitFor(() => expect(screen.queryByText('Não encontrado')).toBeNull());
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.paciente(ID));
    aviso.mockRestore();
  }, TIMEOUT);
});
