import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { PulseSidebar } from './PulseSidebar.jsx';
import { PatientPreviewPanel } from './PatientsListView.jsx';
import { agruparAgendamentosHojePulse } from '../../utils/sortAgendamentosHojePulse.js';
import { loteDasLinhas } from '../../utils/loteAgendasDoPaciente.js';

/**
 * B-42 F2: Ana tem 05:00 e 16:00 hoje (dois cards). Iniciar no card das 05:00 leva lote só com as 05:00,
 * pela sidebar e pelas duas entradas da prévia.
 */

const papel = vi.hoisted(() => ({
  isNivel1: false,
  canSeeProntuario: false,
  canDeleteAgenda: false,
  canStartAnamnese: true,
  roleUserId: 'ru-1',
}));

vi.mock('../../hooks/usePapel.js', () => ({ usePapel: () => papel }));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => papel }));
vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({
  usePatientProfilePhotoSrc: () => ({ src: null, loading: false }),
}));
vi.mock('../hooks/useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true, recarregarFuso: () => {} }),
}));
vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../hooks/useAlertasClinicos.js', () => ({
  useAlertasClinicos: () => ({ alertasPerfil: [], alertasAnamnese: [], resumo: null, isLoading: false }),
}));
vi.mock('../planos/usePlanosPaciente.js', () => ({
  usePlanosPaciente: () => ({ planos: [], loading: false }),
}));
vi.mock('../../services/api', () => ({
  anamneseApi: {},
  procedimentosApi: {},
}));

const DF = 'America/Sao_Paulo';
// 07:00Z = 04:00 em Brasília: os dois cards estão por vir
const NOW = new Date('2026-10-09T07:00:00Z');
const ANA = { id: 'p-ana', nome: 'Ana', cpf: '00000000000' };

function ag(id, horaInicio, horaFim) {
  return {
    id,
    agendaId: id,
    data: '2026-10-09',
    tipo: 'atendimento',
    horaInicio,
    horaFim,
    pacienteId: 'p-ana',
    pacienteNome: 'Ana',
    profissionalRoleUserId: 'ru-1',
    roleUserId: 'ru-1',
    status: 'confirmado',
    procedimentoNome: `Botox ${horaInicio}`,
    catalogoProcedimentoSaudeId: 'cat-1',
    planejamentoItemId: null,
    atendimentoId: null,
    atendimentoStatusCodigo: null,
  };
}

const A05 = ag('a05', '05:00', '05:30');
const A16 = ag('a16', '16:00', '16:30');
const ROWS = [A05, A16];

const loteIds = (options) => (options?.lote || []).map((l) => l.agendaId);

describe('Iniciar no card das 05:00 leva só as 05:00 (Ana 05:00 e 16:00)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try { window.localStorage.clear(); } catch { /* sem storage */ }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sidebar: Iniciar no card das 05:00 → lote só com 05:00', () => {
    const onStartAttendance = vi.fn();
    render(
      <PulseSidebar
        kpi={{
          agendamentosHoje: ROWS,
          entradasHoje: agruparAgendamentosHojePulse(ROWS, DF, NOW),
          semPlanoList: [],
          totalSemPlano: 0,
          aniversariantesList: [],
          recarregarAgendaHoje: vi.fn(async () => {}),
        }}
        loading={false}
        nomeUsuario="Bia"
        getPatientInitials={() => 'A'}
        agendaSchedule={{ handleAtualizarStatus: vi.fn(), handleEnviarWhatsApp: vi.fn(), openReagendarModal: vi.fn() }}
        onStartAttendance={onStartAttendance}
        onVoltarConsulta={vi.fn()}
      />,
    );
    const card05 = screen.getByText('Botox 05:00').closest('div.rounded-xl');
    fireEvent.click(within(card05).getByRole('button', { name: 'Iniciar atendimento' }));
    expect(onStartAttendance).toHaveBeenCalledTimes(1);
    const [slot, linhas] = onStartAttendance.mock.calls[0];
    expect(slot.agendaId).toBe('a05');
    expect(linhas.map((l) => l.id)).toEqual(['a05']);
    // PatientsListView.handleStartAttendanceFromSlot repassa as linhas: buildAgendaSlotOptions(slot, linhas).lote = loteDasLinhas(linhas).
    expect(loteDasLinhas(linhas).map((l) => l.agendaId)).toEqual(['a05']);
  });

  function renderPrevia(onStartAttendance) {
    return render(
      <PatientPreviewPanel
        selectedPatient={ANA}
        detailTitleId="detail-title"
        closeDetail={vi.fn()}
        getPatientInitials={() => 'A'}
        setPatientDetailTab={vi.fn()}
        setPatientView={vi.fn()}
        onStartAttendance={onStartAttendance}
        agendaSchedule={{ handleAtualizarStatus: vi.fn(), handleEnviarWhatsApp: vi.fn(), openReagendarModal: vi.fn() }}
        previewAgendaSlot={A05}
        entradasHoje={agruparAgendamentosHojePulse(ROWS, DF, NOW)}
      />,
    );
  }

  it('prévia, botão "Iniciar Atendimento" → lote só com 05:00', () => {
    const onStartAttendance = vi.fn();
    renderPrevia(onStartAttendance);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Atendimento' }));
    expect(onStartAttendance).toHaveBeenCalledTimes(1);
    const [paciente, options] = onStartAttendance.mock.calls[0];
    expect(paciente.id).toBe('p-ana');
    expect(options.agendaId).toBe('a05');
    expect(loteIds(options)).toEqual(['a05']);
  });

  it('prévia, "Iniciar atendimento" do bloco "Agendamento de Hoje" → lote só com 05:00', () => {
    const onStartAttendance = vi.fn();
    renderPrevia(onStartAttendance);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar atendimento' }));
    expect(onStartAttendance).toHaveBeenCalledTimes(1);
    const [, options] = onStartAttendance.mock.calls[0];
    expect(options.agendaId).toBe('a05');
    expect(loteIds(options)).toEqual(['a05']);
  });
});
