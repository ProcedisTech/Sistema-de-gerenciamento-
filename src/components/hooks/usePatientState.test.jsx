import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePatientState } from './usePatientState';
vi.mock('./useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
describe('navegação para histórico do paciente', () => {
  it('destino timeline abre atendimentos e mantém abas explícitas', () => {
    const { result } = renderHook(() => usePatientState());
    act(() => result.current.setPatientDetailTab('timeline'));
    expect(result.current.patientDetailTab).toBe('avulsos');
    expect(sessionStorage.getItem('patientDetailTab')).toBe('avulsos');
    act(() => result.current.setPatientDetailTab('prontuario'));
    expect(result.current.patientDetailTab).toBe('prontuario');
  });
  it('restaura timeline persistida no histórico de atendimentos', () => {
    sessionStorage.setItem('patientDetailTab', 'timeline');
    const { result } = renderHook(() => usePatientState());
    expect(result.current.patientDetailTab).toBe('avulsos');
  });
});
