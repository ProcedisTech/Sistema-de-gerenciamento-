import React, { useEffect } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('../../services/api', () => ({
  setOrgId: vi.fn(),
  getOrgId: () => '',
  anamneseApi: {},
  procedimentosApi: {},
}));
vi.mock('../../utils/authMeProbe', () => ({ invalidateAuthMeCache: vi.fn() }));
vi.mock('../../hooks/usePapel', () => ({
  usePapel: () => ({ isNivel1: false, canCreatePacientes: false, canDeleteAgenda: false, canStartAnamnese: false, canSeeProntuario: false }),
}));
vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: () => ({ isNivel1: false, canCreatePacientes: false, canDeleteAgenda: false, canStartAnamnese: false, canSeeProntuario: false }),
}));
vi.mock('../../hooks/useAlertasClinicos.js', () => ({
  useAlertasClinicos: () => ({ alertasPerfil: [], alertasAnamnese: [], resumo: null, isLoading: false }),
}));
vi.mock('../planos/usePlanosPaciente.js', () => ({ usePlanosPaciente: () => ({ planos: [], loading: false }) }));
vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({ usePatientProfilePhotoSrc: () => ({ src: null, loading: false }) }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import { OrgProvider, useOrg } from '../../contexts/OrgContext';
import { estadoGateContexto } from '../system/estadoGateContexto.js';
import { ContextoClinicaTela } from '../system/ContextoClinicaGate.jsx';
import { useFusoClinica } from '../hooks/useFusoClinica.js';
import { PatientsListView } from './PatientsListView.jsx';
import { hojeDaClinica } from '../../utils/datasClinica.js';
import { evaluateProximoRetornoStep5 } from '../../utils/proximoRetornoStep5.js';

const ORG = '330e8b5c-8687-48dd-a534-d12aea1d5cd7';

const pacientes = Array.from({ length: 10 }, (_, i) => ({
  id: `p${i}`,
  nome: `Paciente ${i}`,
  cpf: `0000000000${i}`,
  idade: 30 + i,
  ultimaVinda: `2026-09-${String(10 + i).padStart(2, '0')}T13:00:00Z`,
  dataNascimento: `1990-10-0${(i % 9) + 1}`,
}));

const kpi = {
  agendamentosHoje: [
    { agendaId: 'a1', pacienteId: 'p1', pacienteNome: 'Paciente 1', data: '2026-10-02', horaInicio: '09:00', horaFim: '10:00', status: 'confirmado' },
    { agendaId: 'a2', pacienteId: 'p2', pacienteNome: 'Paciente 2', data: '2026-10-02', horaInicio: '06:00', horaFim: '06:30', status: 'realizado' },
  ],
  semPlanoList: [],
  totalSemPlano: 0,
  aniversariantesList: pacientes.slice(0, 3),
};

/** Simula a resposta do /me: permissões + fuso, depois contexto pronto. */
function MeSimulado({ responder }) {
  const org = useOrg();
  useEffect(() => {
    org.setOrgId(ORG);
    org.setContextStatus('loading');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!responder) return;
    org.setRoleUserId('vinculo');
    org.setPapel('DONO');
    org.setFusoHorario('America/Rio_Branco');
    org.setContextStatus('ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responder]);
  return null;
}

function Gate({ children }) {
  const { orgId, contextStatus } = useOrg();
  const estado = estadoGateContexto({ orgId, contextStatus });
  if (estado) return <ContextoClinicaTela estado={estado} onTentarDeNovo={() => {}} />;
  return children;
}

function Tela({ responder }) {
  return (
    <OrgProvider>
      <MeSimulado responder={responder} />
      <Gate>
        <PatientsListView
          patients={pacientes}
          patientListItems={pacientes}
          patientListMeta={{ page: 0, totalPages: 1, totalElements: pacientes.length }}
          setPatientListPage={() => {}}
          setPatientListSortBy={() => {}}
          setPatientSearchQuery={() => {}}
          setSelectedPatientCpf={() => {}}
          setPatientDetailTab={() => {}}
          setPatientView={() => {}}
          getPatientInitials={() => 'PT'}
          kpi={kpi}
          nomeUsuario="Ana"
        />
      </Gate>
    </OrgProvider>
  );
}

function avisosDeFuso(spy) {
  return spy.mock.calls.filter((args) => String(args[0]).includes('fuso ausente'));
}

describe('sem aviso de fuso ausente na carga da lista de pacientes', () => {
  let warn;
  const pilhas = [];

  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', true);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T12:48:00Z'));
    warn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      if (String(args[0]).includes('fuso')) pilhas.push(new Error('pilha do aviso').stack);
    });
  });

  afterEach(() => {
    if (pilhas.length) console.error(pilhas.join('\n\n'));
    pilhas.length = 0;
    warn.mockRestore();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('o espião enxerga o aviso quando o módulo recebe fuso nulo', () => {
    hojeDaClinica(null);
    expect(avisosDeFuso(warn)).toHaveLength(1);
    pilhas.length = 0;
  });

  it('zero avisos antes e depois do contexto pronto', () => {
    const { rerender } = render(<Tela responder={false} />);
    expect(screen.getByText('Preparando sessão…')).toBeInTheDocument();
    expect(avisosDeFuso(warn)).toHaveLength(0);

    act(() => rerender(<Tela responder />));
    expect(screen.getByRole('list', { name: 'Lista de pacientes' })).toBeInTheDocument();
    expect(screen.getAllByText(/Paciente 9/).length).toBeGreaterThan(0);
    expect(avisosDeFuso(warn)).toHaveLength(0);
  });

  it('chamador 1 (memo do bloqueio do retorno no AppRefactored): com fuso nulo não chama o módulo', () => {
    const { result } = renderHook(
      () => {
        const { fuso, pronto } = useFusoClinica();
        return pronto ? evaluateProximoRetornoStep5('2026-10-02', '', hojeDaClinica(fuso)).blocksFinish : false;
      },
      { wrapper: ({ children }) => <OrgProvider>{children}</OrgProvider> },
    );
    expect(result.current).toBe(false);
    expect(avisosDeFuso(warn)).toHaveLength(0);
  });
});
