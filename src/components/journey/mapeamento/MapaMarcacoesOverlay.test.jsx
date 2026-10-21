import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapaMarcacoesOverlay } from './MapaMarcacoesOverlay.jsx';

describe('MapaMarcacoesOverlay - Performance & Efeitos Fluidos de Pontos', () => {
  const mockPontos = [
    {
      id: 'p1',
      localId: 'p1',
      nomeProcedimento: 'Toxina Botulínica',
      quantidade: 2.0,
      unidadeMedida: 'u',
      cor: '#06b6d4',
      posX: 50,
      posY: 50,
      tamanho: 'm',
      tipoGeometria: 'ponto',
    },
  ];

  it('aplica classes de aceleração por hardware (GPU will-change-transform) no ponto', () => {
    render(
      <MapaMarcacoesOverlay
        pontos={mockPontos}
        layoutMetrics={{ cw: 500, ch: 500, drawW: 500, drawH: 500, offsetX: 0, offsetY: 0 }}
        interactive={true}
      />
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeNull();

    const dotSpan = button.querySelector('span');
    expect(dotSpan).not.toBeNull();
    // Deve conter will-change-transform e transition-transform para aceleração por GPU
    expect(dotSpan.className).toContain('will-change-transform');
    expect(dotSpan.className).toContain('transition-transform');
  });

  it('renderiza o tooltip com fundo sólido sem o shader pesado de backdrop-blur', () => {
    render(
      <MapaMarcacoesOverlay
        pontos={mockPontos}
        layoutMetrics={{ cw: 500, ch: 500, drawW: 500, drawH: 500, offsetX: 0, offsetY: 0 }}
        interactive={true}
        hoveredPontoId="p1"
      />
    );

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).not.toBeNull();
    expect(screen.getByText('Toxina Botulínica')).not.toBeNull();

    // Não deve conter backdrop-blur
    expect(tooltip.innerHTML).not.toContain('backdrop-blur');
    expect(tooltip.innerHTML).toContain('bg-slate-900');
  });

  it('limpa o tooltip ativo quando hoveredPontoId se torna null (dismiss suave)', () => {
    const { rerender } = render(
      <MapaMarcacoesOverlay
        pontos={mockPontos}
        layoutMetrics={{ cw: 500, ch: 500, drawW: 500, drawH: 500, offsetX: 0, offsetY: 0 }}
        interactive={true}
        hoveredPontoId="p1"
      />
    );

    expect(screen.getByRole('tooltip')).not.toBeNull();

    // Rerender passando hoveredPontoId = null (ex: clique fora na foto)
    rerender(
      <MapaMarcacoesOverlay
        pontos={mockPontos}
        layoutMetrics={{ cw: 500, ch: 500, drawW: 500, drawH: 500, offsetX: 0, offsetY: 0 }}
        interactive={true}
        hoveredPontoId={null}
      />
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renderiza marcadores em density="preview" com dimensões nítidas sem doses flutuantes', () => {
    const { container } = render(
      <MapaMarcacoesOverlay
        pontos={mockPontos}
        layoutMetrics={{ cw: 500, ch: 500, drawW: 500, drawH: 500, offsetX: 0, offsetY: 0 }}
        density="preview"
        interactive={false}
      />
    );

    // No modo preview/não-interativo, não deve exibir botões ou doses
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('2 u')).toBeNull();

    // O span do marcador deve ter tamanho proporcional (base 14 * 0.85 = 12px)
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot.style.width).toBe('12px');
    expect(dot.style.height).toBe('12px');
    expect(dot.style.backgroundColor).toBe('rgb(6, 182, 212)'); // #06b6d4
  });

  it('renderiza marcadores em density="thumb" com diâmetro visível sem sumir a cor', () => {
    const { container } = render(
      <MapaMarcacoesOverlay
        pontos={mockPontos}
        layoutMetrics={{ cw: 500, ch: 500, drawW: 500, drawH: 500, offsetX: 0, offsetY: 0 }}
        density="thumb"
        interactive={false}
      />
    );

    // O span do marcador deve ter diâmetro seguro (base 14 * 0.65 = 9px)
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot.style.width).toBe('9px');
    expect(dot.style.height).toBe('9px');
  });
});
