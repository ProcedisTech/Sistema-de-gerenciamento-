/** Onda 3 (testador de Configurações): lacunas de voltar/avançar, mesma seção, menu do topo, atalhos e termos. */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { flushSync } from 'react-dom';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { ToastProvider } from '../../contexts/ToastContext.jsx';
import { criarRotas } from '../../rotas/roteador.jsx';
import { TermosManager } from '../../components/termos/TermosManager.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotas = [['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade]];
const noHorarios = () => screen.queryByRole('switch', { name: /Terça-feira (in)?ativo/ }) !== null;
// No hub (seção zerada) aparece o card do grupo Agenda; dentro de uma seção, não.
const naoEhHub = () => screen.queryAllByText(/Horários, feriados e mensagens/).length === 0;
const caminho = () => ultimoRoteador().state.location.pathname;
const avisos = () => screen.queryAllByRole('heading', { name: 'Alterações não salvas' });
const sujar = async () => {
  fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
  await assentarMuito();
};
const irMenuAgenda = async () => {
  fireEvent.click(screen.getAllByRole('button', { name: /^Agenda$/ }).at(-1));
  await assentarMuito();
};
const voltar = async () => {
  act(() => { ultimoRoteador().navigate(-1); });
  await assentarMuito();
};

afterEach(() => {
  cleanup();
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Onda 3 Configurações: lacunas', () => {
  it('1) Horários -> Agenda (menu) -> Voltar volta a /configuracoes/horarios com Horários aberto', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    expect(noHorarios()).toBe(true);
    await irMenuAgenda();
    expect(caminho()).toBe('/agenda');
    await voltar();
    expect(caminho()).toBe('/configuracoes/horarios');
    expect(noHorarios()).toBe(true);
  }, TIMEOUT);

  it('2) clicar na MESMA seção com alteração não salva: sem aviso e sem perder o digitado', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    await sujar();
    const itemLateral = screen.getAllByRole('button', { name: /^Horário de atendimento/ }).find((b) => b.closest('aside'));
    expect(itemLateral).toBeTruthy();
    fireEvent.click(itemLateral);
    await assentarMuito();
    expect(avisos()).toHaveLength(0);
    expect(caminho()).toBe('/configuracoes/horarios');
    expect(screen.getByRole('switch', { name: 'Terça-feira ativo' })).toBeTruthy();
  }, TIMEOUT);

  it('3) Clínica / Perfil pelo menu do topo com horários sujos: sem guarda (igual a antes), vai à seção e descarta o digitado', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    await sujar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir dados da clínica' })[0]);
    await assentarMuito();
    expect(avisos()).toHaveLength(0);
    expect(caminho()).toBe('/configuracoes/clinica');
    expect(noHorarios()).toBe(false);
    // ACHADO (documentado, não corrigido): o "sujo" do App não zera ao pular para Clínica sem guarda; Voltar mostra aviso fantasma.
    await voltar();
    expect(avisos()).toHaveLength(1);
    expect(caminho()).toBe('/configuracoes/clinica');
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    expect(caminho()).toBe('/configuracoes/horarios');
    expect(screen.getByRole('switch', { name: 'Terça-feira inativo' })).toBeTruthy();
    await sujar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir perfil do profissional' })[0]);
    await assentarMuito();
    expect(avisos()).toHaveLength(0);
    expect(caminho()).toBe('/configuracoes/meu-perfil');
  }, TIMEOUT);

  it('4) atalho do catálogo (clique real na notificação) abre /configuracoes/procedimentos; métodos de assinatura idem pelo mesmo irParaTela', async () => {
    const notif = [{ id: 1, tipo: 'SUGESTAO_PROCEDIMENTO', lida: true, criadoEm: '2026-10-06T12:00:00Z', dados: {} }];
    await montarApp({
      caminho: '/notificacoes',
      rotas: [
        ['GET', /^\/api\/v1\/notificacoes$/, () => ({ content: notif, totalElements: 1, totalPages: 1, number: 0, size: 100 })],
        ['GET', /^\/api\/v1\/notificacoes\/count-nao-lidas$/, () => ({ count: 0 })],
      ],
    });
    const card = screen.getByText(/Sugestão de procedimento no catálogo/).closest('button');
    expect(card).toBeTruthy();
    fireEvent.click(card);
    await assentarMuito();
    await assentarMuito(4);
    expect(caminho()).toBe('/configuracoes/procedimentos');
    expect(naoEhHub()).toBe(true);
    // Métodos de assinatura: o handler fica no Step4LGPD (consulta); aqui só o mesmo irParaTela(guarda+secao) via navegação.
    const { caminhos } = await import('../../rotas/caminhos.js');
    act(() => { ultimoRoteador().navigate(caminhos.configuracoes('metodos-assinatura'), { state: { guarda: true } }); });
    await assentarMuito();
    expect(caminho()).toBe('/configuracoes/metodos-de-assinatura');
    expect(naoEhHub()).toBe(true);
  }, TIMEOUT);
});

// --- Termos (mesmo molde de termoFicha.test.jsx) ---
// Mock parcial: só o termo muda; o resto do serviço segue real (o App monta nos outros testes).
vi.mock('../../services/api', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, termosApi: { ...real.termosApi, list: vi.fn(async () => [{ id: 7, titulo: 'Termo Sete', conteudo: '<p>x</p>', ativo: true }]) } };
});
window.matchMedia ??= () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

describe('Termos: lacunas', () => {
  it('5) Novo termo -> Voltar -> Avançar reabre o editor; termo inexistente mostra Não encontrado com o menu de pé', async () => {
    const r = createMemoryRouter(criarRotas(<TermosManager />), { initialEntries: ['/configuracoes/termos'] });
    render(<ToastProvider><RouterProvider router={r} flushSync={flushSync} /></ToastProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /Novo Termo/ }));
    expect(r.state.location.pathname).toBe('/configuracoes/termos/novo');
    await screen.findByText('Novo Termo', { selector: 'h2,h3,h1,div,p,span' });
    act(() => { r.navigate(-1); });
    await waitFor(() => expect(r.state.location.pathname).toBe('/configuracoes/termos'));
    expect(screen.queryByText('Novo Termo', { selector: 'h2,h3,h1' })).toBeNull();
    act(() => { r.navigate(1); });
    await waitFor(() => expect(r.state.location.pathname).toBe('/configuracoes/termos/novo'));
    expect(await screen.findByText('Novo Termo', { selector: 'h2,h3,h1,div,p,span' })).toBeTruthy();
    cleanup();
    const r2 = createMemoryRouter(criarRotas(<TermosManager />), { initialEntries: ['/configuracoes/termos/999'] });
    render(<ToastProvider><RouterProvider router={r2} flushSync={flushSync} /></ToastProvider>);
    expect(await screen.findByText('Não encontrado')).toBeTruthy();
    cleanup();
    // dentro do App: o menu lateral de Configurações segue de pé ao lado do "Não encontrado"
    await montarApp({ caminho: '/configuracoes/termos/999' });
    expect(await screen.findByText('Não encontrado')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Termos de Consentimento/ }).some((b) => b.closest('aside'))).toBe(true);
  }, TIMEOUT);
});
