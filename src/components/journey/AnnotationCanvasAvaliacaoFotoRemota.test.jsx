// Regressão prevenida:
// Fotos sincronizadas do prontuário/atendimento com URLs relativas de API (/api/v1/pacientes/.../arquivo)
// causavam tela cinza vazia no AnnotationCanvasAvaliacao porque Image() sem autenticação tomava 401/CORS.
// O componente agora baixa via fetchArquivoBlob com headers autenticados e cria um blob local seguro.

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { AnnotationCanvasAvaliacao } from './AnnotationCanvasAvaliacao.jsx';
import { pacientesGaleriaApi } from '../../services/api.js';

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('../../services/api.js', () => ({
  mapasApi: {
    buscar: vi.fn().mockResolvedValue(null),
    salvar: vi.fn().mockResolvedValue({}),
  },
  planejamentosApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  catalogosApi: {
    get: vi.fn().mockResolvedValue({ id: 'cat-1', nome: 'Biópsia' }),
    list: vi.fn().mockResolvedValue([]),
  },
  pacientesGaleriaApi: {
    fetchArquivoBlob: vi.fn(),
  },
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('Regressão Zero — Carregamento de Foto Remota Autenticada no AnnotationCanvasAvaliacao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-blob-123');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('baixa blob autenticado via pacientesGaleriaApi quando displayUrl é endpoint de API', async () => {
    const mockBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
    pacientesGaleriaApi.fetchArquivoBlob.mockResolvedValueOnce(mockBlob);

    const apiPhotoUrl = '/api/v1/pacientes/pac-123/arquivo/foto-456';
    const photos = [
      {
        id: 'foto-456',
        url: apiPhotoUrl,
      },
    ];

    render(
      <AnnotationCanvasAvaliacao
        photos={photos}
        editingIndex={0}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(pacientesGaleriaApi.fetchArquivoBlob).toHaveBeenCalledWith(apiPhotoUrl);
    });

    expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
  });
});
