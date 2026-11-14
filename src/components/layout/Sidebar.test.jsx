import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Sidebar } from './Sidebar.jsx';

const media = vi.hoisted(() => ({ mode: 'desktop' }));

vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({
    canSeeConfig: true,
    canSeeConfigEquipe: true,
    canSeeConfigAuditoria: true,
  }),
}));

vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: (query) => {
    if (media.mode === 'mobile') return false; // abaixo de 768px: as duas consultas falsas
    return media.mode === 'desktop'
      ? query === '(min-width: 1024px)'
      : query === '(min-width: 768px) and (max-width: 1023px)';
  },
}));

const baseProps = {
  activeView: 'pacientes',
  irParaTela: () => {},
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

  it('demais telas: sem clínica nem usuário, com a marca e o Recolher menu fora do aside', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(screen.queryByTestId('sidebar-rail-avatar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));

    expectSemIdentidade();
    const marca = screen.getByTestId('sidebar-tablet-brand');
    expect(marca).toHaveTextContent('Procedi');
    // Menu novo: o Recolher saiu do topo do painel e virou o botao do fio, fora do <aside>.
    expect(marca.previousElementSibling).toBeNull();
    const botao = screen.getByRole('button', { name: 'Recolher menu' });
    expect(botao.closest('aside')).toBeNull();
  });
});

describe('Navegação e itens da Sidebar', () => {
  it('renderiza os itens de navegação incluindo Gestão de Equipe e Auditoria', () => {
    const irParaTela = vi.fn();
    render(<Sidebar {...baseProps} irParaTela={irParaTela} />);

    expect(screen.getByRole('button', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestão de Equipe' })).toBeInTheDocument();
    const btnAuditoria = screen.getByRole('button', { name: 'Auditoria' });
    expect(btnAuditoria).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeInTheDocument();

    fireEvent.click(btnAuditoria);
    expect(irParaTela).toHaveBeenCalledWith('auditoria');
  });
});


describe('Sidebar em grupos (identidadeNoHeader)', () => {
  beforeEach(() => {
    media.mode = 'desktop';
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '0');
  });

  it('mostra 3 grupos; clicar em Gestão esconde Auditoria e outro clique reabre', async () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    const gestao = await screen.findByRole('button', { name: 'Gestão' });
    expect(screen.getByRole('button', { name: 'Dia a dia' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Sistema' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Auditoria' })).toBeInTheDocument();

    fireEvent.click(gestao);
    expect(gestao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Auditoria' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pacientes' })).toBeInTheDocument();

    fireEvent.click(gestao);
    expect(await screen.findByRole('button', { name: 'Auditoria' })).toBeInTheDocument();
  });

  it('com identidadeNoHeader falsa não há cabeçalho de grupo', async () => {
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);

    expect(await screen.findByRole('button', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gestão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dia a dia' })).not.toBeInTheDocument();
  });

  it('o nome Procedi usa font-brand', () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    // Marca nova: o peso 600 saiu de font-semibold e foi para .procedi-marca-nome (index.css, coberto em ondaUltimaPassada.test.js).
    expect(screen.getByText('Procedi')).toHaveClass('font-brand', 'procedi-marca-nome');
  });

  it('ponto de pendências: 1 muda o nome acessível; 0 não mostra nada', async () => {
    const { unmount } = render(<Sidebar {...baseProps} identidadeNoHeader pendenciasEquipe={1} />);
    expect(await screen.findByRole('button', { name: 'Gestão de Equipe · 1 pendência' })).toBeInTheDocument();
    unmount();

    render(<Sidebar {...baseProps} identidadeNoHeader pendenciasEquipe={0} />);
    expect(await screen.findByRole('button', { name: 'Gestão de Equipe' })).toBeInTheDocument();
    expect(screen.queryByText(/pendência/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pendência/ })).not.toBeInTheDocument();
  });
});

describe('Sidebar recolhida: largura e toque', () => {
  beforeEach(() => {
    media.mode = 'desktop';
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '1');
  });

  afterEach(() => {
    localStorage.removeItem('procedi.sidebar.desktopCollapsed');
  });

  it('informa 64 e grava --sidebar-w em 64px', () => {
    const onRailWidthPxChange = vi.fn();
    render(<Sidebar {...baseProps} identidadeNoHeader onRailWidthPxChange={onRailWidthPxChange} />);

    expect(onRailWidthPxChange).toHaveBeenCalledWith(64);
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('64px');
  });

  it('botões do trilho têm toque:h-11 e nenhum h-11 solto', async () => {
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    const btn = await screen.findByRole('button', { name: 'Pacientes' });
    expect(btn).toHaveClass('h-10', 'toque:h-11', 'toque:w-11');
    expect(btn).not.toHaveClass('h-11');
    expect(screen.getByRole('button', { name: 'Expandir menu' })).not.toHaveClass('h-11');
  });
});

