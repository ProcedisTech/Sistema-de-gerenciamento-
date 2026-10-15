import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Card de resumo (lista/semana) com consulta em andamento: passa pelo renderSlotActions REAL
 * do AgendaDashboard e pelo AgendaSlotActions REAL. Só os filhos pesados são trocados por stubs;
 * o stub do modal de detalhe da semana chama renderSlotActions(alvo) direto.
 */
const alvoRef = { current: null };

vi.mock('./AgendaWeekSlotDetailModal.jsx', () => ({
  AgendaWeekSlotDetailModal: ({ renderSlotActions }) =>
    alvoRef.current ? <div data-testid="acoes">{renderSlotActions(alvoRef.current)}</div> : null,
}));
vi.mock('./AgendaSummaryEntryCard.jsx', () => ({ AgendaSummaryEntryCard: () => null }));
vi.mock('./AgendaTopbar.jsx', () => ({ AgendaTopbar: () => null }));
vi.mock('./AgendaControlStrip.jsx', () => ({ AgendaControlStrip: () => null }));
vi.mock('./AgendaCalendarGrid.jsx', () => ({ AgendaCalendarGrid: () => null }));
vi.mock('./AgendaCalendarSkeleton.jsx', () => ({ AgendaCalendarSkeleton: () => null }));
vi.mock('./AgendaDayRail.jsx', () => ({ AgendaDayRail: () => null }));
vi.mock('./AgendaDaySheet.jsx', () => ({ AgendaDaySheet: () => null }));
vi.mock('./AgendaWeekStrip.jsx', () => ({ AgendaWeekStrip: () => null }));
vi.mock('./AgendaKbdHint.jsx', () => ({ AgendaKbdHint: () => null }));
vi.mock('./WeekTimeGrid', () => ({ WeekTimeGrid: () => null }));
vi.mock('./AgendaAdvanceConfirmModal.jsx', () => ({ AgendaAdvanceConfirmModal: () => null }));
vi.mock('./AgendaNovoChoiceModal.jsx', () => ({ AgendaNovoChoiceModal: () => null }));
vi.mock('../assinaturas/ModalEscolhaAssinatura.jsx', () => ({ ModalEscolhaAssinatura: () => null }));
vi.mock('../anamnese/SolicitarAnamneseModal.jsx', () => ({ SolicitarAnamneseModal: () => null }));
vi.mock('./useAgendaPage', () => ({ formatLongDate: (iso) => String(iso) }));
vi.mock('./hooks/useAgendaKeyboardShortcuts.js', () => ({ useAgendaKeyboardShortcuts: () => {} }));
vi.mock('../../hooks/useMediaQuery.js', () => ({ useMediaQuery: () => true }));
const toastStub = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastStub }));
vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: () => ({ canDeleteAgenda: true, roleUserId: 'ru-eu' }),
}));

const { AgendaDashboard } = await import('./AgendaDashboard.jsx');

const noop = () => {};
function makeAgenda() {
  return {
    viewMode: 'list',
    loading: false,
    isNivel1: false,
    error: null,
    groupedAppointments: [],
    appointments: [],
    selectedDayAppointments: [],
    filteredWeekGridAppointments: [],
    equipeList: [],
    todayIso: '2026-10-08',
    selectedDay: '2026-10-08',
    weekDayIsos: [],
    appointmentsByDate: {},
    statusFilters: [],
    statusFilterCounts: {},
    closeDaySheet: noop,
    selectDay: noop,
    handleAtualizarStatus: vi.fn(),
    handleMarcarNaoCompareceu: vi.fn(),
    handleEnviarWhatsApp: vi.fn(),
    refreshDashboard: vi.fn(),
  };
}

function row(extra = {}) {
  return {
    id: 'ag-1',
    agendaId: 'ag-1',
    status: 'confirmado',
    tipo: 'agendamento',
    data: '2026-10-08',
    horaInicio: '09:00',
    pacienteNome: 'Ana',
    ...extra,
  };
}

function renderCom(alvo) {
  alvoRef.current = alvo;
  return render(
    <AgendaDashboard
      agenda={makeAgenda()}
      onSlotCancelar={vi.fn()}
      onSlotReagendar={vi.fn()}
      onStartAttendance={vi.fn()}
      onVoltarConsulta={vi.fn()}
    />,
  );
}

describe('AgendaDashboard.renderSlotActions — consulta em andamento (card de resumo)', () => {
  beforeEach(() => {
    alvoRef.current = null;
  });

  it('com consulta aberta: NÃO mostra Cancelar, Reagendar nem Não compareceu; WhatsApp fica', () => {
    renderCom(row({ atendimentoId: 'at-1', atendimentoStatusCodigo: 'aberto', atendimentoAnfitriaoRoleUserId: 'ru-eu' }));
    expect(screen.getByTestId('acoes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reagendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /não compareceu/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
  });

  it('com consulta aberta de OUTRA profissional, em grupo (1 de 2): mesmas regras', () => {
    renderCom({
      kind: 'group',
      appointments: [
        row(),
        row({ id: 'ag-2', agendaId: 'ag-2', atendimentoId: 'at-2', atendimentoStatusCodigo: 'aberto', atendimentoAnfitriaoRoleUserId: 'ru-outra' }),
      ],
    });
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reagendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /não compareceu/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
  });

  it('sem consulta em andamento: Cancelar, Reagendar, Não compareceu e WhatsApp como hoje', () => {
    renderCom(row());
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reagendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /não compareceu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
  });

  it('consulta abandonada conta como sem andamento: tudo como hoje', () => {
    renderCom(row({ atendimentoId: 'at-3', atendimentoStatusCodigo: 'abandonado', atendimentoAnfitriaoRoleUserId: 'ru-eu' }));
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reagendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /não compareceu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
  });
});
