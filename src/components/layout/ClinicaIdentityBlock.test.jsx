import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ClinicaIdentityBlock } from './ClinicaIdentityBlock.jsx';

describe('ClinicaIdentityBlock', () => {
  it('sem logo mostra o ícone Shield', () => {
    const { container } = render(<ClinicaIdentityBlock tituloClinica="Clínica Teste" />);

    expect(screen.queryByAltText('Logo')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('com logo mostra a imagem', () => {
    render(<ClinicaIdentityBlock tituloClinica="Clínica Teste" clinicaLogoResolved="https://cdn/x.png" />);

    expect(screen.getByAltText('Logo')).toHaveAttribute('src', 'https://cdn/x.png');
  });

  it('com canSeeConfig é um botão que chama onOpenClinicaSettings', () => {
    const onOpen = vi.fn();
    render(<ClinicaIdentityBlock tituloClinica="Clínica Teste" canSeeConfig onOpenClinicaSettings={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir dados da clínica' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('sem canSeeConfig não é botão', () => {
    render(<ClinicaIdentityBlock tituloClinica="Clínica Teste" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Clínica Teste')).toBeInTheDocument();
  });

  it('variant header: nome em até 2 linhas, largura máxima por faixa e title', () => {
    render(<ClinicaIdentityBlock variant="header" tituloClinica="Premier Harmonização" />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('line-clamp-2', 'break-words', 'text-[16px]', 'text-app-ink');
    expect(h1).not.toHaveClass('truncate');
    expect(h1).toHaveAttribute('title', 'Premier Harmonização');
    expect(h1.parentElement).toHaveClass('min-w-0', 'flex-1', 'md:max-w-[240px]', 'lg:max-w-[120px]');
  });

  it('variant header: visível em todas as larguras, ocupa o espaço livre no celular e não encolhe a partir de lg', () => {
    render(<ClinicaIdentityBlock variant="header" tituloClinica="Clínica Teste" canSeeConfig />);

    const bloco = screen.getByRole('button', { name: 'Abrir dados da clínica' });
    expect(bloco).toHaveClass('flex', 'min-w-0', 'flex-1', 'md:flex-initial', 'lg:flex-none');
    expect(bloco).not.toHaveClass('hidden', 'xl:flex');
  });

  it('variant header sem canSeeConfig é uma div, sem botão', () => {
    const { container } = render(<ClinicaIdentityBlock variant="header" tituloClinica="Clínica Teste" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.firstChild.tagName).toBe('DIV');
    expect(container.firstChild).not.toHaveClass('hidden');
  });

  it('variant header com logo: caixa de 36px (40px a partir de lg) sem padding nem borda', () => {
    render(
      <ClinicaIdentityBlock variant="header" tituloClinica="Clínica Teste" clinicaLogoResolved="https://cdn/x.png" />,
    );

    const img = screen.getByAltText('Logo');
    expect(img).toHaveClass('h-9', 'w-9', 'lg:h-10', 'lg:w-10', 'object-cover');
    const caixa = img.parentElement;
    expect(caixa).toHaveClass('h-9', 'w-9', 'lg:h-10', 'lg:w-10', 'rounded-xl', 'overflow-hidden', 'ring-1');
    expect(caixa).not.toHaveClass('p-1', 'p-2', 'border');
  });

  it('variant header sem logo: a mesma caixa com o Shield', () => {
    const { container } = render(<ClinicaIdentityBlock variant="header" tituloClinica="Clínica Teste" />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.parentElement).toHaveClass('h-9', 'w-9', 'lg:h-10', 'lg:w-10', 'items-center', 'justify-center');
  });

  it.each(['sidebar-desktop', 'sidebar-tablet'])('variant %s mantém a caixa do logo de hoje', (variant) => {
    render(
      <ClinicaIdentityBlock variant={variant} tituloClinica="Clínica Teste" clinicaLogoResolved="https://cdn/x.png" />,
    );

    const img = screen.getByAltText('Logo');
    expect(img).toHaveClass('h-10', 'w-10', 'rounded-xl');
    expect(img.parentElement).toHaveClass('p-2', 'border', 'border-white/30', 'bg-[#00a88e]');
  });

  it('variant sidebar mantém o truncate e o tamanho de hoje', () => {
    render(<ClinicaIdentityBlock variant="sidebar-desktop" tituloClinica="Clínica Teste" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('truncate', 'text-[19px]');
  });

  it('não mostra o subtítulo', () => {
    render(<ClinicaIdentityBlock variant="sidebar-tablet" tituloClinica="Clínica Teste" />);

    expect(screen.queryByText('Harmonização Premium')).not.toBeInTheDocument();
  });
});