describe('Onda 1 (item 1): topo do menu lateral com a marca nova', () => {
  const simbolo = (raiz) => raiz.querySelector('svg');
  const aside = () => document.querySelector('aside');

  it('desktop aberto: nome com classe da marca e font-brand, topo sem border-b, simbolo de altura 42', () => {
    media.mode = 'desktop';
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '0');
    render(<Sidebar {...baseProps} identidadeNoHeader />);
    const nome = screen.getByText('Procedi');
    expect(nome).toHaveClass('procedi-marca-nome', 'font-brand');
    const topo = screen.getByTestId('sidebar-brand').closest('.procedi-marca');
    expect(topo).not.toBeNull();
    expect(topo).not.toHaveClass('border-b');
    expect(simbolo(topo).getAttribute('class')).toContain('h-[42px]');
    expect(aside()).toHaveClass('procedi-menu-fundo');
    expect(aside()).not.toHaveClass('bg-white');
  });

  it('tablet aberto: nome com classe da marca e font-brand, topo sem border-b, simbolo 42, Recolher fora do aside', () => {
    media.mode = 'tablet';
    render(<Sidebar {...baseProps} identidadeNoHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));
    const nome = screen.getByText('Procedi');
    expect(nome).toHaveClass('procedi-marca-nome', 'font-brand');
    const topo = screen.getByTestId('sidebar-tablet-brand').closest('.procedi-marca');
    expect(topo).not.toBeNull();
    expect(topo).not.toHaveClass('border-b');
    expect(simbolo(screen.getByTestId('sidebar-tablet-brand')).getAttribute('class')).toContain('h-[42px]');
    // Menu novo: sem botao antigo no topo do painel; o unico Recolher menu e o do fio, fora do <aside>.
    expect(screen.getByTestId('sidebar-tablet-brand').previousElementSibling).toBeNull();
    expect(topo.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Recolher menu' }).closest('aside')).toBeNull();
  });

  it('recolhido: simbolo de altura 30, topo sem border-b; clicar em Expandir menu abre o menu com o texto "Sair do Sistema"', () => {
    media.mode = 'desktop';
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '1');
    render(<Sidebar {...baseProps} identidadeNoHeader />);
    const botao = screen.getByRole('button', { name: 'Expandir menu' });
    const topo = botao.closest('.procedi-marca');
    expect(topo).toHaveClass('procedi-marca--recolhida');
    expect(topo).not.toHaveClass('border-b');
    expect(simbolo(botao).getAttribute('class')).toContain('h-[30px]');
    expect(simbolo(botao).getAttribute('class')).not.toContain('h-[42px]');
    expect(screen.queryByText('Sair do Sistema')).not.toBeInTheDocument(); // antes: so icones
    fireEvent.click(botao);
    expect(screen.getByText('Sair do Sistema')).toBeInTheDocument();
    expect(screen.getByText('Procedi')).toHaveClass('procedi-marca-nome');
    localStorage.removeItem('procedi.sidebar.desktopCollapsed');
  });

  it('identidadeNoHeader falsa nada mudou: topo com border-b, fundo bg-white, sem classes da marca nova', () => {
    media.mode = 'desktop';
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '0');
    const { container } = render(<Sidebar {...baseProps} identidadeNoHeader={false} />);
    const topo = screen.getByRole('button', { name: 'Abrir dados da cl\u00ednica' }).closest('.border-b');
    expect(topo).not.toBeNull(); // sinal positivo
    expect(topo).toHaveClass('border-b', 'border-app-border');
    expect(aside()).toHaveClass('bg-white');
    expect(container.querySelector('.procedi-marca, .procedi-menu-fundo, .procedi-marca-nome')).toBeNull();
    cleanup();
    localStorage.setItem('procedi.sidebar.desktopCollapsed', '1');
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);
    const exp = screen.getByRole('button', { name: 'Expandir menu' });
    expect(exp.parentElement).toHaveClass('border-b');
    expect(exp.querySelector('svg').getAttribute('class')).toContain('h-5');
    localStorage.removeItem('procedi.sidebar.desktopCollapsed');
  });
});

