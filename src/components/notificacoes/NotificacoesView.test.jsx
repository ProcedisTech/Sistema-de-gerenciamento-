import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificacoesView from './NotificacoesView.jsx';

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('../../services/api.js', () => ({
  notificacoesApi: {
    contarNaoLidas: vi.fn(),
    listar: vi.fn(),
    marcarLida: vi.fn(),
    marcarTodasLidas: vi.fn(),
    deletar: vi.fn(),
    limparLidas: vi.fn(),
  },
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock('../hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }),
}));

import { notificacoesApi } from '../../services/api.js';

describe('NotificacoesView — tratamento visual de agenda_profissional_transferido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza notificação de transferência com mensagem humanizada, motivo e ícone correto', async () => {
    const fakeNotification = {
      id: 'notif-1',
      tipo: 'agenda_profissional_transferido',
      lida: false,
      criadoEm: new Date().toISOString(),
      payload: {
        pacienteNome: 'Ana Carolina Silva Oliveira',
        dataAgendamento: '2026-11-06',
        horaInicio: '18:00',
        procedimentoNome: null,
        profissionalAnteriorNome: 'Guilherme Barcelos',
        profissionalNovoNome: 'Dra. Camila Souza',
        motivo: 'Imprevisto do profissional',
      },
    };

    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 1 });
    notificacoesApi.listar.mockResolvedValue({ content: [fakeNotification], totalElements: 1 });

    render(<NotificacoesView onVoltar={vi.fn()} onNavigateToAgenda={vi.fn()} />);

    expect(await screen.findByText(/Ana Carolina Silva Oliveira/)).toBeInTheDocument();
    expect(screen.getByText(/transferido de Guilherme Barcelos para Dra. Camila Souza/)).toBeInTheDocument();
    expect(screen.getByText('Motivo: Imprevisto do profissional')).toBeInTheDocument();

    // Aba Agenda exibe contagem (1) e permite filtrar
    const chipAgenda = screen.getByRole('button', { name: /Agenda \(1\)/i });
    expect(chipAgenda).toBeInTheDocument();

    fireEvent.click(chipAgenda);
    expect(await screen.findByText(/Ana Carolina Silva Oliveira/)).toBeInTheDocument();
  });

  it('ao clicar no card de transferência, marca como lida e navega para agenda', async () => {
    const onNavigateToAgenda = vi.fn();
    const fakeNotification = {
      id: 'notif-2',
      tipo: 'agenda_profissional_transferido',
      lida: false,
      criadoEm: new Date().toISOString(),
      payload: {
        pacienteNome: 'André Lima',
        profissionalAnteriorNome: 'Guilherme',
        profissionalNovoNome: 'Dra. Camila',
      },
    };

    notificacoesApi.contarNaoLidas.mockResolvedValue({ count: 1 });
    notificacoesApi.listar.mockResolvedValue({ content: [fakeNotification], totalElements: 1 });
    notificacoesApi.marcarLida.mockResolvedValue({});

    render(<NotificacoesView onVoltar={vi.fn()} onNavigateToAgenda={onNavigateToAgenda} />);

    const card = await screen.findByText(/André Lima/);
    fireEvent.click(card.closest('button'));

    await waitFor(() => {
      expect(notificacoesApi.marcarLida).toHaveBeenCalledWith('notif-2');
      expect(onNavigateToAgenda).toHaveBeenCalledTimes(1);
    });
  });
});
