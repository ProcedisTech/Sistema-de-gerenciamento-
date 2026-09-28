import React from 'react';
import { render, screen, within } from '@testing-library/react';
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
        clinicaNome="Clínica Teste"
        pageSlot={<PageSlot icon={CalendarDays} title="Agenda" />}
      />
    );

    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(within(screen.getByTestId('global-header-brand')).getByText('Procedi')).toBeInTheDocument();
  });

  it('não renderiza o container do slot quando pageSlot for omitido', () => {
    render(<GlobalHeader activeView="agenda" clinicaNome="Clínica Teste" />);

    expect(screen.queryByTestId('global-header-page-slot')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('global-header-brand')).getByText('Procedi')).toBeInTheDocument();
  });
});

describe('GlobalHeader com identidade', () => {
  it('a marca fica escondida a partir de xl', () => {
    render(<GlobalHeader activeView="pacientes" clinicaNome="Clínica Teste" />);

    expect(screen.getByTestId('global-header-brand')).toHaveClass('xl:hidden');
  });

  it('mostra o nome da clínica no bloco da clínica, visível só a partir de xl', () => {
    render(<GlobalHeader activeView="pacientes" clinicaNome="Clínica Teste" />);

    const nome = screen.getByRole('heading', { level: 1, name: 'Clínica Teste' });
    const bloco = nome.closest('div.xl\\:flex');
    expect(bloco).not.toBeNull();
    expect(bloco).toHaveClass('hidden');
  });

  it('mostra o cartão do usuário visível só a partir de xl, com o texto só a partir de 1440px', () => {
    render(
      <GlobalHeader
        activeView="pacientes"
        clinicaNome="Clínica Teste"
        perfilNomeCompleto="Maria Souza"
      />
    );

    const nome = screen.getByRole('heading', { level: 2, name: 'Maria Souza' });
    const texto = nome.parentElement;
    expect(texto).toHaveClass('hidden', 'min-[1440px]:block');
    const cartao = texto.parentElement;
    expect(cartao).toHaveClass('hidden', 'xl:flex');
  });

  it('mantém o pageSlot recebido igual ao de hoje', () => {
    render(
      <GlobalHeader
        activeView="pacientes"
        clinicaNome="Clínica Teste"
        pageSlot={<PageSlot icon={Users} title="Pacientes" />}
      />
    );

    const slot = screen.getByTestId('global-header-page-slot');
    expect(within(slot).getByText('Pacientes')).toBeInTheDocument();
  });

  it('não mostra o subtítulo fixo', () => {
    render(<GlobalHeader activeView="pacientes" clinicaNome="Clínica Teste" />);

    expect(screen.queryByText('Harmonização Premium')).not.toBeInTheDocument();
  });
});
