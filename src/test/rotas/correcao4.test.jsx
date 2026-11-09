/** Correção 4 (Testador-C4): lacunas da Onda 3 — POP sempre bloqueado não cria aviso a mais, ficha existente, aviso fantasma, rascunho de termos. */
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
vi.mock('../../hooks/useProcedimentosOptions', () => ({ useProcedimentosOptions: () => ({ options: [], loading: false }) }));
vi.mock('../../components/anamnese/AnamneseDocumentoEditor.jsx', () => ({
  AnamneseDocumentoEditor: ({ onDirtyChange }) => <input aria-label="campo-ficha" onChange={() => onDirtyChange?.(true)} />,
}));
vi.mock('../../services/api', async (orig) => {
  const real = await orig();
  const termos = [
    { id: 7, titulo: 'Termo A', conteudo: '<p>a</p>', ativo: true },
    { id: 8, titulo: 'Termo B', conteudo: '<p>b</p>', ativo: true },
  ];
  return { ...real, termosApi: { ...real.termosApi, list: vi.fn(async () => termos), update: vi.fn(async () => ({})), create: vi.fn(async () => ({})) } };
});

window.matchMedia ??= () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotas = [
  ['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade],
  ['GET', /^\/api\/v1\/anamnese\/fichas$/, () => [{ id: 5, nome: 'Ficha Cinco', totalPerguntas: 1 }]],
];
const avisos = () => screen.queryAllByRole('heading', { name: 'Alterações não salvas' });
const caminho = () => ultimoRoteador().state.location.pathname;
const menu = async (nome) => { fireEvent.click(screen.getAllByRole('button', { name: nome })[0]); await assentarMuito(); };
const ir = async (d) => { act(() => { ultimoRoteador().navigate(d); }); await assentarMuito(); };
const campo = () => screen.queryByLabelText('campo-ficha');

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Correção 4 — Configurações', () => {
  it('1) sem alteração: Voltar/Avançar entre seções e para fora não mostram aviso', async () => {
    await montarApp({ view: 'pacientes', rotas });
    const pilhaVista = [caminho()];
    await menu(/^Configurações$/); pilhaVista.push(caminho());
    fireEvent.click(screen.getAllByText(/Horários, feriados e mensagens/)[0]); await assentarMuito(); pilhaVista.push(caminho());
    fireEvent.click(screen.getAllByRole('button', { name: 'Feriados' })[0]); await assentarMuito(); pilhaVista.push(caminho());
    const fim = caminho();
    // pilha montada acima (sem repetidos seguidos); Voltar/Avançar andam sobre ela e param nas pontas
    const pilha = [...new Set(pilhaVista)];
    expect(pilha.at(-1)).toBe(fim);
    let pos = pilha.length - 1;
    for (let i = 0; i < 4; i += 1) {
      pos = Math.max(0, pos - 1);
      await ir(-1);
      await waitFor(() => expect(caminho()).toBe(pilha[pos]));
      await waitFor(() => expect(avisos()).toHaveLength(0));
    }
    expect(caminho()).not.toBe(fim);
    for (let i = 0; i < 4; i += 1) {
      pos = Math.min(pilha.length - 1, pos + 1);
      await ir(1);
      await waitFor(() => expect(caminho()).toBe(pilha[pos]));
      await waitFor(() => expect(avisos()).toHaveLength(0));
    }
    expect(caminho()).toBe(fim);
  }, TIMEOUT);

  async function abrirFichaExistenteSuja() {
    await montarApp({ view: 'pacientes', rotas });
    await menu(/^Configurações$/);
    await waitFor(() => expect(caminho()).toBe('/configuracoes'));
    fireEvent.click(screen.getAllByText(/Fichas|Anamnese/)[0]); await assentarMuito();
    fireEvent.click(await screen.findByText('Ficha Cinco')); await assentarMuito();
    await waitFor(() => expect(caminho()).toBe('/configuracoes/fichas/5'));
    await waitFor(() => expect(campo()).not.toBeNull());
    fireEvent.change(campo(), { target: { value: 'texto' } }); await assentarMuito();
  }

  it('2) ficha existente suja + Voltar: avisa; continuar mantém texto/endereço; sair volta à lista sem novo aviso', async () => {
    await abrirFichaExistenteSuja();
    await ir(-1);
    await waitFor(() => expect(avisos()).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', { name: /continuar editando/i })); await assentarMuito();
    await waitFor(() => expect(avisos()).toHaveLength(0));
    await waitFor(() => expect(campo().value).toBe('texto'));
    await waitFor(() => expect(caminho()).toBe('/configuracoes/fichas/5'));
    await ir(-1);
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' })); await assentarMuito();
    await waitFor(() => expect(caminho()).toBe('/configuracoes/fichas'));
    await waitFor(() => expect(campo()).toBeNull());
    await ir(-1);
    await waitFor(() => expect(caminho()).toBe('/configuracoes'));
    await waitFor(() => expect(avisos()).toHaveLength(0));
  }, TIMEOUT);

  it('3) depois de "sair sem salvar", Agenda e de volta a Configurações: sem aviso fantasma', async () => {
    await abrirFichaExistenteSuja();
    await ir(-1);
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' })); await assentarMuito();
    await waitFor(() => expect(avisos()).toHaveLength(0)); // sinal positivo: o aviso fechou
    await menu(/^Agenda$/);
    await waitFor(() => expect(caminho()).toBe('/agenda'));
    await waitFor(() => expect(avisos()).toHaveLength(0));
    await menu(/^Configurações$/);
    await waitFor(() => expect(caminho()).toBe('/configuracoes'));
    await waitFor(() => expect(avisos()).toHaveLength(0));
    await ir(-1);
    await waitFor(() => expect(caminho()).toBe('/agenda'));
    await waitFor(() => expect(avisos()).toHaveLength(0));
    await ir(1);
    await waitFor(() => expect(caminho()).toBe('/configuracoes'));
    await waitFor(() => expect(avisos()).toHaveLength(0));
  }, TIMEOUT);
});

