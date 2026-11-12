/** Correção 2 (Onda 2): lacunas — voltar para paciente fora da página, cancelar empilha, busca após o limite. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, montarApp } from '../consulta/appConsulta.jsx';
import { pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
vi.mock('../../components/patients/PatientForm.jsx', () => ({
  PatientForm: ({ onCancel }) => <button type="button" onClick={onCancel}>Cancelar cadastro</button>,
}));

// Só o `it` 3 liga os falsos (componente isolado); nos demais vale o módulo real.
const falso = globalThis.__c2Falso = { ligado: false };
vi.mock('../../hooks/usePapel', async (orig) => {
  const real = await orig();
  return { ...real, usePapel: (...a) => (globalThis.__c2Falso.ligado ? { isNivel1: false } : real.usePapel(...a)) };
});
vi.mock('../../components/hooks/useAgoraDaClinica.js', async (orig) => {
  const real = await orig();
  return { ...real, useAgoraDaClinica: (...a) => (globalThis.__c2Falso.ligado ? { fuso: 'America/Sao_Paulo', hojeIso: '2026-11-07' } : real.useAgoraDaClinica(...a)) };
});
vi.mock('../../contexts/useToast.js', async (orig) => {
  const real = await orig();
  return { ...real, useToast: (...a) => (globalThis.__c2Falso.ligado ? { error: () => {}, success: () => {} } : real.useToast(...a)) };
});

const IDA = 'c0000000-0000-4000-8000-0000000000ff';
const dtoA = { ...pacienteDto, id: IDA, nomeCompleto: 'Zuleica Fora Da Pagina', cpf: '11144477735' };
const outros = Array.from({ length: 20 }, (_, i) => ({
  ...pacienteDto,
  id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  nomeCompleto: `Paciente Pagina ${i + 1}`,
  cpf: `1000000${String(i).padStart(4, '0')}`,
}));
const B = outros[0];
const rotasLista = [
  ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({ content: outros, totalElements: 21, totalPages: 2, number: 0, size: 20 })],
  ['GET', new RegExp(`^/api/v1/pacientes/${IDA}$`), () => dtoA],
  ['GET', new RegExp(`^/api/v1/pacientes/${B.id}$`), () => B],
];

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  falso.ligado = false;
});

describe('correção 2 — lacunas', () => {
  it('1) voltar de B (na página) para A (fora da página) mostra o perfil de A, sem A duplicado', async () => {
    const erros = vi.spyOn(console, 'error');
    sessaoFalsa.definir('usr-1');
    await montarApp({ caminho: caminhos.paciente(IDA), rotas: rotasLista });
    await waitFor(() => expect(screen.getAllByText(/Zuleica Fora Da Pagina/).length).toBeGreaterThan(0), { timeout: 8000 });

    act(() => { ultimoRoteador().navigate(caminhos.paciente(B.id)); });
    await assentarMuito(6);
    await waitFor(() => expect(screen.getAllByText(/Paciente Pagina 1\b/).length).toBeGreaterThan(0), { timeout: 8000 });

    act(() => { ultimoRoteador().navigate(-1); });
    await assentarMuito(6);
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.paciente(IDA));
    await waitFor(() => expect(screen.getAllByText(/Zuleica Fora Da Pagina/).length).toBeGreaterThan(0), { timeout: 8000 });

    // volta à lista: A não está na página; não pode aparecer (nem duplicado)
    act(() => { ultimoRoteador().navigate(caminhos.pacientes()); });
    await assentarMuito(6);
    expect(screen.queryAllByText(/Zuleica Fora Da Pagina/).length).toBe(0);
    const chaveDuplicada = erros.mock.calls.some((c) => String(c[0]).includes('same key'));
    expect(chaveDuplicada).toBe(false);
  }, TIMEOUT);

  it('3) Cancelar e Esc do cadastro continuam EMPILHANDO (só o retorno automático substitui)', async () => {
    falso.ligado = true;
    const { PatientCreateView } = await import('../../components/patients/PatientCreateView.jsx');
    const montar = (extras = {}) => {
      let r;
      const Tela = () => <PatientCreateView rota={{ rotaId: 'pacienteNovo' }} voltarParaLista={(o) => r.navigate('/pacientes', o)} {...extras} />;
      r = createMemoryRouter(
        [{ path: '/pacientes', element: <p>Lista</p> }, { path: '/pacientes/novo', element: <Tela /> }],
        { initialEntries: ['/pacientes', '/pacientes/novo'], initialIndex: 1 },
      );
      return { r, ui: render(<RouterProvider router={r} />) };
    };
    const a = montar();
    await act(async () => { fireEvent.click(screen.getByText('Cancelar cadastro')); });
    expect(a.r.state.location.pathname).toBe('/pacientes');
    expect(a.r.state.historyAction).toBe('PUSH');
    await act(async () => { await a.r.navigate(-1); });
    expect(a.r.state.location.pathname).toBe('/pacientes/novo');
    a.ui.unmount();
    const b = montar({ variant: 'modal' });
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(b.r.state.location.pathname).toBe('/pacientes');
    expect(b.r.state.historyAction).toBe('PUSH');
    await act(async () => { await b.r.navigate(-1); });
    expect(b.r.state.location.pathname).toBe('/pacientes/novo');
  });

  it('4) busca de texto: depois do limite de página, trocar o texto busca de novo, sem navegação por efeito', async () => {
    sessaoFalsa.definir('usr-1');
    const mk = (pref, n) => Array.from({ length: n }, (_, i) => ({
      ...pacienteDto, id: `c0000000-0000-4000-8000-${pref}${String(i + 1).padStart(11 - pref.length + 1, '0')}`.slice(0, 36),
      nomeCompleto: `${pref === 'a' ? 'Ana' : 'Bia'} Nome ${String(i + 1).padStart(2, '0')}`, cpf: `${pref === 'a' ? '2' : '3'}00000${String(i).padStart(5, '0')}`,
    }));
    const anas = mk('a', 25);
    const bias = mk('b', 3);
    const chamadas = [];
    await montarApp({
      caminho: caminhos.pacientes(),
      rotas: [['GET', /^\/api\/v1\/pacientes\/search$/, (ctx) => {
        const q = String(new URLSearchParams(ctx.query).get('q') ?? '');
        chamadas.push(q);
        return { content: q.startsWith('ana') ? anas : q.startsWith('bia') ? bias : outros, totalElements: 0, totalPages: 1, number: 0, size: 20 };
      }]],
    });
    const caixa = screen.getAllByPlaceholderText(/Buscar por nome, CPF ou telefone/)[0];
    fireEvent.change(caixa, { target: { value: 'ana' } });
    await assentarMuito(6);
    await waitFor(() => expect(screen.getAllByText('Ana Nome 01').length).toBeGreaterThan(0), { timeout: 8000 });
    // endereço pede a página 10, mas a busca só tem 2: mostra a última (itens 21–25)
    act(() => { ultimoRoteador().navigate('/pacientes?pagina=10'); });
    await assentarMuito(6);
    await waitFor(() => expect(screen.getAllByText('Ana Nome 25').length).toBeGreaterThan(0), { timeout: 8000 });
    const antes = ultimoRoteador().state.location;
    // trocar o texto busca de novo e a lista atualiza
    fireEvent.change(caixa, { target: { value: 'bia' } });
    await assentarMuito(6);
    await waitFor(() => expect(screen.getAllByText('Bia Nome 01').length).toBeGreaterThan(0), { timeout: 8000 });
    expect(screen.queryAllByText('Ana Nome 25').length).toBe(0);
    expect(chamadas.some((q) => q.startsWith('bia'))).toBe(true);
    // o efeito não navega: depois de assentar, o endereço não muda mais
    const depois = ultimoRoteador().state.location;
    await assentarMuito(6);
    expect(ultimoRoteador().state.location).toBe(depois);
    expect(antes.pathname).toBe(depois.pathname);
  }, TIMEOUT);
});
