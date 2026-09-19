import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/apiEnv', () => ({
  resolveApiUrl: (path) => path,
}));

vi.mock('../../services/api', () => ({
  catalogoClinicoApi: {
    reacoesAdversas: vi.fn(),
    alimentos: vi.fn(),
    outrasAlergias: vi.fn(),
    principiosAtivos: vi.fn(),
    medicamentos: vi.fn(),
    antecedentesPessoais: vi.fn(),
  },
}));

import { searchCatalogoHub, searchCatalogoPublico } from './anamneseCatalogoSearch.js';
import { catalogoClinicoApi } from '../../services/api';

describe('searchCatalogoPublico', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('reacao com HTTP 500 rejeita a promise', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    const fn = searchCatalogoPublico('catalogo_reacao');
    await expect(fn('')).rejects.toThrow(/Catálogo indisponível/);
  });

  it('principio ativo com HTTP 404 retorna lista vazia (fetchJson)', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });
    const fn = searchCatalogoPublico('catalogo_principio_ativo');
    await expect(fn('am')).resolves.toEqual([]);
  });

  it('reacao com HTTP 200 retorna lista', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', nome: 'Coceira' }],
    });
    const fn = searchCatalogoPublico('catalogo_reacao');
    await expect(fn('')).resolves.toEqual([{ id: '1', nome: 'Coceira' }]);
  });
});

describe('searchCatalogoHub catalogo_reacao', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('propaga rejeição sem engolir em []', async () => {
    catalogoClinicoApi.reacoesAdversas.mockRejectedValue(new Error('network'));
    const fn = searchCatalogoHub('catalogo_reacao');
    await expect(fn('')).rejects.toThrow('network');
  });
});
