import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificacoesView from './NotificacoesView.jsx';

vi.mock('../../services/api.js', () => ({
  notificacoesApi: { contarNaoLidas: vi.fn(), listar: vi.fn() },
}));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ error: vi.fn() }) }));
vi.mock('../hooks/useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));

import { notificacoesApi } from '../../services/api.js';

describe('NotificacoesView — sem "Ver notificações"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = window.matchMedia || (() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  });

  it('mostra o cartão de cadeado e não chama a API', async () => {
    const onVoltar = vi.fn();
    render(<NotificacoesView semAcesso onVoltar={onVoltar} />);
    expect(screen.getByText('Você não tem acesso às notificações')).toBeInTheDocument();
    expect(screen.getByText(/liberar a permissão "Ver notificações"/)).toBeInTheDocument();
    screen.getByRole('button', { name: /voltar/i }).click();
    expect(onVoltar).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(notificacoesApi.contarNaoLidas).not.toHaveBeenCalled();
    expect(notificacoesApi.listar).not.toHaveBeenCalled();
  });

  it('com acesso, carrega normalmente', async () => {
    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 0 });
    notificacoesApi.listar.mockResolvedValue({ content: [] });
    render(<NotificacoesView onVoltar={vi.fn()} />);
    await vi.waitFor(() => expect(notificacoesApi.listar).toHaveBeenCalled());
    expect(screen.queryByText('Você não tem acesso às notificações')).toBeNull();
  });
});
