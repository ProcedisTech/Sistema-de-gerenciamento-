import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Sidebar } from './Sidebar.jsx';

const media = vi.hoisted(() => ({ mode: 'desktop' }));

vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({
    canSeeConfig: true,
    canSeeConfigEquipe: true,
  }),
}));

vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: (query) =>
    media.mode === 'desktop'
      ? query === '(min-width: 1024px)'
      : query === '(min-width: 768px) and (max-width: 1023px)',
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

function expectSemIdentidade() {
  expect(screen.queryByRole('button', { name: 'Abrir dados da clínica' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Abrir perfil do profissional' })).not.toBeInTheDocument();
  expect(screen.queryByText('Clínica Teste')).not.toBeInTheDocument();
}

function expectComIdentidade() {
  const clinica = screen.getByRole('button', { name: 'Abrir dados da clínica' });
  const usuario = screen.getByRole('button', { name: 'Abrir perfil do profissional' });
  expect(clinica).not.toHaveClass('xl:hidden');
  expect(usuario).not.toHaveClass('xl:hidden');
  expect(screen.getByText('Clínica Teste')).toBeInTheDocument();
  expect(screen.getByText('Maria')).toBeInTheDocument();
}

describe('Sidebar (desktop expandida)', () => {
  beforeEach(() => {
    media.mode = 'desktop';
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '0');
  });

  it('Jornada e Consulta (identidadeNoHeader=false): clínica e usuário como hoje, sem marca', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);

    expectComIdentidade();
    expect(screen.queryByTestId('sidebar-brand')).not.toBeInTheDocument();
  });

  it('demais telas (identidadeNoHeader=true): sem clínica nem usuário, com a marca visível', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expectSemIdentidade();
    const marca = screen.getByTestId('sidebar-brand');
    expect(marca).toHaveClass('flex');
    expect(marca).not.toHaveClass('hidden', 'xl:flex');
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
    media.mode = 'desktop';
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '1');
  });

  afterEach(() => {
    localStorage.removeItem('procedi.sidebar.desktopCollapsed');
  });

  it('Jornada e Consulta: avatar no trilho', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);

    expect(screen.getByTestId('sidebar-rail-avatar')).toBeInTheDocument();
  });

  it('demais telas: sem avatar no trilho', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(screen.queryByTestId('sidebar-rail-avatar')).not.toBeInTheDocument();
    expectSemIdentidade();
  });
});

describe('Sidebar do tablet (painel aberto)', () => {
  beforeEach(() => {
    media.mode = 'tablet';
  });

  afterEach(() => {
    media.mode = 'desktop';
  });

  it('Jornada e Consulta: clínica e usuário como hoje, sem marca', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));

    expectComIdentidade();
    expect(screen.queryByTestId('sidebar-tablet-brand')).not.toBeInTheDocument();
  });

  it('demais telas: sem clínica nem usuário, com a marca ao lado do Recolher menu', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(screen.queryByTestId('sidebar-rail-avatar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));

    expectSemIdentidade();
    const marca = screen.getByTestId('sidebar-tablet-brand');
    expect(marca).toHaveTextContent('Procedi');
    expect(marca.previousElementSibling).toHaveAttribute('aria-label', 'Recolher menu');
  });
});