describe('Botao do fio dourado (menu novo)', () => {
  const CHAVE = 'procedi.sidebar.desktopCollapsed';
  const botoesMenu = () => document.querySelectorAll('.procedi-menu-botao');
  const larguraSidebar = () => document.documentElement.style.getPropertyValue('--sidebar-w');

  afterEach(() => {
    media.mode = 'desktop';
    localStorage.removeItem(CHAVE);
  });

  it('1. desktop aberto: um unico Recolher menu; clique grava 1, vira Abrir menu; clique volta a 0', () => {
    media.mode = 'desktop';
    localStorage.setItem(CHAVE, '0');
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(screen.getAllByRole('button', { name: 'Recolher menu' })).toHaveLength(1);
    const botao = screen.getByRole('button', { name: 'Recolher menu' });
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(botao).toHaveAttribute('title', 'Recolher menu');

    fireEvent.click(botao);
    expect(localStorage.getItem(CHAVE)).toBe('1');
    const aberto = screen.getByRole('button', { name: 'Abrir menu' });
    expect(aberto).toHaveAttribute('aria-expanded', 'false');
    expect(aberto).toHaveAttribute('title', 'Abrir menu');
    expect(screen.queryByRole('button', { name: 'Recolher menu' })).not.toBeInTheDocument();

    fireEvent.click(aberto);
    expect(localStorage.getItem(CHAVE)).toBe('0');
    expect(screen.getByRole('button', { name: 'Recolher menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('2. tablet: recolhido, Abrir menu abre o painel; aberto, Recolher menu fecha', () => {
    media.mode = 'tablet';
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(screen.queryByText('Sair do Sistema')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(screen.getByText('Sair do Sistema')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu' }));
    expect(screen.queryByText('Sair do Sistema')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument();
  });

  it('3. identidadeNoHeader falsa: sem botao novo; os dois botoes antigos Recolher menu seguem', () => {
    media.mode = 'desktop';
    localStorage.setItem(CHAVE, '0');
    const { unmount } = render(<Sidebar {...baseProps} identidadeNoHeader={false} />);
    expect(botoesMenu()).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Recolher menu' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Recolher menu' })).toHaveAttribute('title', 'Recolher');
    unmount();

    media.mode = 'tablet';
    render(<Sidebar {...baseProps} identidadeNoHeader={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));
    expect(botoesMenu()).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Recolher menu' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument();
  });

  it('4. menu novo: so um Recolher menu (o do fio), irmao do aside; z-[100] no tablet aberto, z-auto fechado; botao z-[45]', () => {
    media.mode = 'desktop';
    localStorage.setItem(CHAVE, '0');
    const { unmount } = render(<Sidebar {...baseProps} identidadeNoHeader />);
    const botao = screen.getByRole('button', { name: 'Recolher menu' });
    expect(botao).toHaveClass('procedi-menu-botao', 'z-[45]');
    expect(botoesMenu()).toHaveLength(1);
    expect(botao.closest('aside')).toBeNull();
    const wrapper = botao.parentElement;
    expect(wrapper.querySelector(':scope > aside')).not.toBeNull();
    expect(botao.nextElementSibling).toBe(wrapper.querySelector('aside'));
    unmount();

    media.mode = 'tablet';
    render(<Sidebar {...baseProps} identidadeNoHeader />);
    const fechado = screen.getByRole('button', { name: 'Abrir menu' }).parentElement;
    expect(fechado).toHaveClass('z-auto');
    expect(fechado).not.toHaveClass('z-[100]');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const abertoBotao = screen.getByRole('button', { name: 'Recolher menu' });
    expect(abertoBotao.parentElement).toHaveClass('z-[100]');
    expect(abertoBotao.parentElement).not.toHaveClass('z-auto');
    expect(abertoBotao).toHaveClass('z-[45]');
    expect(screen.getAllByRole('button', { name: 'Recolher menu' })).toHaveLength(1);
  });

  it('5. mobile (<768px): sem botao; wrapper com hidden, md:flex, h-full, shrink-0', () => {
    media.mode = 'mobile';
    render(<Sidebar {...baseProps} identidadeNoHeader />);

    expect(botoesMenu()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Recolher menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument();
    const wrapper = document.querySelector('aside').parentElement;
    expect(wrapper).toHaveClass('hidden', 'md:flex', 'h-full', 'shrink-0');
  });

  it('9. --sidebar-w: 220px desktop aberto; 64px desktop recolhido e tablet fechado; 0px no mobile; callback 220 e 64', () => {
    const cb = vi.fn();
    media.mode = 'desktop';
    localStorage.setItem(CHAVE, '0');
    const { unmount } = render(<Sidebar {...baseProps} identidadeNoHeader onRailWidthPxChange={cb} />);
    expect(larguraSidebar()).toBe('220px');
    expect(cb).toHaveBeenLastCalledWith(220);
    unmount();

    localStorage.setItem(CHAVE, '1');
    const cb2 = vi.fn();
    const r2 = render(<Sidebar {...baseProps} identidadeNoHeader onRailWidthPxChange={cb2} />);
    expect(larguraSidebar()).toBe('64px');
    expect(cb2).toHaveBeenLastCalledWith(64);
    r2.unmount();

    media.mode = 'tablet';
    const r3 = render(<Sidebar {...baseProps} identidadeNoHeader />);
    expect(larguraSidebar()).toBe('64px');
    r3.unmount();

    media.mode = 'mobile';
    render(<Sidebar {...baseProps} identidadeNoHeader />);
    expect(larguraSidebar()).toBe('0px');
  });
});
