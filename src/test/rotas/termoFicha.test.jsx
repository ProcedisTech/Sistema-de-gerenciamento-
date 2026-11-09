/** Onda 3A-3: termo e ficha abertos vêm do endereço (F5 reabre, Novo empilha, Voltar volta à lista). */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { flushSync } from 'react-dom';
import { ToastProvider } from '../../contexts/ToastContext.jsx';
import { criarRotas } from '../../rotas/roteador.jsx';
import { TermosManager } from '../../components/termos/TermosManager.jsx';
import { termosApi } from '../../services/api';
import { AnamneseFichasHome } from '../../components/anamnese/AnamneseFichasHome.jsx';

vi.mock('../../services/api', () => ({
  termosApi: { list: vi.fn(async () => [{ id: 7, titulo: 'Termo Sete', conteudo: '<p>x</p>', ativo: true }]), update: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
  anamneseApi: { listFichas: vi.fn(async () => [{ id: 5, nome: 'Ficha Cinco', totalPerguntas: 1 }]) },
}));
vi.mock('../../hooks/useProcedimentosOptions', () => ({ useProcedimentosOptions: () => ({ options: [], loading: false }) }));
vi.mock('../../components/anamnese/AnamneseDocumentoEditor.jsx', () => ({
  AnamneseDocumentoEditor: ({ fichaId }) => <div>editor-ficha-{String(fichaId)}</div>,
}));

let roteador;
function montar(ui, caminho) {
  roteador = createMemoryRouter(criarRotas(ui), { initialEntries: [caminho] });
  render(<ToastProvider><RouterProvider router={roteador} flushSync={flushSync} /></ToastProvider>);
}
const aqui = () => roteador.state.location.pathname;

window.matchMedia ??= () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

afterEach(cleanup);

describe('termos e fichas pelo endereço', () => {
  it('F5 em /configuracoes/termos/7 abre o termo', async () => {
    montar(<TermosManager />, '/configuracoes/termos/7');
    expect(await screen.findByText('Editar Termo')).toBeTruthy();
    await waitFor(() => expect(screen.getByDisplayValue('Termo Sete')).toBeTruthy());
  });

  it('Novo termo empilha /termos/novo e Voltar volta à lista', async () => {
    montar(<TermosManager />, '/configuracoes/termos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo Termo/ }));
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos/novo'));
    expect(await screen.findByText('Novo Termo', { selector: 'h2,h3,h1,div,p,span' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Voltar/ })[0]);
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos'));
    await waitFor(() => expect(roteador.state.historyAction).toBe('PUSH'));
  });

  it('termo inexistente mostra Não encontrado', async () => {
    montar(<TermosManager />, '/configuracoes/termos/999');
    expect(await screen.findByText('Não encontrado')).toBeTruthy();
  });

  it('/configuracoes/fichas/5 abre a ficha; id inexistente mostra Não encontrado', async () => {
    montar(<AnamneseFichasHome />, '/configuracoes/fichas/5');
    expect(await screen.findByText('editor-ficha-5')).toBeTruthy();
    cleanup();
    montar(<AnamneseFichasHome />, '/configuracoes/fichas/404');
    expect(await screen.findByText('Não encontrado')).toBeTruthy();
  });
});

describe('termos: histórico do navegador', () => {
  const voltar = () => fireEvent.click(screen.getAllByRole('button', { name: /Voltar/ })[0]);

  it('novo > Voltar > abrir 7 > Voltar do navegador 2x: /novo vazio', async () => {
    montar(<TermosManager />, '/configuracoes/termos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo Termo/ }));
    voltar();
    await screen.findByText('Termo Sete'); fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    await waitFor(() => expect(screen.getByDisplayValue('Termo Sete')).toBeTruthy());
    await act(async () => { await roteador.navigate(-1); });
    await act(async () => { await roteador.navigate(-1); });
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos/novo'));
    await waitFor(() => expect(screen.queryByDisplayValue('Termo Sete')).toBeNull());
  });

  const abrirSete = async () => {
    montar(<TermosManager />, '/configuracoes/termos');
    await screen.findByText('Termo Sete');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    return screen.findByDisplayValue('Termo Sete');
  };

  it('edita 7, Voltar, Avançar: mantém o texto digitado', async () => {
    const campo = await abrirSete();
    fireEvent.change(campo, { target: { value: 'Termo Sete editado' } });
    await act(async () => { await roteador.navigate(-1); });
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos'));
    await act(async () => { await roteador.navigate(1); });
    expect(await screen.findByDisplayValue('Termo Sete editado')).toBeTruthy();
  });

  it('salvar termo novo substitui o endereço: Voltar não reabre /termos/novo', async () => {
    montar(<TermosManager />, '/configuracoes/termos');
    fireEvent.click(await screen.findByRole('button', { name: /Usar Template/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Template LGPD/ }));
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos/novo'));
    fireEvent.click(screen.getByRole('button', { name: /Salvar|Criar/ }));
    await waitFor(() => expect(termosApi.create).toHaveBeenCalled());
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos'));
    await waitFor(() => expect(roteador.state.historyAction).toBe('REPLACE'));
    await act(async () => { await roteador.navigate(-1); });
    await waitFor(() => expect(aqui()).not.toBe('/configuracoes/termos/novo'));
  });

  it('salvar descarta o rascunho: Voltar ao termo mostra o salvo', async () => {
    const campo = await abrirSete();
    fireEvent.change(campo, { target: { value: 'Termo Sete editado' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar|Atualizar/ }));
    await waitFor(() => expect(termosApi.update).toHaveBeenCalled());
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos'));
    // salvar substitui o editor no histórico (Voltar não o reabre); reabrir mostra o salvo, não o rascunho
    await screen.findByText('Termo Sete');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    await waitFor(() => expect(aqui()).toBe('/configuracoes/termos/7'));
    expect(await screen.findByDisplayValue('Termo Sete')).toBeTruthy();
  });
});
