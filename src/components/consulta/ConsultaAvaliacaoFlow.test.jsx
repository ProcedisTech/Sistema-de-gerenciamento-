import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsultaAvaliacaoFlow } from './ConsultaAvaliacaoFlow.jsx';

vi.mock('../patients/galeria/GaleriaMapaThumb.jsx', () => ({
  GaleriaMapaThumb: ({ url, mapaOverlay, density, alt }) => (
    <div
      data-testid="galeria-mapa-thumb"
      data-url={url}
      data-density={density}
      data-pontos-count={mapaOverlay?.pontos?.length ?? 0}
    >
      {alt}
    </div>
  ),
}));

describe('ConsultaAvaliacaoFlow — Renderização de Miniaturas com Overlay Vetorial', () => {
  it('renderiza GaleriaMapaThumb quando a foto possui pontos anotados', () => {
    const photosMock = [
      {
        url: 'blob:http://localhost:5173/clean-photo-1',
        pontos: [
          { x: 50, y: 50, cor: '#d946ef', procedimentoIndex: 0 },
          { x: 60, y: 70, cor: '#64748b', procedimentoIndex: 1 },
        ],
        procedimentosMapeados: [
          { catalogoProcedimentoSaudeId: 'cat-1', nome: 'Exérese' },
          { catalogoProcedimentoSaudeId: 'cat-2', nome: 'Drenagem' },
        ],
      },
    ];

    render(
      <ConsultaAvaliacaoFlow
        evaluationCapturedPhotos={photosMock}
        onAnnotatePhoto={vi.fn()}
        onEvaluationRemovePhoto={vi.fn()}
      />
    );

    const thumb = screen.getByTestId('galeria-mapa-thumb');
    expect(thumb).toBeInTheDocument();
    expect(thumb.getAttribute('data-url')).toBe('blob:http://localhost:5173/clean-photo-1');
    expect(thumb.getAttribute('data-density')).toBe('thumb');
    expect(thumb.getAttribute('data-pontos-count')).toBe('2');
  });

  it('renderiza img padrão quando a foto não possui pontos ou anotações', () => {
    const photosMock = [
      {
        url: 'blob:http://localhost:5173/clean-photo-2',
        pontos: [],
      },
    ];

    const { container } = render(
      <ConsultaAvaliacaoFlow
        evaluationCapturedPhotos={photosMock}
        onAnnotatePhoto={vi.fn()}
        onEvaluationRemovePhoto={vi.fn()}
      />
    );

    expect(screen.queryByTestId('galeria-mapa-thumb')).toBeNull();
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('blob:http://localhost:5173/clean-photo-2');
  });
});
