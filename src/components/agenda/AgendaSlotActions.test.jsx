import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AgendaSlotActions from './AgendaSlotActions.jsx';

describe('AgendaSlotActions', () => {
  const mockAgenda = {
    agendaId: 'agenda-123',
    status: 'confirmado',
    tipo: 'agendamento',
  };

  it('exibe botão Cancelar quando onCancelar é fornecido e canCancelar é true', () => {
    const handleCancelar = vi.fn();
    render(
      <AgendaSlotActions
        agenda={mockAgenda}
        onCancelar={handleCancelar}
        canCancelar={true}
      />
    );

    const btnCancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(btnCancelar).toBeInTheDocument();

    fireEvent.click(btnCancelar);
    expect(handleCancelar).toHaveBeenCalledTimes(1);
  });

  it('NÃO exibe botão Cancelar quando canCancelar é false', () => {
    const handleCancelar = vi.fn();
    render(
      <AgendaSlotActions
        agenda={mockAgenda}
        onCancelar={handleCancelar}
        canCancelar={false}
      />
    );

    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it('NÃO exibe botão Cancelar quando onCancelar é null ou omitido', () => {
    render(
      <AgendaSlotActions
        agenda={mockAgenda}
        canCancelar={true}
      />
    );

    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it('em modo compact, respeita canCancelar false ocultando o botão', () => {
    render(
      <AgendaSlotActions
        agenda={mockAgenda}
        compact={true}
        onCancelar={vi.fn()}
        canCancelar={false}
      />
    );

    expect(screen.queryByTitle('Cancelar agendamento')).not.toBeInTheDocument();
  });

  it('exibe botão Não compareceu quando onMarcarNaoCompareceu é fornecido e canCancelar é true', () => {
    render(
      <AgendaSlotActions
        agenda={mockAgenda}
        onMarcarNaoCompareceu={vi.fn()}
        canCancelar={true}
      />
    );

    expect(screen.getByRole('button', { name: /não compareceu/i })).toBeInTheDocument();
  });

  it('NÃO exibe botão Não compareceu quando canCancelar é false', () => {
    render(
      <AgendaSlotActions
        agenda={mockAgenda}
        onMarcarNaoCompareceu={vi.fn()}
        canCancelar={false}
      />
    );

    expect(screen.queryByRole('button', { name: /não compareceu/i })).not.toBeInTheDocument();
  });
});
