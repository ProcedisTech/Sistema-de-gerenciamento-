import { createElement, useEffect, useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { usePatientState } from '../../components/hooks/usePatientState.js';
import { criarAvisosFalsos } from '../avisosFalsos.jsx';

vi.mock('../../contexts/OrgContext', () => ({
  useOrg: () => ({ fusoHorario: 'America/Sao_Paulo', recarregarContextoOrg: () => {} }),
}));
vi.mock('../../services/api', () => ({
  pacientesApi: {
    list: async () => ({ content: [], first: true, last: true, totalPages: 5, number: 0, totalElements: 0 }),
    search: async () => ({ content: Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, nome: `Paciente ${i}` })) }),
  },
  patientListSortToApiParam: () => 'nome_asc',
}));

function montar(caminho) {
  const canal = criarAvisosFalsos();
  let roteador;
  function Wrapper({ children }) {
    const [r] = useState(() => createMemoryRouter(
      [{ path: '*', element: createElement(canal.Wrapper, null, children) }],
      { initialEntries: [caminho] },
    ));
    useEffect(() => { roteador = r; });
    return createElement(RouterProvider, { router: r });
  }
  const r = renderHook(() => usePatientState({ authEnabled: true }), { wrapper: Wrapper });
  return { ...r, roteador: () => roteador };
}

describe('lista de pacientes lida do endereço', () => {
  it('?pagina=3&ordem=visita-desc → página 2 (0-based) e ordem lidas', async () => {
    const m = montar('/pacientes?pagina=3&ordem=visita-desc');
    await act(async () => {});
    expect(m.result.current.patientListPage).toBe(2);
    expect(m.result.current.patientListSortBy).toBe('visita-desc');
  });

  it('setter de filtro escreve no endereço com replace e zera a página', async () => {
    const m = montar('/pacientes?pagina=3');
    await act(async () => {});
    const antes = m.roteador().state.historyAction;
    const tamanho = window.history.length;
    act(() => m.result.current.setEhNovoFilter(true));
    const loc = m.roteador().state.location;
    expect(loc.pathname + loc.search).toBe('/pacientes?filtro=novos');
    await waitFor(() => expect(m.roteador().state.historyAction).toBe('REPLACE'));
    expect(antes).not.toBe('REPLACE');
    expect(m.result.current.ehNovoFilter).toBe(true);
    expect(m.result.current.patientListPage).toBe(0);
    expect(window.history.length).toBe(tamanho);
  });

  it('trocar a ordem para aniversário limpa o filtro sem-retorno do endereço', async () => {
    const m = montar('/pacientes?filtro=sem-retorno');
    await act(async () => {});
    expect(m.result.current.semRetornoFilter).toBe(true);
    act(() => m.result.current.setPatientListSortBy('birthday-asc'));
    const loc = m.roteador().state.location;
    expect(loc.search).not.toContain('sem-retorno');
    expect(loc.search).toContain('ordem=birthday-asc');
    expect(m.result.current.semRetornoFilter).toBe(false);
  });

  it('busca de texto com menos páginas que a do endereço: mostra a última página válida, sem navegar por efeito', async () => {
    const m = montar('/pacientes');
    await act(async () => {});
    act(() => m.result.current.setPatientSearchQuery('pac'));
    await act(async () => {});
    act(() => m.result.current.setPatientListPage(9));
    await act(async () => {});
    await act(async () => {});
    const tamanho = window.history.length;
    const loc0 = m.roteador().state.location;
    expect(m.result.current.patientListMeta.totalPages).toBe(2);
    expect(m.result.current.patientListPage).toBe(1);
    expect(m.roteador().state.location.search).toContain('pagina=10');
    expect(m.roteador().state.location.search).toBe(loc0.search);
    expect(m.roteador().state.location).toBe(loc0);
    expect(window.history.length).toBe(tamanho);
  });
});
