import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTermosPendentes } from './useTermosPendentes.js';

vi.mock('../services/api', () => ({
  termosApi: {
    resolver: vi.fn(),
  },
}));

import { termosApi } from '../services/api';

describe('useTermosPendentes — badge = gate', () => {
  beforeEach(() => {
    termosApi.resolver.mockReset();
  });

  it('conta só faltantes da resolução, ignorando INSTITUCIONAL selecionado', async () => {
    termosApi.resolver.mockResolvedValue({
      faltantes: [],
      termosExigidos: [],
    });

    const { result } = renderHook(() =>
      useTermosPendentes('pac-1', {
        catalogoIds: ['cat-botox'],
        exigirFilaVinculo: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.count).toBe(0);
    expect(result.current.pendentes).toEqual([]);
  });

  it('espelha faltantes do endpoint', async () => {
    termosApi.resolver.mockResolvedValue({
      faltantes: [{ termoId: 'termo-um', titulo: 'Termo de um' }],
    });

    const { result } = renderHook(() =>
      useTermosPendentes('pac-1', {
        catalogoIds: ['cat-botox'],
        exigirFilaVinculo: true,
      })
    );

    await waitFor(() => {
      expect(result.current.count).toBe(1);
    });
    expect(result.current.pendentes[0].id).toBe('termo-um');
  });
});
