import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { SignatureFullscreenModal } from '../journey/Step4LGPD.jsx';

describe('SignatureFullscreenModal — erro e retry', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,abc');
  });

  it('exibe erro e Tentar novamente quando retryable', () => {
    const canvasRef = { current: document.createElement('canvas') };
    const hasStrokeRef = { current: true };

    render(
      <SignatureFullscreenModal
        open={true}
        title="Assinatura do Paciente"
        onClose={vi.fn()}
        canvasRef={canvasRef}
        hasStrokeRef={hasStrokeRef}
        mobilePortrait={false}
        onConfirm={vi.fn()}
        error="Erro ao salvar"
        saving={false}
        retryable={true}
      />
    );

    expect(screen.getByText('Erro ao salvar')).toBeInTheDocument();
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('erro não retentável não mostra Tentar novamente', () => {
    const canvasRef = { current: document.createElement('canvas') };
    const hasStrokeRef = { current: true };

    render(
      <SignatureFullscreenModal
        open={true}
        title="Assinatura do Paciente"
        onClose={vi.fn()}
        canvasRef={canvasRef}
        hasStrokeRef={hasStrokeRef}
        mobilePortrait={false}
        onConfirm={vi.fn()}
        error="já foi finalizada por outro caminho"
        saving={false}
        retryable={false}
      />
    );

    expect(screen.getByText(/já foi finalizada/i)).toBeInTheDocument();
    expect(screen.queryByText('Tentar novamente')).not.toBeInTheDocument();
  });
});
