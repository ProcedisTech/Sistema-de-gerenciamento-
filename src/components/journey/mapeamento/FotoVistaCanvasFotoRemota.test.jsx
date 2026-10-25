import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { FotoVistaCanvasCore } from './FotoVistaCanvas.jsx';
import { pacientesGaleriaApi } from '../../../services/api.js';

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

vi.mock('../../../services/api.js', () => ({
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

vi.mock('../../../contexts/useToast.js', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('Regressão Zero — Carregamento de Foto Remota Autenticada no FotoVistaCanvasCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-blob-autenticado-123');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('baixa blob autenticado via pacientesGaleriaApi quando displayUrl é rota de API (/api/v1/...)', async () => {
    const mockBlob = new Blob(['bytes-da-foto-do-paciente'], { type: 'image/jpeg' });
    pacientesGaleriaApi.fetchArquivoBlob.mockResolvedValueOnce(mockBlob);

    const apiPhotoUrl = '/api/v1/pacientes/pac-123/galeria/foto-789/arquivo?v=1700000000';
    const foto = {
      id: 'foto-789',
      fotoGaleriaId: 'foto-789',
      displayUrl: apiPhotoUrl,
      url: apiPhotoUrl,
    };

    render(
      <FotoVistaCanvasCore
        vistaAtual="frontal"
        foto={foto}
        pacienteId="pac-123"
        procedimentoArmado={{ id: 'cat-1', nome: 'Procedimento' }}
        pontosVista={[]}
        modo="ponto"
        readOnly={false}
      />
    );

    await waitFor(() => {
      expect(pacientesGaleriaApi.fetchArquivoBlob).toHaveBeenCalledWith(apiPhotoUrl);
    });

    expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
  });
});
