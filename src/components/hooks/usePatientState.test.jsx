import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { usePatientState } from './usePatientState';
const wrapper = ({ children }) => <MemoryRouter initialEntries={['/pacientes']}>{children}</MemoryRouter>;
vi.mock('./useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
describe('usePatientState: sub-tela e aba vêm do endereço', () => {
  it('não expõe mais patientView nem aba do perfil', () => {
    const { result } = renderHook(() => usePatientState(), { wrapper });
    for (const k of ['patientView', 'setPatientView', 'patientDetailTab', 'setPatientDetailTab']) {
      expect(result.current).not.toHaveProperty(k);
    }
  });
  it('selectedPatientCpf começa nulo e ignora o storage', () => {
    sessionStorage.setItem('selectedPatientCpf', '111');
    sessionStorage.setItem('activePatientCpf', '222');
    const { result } = renderHook(() => usePatientState(), { wrapper });
    expect(result.current.selectedPatientCpf).toBeNull();
  });
  it('setSelectedPatientCpf guarda só em memória, sem gravar storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => usePatientState(), { wrapper });
    act(() => result.current.setSelectedPatientCpf('12345678900'));
    expect(result.current.selectedPatientCpf).toBe('12345678900');
    expect(setItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('selectedPatientCpf')).toBeNull();
    act(() => result.current.setSelectedPatientCpf('  '));
    expect(result.current.selectedPatientCpf).toBeNull();
    setItem.mockRestore();
  });
});
