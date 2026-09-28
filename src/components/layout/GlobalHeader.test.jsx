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
    expect(screen.queryByText('Procedi')).not.toBeInTheDocument();
  });

  it('não renderiza o container do slot quando pageSlot for omitido', () => {
    render(<GlobalHeader activeView="agenda" clinicaNome="Clínica Teste" />);

    expect(screen.queryByTestId('global-header-page-slot')).not.toBeInTheDocument();
  });

  it('o nome da tela e o divisor ficam escondidos abaixo de 1280px', () => {
    render(
      <GlobalHeader
        activeView="agenda"
        clinicaNome="Clínica Teste"
        pageSlot={<PageSlot icon={CalendarDays} title="Agenda" />}
      />
    );

    const wrapper = screen.getByTestId('global-header-page-slot').parentElement;
    expect(wrapper).toHaveClass('hidden', 'min-w-0', 'xl:flex');
    expect(wrapper.previousElementSibling).toHaveClass('hidden', 'xl:block');
  });
});

describe('GlobalHeader com identidade', () => {
  it('a marca Procedi não aparece no header', () => {
    render(<GlobalHeader activeView="pacientes" clinicaNome="Clínica Teste" />);

    expect(screen.queryByTestId('global-header-brand')).not.toBeInTheDocument();
    expect(screen.queryByText('Procedi')).not.toBeInTheDocument();
  });

  it('mostra o bloco da clínica em todas as larguras, com logo de 36px e 40px a partir de lg', () => {
    const { container } = render(<GlobalHeader activeView="pacientes" clinicaNome="Clínica Teste" />);

    const nome = screen.getByRole('heading', { level: 1, name: 'Clínica Teste' });
    const bloco = nome.parentElement.parentElement;
    expect(bloco).not.toHaveClass('hidden', 'xl:flex');
    expect(bloco.parentElement).toHaveClass('min-w-0', 'flex-1', 'lg:flex-initial');
    const caixa = container.querySelector('svg').parentElement;
    expect(caixa).toHaveClass('h-9', 'w-9', 'lg:h-10', 'lg:w-10');
  });

  it('mostra a foto do usuário em todas as larguras, com o texto só a partir de 1440px', () => {
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
    expect(cartao).not.toHaveClass('hidden', 'xl:flex');
    expect(cartao).toHaveClass('min-w-0', 'p-1.5', 'lg:p-0');
    expect(screen.getByText('MS')).toHaveClass('h-8', 'w-8', 'lg:h-10', 'lg:w-10', 'shrink-0');
  });

  it('Agendamento: só o ícone abaixo de 1280px, com aria-label e title', () => {
    render(<GlobalHeader activeView="pacientes" clinicaNome="Clínica Teste" />);

    const botao = screen.getByRole('button', { name: 'Agendamento' });
    expect(botao).toHaveAttribute('title', 'Agendamento');
    expect(botao).toHaveClass('h-10', 'w-10', 'xl:w-auto', 'shrink-0');
    expect(within(botao).getByText('Agendamento')).toHaveClass('hidden', 'xl:inline');
  });

  it('botões e sino não encolhem; o grupo da direita pode encolher', () => {
    render(<GlobalHeader activeView="pacientes" clinicaNome="Clínica Teste" />);

    expect(screen.getByRole('button', { name: 'Novo Paciente' })).toHaveClass('shrink-0');
    const sinoWrapper = screen.getByTestId('notification-bell').parentElement;
    expect(sinoWrapper).toHaveClass('shrink-0');
    expect(sinoWrapper.parentElement).toHaveClass('ml-auto', 'min-w-0');
    expect(sinoWrapper.parentElement).not.toHaveClass('shrink-0');
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
