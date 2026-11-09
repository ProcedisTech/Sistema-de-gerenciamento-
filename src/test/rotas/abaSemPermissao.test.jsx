import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';
import { flushSync } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

const papel = vi.hoisted(() => ({ atual: {} }));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => papel.atual }));
vi.mock('../../hooks/usePapel.js', () => ({ usePapel: () => papel.atual }));
vi.mock('../../hooks/useAlertasClinicos', () => ({
  useAlertasClinicos: () => ({ alertasPerfil: [], alertasAnamnese: [], resumo: null, isLoading: false }),
}));
vi.mock('../../hooks/useAlertasClinicos.js', () => ({
  useAlertasClinicos: () => ({ alertasPerfil: [], alertasAnamnese: [], resumo: null, isLoading: false }),
}));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('../../contexts/OrgContext', () => ({ useOrg: () => ({ orgId: 'org-1' }) }));
vi.mock('../../components/hooks/useAgoraDaClinica.js', () => ({
  useAgoraDaClinica: () => ({ fuso: 'America/Sao_Paulo', hojeIso: '2026-11-07', agoraMs: 0 }),
}));
vi.mock('../hooks/useAgoraDaClinica.js', () => ({
  useAgoraDaClinica: () => ({ fuso: 'America/Sao_Paulo', hojeIso: '2026-11-07', agoraMs: 0 }),
}));
vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({ usePatientProfilePhotoSrc: () => ({ src: null, loading: false }) }));

import { PatientProfileView } from '../../components/patients/PatientProfileView.jsx';
import { useRotaAtual } from '../../rotas/useRotaAtual.js';
import { caminhos } from '../../rotas/caminhos.js';

const PACIENTE = { id: 'p1', nome: 'Ana Souza', cpf: '' };
let roteador;

function Perfil() {
  const rota = useRotaAtual();
  const navigate = useNavigate();
  return (
    <PatientProfileView
      selectedPatient={PACIENTE}
      patientDetailTab={rota.patientDetailTab ?? 'planos'}
      rota={rota}
      irPara={navigate}
      voltarParaLista={() => navigate(caminhos.pacientes())}
      getPatientInitials={() => 'AS'}
    />
  );
}

function montar(caminho) {
  roteador = createMemoryRouter(
    [{ path: '/pacientes/:pacienteId/*', element: <Perfil /> }],
    { initialEntries: [caminho] },
  );
  render(<RouterProvider router={roteador} flushSync={flushSync} />);
}

describe('aba do endereço sem permissão', () => {
  beforeEach(() => {
    papel.atual = { canSeeOrcamentos: true, canSeeProntuario: false, canStartAnamnese: true, canSeeDocumentos: true };
  });

  it('link direto para prontuário sem permissão: endereço vira o perfil, com replace', () => {
    montar('/pacientes/p1/prontuario');
    expect(roteador.state.location.pathname).toBe('/pacientes/p1');
    expect(roteador.state.historyAction).toBe('REPLACE');
    expect(roteador.state.location.pathname).not.toContain('prontuario');
  });

  it('clicar numa aba permitida empilha (push)', () => {
    montar('/pacientes/p1');
    fireEvent.click(screen.getByRole('button', { name: 'Procedimentos e Atendimentos Sem Plano' }));
    expect(roteador.state.location.pathname).toBe('/pacientes/p1/avulsos');
    expect(roteador.state.historyAction).toBe('PUSH');
  });
});
