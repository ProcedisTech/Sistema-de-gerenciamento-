import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { UsuarioIdentityCard } from './UsuarioIdentityCard.jsx';

describe('UsuarioIdentityCard', () => {
  it('sem foto mostra as iniciais', () => {
    render(<UsuarioIdentityCard displayName="Maria Souza" roleLabel="Usuário" />);

    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('com foto mostra a imagem', () => {
    const { container } = render(
      <UsuarioIdentityCard displayName="Maria Souza" roleLabel="Usuário" perfilFotoResolved="https://cdn/y.png" />,
    );

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn/y.png');
  });

  it('com canSeeConfig é um botão que chama onOpenPerfilSettings', () => {
    const onOpen = vi.fn();
    render(
      <UsuarioIdentityCard displayName="Maria Souza" roleLabel="Usuário" canSeeConfig onOpenPerfilSettings={onOpen} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir perfil do profissional' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('mostra o nome curto, com o nome completo no title e no nome acessível; iniciais do nome completo', () => {
    render(<UsuarioIdentityCard displayName="Maria Souza" shortName="Maria" roleLabel="Usuário" />);

    const nome = screen.getByRole('heading', { level: 2, name: 'Maria Souza' });
    expect(nome).toHaveTextContent(/^Maria$/);
    expect(nome).toHaveAttribute('title', 'Maria Souza');
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('o cargo mostra "Usuário"', () => {
    render(<UsuarioIdentityCard displayName="Maria Souza" roleLabel="Usuário" />);

    expect(screen.getByText('Usuário')).toBeInTheDocument();
  });

  it('variant header: iniciais de 32px (40px a partir de lg) com anel, área de toque de 44px, pílula em 1440px', () => {
    render(<UsuarioIdentityCard variant="header" displayName="Maria Souza" roleLabel="Usuário" />);

    const nome = screen.getByRole('heading', { level: 2, name: 'Maria Souza' });
    const cartao = nome.parentElement.parentElement;
    expect(cartao).toHaveClass(
      'flex',
      'min-w-0',
      'rounded-full',
      'p-1.5',
      'lg:p-0',
      'min-[1440px]:pr-4',
      'min-[1440px]:ring-1',
      'min-[1440px]:bg-app-nav-active',
    );
    expect(cartao).not.toHaveClass('hidden', 'xl:flex', 'border', 'mx-4', 'mt-4', 'mb-6');
    expect(screen.getByText('MS')).toHaveClass(
      'h-8',
      'w-8',
      'lg:h-10',
      'lg:w-10',
      'shrink-0',
      'rounded-full',
      'ring-[1.5px]',
      'ring-app-accent',
      'ring-offset-2',
    );
    expect(nome.parentElement).toHaveClass('hidden', 'min-w-0', 'max-w-[140px]', 'min-[1440px]:block');
    expect(nome).toHaveClass('truncate');
  });

  it('variant header sem canSeeConfig é uma div, sem botão', () => {
    const { container } = render(<UsuarioIdentityCard variant="header" displayName="Maria Souza" roleLabel="Usuário" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.firstChild.tagName).toBe('DIV');
  });

  it('variant header com foto: moldura com anel', () => {
    const { container } = render(
      <UsuarioIdentityCard
        variant="header"
        displayName="Maria Souza"
        roleLabel="Usuário"
        perfilFotoResolved="https://cdn/y.png"
      />,
    );

    const moldura = container.querySelector('img').parentElement;
    expect(moldura).toHaveClass('h-8', 'w-8', 'lg:h-10', 'lg:w-10', 'ring-[1.5px]', 'ring-app-accent', 'ring-offset-2');
  });

  it('variant sidebar mantém as classes de hoje', () => {
    render(<UsuarioIdentityCard variant="sidebar" displayName="Maria Souza" roleLabel="Usuário" />);

    const nome = screen.getByRole('heading', { level: 2, name: 'Maria Souza' });
    const cartao = nome.parentElement.parentElement;
    expect(cartao).toHaveClass('rounded-[14px]', 'border', 'border-app-border', 'p-3');
    const foto = screen.getByText('MS');
    expect(foto).toHaveClass('h-10', 'w-10');
    expect(foto).not.toHaveClass('ring-offset-2');
  });
});
