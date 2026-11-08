import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { usePatientState } from '../../components/hooks/usePatientState';
import { pacientesApi } from '../../services/api';

vi.mock('../../components/hooks/useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));
vi.mock('../../services/api', async (orig) => ({
  ...(await orig()),
  pacientesApi: { list: vi.fn(), search: vi.fn() },
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const dto = (id) => ({ id, nome: `Paciente ${id}`, cpf: `0000000000${id}` });
const pagina = (ids, number, last) => ({ content: ids.map(dto), first: number === 0, last, number, totalPages: 2, totalElements: 4 });

function Espiao({ aoMudar }) {
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => { aoMudar(loc, navigate); });
  return null;
}

function montar(inicial) {
  const espiao = {};
  const aoMudar = (loc, navigate) => { espiao.loc = loc; espiao.navigate = navigate; };
  const wrapper = ({ children }) => (
    <MemoryRouter initialEntries={[inicial]}><Espiao aoMudar={aoMudar} />{children}</MemoryRouter>
  );
  const r = renderHook(() => usePatientState({ authEnabled: true }), { wrapper });
  return { ...r, espiao };
}

describe('setas do perfil navegam por endereço', () => {
  it('seta próxima dentro da página empilha /pacientes/<id seguinte>', async () => {
    pacientesApi.list.mockResolvedValue(pagina([1, 2], 0, false));
    const { result, espiao } = montar('/pacientes/1');
    await waitFor(() => expect(result.current.patientListItems).toHaveLength(2));
    act(() => result.current.captureProfileNavSnapshot('00000000001'));
    await act(async () => { await result.current.navigateProfilePatient(1); });
    expect(espiao.loc.pathname).toBe('/pacientes/2');
    act(() => espiao.navigate(-1)); // empilhou: voltar leva ao anterior
    expect(espiao.loc.pathname).toBe('/pacientes/1');
  });

  it('cruzar página busca a vizinha no clique e vai ao primeiro id dela', async () => {
    pacientesApi.list.mockResolvedValueOnce(pagina([1, 2], 0, false));
    const { result, espiao } = montar('/pacientes/2');
    await waitFor(() => expect(result.current.patientListItems).toHaveLength(2));
    act(() => result.current.captureProfileNavSnapshot('00000000002'));
    pacientesApi.list.mockClear();
    pacientesApi.list.mockResolvedValue(pagina([3, 4], 1, true));
    await act(async () => { await result.current.navigateProfilePatient(1); });
    expect(pacientesApi.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    expect(espiao.loc.pathname).toBe('/pacientes/3');
    act(() => espiao.navigate(-1));
    expect(espiao.loc.pathname).toBe('/pacientes/2');
  });

  it('falha na busca da página vizinha não navega', async () => {
    pacientesApi.list.mockResolvedValueOnce(pagina([1, 2], 0, false));
    const { result, espiao } = montar('/pacientes/2');
    await waitFor(() => expect(result.current.patientListItems).toHaveLength(2));
    act(() => result.current.captureProfileNavSnapshot('00000000002'));
    pacientesApi.list.mockRejectedValue(new Error('x'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { await result.current.navigateProfilePatient(1); });
    expect(espiao.loc.pathname).toBe('/pacientes/2');
  });
});
