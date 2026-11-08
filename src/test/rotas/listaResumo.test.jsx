/** Resumo do paciente = ?resumo=<id> no endereço (empilha; Voltar fecha); perfil abre por id, sem CPF. */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('../../services/api', () => ({ setOrgId: vi.fn(), getOrgId: () => '', anamneseApi: { listPaciente: () => Promise.resolve([]) }, procedimentosApi: { byPaciente: () => Promise.resolve([]) } }));
vi.mock('../../utils/authMeProbe', () => ({ invalidateAuthMeCache: vi.fn() }));
const papel = { isNivel1: true, canCreatePacientes: false, canDeleteAgenda: false, canStartAnamnese: false, canSeeProntuario: true };
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => papel }));
vi.mock('../../hooks/usePapel.js', () => ({ usePapel: () => papel }));
vi.mock('../../hooks/useAlertasClinicos.js', () => ({
  useAlertasClinicos: () => ({ alertasPerfil: [], alertasAnamnese: [], resumo: null, isLoading: false }),
}));
vi.mock('../../components/planos/usePlanosPaciente.js', () => ({ usePlanosPaciente: () => ({ planos: [], loading: false }) }));
vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({ usePatientProfilePhotoSrc: () => ({ src: null, loading: false }) }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import { PatientsListView } from '../../components/patients/PatientsListView.jsx';
import { lerRota } from '../../rotas/useRotaAtual.js';

const CPF = '12345678909';
const pacientes = [{ id: 'p1', nome: 'Maria Souza', cpf: CPF, idade: 30, dataNascimento: '1990-10-01' }];

function Host() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <PatientsListView
      patients={pacientes}
      patientListItems={pacientes}
      patientListMeta={{ page: 0, totalPages: 1, totalElements: 1 }}
      setPatientListPage={() => {}}
      setPatientListSortBy={() => {}}
      setPatientSearchQuery={() => {}}
      setSelectedPatientCpf={() => {}}
      rota={lerRota(pathname, search)}
      irPara={navigate}
      getPatientInitials={() => 'MS'}
      kpi={{ agendamentosHoje: [], semPlanoList: [], totalSemPlano: 0, aniversariantesList: [] }}
      nomeUsuario="Ana"
    />
  );
}

function montar() {
  const router = createMemoryRouter([{ path: '*', element: <Host /> }], {
    initialEntries: ['/agenda', '/pacientes'],
    initialIndex: 1,
  });
  render(<RouterProvider router={router} />);
  return router;
}
const caminho = (r) => r.state.location.pathname + r.state.location.search;

describe('lista de pacientes pelo endereço', () => {
  it('abrir o resumo empilha ?resumo=<id> e Voltar fecha', () => {
    const router = montar();
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    expect(caminho(router)).toBe('/pacientes?resumo=p1');
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);

    act(() => { router.navigate(-1); });
    expect(caminho(router)).toBe('/pacientes');
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });

  it('abrir o perfil pela lista vai para /pacientes/<id>, sem CPF no endereço', () => {
    const router = montar();
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /Ver Cadastro|Ver Perfil/ })[0]);
    expect(caminho(router)).toBe('/pacientes/p1');
    expect(caminho(router)).not.toContain(CPF);
  });
});
