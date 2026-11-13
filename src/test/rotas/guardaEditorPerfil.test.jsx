/** Editor de perfil de acesso com alteração não salva: Voltar, Cancelar e voltar do navegador passam pela guarda; salvar e sem alteração, não. */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import fixtures from '../fixtures/equipePrototype.json';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const rotas = [
  ['GET', /^\/api\/v1\/equipe$/, () => []],
  ['GET', /^\/api\/v1\/dimensoes\/(roles|especialidades)$/, () => []],
  ['GET', /^\/api\/v1\/perfis-acesso$/, () => []],
  ['GET', /^\/api\/v1\/permissoes$/, () => fixtures.catalog],
  ['POST', /^\/api\/v1\/perfis-acesso$/, ({ body }) => ({ id: 'novo-1', nome: body.nome, descricao: '' })],
  ['PUT', /^\/api\/v1\/perfis-acesso\/[^/]+\/permissoes$/, () => ({})],
];
const AVISO_EQUIPE = 'Você tem alterações não salvas na Gestão de equipe.';
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
const noEditor = () => screen.queryByRole('heading', { name: 'Novo perfil de acesso' }) !== null;
const caminho = () => ultimoRoteador().state.location.pathname;

async function abrirEditor({ sujar, comHistoria = false }) {
  await montarApp({ view: 'pacientes', rotas, caminho: comHistoria ? undefined : caminhos.equipe('perfis') });
  if (comHistoria) {
    await assentarMuito();
    act(() => {
      ultimoRoteador().navigate(caminhos.equipe('perfis'));
    });
  }
  await assentarMuito();
  await waitFor(() => expect(noEditor()).toBe(true));
  if (sujar) {
    const grupo = await screen.findByRole('radiogroup', { name: 'Nível em Agenda' });
    await waitFor(() => expect(within(grupo).getByRole('radio', { name: 'Só ver' })).not.toBeDisabled());
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Só ver' }));
    await assentarMuito();
  }
}
const clicar = async (nome) => {
  fireEvent.click(await screen.findByRole('button', { name: nome }));
  await assentarMuito();
};

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Guarda do editor de perfil de acesso', () => {
  it('Voltar (Gestão de Equipe) com alteração abre a janela; Continuar editando fica no editor', async () => {
    await abrirEditor({ sujar: true });
    await clicar(/Gestão de Equipe/);
    await waitFor(() => expect(modal()).not.toBeNull());
    await clicar('Continuar editando');
    await waitFor(() => expect(modal()).toBeNull()); // sinal positivo: a janela fechou; só então a negativa
    expect(caminho()).toBe(caminhos.equipe('perfis'));
    expect(noEditor()).toBe(true);
  }, TIMEOUT);

  it('Cancelar com alteração abre a janela; Sair sem salvar vai para /equipe', async () => {
    await abrirEditor({ sujar: true });
    await clicar('Cancelar');
    await waitFor(() => expect(modal()).not.toBeNull());
    await clicar('Sair sem salvar');
    await waitFor(() => expect(caminho()).toBe(caminhos.equipe()));
    await waitFor(() => expect(modal()).toBeNull());
  }, TIMEOUT);

  it('voltar do navegador com alteração abre a janela', async () => {
    await abrirEditor({ sujar: true, comHistoria: true });
    act(() => {
      ultimoRoteador().navigate(-1);
    });
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    await waitFor(() => expect(noEditor()).toBe(true));
  }, TIMEOUT);

  it('salvar não abre a janela e volta para /equipe', async () => {
    await abrirEditor({ sujar: true });
    fireEvent.change(screen.getByLabelText('Nome do perfil'), { target: { value: 'Perfil Teste' } });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Salvar perfil' }))[0]);
    await assentarMuito();
    await waitFor(() => expect(caminho()).toBe(caminhos.equipe()));
    expect(modal()).toBeNull(); // só depois de chegar em /equipe
  }, TIMEOUT);

  it('sem alteração, Cancelar sai direto', async () => {
    await abrirEditor({ sujar: false });
    await clicar('Cancelar');
    await waitFor(() => expect(caminho()).toBe(caminhos.equipe()));
    expect(modal()).toBeNull(); // só depois de chegar em /equipe
  }, TIMEOUT);

  it('alteração no editor de perfil: ao sair a janela diz "Gestão de equipe"', async () => {
    await abrirEditor({ sujar: true });
    await clicar(/Gestão de Equipe/);
    await waitFor(() => expect(modal()).not.toBeNull());
    expect(await screen.findByText(AVISO_EQUIPE)).toBeTruthy();
  }, TIMEOUT);

  it('alteração na aba Acesso da pessoa: ao sair a janela diz "Gestão de equipe"', async () => {
    await montarApp({ view: 'pacientes', rotas: rotasPessoa, caminho: caminhos.membro(OUTRO) });
    await assentarMuito();
    fireEvent.click(await screen.findByRole('tab', { name: 'Acesso', exact: true }));
    await assentarMuito();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Perfil Base' }), { target: { value: 'rec' } });
    await assentarMuito();
    await screen.findByRole('region', { name: 'Salvar acesso' }); // sinal positivo: está sujo
    act(() => {
      ultimoRoteador().navigate(caminhos.equipe());
    });
    await assentarMuito();
    await waitFor(() => expect(modal()).not.toBeNull());
    expect(await screen.findByText(AVISO_EQUIPE)).toBeTruthy();
  }, TIMEOUT);
});
