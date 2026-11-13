import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePendenciasEquipe } from './usePendenciasEquipe.js';

vi.mock('../services/api', () => ({ equipeApi: { list: vi.fn() } }));

import { equipeApi } from '../services/api';

// Formato real: equipeApi.list() devolve o corpo ja parseado (lista ou {content}), sem .ok/.json.
const resp = (body) => body;
const lista = [
  { ativo: true, perfilAcessoId: null },
  { ativo: false, perfilAcessoId: null },
  { ativo: true, perfilAcessoId: 'p1' },
];

describe('usePendenciasEquipe', () => {
  beforeEach(() => {
    equipeApi.list.mockReset();
  });

  it('desligado: não chama list e devolve 0', async () => {
    const { result } = renderHook(() => usePendenciasEquipe(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.pendencias).toBe(0);
    expect(equipeApi.list).not.toHaveBeenCalled();
  });

  it('array: conta ativos sem perfil', async () => {
    equipeApi.list.mockResolvedValue(resp(lista));
    const { result } = renderHook(() => usePendenciasEquipe(true));
    await waitFor(() => expect(result.current.pendencias).toBe(1));
  });

  it('{content}: conta ativos sem perfil', async () => {
    equipeApi.list.mockResolvedValue(resp({ content: [{ ativo: true }] }));
    const { result } = renderHook(() => usePendenciasEquipe(true));
    await waitFor(() => expect(result.current.pendencias).toBe(1));
  });

  it('erro: devolve 0, não lança e não loga console.error', async () => {
    const erroSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const avisoSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    equipeApi.list.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => usePendenciasEquipe(true));
    await waitFor(() => expect(equipeApi.list).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.pendencias).toBe(0);
    expect(erroSpy).not.toHaveBeenCalled();
    expect(avisoSpy).not.toHaveBeenCalled();
    erroSpy.mockRestore();
    avisoSpy.mockRestore();
  });

  it('re-render não chama de novo', async () => {
    equipeApi.list.mockResolvedValue(resp(lista));
    const { result, rerender } = renderHook(() => usePendenciasEquipe(true));
    await waitFor(() => expect(result.current.pendencias).toBe(1));
    rerender();
    rerender();
    expect(equipeApi.list).toHaveBeenCalledTimes(1);
  });

  it('recarregar: conta 1, a API passa a devolver 0 e o número cai para 0', async () => {
    equipeApi.list.mockResolvedValueOnce(resp(lista));
    const { result } = renderHook(() => usePendenciasEquipe(true));
    await waitFor(() => expect(result.current.pendencias).toBe(1));
    equipeApi.list.mockResolvedValueOnce(resp([{ ativo: true, perfilAcessoId: 'p1' }]));
    act(() => result.current.recarregar());
    await waitFor(() => expect(result.current.pendencias).toBe(0));
    expect(equipeApi.list).toHaveBeenCalledTimes(2);
  });

  it('StrictMode: o número aparece e list é chamado 1x', async () => {
    equipeApi.list.mockResolvedValue(resp(lista));
    const { result } = renderHook(() => usePendenciasEquipe(true), { wrapper: React.StrictMode });
    await waitFor(() => expect(result.current.pendencias).toBe(1));
    expect(equipeApi.list).toHaveBeenCalledTimes(1);
  });
});
