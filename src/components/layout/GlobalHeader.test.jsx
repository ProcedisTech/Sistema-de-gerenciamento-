import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Users, CalendarDays } from 'lucide-react';
import { GlobalHeader } from './GlobalHeader.jsx';
import { PageSlot } from './PageSlot.jsx';

vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({
    canCreatePacientes: true,
    canWriteAgenda: true,
    isNivel1: false,
  }),
}));

vi.mock('./NotificationBell.jsx', () => ({
  default: () => <div data-testid="notification-bell">Bell</div>,
}));

vi.mock('../agenda/PacienteSearchInput.jsx', () => ({
  PacienteSearchInput: () => <div data-testid="paciente-search-input">SearchInput</div>,
}));

describe('PageSlot', () => {
  it('renderiza título e ícone corretamente', () => {
    render(<PageSlot icon={Users} title="Pacientes" />);

    expect(screen.getByText('Pacientes')).toBeInTheDocument();
    expect(screen.getByTestId('global-header-page-slot')).toBeInTheDocument();
  });

  it('renderiza breadcrumb quando informado', () => {
    render(<PageSlot icon={Users} title="Pacientes" breadcrumb="Maria Silva" />);

    expect(screen.getByText('Pacientes')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
  });

  it('retorna null quando título for vazio ou não informado', () => {
    const { container } = render(<PageSlot title="" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('GlobalHeader com pageSlot', () => {
  it('renderiza o slot de página no cabeçalho desktop quando fornecido', () => {
    render(
      <GlobalHeader
        activeView="agenda"
        pageSlot={<PageSlot icon={CalendarDays} title="Agenda" />}
      />
    );

    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Procedi')).toBeInTheDocument();
  });

  it('não renderiza o container do slot quando pageSlot for omitido', () => {
    render(<GlobalHeader activeView="agenda" />);

    expect(screen.queryByTestId('global-header-page-slot')).not.toBeInTheDocument();
    expect(screen.getByText('Procedi')).toBeInTheDocument();
  });
});
