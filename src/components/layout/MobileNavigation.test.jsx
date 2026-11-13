import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { MobileNavigation } from './MobileNavigation.jsx';

const papel = vi.hoisted(() => ({ v: {} }));
vi.mock('../../hooks/usePapel', async (orig) => ({ ...(await orig()), usePapel: () => papel.v }));

const TUDO = { canSeeConfig: true, canSeeConfigEquipe: true, canSeeConfigAuditoria: true };
const montar = (extra = {}) => {
  const props = { activeView: 'pacientes', irParaTela: vi.fn(), onLogout: vi.fn(), ...extra };
  render(<MobileNavigation {...props} />);
  return props;
};
const abrir = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
  return screen.findByRole('dialog');
};

describe('MobileNavigation', () => {
  beforeEach(() => { papel.v = TUDO; });

  it('1) barra: Pacientes, Agenda, Equipe e Menu; sem Configurações nem Sair', async () => {
    montar();
    for (const n of ['Pacientes', 'Agenda', 'Equipe', 'Menu']) expect(await screen.findByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Configurações/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sair/ })).toBeNull();
  });

  it('2) sem permissão de equipe, Equipe não aparece', async () => {
    papel.v = { ...TUDO, canSeeConfigEquipe: false };
    montar();
    await screen.findByRole('button', { name: 'Pacientes' });
    expect(screen.queryByRole('button', { name: 'Equipe' })).toBeNull();
  });

  it('3) Menu abre dialog no body com os grupos e a marca', async () => {
    montar();
    const d = await abrir();
    expect(d.parentElement.parentElement).toBe(document.body);
    expect(d).toHaveAttribute('aria-modal', 'true');
    for (const t of ['Dia a dia', 'Gestão', 'Sistema', 'Procedi']) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('4) sem equipe nem auditoria, o grupo Gestão some', async () => {
    papel.v = { ...TUDO, canSeeConfigEquipe: false, canSeeConfigAuditoria: false };
    montar();
    await abrir();
    await screen.findByText('Dia a dia');
    expect(screen.queryByText('Gestão')).toBeNull();
  });

  it('5) clicar Auditoria navega e fecha o painel', async () => {
    const p = montar();
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Auditoria' }));
    expect(p.irParaTela).toHaveBeenCalledWith('auditoria');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('6) Sair do Sistema chama onLogout uma vez', async () => {
    const p = montar();
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Sair do Sistema' }));
    expect(p.onLogout).toHaveBeenCalledTimes(1);
  });

  it('7) Esc fecha e o foco volta ao Menu; clique no fundo também fecha', async () => {
    montar();
    await abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
    await abrir();
    fireEvent.click(screen.getByTestId('menu-fundo'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('8) pendenciasEquipe=1 dá nome com pendência; 0 não', async () => {
    const { unmount } = render(<MobileNavigation activeView="pacientes" irParaTela={vi.fn()} onLogout={vi.fn()} pendenciasEquipe={1} />);
    expect(await screen.findByRole('button', { name: 'Equipe · 1 pendência' })).toBeInTheDocument();
    unmount();
    montar({ pendenciasEquipe: 0 });
    expect(await screen.findByRole('button', { name: 'Equipe' })).toBeInTheDocument();
  });
});

describe('MobileNavigation rota', () => {
  beforeEach(() => { papel.v = TUDO; });

  it('13) mudar o pathname com o menu aberto fecha o menu', async () => {
    const props = { activeView: 'pacientes', irParaTela: vi.fn(), onLogout: vi.fn() };
    const { rerender } = render(<MobileNavigation {...props} pathname="/pacientes" />);
    await abrir();
    rerender(<MobileNavigation {...props} pathname="/pacientes" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // mesma rota: continua aberto
    rerender(<MobileNavigation {...props} pathname="/agenda" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('MobileNavigation foco', () => {
  beforeEach(() => { papel.v = TUDO; });

  it('abrir leva o foco para dentro do dialog', async () => {
    montar();
    const d = await abrir();
    await waitFor(() => expect(d).toContainElement(document.activeElement));
  });

  it('fechar pelo botão fechar devolve o foco ao Menu', async () => {
    montar();
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('fechar pelo fundo devolve o foco ao Menu', async () => {
    montar();
    await abrir();
    fireEvent.click(screen.getByTestId('menu-fundo'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('Tab no último item volta ao primeiro (prisão de foco)', async () => {
    montar();
    const d = await abrir();
    const bs = d.querySelectorAll('button');
    bs[bs.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(bs[0]).toHaveFocus();
  });
});

describe('MobileNavigation: onda 1 (itens 1 e 2)', () => {
  beforeEach(() => { papel.v = TUDO; });

  it('item 2: barra de baixo e painel somem a partir de md (768) e nao de lg (1024)', async () => {
    // D12a substituida: barra so abaixo de 768
    montar();
    const barra = (await screen.findByRole('button', { name: 'Menu' })).closest('.fixed');
    expect(barra).toHaveClass('fixed', 'bottom-0'); // sinal positivo: achou a barra
    expect(barra).toHaveClass('md:hidden');
    expect(barra).not.toHaveClass('lg:hidden');
    const d = await abrir();
    const raiz = d.parentElement;
    expect(raiz).toHaveClass('fixed', 'inset-0', 'md:hidden');
    expect(raiz).not.toHaveClass('lg:hidden');
  });

  it('item 1: painel do Menu com marca nova (nome, simbolo 42, sem border-b no topo)', async () => {
    montar();
    const d = await abrir();
    expect(d).toHaveClass('procedi-menu-fundo');
    const nome = screen.getByText('Procedi');
    expect(nome).toHaveClass('procedi-marca-nome', 'font-brand');
    const topo = nome.closest('.procedi-marca');
    expect(topo).not.toBeNull();
    expect(topo).not.toHaveClass('border-b');
    expect(topo.querySelector('svg').getAttribute('class')).toContain('h-[42px]');
    expect(within(topo).getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument();
  });
});
