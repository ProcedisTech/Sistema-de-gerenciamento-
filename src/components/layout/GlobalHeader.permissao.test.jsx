import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalHeader } from './GlobalHeader.jsx';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { ToastContext } from '../../contexts/toastContext.js';

const papel = vi.hoisted(() => ({ canSeeNotificacoes: true }));

vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({ canCreatePacientes: true, canWriteAgenda: true, isNivel1: false, ...papel }),
}));
vi.mock('../agenda/PacienteSearchInput.jsx', () => ({ PacienteSearchInput: () => <div /> }));
vi.mock('../../services/api.js', () => ({
  notificacoesApi: {
    contarNaoLidas: vi.fn(),
    listar: vi.fn(),
    marcarLida: vi.fn(),
    marcarTodasLidas: vi.fn(),
  },
}));

vi.mock('../hooks/useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true }) }));

import { notificacoesApi } from '../../services/api.js';

function montar() {
  const { Wrapper: Avisos } = criarAvisosFalsos();
  const Wrapper = ({ children }) => (
    <ToastContext.Provider value={{ urgente: vi.fn(), error: vi.fn() }}>
      <Avisos>{children}</Avisos>
    </ToastContext.Provider>
  );
  render(<GlobalHeader activeView="agenda" clinicaNome="Clínica Teste" />, { wrapper: Wrapper });
}

describe('GlobalHeader — sino depende de "Ver notificações"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 0 });
    notificacoesApi.listar.mockResolvedValue({ content: [], totalElements: 0 });
  });

  it('sem a permissão: sem sino e sem chamar a API', async () => {
    papel.canSeeNotificacoes = false;
    montar();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /notifica/i })).toBeNull();
    expect(notificacoesApi.contarNaoLidas).not.toHaveBeenCalled();
    expect(notificacoesApi.listar).not.toHaveBeenCalled();
  });

  it('com a permissão: o sino aparece e consulta a API', async () => {
    papel.canSeeNotificacoes = true;
    montar();
    expect(screen.getByRole('button', { name: /notifica/i })).toBeInTheDocument();
    await waitFor(() => expect(notificacoesApi.contarNaoLidas).toHaveBeenCalled());
  });
});
