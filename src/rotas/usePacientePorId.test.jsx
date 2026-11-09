import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const get = vi.hoisted(() => vi.fn());
vi.mock('../services/api.js', () => ({ pacientesApi: { get } }));
vi.mock('../contexts/OrgContext.jsx', () => ({ useOrg: () => ({ orgId: 'org-1', contextStatus: 'ready', fusoHorario: 'Pacific/Kiritimati' }) }));
vi.mock('../utils/patientMapping.js', () => ({ mapBackendPatient: (d, opts) => ({ id: d.id, nome: `mapeado-${d.id}`, opts }) }));

import { usePacientePorId } from './usePacientePorId.js';

beforeEach(() => { get.mockReset(); });

describe('usePacientePorId', () => {
  it('acha na lista sem rede', () => {
    const lista = [{ id: 7, nome: 'Ana' }];
    const { result } = renderHook(() => usePacientePorId('7', lista));
    expect(result.current).toEqual({ paciente: lista[0], carregando: false, naoEncontrado: false });
    expect(get).not.toHaveBeenCalled();
  });

  it('id nulo nao faz rede', () => {
    const { result } = renderHook(() => usePacientePorId(null, []));
    expect(result.current).toEqual({ paciente: null, carregando: false, naoEncontrado: false });
    expect(get).not.toHaveBeenCalled();
  });

  it('busca na API e mapeia', async () => {
    get.mockResolvedValue({ id: 9 });
    const { result } = renderHook(() => usePacientePorId('9', []));
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(get).toHaveBeenCalledWith('9');
    expect(result.current.paciente).toMatchObject({ id: 9, nome: 'mapeado-9' });
  });

  it('passa o fuso da clinica e o hoje dela ao mapeamento', async () => {
    get.mockResolvedValue({ id: 9 });
    const { result } = renderHook(() => usePacientePorId('9', []));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.paciente.opts.fuso).toBe('Pacific/Kiritimati');
    expect(result.current.paciente.opts.hojeIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('404 vira naoEncontrado; erro de rede nao', async () => {
    get.mockRejectedValueOnce({ status: 404 });
    const a = renderHook(() => usePacientePorId('1', []));
    await waitFor(() => expect(a.result.current.carregando).toBe(false));
    expect(a.result.current).toEqual({ paciente: null, carregando: false, naoEncontrado: true });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    get.mockRejectedValueOnce({ status: 500 });
    const b = renderHook(() => usePacientePorId('c0000000-0000-4000-8000-0000000000e2', []));
    await waitFor(() => expect(b.result.current.carregando).toBe(false));
    expect(b.result.current.naoEncontrado).toBe(false);

    get.mockRejectedValueOnce({ status: 500 }); // id sem formato de UUID: 500 vira não encontrado
    const c = renderHook(() => usePacientePorId('abc', []));
    await waitFor(() => expect(c.result.current.carregando).toBe(false));
    expect(c.result.current.naoEncontrado).toBe(true);
    warn.mockRestore();
  });

  it('descarta resposta velha ao trocar o id', async () => {
    let resolveA;
    get.mockImplementationOnce(() => new Promise((r) => { resolveA = r; }));
    get.mockResolvedValueOnce({ id: 'B' });
    const { result, rerender } = renderHook(({ id }) => usePacientePorId(id, []), { initialProps: { id: 'A' } });
    rerender({ id: 'B' });
    await waitFor(() => expect(result.current.paciente?.id).toBe('B'));
    await act(async () => { resolveA({ id: 'A' }); });
    expect(result.current.paciente.id).toBe('B');
  });
});
