// Regressão prevenida: Ao anotar fotos de procedimentos, a foto limpa original
// (cleanBlob / cleanUrl) DEVE ser preservada sem queima destrutiva de traços no bitmap JPEG.
// As anotações de traços, pontos e doses são estruturadas no mapaOverlay vetorial.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnnotationCanvasAvaliacao } from './AnnotationCanvasAvaliacao.jsx';

vi.mock('../../services/api.js', () => ({
  mapasApi: {
    salvar: vi.fn().mockResolvedValue({ id: 'mapa-proc-123' }),
  },
  planejamentosApi: {
    listarPorPaciente: vi.fn().mockResolvedValue([]),
  },
  catalogosApi: {
    buscarPorId: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
  },
  isRealUuid: (id) => typeof id === 'string' && id.length > 10,
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

describe('AnnotationCanvasAvaliacao — Preservação de Foto Limpa no Procedimento', () => {
  it('preserva cleanBlob e cleanUrl e emite mapaOverlay vetorial ao salvar', async () => {
    const onAnnotatedCaptureSaved = vi.fn();
    const cleanBlobMock = new Blob(['foto-original-limpa'], { type: 'image/jpeg' });
    const cleanUrlMock = 'blob:http://localhost/clean-photo-proc-1';

    const fotosProcedimento = [
      {
        id: 'foto-proc-1',
        url: cleanUrlMock,
        cleanUrl: cleanUrlMock,
        blob: cleanBlobMock,
        cleanBlob: cleanBlobMock,
      },
    ];

    const procedimentos = [
      {
        id: 'proc-toxina',
        catalogoProcedimentoSaudeId: 'proc-toxina',
        nome: 'Toxina Botulínica',
        corHex: '#8b5cf6',
      },
    ];

    render(
      <AnnotationCanvasAvaliacao
        photos={fotosProcedimento}
        editingIndex={0}
        imageSrc={cleanUrlMock}
        onAnnotatedCaptureSaved={onAnnotatedCaptureSaved}
        onClose={vi.fn()}
        pacienteId="paciente-uuid-123"
        procedimentosIniciais={procedimentos}
      />
    );

    // O botão de salvar avaliação / anotação está presente
    const salvarBtn = screen.getByRole('button', { name: /Salvar Marcações|Salvar Anotações|Salvar/i });
    expect(salvarBtn).toBeTruthy();

    fireEvent.click(salvarBtn);

    // Se houver modal de destino (Plano vs Avulso), escolhe avulso para procedimento
    const btnAvulso = screen.queryByRole('button', { name: /Apenas Salvar|Salvar Avulso|Confirmar/i });
    if (btnAvulso) {
      fireEvent.click(btnAvulso);
    }

    await waitFor(() => {
      expect(onAnnotatedCaptureSaved).toHaveBeenCalled();
    });

    const payload = onAnnotatedCaptureSaved.mock.calls[0][0];

    // Verifica que a foto limpa original foi estritamente preservada
    expect(payload.cleanUrl).toBe(cleanUrlMock);
    expect(payload.cleanBlob).toBe(cleanBlobMock);
    expect(payload.isAnnotated).toBe(true);
    expect(payload.mapaOverlay).toBeDefined();
    expect(Array.isArray(payload.mapaOverlay.pontos)).toBe(true);
  });

  it('aguarda envio pendente via aguardarFotosPendentes, resolve fotoId sem stale closure e pula upload duplicado', async () => {
    const onAnnotatedCaptureSaved = vi.fn();
    const persistAnnotatedPhotoToGallery = vi.fn();
    const cleanBlobMock = new Blob(['foto-bytes'], { type: 'image/jpeg' });
    const cleanUrlMock = 'blob:http://localhost/clean-photo-2';

    // A foto na montagem inicial ainda NÃO tem fotoId (em envio no background)
    const fotoEmEnvio = {
      url: cleanUrlMock,
      cleanUrl: cleanUrlMock,
      blob: cleanBlobMock,
      cleanBlob: cleanBlobMock,
      meta: {},
    };

    let uploadTerminou = false;
    const aguardarFotosPendentes = vi.fn().mockImplementation(async () => {
      // Simula o useEnvioFotosConsulta concluindo o upload e mutando a foto em memória
      fotoEmEnvio.meta.fotoId = 'foto-servidor-uuid-777';
      fotoEmEnvio.fotoId = 'foto-servidor-uuid-777';
      uploadTerminou = true;
    });

    const obterFotoId = vi.fn(() => (uploadTerminou ? 'foto-servidor-uuid-777' : null));

    render(
      <AnnotationCanvasAvaliacao
        photos={[fotoEmEnvio]}
        editingIndex={0}
        imageSrc={cleanUrlMock}
        onAnnotatedCaptureSaved={onAnnotatedCaptureSaved}
        persistAnnotatedPhotoToGallery={persistAnnotatedPhotoToGallery}
        aguardarFotosPendentes={aguardarFotosPendentes}
        obterFotoId={obterFotoId}
        onClose={vi.fn()}
        pacienteId="paciente-uuid-123"
        procedimentosIniciais={[]}
      />
    );

    const salvarBtn = screen.getByRole('button', { name: /Salvar Marcações|Salvar Anotações|Salvar/i });
    fireEvent.click(salvarBtn);

    await waitFor(() => {
      expect(aguardarFotosPendentes).toHaveBeenCalled();
      expect(onAnnotatedCaptureSaved).toHaveBeenCalled();
    });

    // Como o aguardarFotosPendentes forneceu o ID, o persistAnnotatedPhotoToGallery NÃO deve ser chamado (Zero Duplicação)
    expect(persistAnnotatedPhotoToGallery).not.toHaveBeenCalled();
  });
});
