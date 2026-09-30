import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import CancelarAgendaModal from './CancelarAgendaModal.jsx';
import * as UsePapelModule from '../../hooks/usePapel.js';
import * as ApiModule from '../../services/api.js';

vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: vi.fn(),
}));

vi.mock('../../services/api.js', () => ({
  motivosCancelamentoApi: {
    listar: vi.fn().mockResolvedValue([]),
  },
  getApiErrorToastMessage: vi.fn(),
}));

describe('CancelarAgendaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o modal quando canDeleteAgenda for true', async () => {
    vi.mocked(UsePapelModule.usePapel).mockReturnValue({
      canDeleteAgenda: true,
    });

    await act(async () => {
      render(
        <CancelarAgendaModal
          agenda={{ agendaId: 'a-1' }}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
    });

    expect(screen.getByRole('heading', { name: /cancelar agendamento/i })).toBeInTheDocument();
  });

  it('NÃO renderiza nada (retorna null) quando canDeleteAgenda for false', async () => {
    vi.mocked(UsePapelModule.usePapel).mockReturnValue({
      canDeleteAgenda: false,
    });

    let renderedContainer;
    await act(async () => {
      const { container } = render(
        <CancelarAgendaModal
          agenda={{ agendaId: 'a-1' }}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      renderedContainer = container;
    });

    expect(renderedContainer).toBeEmptyDOMElement();
    expect(screen.queryByRole('heading', { name: /cancelar agendamento/i })).not.toBeInTheDocument();
  });
});
