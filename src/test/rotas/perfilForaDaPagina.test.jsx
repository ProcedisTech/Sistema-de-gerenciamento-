/** F5 em /pacientes/<id> de paciente que NÃO está na página carregada da lista: mostra o perfil dele, não a lista. */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, montarApp } from '../consulta/appConsulta.jsx';
import { pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const ID = 'c0000000-0000-4000-8000-0000000000ff';
const alvo = { ...pacienteDto, id: ID, nomeCompleto: 'Zuleica Fora Da Pagina', cpf: '11144477735' };
const outros = Array.from({ length: 20 }, (_, i) => ({
  ...pacienteDto,
  id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  nomeCompleto: `Paciente Pagina ${i + 1}`,
  cpf: `1000000${String(i).padStart(4, '0')}`,
}));

describe('perfil de paciente fora da página da lista', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('F5 em /pacientes/<id> mostra o perfil daquele paciente, não a lista', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({
      caminho: caminhos.paciente(ID),
      rotas: [
        ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({ content: outros, totalElements: 21, totalPages: 2, number: 0, size: 20 })],
        ['GET', new RegExp(`^/api/v1/pacientes/${ID}$`), () => alvo],
      ],
    });
    await waitFor(() => expect(screen.getAllByText(/Zuleica Fora Da Pagina/).length).toBeGreaterThan(0), { timeout: 8000 });
    await assentarMuito(6);
    await waitFor(() => expect(screen.queryByText('Paciente Pagina 1')).toBeNull());
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.paciente(ID));
  }, TIMEOUT);
});
