import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';
import { flushSync } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

const papel = vi.hoisted(() => ({ atual: {} }));
const notas = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn() }));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => papel.atual }));
vi.mock('../../hooks/usePapel.js', () => ({ usePapel: () => papel.atual }));
vi.mock('../../hooks/useAlertasClinicos', () => ({
  useAlertasClinicos: () => ({ alertasPerfil: [], alertasAnamnese: [], resumo: null, isLoading: false }),
}));
vi.mock('../../hooks/useAlertasClinicos.js', () => ({
  useAlertasClinicos: () => ({ alertasPerfil: [], alertasAnamnese: [], resumo: null, isLoading: false }),
}));
vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock('../../contexts/OrgContext', () => ({ useOrg: () => ({ orgId: 'org-1' }) }));
vi.mock('../hooks/useAgoraDaClinica.js', () => ({
  useAgoraDaClinica: () => ({ fuso: 'America/Sao_Paulo', hojeIso: '2026-11-07', agoraMs: 0 }),
}));
vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({ usePatientProfilePhotoSrc: () => ({ src: null, loading: false }) }));
vi.mock('../../services/api', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, notasApi: { ...real.notasApi, create: notas.create, list: notas.list } };
});

import { PatientProfileView } from './PatientProfileView.jsx';
import { useRotaAtual } from '../../rotas/useRotaAtual.js';
import { caminhos } from '../../rotas/caminhos.js';

const PACIENTE = { id: 'p1', nome: 'Ana Souza', cpf: '' };

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
      roleUserId="11111111-1111-1111-1111-111111111111"
    />
  );
}

describe('nota rápida: duplo clique', () => {
  it('2 cliques seguidos criam 1 nota e o botão fica desabilitado enquanto salva', async () => {
    papel.atual = { canCreateNotaPaciente: true, canSeeOrcamentos: true, canSeeDocumentos: true };
    let solta;
    notas.create.mockReturnValue(new Promise((r) => { solta = r; }));
    notas.list.mockResolvedValue([]);
    const roteador = createMemoryRouter([{ path: '/pacientes/:pacienteId/*', element: <Perfil /> }], {
      initialEntries: ['/pacientes/p1'],
    });
    render(<RouterProvider router={roteador} flushSync={flushSync} />);

    fireEvent.change(await screen.findByPlaceholderText('Escreva uma nota rápida...'), { target: { value: 'oi' } });
    const botao = screen.getByRole('button', { name: 'Adicionar nota rápida' });
    expect(botao).toBeEnabled();
    fireEvent.click(botao);
    fireEvent.click(botao);

    expect(notas.create).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(botao).toBeDisabled());
    solta({});
    await waitFor(() => expect(botao).toBeDisabled()); // texto limpo após salvar
  });
});
