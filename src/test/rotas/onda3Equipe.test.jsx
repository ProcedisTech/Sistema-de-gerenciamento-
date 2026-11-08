/** Onda 3 (Equipe) com o App MONTADO: guarda de permissão, /equipe/me, Voltar/Avançar, F5 e chaves na saída. */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { PERMISSOES } from '../../constants/permissoes.js';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const OUTRO = 'bbbbbbbb-0000-4000-8000-000000000002';
const equipe = [
  { id: ROLE_USER_ID, nomeCompleto: 'Beatriz Lima', perfilAcessoId: 'p1', perfilAcessoNome: 'Dono', roleId: 'd', roleName: 'DENTISTA', ativo: true },
  { id: OUTRO, nomeCompleto: 'Bruno Silva', perfilAcessoId: 'p1', perfilAcessoNome: 'Dono', roleId: 'd', roleName: 'DENTISTA', ativo: true },
];
const rotas = [
  ['GET', /^\/api\/v1\/equipe$/, () => equipe],
  ['GET', /^\/api\/v1\/perfil$/, () => ({ id: ROLE_USER_ID, nomeCompleto: 'Beatriz Pessoal' })],
];
const SEM_EQUIPE = Object.values(PERMISSOES).filter((p) => p !== PERMISSOES.USUARIO_VER);
const r = () => ultimoRoteador();
const local = () => r().state.location.pathname;
const irPara = async (delta) => { act(() => { r().navigate(delta); }); await assentarMuito(); };

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Onda 3 Equipe com o App montado', () => {
  it('sem permissão de equipe, /equipe/<outro> redireciona a /pacientes e a história não cresce', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ permissoes: SEM_EQUIPE, rotas, caminho: caminhos.membro(OUTRO) });
    expect(local()).toBe(caminhos.pacientes());
    expect(r().state.historyAction).toBe('REPLACE');
    expect(screen.queryByText('Bruno Silva')).toBeNull();
    // história: voltar não leva de volta a /equipe/<outro>
    await irPara(-1);
    expect(local()).not.toBe(caminhos.membro(OUTRO));
  }, TIMEOUT);

  it('a mesma pessoa abre /equipe/me e vê o próprio perfil', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ permissoes: SEM_EQUIPE, rotas, caminho: caminhos.membro('me') });
    expect(local()).toBe(caminhos.membro('me'));
    expect(screen.queryByText('Você não tem permissão para visualizar a equipe.')).toBeNull();
    expect(screen.getAllByText(/Beatriz/).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('a mesma pessoa abre /equipe/<seu id> e vê o próprio perfil', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ permissoes: SEM_EQUIPE, rotas, caminho: caminhos.membro(ROLE_USER_ID) });
    expect(local()).toBe(caminhos.membro(ROLE_USER_ID));
    expect(screen.getAllByText(/Beatriz/).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('com permissão: lista → membro → Voltar → lista → Avançar → membro aberto', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ rotas, caminho: caminhos.equipe() });
    fireEvent.click(screen.getByRole('button', { name: 'Ver Bruno Silva' }));
    await assentarMuito();
    expect(local()).toBe(caminhos.membro(OUTRO));
    expect(screen.getAllByText(/Bruno Silva/).length).toBeGreaterThan(0);
    await irPara(-1);
    expect(local()).toBe(caminhos.equipe());
    expect(screen.getByRole('button', { name: 'Ver Bruno Silva' })).toBeTruthy();
    await irPara(1);
    expect(local()).toBe(caminhos.membro(OUTRO));
    expect(screen.queryByRole('button', { name: 'Ver Bruno Silva' })).toBeNull();
    expect(screen.getAllByText(/Bruno Silva/).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('F5 em /equipe/<id> abre o mesmo membro', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ rotas, caminho: caminhos.membro(OUTRO) });
    expect(local()).toBe(caminhos.membro(OUTRO));
    expect(screen.queryByText('Não encontrado')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver Bruno Silva' })).toBeNull(); // não é a lista
    expect(screen.getAllByText(/Bruno Silva/).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('Sair apaga as chaves de tela; novo login cai em /pacientes', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ rotas, caminho: caminhos.equipe() });
    sessionStorage.setItem('procedi_config_section', 'clinica');
    sessionStorage.setItem('procedi_config_tab', 'equipe');
    sessionStorage.setItem('activeView', 'gestao-equipe');
    fireEvent.click(screen.getAllByRole('button', { name: /Sair do sistema/i })[0]);
    await assentarMuito(8);
    expect(local()).toBe(caminhos.entrar());
    for (const k of ['procedi_config_section', 'procedi_config_tab', 'activeView']) expect(sessionStorage.getItem(k)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('E-mail ou nome cadastrado'), { target: { value: 'usr-1@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Sua senha'), { target: { value: 'segredo' } });
    fireEvent.click(screen.getByText('Entrar no Sistema'));
    await assentarMuito(8);
    expect(local()).toBe(caminhos.pacientes());
  }, TIMEOUT);
});
