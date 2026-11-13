// Item 8: ao atribuir perfil (onEquipeInvalidate), a pendência da Equipe no menu é recarregada.
// equipeApi.list é mockado no formato real (request() devolve o JSON: a lista pronta, sem .ok/.json).
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, montarApp } from '../consulta/appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../components/configuracoes/index.js', async (importOriginal) => {
  const real = await importOriginal();
  const Stub = (p) => <button type="button" onClick={() => globalThis.__atribuir?.(p.onEquipeInvalidate)}>Atribuir (stub)</button>;
  return { ...real, ConfiguracoesView: Stub, GestaoUsuariosView: Stub };
});
vi.mock('../../services/api.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, equipeApi: { ...real.equipeApi, list: () => globalThis.__equipeLista() } };
});

const usuario = { id: 'ru-9', usuarioId: 'u-9', nomeCompleto: 'Sem Perfil', ativo: true };
let atribuido;
function lista() {
  const dados = [atribuido ? { ...usuario, perfilAcessoId: 'p-1' } : usuario];
  return Promise.resolve(dados); // formato real de equipeApi.list(): a lista pronta
}
// Sidebar ("Gestão de Equipe") e barra móvel ("Equipe") levam o contador no nome acessível.
const comPendencia = () => screen.queryAllByRole('button').some((b) => /Equipe · 1 pendência/.test(b.getAttribute('aria-label') || ''));

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
  delete globalThis.__atribuir;
  delete globalThis.__equipeLista;
});

describe.each([
  ['A: Configurações', 'configuracoes'],
  ['B: Gestão de equipe', 'gestao-equipe'],
])('pendência da Equipe recarrega ao atribuir perfil (%s)', (_n, view) => {
  it('some o "· 1 pendência" do item Equipe depois do onEquipeInvalidate', async () => {
    atribuido = false;
    globalThis.__equipeLista = lista;
    globalThis.__atribuir = (cb) => { atribuido = true; cb(); };
    await montarApp({ view });
    await waitFor(() => expect(comPendencia()).toBe(true), { timeout: 10000 });
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir (stub)' }));
    await waitFor(() => expect(comPendencia()).toBe(false), { timeout: 10000 });
  }, TIMEOUT);
});
