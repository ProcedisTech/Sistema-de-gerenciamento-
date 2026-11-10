import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Não titular inicia a consulta pelo card (rail REAL) sem bloqueio e sem modal do Dono.
 * Só os filhos pesados do Dashboard são stubs; card, AgendaRailCardActions, agendaCardActions e
 * handlePrimary do AgendaDashboard são os reais.
 */
vi.mock('./AgendaTopbar.jsx', () => ({ AgendaTopbar: () => null }));
vi.mock('./AgendaControlStrip.jsx', () => ({ AgendaControlStrip: () => null }));
vi.mock('./AgendaCalendarGrid.jsx', () => ({ AgendaCalendarGrid: () => null }));
vi.mock('./AgendaCalendarSkeleton.jsx', () => ({ AgendaCalendarSkeleton: () => null }));
vi.mock('./AgendaDaySheet.jsx', () => ({ AgendaDaySheet: () => null }));
vi.mock('./AgendaWeekStrip.jsx', () => ({ AgendaWeekStrip: () => null }));
vi.mock('./AgendaKbdHint.jsx', () => ({ AgendaKbdHint: () => null }));
vi.mock('./WeekTimeGrid', () => ({ WeekTimeGrid: () => null }));
vi.mock('./AgendaWeekSlotDetailModal.jsx', () => ({ AgendaWeekSlotDetailModal: () => null }));
vi.mock('./AgendaSummaryEntryCard.jsx', () => ({ AgendaSummaryEntryCard: () => null }));
vi.mock('./AgendaAdvanceConfirmModal.jsx', () => ({ AgendaAdvanceConfirmModal: () => null }));
vi.mock('./AgendaNovoChoiceModal.jsx', () => ({ AgendaNovoChoiceModal: () => null }));
vi.mock('../assinaturas/ModalEscolhaAssinatura.jsx', () => ({ ModalEscolhaAssinatura: () => null }));
vi.mock('../anamnese/SolicitarAnamneseModal.jsx', () => ({ SolicitarAnamneseModal: () => null }));
vi.mock('./useAgendaPage', () => ({ formatLongDate: (iso) => String(iso) }));
vi.mock('./hooks/useAgendaKeyboardShortcuts.js', () => ({ useAgendaKeyboardShortcuts: () => {} }));
vi.mock('../hooks/useFusoClinica.js', () => ({ useFusoClinica: () => ({ fuso: 'America/Sao_Paulo' }) }));
vi.mock('../../hooks/useMediaQuery.js', () => ({ useMediaQuery: () => true }));
const toastStub = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastStub }));
const papelRef = { current: {} };
vi.mock('../../hooks/usePapel.js', () => ({ usePapel: () => papelRef.current }));

const { AgendaDashboard } = await import('./AgendaDashboard.jsx');
const { TrocarProfissionalAgendaModal } = await import('./TrocarProfissionalAgendaModal.jsx');

const noop = () => {};
const appt = {
  id: 'ag-1',
  agendaId: 'ag-1',
  status: 'confirmado',
  tipo: 'agendamento',
  data: '2026-10-09',
  horaInicio: '09:00',
  pacienteId: 'p1',
  pacienteNome: 'Ana Souza',
  procedimentoNome: 'Limpeza de pele',
  profissionalRoleUserId: 'ru-colega',
};

function makeAgenda() {
  return {
    viewMode: 'list',
    loading: false,
    isNivel1: false,
    error: null,
    groupedAppointments: [],
    appointments: [appt],
    selectedDayAppointments: [appt],
    filteredWeekGridAppointments: [],
    equipeList: [],
    todayIso: '2026-10-08',
    selectedDay: '2026-10-09',
    weekDayIsos: [],
    appointmentsByDate: {},
    statusFilters: [],
    statusFilterCounts: {},
    closeDaySheet: noop,
    selectDay: noop,
    handleAtualizarStatus: vi.fn(),
    handleEnviarWhatsApp: vi.fn(),
    refreshDashboard: vi.fn(),
  };
}

function montar(papel) {
  papelRef.current = { canDeleteAgenda: true, canStartAnamnese: true, roleUserId: 'ru-eu', ...papel };
  const onStartAttendance = vi.fn();
  render(
    <AgendaDashboard
      agenda={makeAgenda()}
      patients={[{ id: 'p1', nome: 'Ana Souza' }]}
      onStartAttendance={onStartAttendance}
      onVoltarConsulta={vi.fn()}
      onSlotCancelar={vi.fn()}
      onSlotReagendar={vi.fn()}
    />,
  );
  return onStartAttendance;
}

describe('AgendaDashboard: não titular inicia a consulta pelo card', () => {
  beforeEach(() => {
    toastStub.error.mockClear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it.each([
    ['profissional não titular', { isDono: false }],
    ['Dono não titular', { isDono: true }],
  ])('%s: botão habilitado, clique chama onStartAttendance, sem dialog e sem toast', async (_n, papel) => {
    const onStart = montar(papel);
    // sinal positivo: o card renderizou
    const btn = await screen.findByRole('button', { name: /iniciar atendimento/i });
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onStart.mock.calls[0][0]).toMatchObject({ id: 'p1' });
    expect(onStart.mock.calls[0][1]).toMatchObject({ agendaId: 'ag-1', fromAgendaSlot: true });
    expect(onStart.mock.calls[0][1].assumidoPorDono).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toastStub.error).not.toHaveBeenCalled();
  });
});

describe('Troca EXPLÍCITA de profissional continua abrindo', () => {
  it('TrocarProfissionalAgendaModal aberto renderiza o dialog', () => {
    render(
      <TrocarProfissionalAgendaModal
        open
        appointment={{ ...appt, profissionalNome: 'Colega' }}
        equipeList={[{ roleUserId: 'ru-eu', nome: 'Eu' }]}
        onClose={noop}
        onConfirm={noop}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
