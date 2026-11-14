/** Gestão de equipe com alteração não salva (acesso da pessoa ou editor de perfil) trava a atualização do app; descartar libera. */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from '../rotas/montarComRoteador.jsx';
import { ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import { estaTravado, liberar } from '../../pwa/travaAtualizacao.js';
import fixtures from '../fixtures/equipePrototype.json';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../hooks/useMediaQuery.js', () => ({ useMediaQuery: (q) => q === '(min-width: 1024px)' }));

// Rotas copiadas de guardaEditorPerfil.test.jsx (editor de perfil e acesso da pessoa).
const rotasPerfil = [
  ['GET', /^\/api\/v1\/equipe$/, () => []],
  ['GET', /^\/api\/v1\/dimensoes\/(roles|especialidades)$/, () => []],
  ['GET', /^\/api\/v1\/perfis-acesso$/, () => []],
  ['GET', /^\/api\/v1\/permissoes$/, () => fixtures.catalog],
];
const OUTRO = 'bbbbbbbb-0000-4000-8000-000000000002';
const rotasPessoa = [
  ['GET', /^\/api\/v1\/equipe$/, () => [
    { id: ROLE_USER_ID, nomeCompleto: 'Beatriz Lima', perfilAcessoId: 'dono', perfilAcessoCodigo: 'DONO', perfilAcessoNome: 'Dono', roleId: 'd', roleName: 'DENTISTA', ativo: true },
    { id: OUTRO, nomeCompleto: 'Bruno Silva', perfilAcessoId: 'clinico', perfilAcessoNome: 'Clínico', roleId: 'd', roleName: 'DENTISTA', ativo: true },
  ]],
  ['GET', /^\/api\/v1\/dimensoes\/(roles|especialidades)$/, () => []],
  ['GET', /^\/api\/v1\/perfis-acesso$/, () => [
    { id: 'dono', nome: 'Dono', codigo: 'DONO' }, { id: 'clinico', nome: 'Clínico' }, { id: 'rec', nome: 'Recepção' },
  ]],
  ['GET', /^\/api\/v1\/permissoes$/, () => fixtures.catalog],
  ['GET', /^\/api\/v1\/perfis-acesso\/clinico\/permissoes$/, () => ['agenda:VER', 'AGENDA_CRIAR']],
  ['GET', /^\/api\/v1\/perfis-acesso\/rec\/permissoes$/, () => ['agenda:VER']],
  ['GET', /^\/api\/v1\/perfis-acesso\/dono\/permissoes$/, () => ['agenda:VER']],
];
const modal = () => screen.queryByRole('heading', { name: 'Alterações não salvas' });
const caminho = () => ultimoRoteador().state.location.pathname;

// Abre a aba Acesso da pessoa; devolve com a tela carregada e ainda limpa.
async function abrirAcessoPessoa() {
  await montarApp({ view: 'pacientes', rotas: rotasPessoa, caminho: caminhos.membro(OUTRO) });
  await assentarMuito();
  fireEvent.click(await screen.findByRole('tab', { name: 'Acesso', exact: true }));
  await assentarMuito();
  return screen.findByRole('combobox', { name: 'Perfil Base' }); // sinal positivo: tela carregada
}
const sujarPessoa = async (combo) => {
  fireEvent.change(combo, { target: { value: 'rec' } });
  await assentarMuito();
  await screen.findByRole('region', { name: 'Salvar acesso' }); // sinal positivo: está sujo
};

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
  liberar('config');
  liberar('equipe');
});

describe('trava de atualização pela Gestão de equipe', () => {
  it('acesso da pessoa alterado e não salvo trava', async () => {
    const combo = await abrirAcessoPessoa();
    expect(estaTravado()).toBe(false);
    await sujarPessoa(combo);
    await waitFor(() => expect(estaTravado()).toBe(true));
  }, TIMEOUT);

  it('acesso da pessoa: descartar pela guarda de navegação libera', async () => {
    const combo = await abrirAcessoPessoa();
    expect(estaTravado()).toBe(false);
    await sujarPessoa(combo);
    await waitFor(() => expect(estaTravado()).toBe(true));
    act(() => { ultimoRoteador().navigate(caminhos.equipe()); });
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    await waitFor(() => expect(caminho()).toBe(caminhos.equipe()));
    await waitFor(() => expect(modal()).toBeNull()); // sinal positivo: guarda fechou e a tela seguinte abriu
    expect(estaTravado()).toBe(false);
  }, TIMEOUT);

  it('editor de perfil de acesso alterado e não salvo trava', async () => {
    await montarApp({ view: 'pacientes', rotas: rotasPerfil, caminho: caminhos.equipe('perfis') });
    await assentarMuito();
    await screen.findByRole('heading', { name: 'Novo perfil de acesso' }); // sinal positivo: editor carregado
    const grupo = await screen.findByRole('radiogroup', { name: 'Nível em Agenda' });
    await waitFor(() => expect(within(grupo).getByRole('radio', { name: 'Só ver' })).not.toBeDisabled());
    expect(estaTravado()).toBe(false);
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Só ver' }));
    await assentarMuito();
    await waitFor(() => expect(estaTravado()).toBe(true));
  }, TIMEOUT);
});
