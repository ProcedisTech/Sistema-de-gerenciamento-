import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnnotationCanvasAvaliacao } from './AnnotationCanvasAvaliacao.jsx';

vi.mock('../../services/api.js', () => ({
  mapasApi: {
    salvar: vi.fn().mockResolvedValue({ id: 'mapa-auto-123' }),
  },
  planejamentosApi: {
    listarPorPaciente: vi.fn().mockResolvedValue([]),
  },
  catalogosApi: {
    buscarPorId: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
  isRealUuid: (id) => typeof id === 'string' && id.length > 5,
}));

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('AnnotationCanvasAvaliacao — Autosave e Pop-up Inteligente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('salva direto sem pop-up quando a consulta possui plano e todos os procedimentos já pertencem a ele', async () => {
    const onSaved = vi.fn();
    const cleanUrl = 'blob:http://localhost/clean-photo-1';
    const catToxina = 'cat-toxina-1';

    const photo = {
      id: 'foto-1',
      fotoId: 'foto-1',
      url: cleanUrl,
      cleanUrl: cleanUrl,
      pontos: [
        {
          id: 'pt-1',
          posX: 50,
          posY: 50,
          tipoGeometria: 'ponto',
          catalogoProcedimentoSaudeId: catToxina,
          quantidade: 1,
        },
      ],
    };

    const planoContexto = {
      id: 'plano-100',
      itens: [
        {
          id: 'item-1',
          catalogoProcedimentoSaudeId: catToxina,
        },
      ],
    };

    render(
      <AnnotationCanvasAvaliacao
        photos={[photo]}
        editingIndex={0}
        imageSrc={cleanUrl}
        pacienteId="paciente-1"
        procedimentosIniciais={[{ id: catToxina, nome: 'Toxina', corHex: '#8b5cf6' }]}
        planoContexto={planoContexto}
        onAnnotatedCaptureSaved={onSaved}
        onClose={vi.fn()}
      />
    );

    const btnSalvar = screen.getByRole('button', { name: /Salvar Foto|Salvar/i });
    fireEvent.click(btnSalvar);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    const callPayload = onSaved.mock.calls[0][0];
    expect(callPayload.destinoAvaliacao).toBe('plano');
    expect(callPayload.mapaOverlay.tipoMapaCodigo).toBe('avaliacao');
    expect(screen.queryByText(/Destino da Avaliação Clínica/i)).toBeNull();
  });

  it('abre pop-up inteligente de novo procedimento quando há procedimento não constante no plano', async () => {
    const onSaved = vi.fn();
    const cleanUrl = 'blob:http://localhost/clean-photo-2';
    const catToxina = 'cat-toxina-1';
    const catPreenchedor = 'cat-preenchedor-2';

    const photo = {
      id: 'foto-2',
      fotoId: 'foto-2',
      url: cleanUrl,
      cleanUrl: cleanUrl,
      pontos: [
        {
          id: 'pt-1',
          posX: 40,
          posY: 40,
          tipoGeometria: 'ponto',
          catalogoProcedimentoSaudeId: catPreenchedor,
          quantidade: 1,
        },
      ],
    };

    const planoContexto = {
      id: 'plano-100',
      itens: [
        {
          id: 'item-1',
          catalogoProcedimentoSaudeId: catToxina, // Plano só tem Toxina!
        },
      ],
    };

    render(
      <AnnotationCanvasAvaliacao
        photos={[photo]}
        editingIndex={0}
        imageSrc={cleanUrl}
        pacienteId="paciente-1"
        procedimentosIniciais={[{ id: catPreenchedor, nome: 'Preenchedor', corHex: '#06b6d4' }]}
        planoContexto={planoContexto}
        onAnnotatedCaptureSaved={onSaved}
        onClose={vi.fn()}
      />
    );

    const btnSalvar = screen.getByRole('button', { name: /Salvar Foto|Salvar/i });
    fireEvent.click(btnSalvar);

    // Deve abrir o pop-up inteligente com título específico de novo procedimento
    const modalTitulo = await screen.findByText(/Novo Procedimento na Avaliação/i);
    expect(modalTitulo).toBeTruthy();

    const btnIncluir = screen.getByRole('button', { name: /Sim, incluir no Plano de Tratamento/i });
    fireEvent.click(btnIncluir);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    const callPayload = onSaved.mock.calls[0][0];
    expect(callPayload.destinoAvaliacao).toBe('plano');
    expect(callPayload.mapaOverlay.tipoMapaCodigo).toBe('avaliacao');
  });
});
