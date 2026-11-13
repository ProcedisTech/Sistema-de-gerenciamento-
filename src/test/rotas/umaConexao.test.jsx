/** Navegar pelo menu não remonta o AvisosProvider: um leitor (uma conexão SSE) por aba. */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { irPeloMenu } from './irPeloMenu.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

const leitores = vi.hoisted(() => ({ criados: 0, parados: 0 }));

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
// AvisosProvider REAL; só o leitor do canal é contado.
vi.mock('../../services/avisos/canalAvisos.js', async (importOriginal) => ({
  ...(await importOriginal()),
  criarLeitorAvisos: vi.fn(() => {
    leitores.criados += 1;
    return { iniciar: vi.fn(), parar: () => { leitores.parados += 1; } };
  }),
}));

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
  leitores.criados = 0;
  leitores.parados = 0;
});

describe('Uma conexão de avisos por aba', () => {
  it('3 navegações pelo menu mantêm 1 leitor, sem fechar nem reabrir', async () => {
    await montarApp({ view: 'pacientes' });
    expect(leitores.criados).toBe(1);

    for (const [nome, caminho] of [[/^Agenda$/, caminhos.agenda()], [/^Equipe$/, caminhos.equipe()], [/^Configurações$/, caminhos.configuracoes()]]) {
      if (String(nome) === String(/^Configurações$/)) await irPeloMenu(nome); else fireEvent.click(screen.getAllByRole('button', { name: nome })[0]);
      await assentarMuito();
      await waitFor(() => expect(ultimoRoteador().state.location.pathname).toBe(caminho));
    }

    await waitFor(() => expect(leitores.criados).toBe(1));
    await waitFor(() => expect(leitores.parados).toBe(0));
  }, TIMEOUT);
});
