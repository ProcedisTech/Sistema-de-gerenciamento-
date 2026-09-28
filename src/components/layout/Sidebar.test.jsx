import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Sidebar } from './Sidebar.jsx';

vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({
    canSeeConfig: true,
    canSeeConfigEquipe: true,
  }),
}));

vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: (query) => query === '(min-width: 1024px)',
}));

const baseProps = {
  activeView: 'pacientes',
  setActiveView: () => {},
  handleLogout: () => {},
  authUser: { id: '1', email: 'maria@x.com' },
  clinicaNome: 'Clínica Teste',
  perfilNomeCompleto: 'Maria Souza',
  perfilApelido: '',
};

describe('Sidebar (desktop expandida)', () => {
  beforeEach(() => {
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '0');
  });

  it('Jornada e Consulta (identidadeNoHeader=false): clínica e usuário sem xl:hidden, sem marca', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);

    const clinica = screen.getByRole('button', { name: 'Abrir dados da clínica' });
    const usuario = screen.getByRole('button', { name: 'Abrir perfil do profissional' });
    expect(clinica).not.toHaveClass('xl:hidden');
    expect(usuario).not.toHaveClass('xl:hidden');
    expect(screen.getByText('Clínica Teste')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-brand')).not.toBeInTheDocument();
  });

  it('demais telas (identidadeNoHeader=true): clínica e usuário com xl:hidden, marca hidden xl:flex', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(screen.getByRole('button', { name: 'Abrir dados da clínica' })).toHaveClass('xl:hidden');
    expect(screen.getByRole('button', { name: 'Abrir perfil do profissional' })).toHaveClass('xl:hidden');
    const marca = screen.getByTestId('sidebar-brand');
    expect(marca).toHaveClass('hidden', 'xl:flex');
    expect(marca).toHaveTextContent('Procedi');
  });

  it('não mostra o subtítulo fixo', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);

    expect(screen.queryByText('Harmonização Premium')).not.toBeInTheDocument();
  });

  it('mantém os textos de reserva de hoje', () => {
    render(
      <Sidebar
        {...baseProps}
        clinicaNome=""
        perfilNomeCompleto=""
        identidadeNoHeader={false}
      />,
    );

    expect(screen.getByText('Procedi')).toBeInTheDocument();
    expect(screen.getByText('maria@x.com')).toBeInTheDocument();
    expect(screen.getByText('Usuário')).toBeInTheDocument();
    expect(screen.getByText('MA')).toBeInTheDocument();
  });
});

describe('Sidebar recolhida', () => {
  beforeEach(() => {
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '1');
  });

  afterEach(() => {
    localStorage.removeItem('procedi.sidebar.desktopCollapsed');
  });

  it('Jornada e Consulta: avatar sem xl:hidden', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);

    expect(screen.getByTestId('sidebar-rail-avatar')).not.toHaveClass('xl:hidden');
  });

  it('demais telas: avatar com xl:hidden', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(screen.getByTestId('sidebar-rail-avatar')).toHaveClass('xl:hidden');
  });
});
