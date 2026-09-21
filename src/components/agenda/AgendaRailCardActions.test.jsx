import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaRailCardActions } from './AgendaRailCardActions.jsx';

describe('AgendaRailCardActions', () => {
  const mockAppointment = {
    id: 'appt-1',
    status: 'confirmado',
    pacienteNome: 'Maria Silva',
  };

  it('exibe o botão Cancelar quando secondary contém "cancelar" e onCancelar é fornecido', () => {
    const handleCancelar = vi.fn();
    render(
      <AgendaRailCardActions
        appointment={mockAppointment}
        actions={{ primary: null, secondary: ['cancelar', 'reagendar'] }}
        onCancelar={handleCancelar}
      />
    );

    const btn = screen.getByRole('button', { name: /cancelar/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(handleCancelar).toHaveBeenCalledWith(mockAppointment);
  });

  it('NÃO exibe o botão Cancelar se onCancelar for null mesmo que secondary contenha "cancelar"', () => {
    render(
      <AgendaRailCardActions
        appointment={mockAppointment}
        actions={{ primary: null, secondary: ['cancelar', 'reagendar'] }}
        onCancelar={null}
      />
    );

    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it('NÃO exibe o botão Cancelar se secondary não contiver "cancelar"', () => {
    const handleCancelar = vi.fn();
    render(
      <AgendaRailCardActions
        appointment={mockAppointment}
        actions={{ primary: null, secondary: ['reagendar', 'whatsapp'] }}
        onCancelar={handleCancelar}
      />
    );

    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });
});