describe('Correção 4 — Termos: rascunho por id', () => {
  let roteador;
  const aqui = () => roteador.state.location.pathname;
  const nav = async (d) => { await act(async () => { await roteador.navigate(d); }); };
  const abrir = (nome) => {
    const i = [...screen.getAllByText(/^Termo [AB]$/)].findIndex((e) => e.textContent === nome);
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[i]);
  };
  afterEach(cleanup);

  it('4) A digitado > Voltar > B > Voltar > Voltar até A: documenta rascunho', async () => {
    roteador = createMemoryRouter(criarRotas(<TermosManager />), { initialEntries: ['/configuracoes/termos'] });
    render(<ToastProvider><RouterProvider router={roteador} flushSync={flushSync} /></ToastProvider>);
    await screen.findByText('Termo A');
    abrir('Termo A');
    const a = await screen.findByDisplayValue('Termo A');
    fireEvent.change(a, { target: { value: 'A digitado' } });
    await nav(-1);
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos'));
    abrir('Termo B');
    const b = await screen.findByDisplayValue('Termo B');
    await waitFor(() => expect(screen.queryByDisplayValue('A digitado')).toBeNull()); // B não herda texto de A
    expect(b).toBeTruthy();
    // Literal: abrir B depois do Voltar corta o Avançar de A; reabrir A mostra o texto salvo (openEdit descarta).
    await nav(-1);
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos'));
    await waitFor(() => expect(screen.queryByDisplayValue('A digitado')).toBeNull());
    abrir('Termo A');
    expect(await screen.findByDisplayValue('Termo A')).toBeTruthy();
    await waitFor(() => expect(screen.queryByDisplayValue('A digitado')).toBeNull());
  });

  it('4b) A digitado > vai direto a B pelo endereço > Voltar a A: rascunho de A se perde (1 slot)', async () => {
    roteador = createMemoryRouter(criarRotas(<TermosManager />), { initialEntries: ['/configuracoes/termos/7'] });
    render(<ToastProvider><RouterProvider router={roteador} flushSync={flushSync} /></ToastProvider>);
    fireEvent.change(await screen.findByDisplayValue('Termo A'), { target: { value: 'A digitado' } });
    await act(async () => { await roteador.navigate('/configuracoes/termos/8'); });
    expect(await screen.findByDisplayValue('Termo B')).toBeTruthy();
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos/8'));
    await waitFor(() => expect(screen.queryByDisplayValue('A digitado')).toBeNull());
    await nav(-1);
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos/7'));
    const achou = await screen.findByDisplayValue(/Termo A|A digitado/);
    expect(achou.value).toBe('Termo A'); // 🟢 documentado: 1 rascunho só; hidratar B descarta o de A (só por endereço direto)
  });
});
