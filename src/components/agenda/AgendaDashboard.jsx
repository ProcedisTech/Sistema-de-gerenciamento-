import React from 'react';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grid2X2,
  List,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { formatLongDate } from './useAgendaPage';
import { WeekTimeGrid } from './WeekTimeGrid';
import AgendaSlotActions from './AgendaSlotActions.jsx';
import { AgendaAppointmentSummaryCard } from './AgendaAppointmentSummaryCard.jsx';
import { AgendaWeekSlotDetailModal } from './AgendaWeekSlotDetailModal.jsx';
import { AgendaKpiStatusSheet } from './AgendaKpiStatusSheet.jsx';
import { AgendaAdvanceConfirmModal } from './AgendaAdvanceConfirmModal.jsx';
import NotificationBell from '../layout/NotificationBell.jsx';
import { KPI_DRILLDOWN_PERIOD } from '../../utils/agendaKpiDrilldown.js';
import { buildAdvanceOffersByAgendaId } from '../../utils/agendaAdvanceOffer.js';
import { addMinutesToTime } from '../../utils/agendaMapping.js';

function formatDayHeading(iso) {
  if (!iso) return '';
  return formatLongDate(iso);
}

function samePatient(a, b) {
  if (!a || !b) return false;
  return (
    String(a.id || '') === String(b.pacienteId || '') ||
    String(a.nome || a.nomeCompleto || '').trim() === String(b.pacienteNome || '').trim()
  );
}

function StatCard({ label, value, icon, tone = 'default', onClick, interactive = false }) {
  const isToday = tone === 'today';
  const renderedIcon = React.createElement(icon, { className: 'h-5 w-5', strokeWidth: 2.4 });
  const iconClass =
    tone === 'success'
      ? 'bg-stats-confirmedBg text-stats-confirmedIcon'
      : tone === 'warning'
        ? 'bg-stats-pendingBg text-stats-pendingIcon'
        : tone === 'purple'
          ? 'bg-stats-totalBg text-stats-totalIcon'
          : 'bg-white/20 text-stats-todayIcon';

  const className = `rounded-[12px] border p-4 shadow-sm transition-shadow ${
    isToday
      ? 'border-transparent bg-gradient-to-br from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700'
      : 'border-calendar-border bg-white hover:border-gray-300 hover:shadow-md'
  }${interactive ? ' cursor-pointer hover:ring-2 hover:ring-brand-primary/25 focus:outline-none focus:ring-2 focus:ring-brand-primary/40' : ''}`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[11px] font-semibold ${isToday ? 'text-white/85' : 'text-[#888888]'}`}>{label}</div>
          <div
            className={`mt-1 text-3xl font-bold leading-none ${
              isToday
                ? 'text-white'
                : tone === 'success'
                  ? 'text-brand-primary'
                  : tone === 'warning'
                    ? 'text-stats-pendingIcon'
                    : 'text-[#1A1A2E]'
            }`}
          >
            {value}
          </div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconClass}`}>
          {renderedIcon}
        </div>
      </div>
    </>
  );

  if (interactive && typeof onClick === 'function') {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${className}`} aria-label={`Ver ${label}`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function DayPanel({
  selectedDay,
  appointments,
  onPrimary,
  onEdit,
  renderSlotActions,
  isNivel1 = false,
  advanceOfferByAgendaId,
  onAdvanceClick,
}) {
  return (
    <div className="h-full rounded-[14px] border border-calendar-border bg-white">
      <div className="rounded-t-[14px] border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-blue-50 p-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-brand-primaryDark">
          <CalendarDays className="h-4 w-4" />
          <span>{formatDayHeading(selectedDay)}</span>
        </div>
        <div className="mt-1 text-[18px] font-black text-brand-primaryDark">
          {appointments.length} agendamento{appointments.length === 1 ? '' : 's'}
        </div>
      </div>

      <div key={selectedDay} className="max-h-[62vh] space-y-3 overflow-y-auto p-3 pr-2 transition-all duration-200 animate-in fade-in slide-in-from-right-2 custom-scrollbar">
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E8E8E8] bg-[#F5F6FA] p-5 text-center text-[13px] font-semibold text-[#888888]">
            Nenhum agendamento neste dia.
          </div>
        ) : (
          appointments.map((appointment) => (
            <AgendaAppointmentSummaryCard
              key={appointment.id}
              appointment={appointment}
              onPrimary={onPrimary}
              onEdit={onEdit}
              renderSlotActions={renderSlotActions}
              isNivel1={isNivel1}
              advanceOffer={advanceOfferByAgendaId?.get(String(appointment.id))}
              onAdvanceClick={onAdvanceClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CalendarGrid({ agenda }) {
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  return (
    <div>
      <div role="row" className="grid grid-cols-7 text-center text-[12px] font-bold text-[#888888] sm:text-[11px]">
        {weekDays.map((day) => (
          <div key={day} role="columnheader" className="py-2 sm:py-2">
            {day}
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label={`Calendario de ${agenda.monthLabel}`}
        className="grid grid-cols-7 gap-2 sm:gap-3"
      >
        {agenda.calendarCells.map((cell) => {
          if (!cell.inCurrentMonth) {
            return (
              <div
                key={cell.iso}
                aria-hidden="true"
                className="aspect-square w-full"
              />
            );
          }
          const dayAppointments = agenda.appointmentsByDate[cell.iso] || [];
          const isSelected = cell.iso === agenda.selectedDay;
          const dots = dayAppointments.slice(0, 3);
          const hasMore = dayAppointments.length > 3;
          const hasEvents = dayAppointments.length > 0;

          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-label={`${cell.day} de ${agenda.monthLabel}, ${dayAppointments.length} agendamento(s)`}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => agenda.selectDay(cell.iso)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  agenda.moveSelectedDay(1);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  agenda.moveSelectedDay(-1);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  agenda.moveSelectedDay(7);
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  agenda.moveSelectedDay(-7);
                } else if (event.key === 'Enter') {
                  agenda.selectDay(cell.iso);
                }
              }}
              className={`relative flex aspect-square w-full min-w-0 items-center justify-center rounded-xl border p-2 transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary text-white shadow-sm hover:bg-brand-primaryDark'
                  : hasEvents
                    ? 'border-calendar-border bg-calendar-cellWithEvents text-[#1A1A2E] hover:bg-calendar-cellHover'
                    : 'border-transparent bg-calendar-cellEmpty text-[#1A1A2E] hover:bg-calendar-cellHover'
              }`}
            >
              <span className="text-base font-bold leading-none sm:text-[15px]">{cell.day}</span>
              {dayAppointments.length > 0 ? (
                <span
                  className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black sm:right-1.5 sm:top-1.5 sm:h-[22px] sm:w-[22px] sm:text-[11px] ${
                    isSelected ? 'bg-white text-brand-primary' : 'bg-brand-primary text-white'
                  }`}
                >
                  {dayAppointments.length}
                </span>
              ) : null}
              <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-2 sm:gap-1.5">
                {dots.map((item) => {
                  const dotColor = isSelected ? '#FFFFFF' : item.corHex || '#14B8A6';
                  return (
                    <span
                      key={item.id}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                  );
                })}
                {hasMore ? <span className={`text-[10px] font-black leading-none ${isSelected ? 'text-white' : 'text-[#888888]'}`}>...</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListDayCards({ agenda, onOpenDaySummary }) {
  if (agenda.groupedAppointments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E8E8E8] bg-white p-6 text-center text-[13px] font-semibold text-[#888888]">
        Nenhum agendamento no mÃªs.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
      {agenda.groupedAppointments.map((group) => {
        const isToday = group.date === agenda.todayIso;
        const first = group.items[0];
        return (
          <button
            key={group.date}
            type="button"
            onClick={() => {
              agenda.selectDay(group.date, false);
              onOpenDaySummary(group);
            }}
            className="flex w-full flex-col rounded-xl border border-brand-primary/15 bg-white p-4 text-left shadow-sm transition-all hover:border-brand-primary/30"
          >
            <p className="break-words text-[14px] font-bold leading-snug text-[#0f172a] [overflow-wrap:anywhere]">
              {formatLongDate(group.date)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-app-border bg-brand-primarySubtle px-2 py-0.5 text-[11px] font-bold text-brand-primaryDark">
                {group.items.length} agendamento{group.items.length === 1 ? '' : 's'}
              </span>
              {isToday ? (
                <span className="rounded-md border border-brand-primary/25 bg-brand-primary/10 px-2 py-0.5 text-[11px] font-bold text-brand-primaryDark">
                  Hoje
                </span>
              ) : null}
            </div>
            {first ? (
              <p className="mt-3 line-clamp-2 text-[12px] font-medium text-[#64748b]">
                <span className="font-bold text-brand-primary">{first.horaInicio}</span>
                <span className="mx-1.5 text-[#CBD5E1]">Â·</span>
                {first.pacienteNome}
                {group.items.length > 1 ? (
                  <span className="mt-0.5 block text-[11px] text-[#94a3b8]">+{group.items.length - 1} outros</span>
                ) : null}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function DaySummaryModal({
  group,
  onClose,
  onEdit,
  onPrimary,
  renderSlotActions,
  isNivel1 = false,
  advanceOfferByAgendaId,
  onAdvanceClick,
}) {
  if (!group) return null;

  return (
    <div className="fixed inset-0 z-[215] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fechar resumo do dia" />
      <div className="relative max-h-[min(92dvh,720px)] w-full max-w-[720px] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-[1] flex items-start justify-between gap-3 border-b border-[#E8E8E8] bg-white p-4 sm:p-5">
          <div className="min-w-0">
            <h3 className="text-[16px] font-black leading-tight text-[#1A1A2E] sm:text-[18px]">{formatLongDate(group.date)}</h3>
            <p className="mt-1 text-[12px] font-medium text-[#888888]">
              {group.items.length} agendamento{group.items.length === 1 ? '' : 's'} neste dia
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 text-[#64748b] hover:bg-[#F5F6FA]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          {group.items.map((appointment) => (
            <AgendaAppointmentSummaryCard
              key={appointment.id}
              appointment={appointment}
              onPrimary={(item) => {
                onPrimary(item);
                onClose();
              }}
              onEdit={(item) => {
                onEdit(item);
                onClose();
              }}
              renderSlotActions={renderSlotActions}
              isNivel1={isNivel1}
              advanceOffer={advanceOfferByAgendaId?.get(String(appointment.id))}
              onAdvanceClick={onAdvanceClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgendaDashboard({
  agenda,
  patients = [],
  onStartAttendance,
  authEnabled = false,
  onSlotCancelar,
  onSlotReagendar,
}) {
  const [listDaySummary, setListDaySummary] = React.useState(null);
  const [weekSlotDetail, setWeekSlotDetail] = React.useState(null);
  const [kpiDrilldown, setKpiDrilldown] = React.useState(null);
  const [kpiPeriod, setKpiPeriod] = React.useState(KPI_DRILLDOWN_PERIOD.HOJE);
  const [kpiProfissionalId, setKpiProfissionalId] = React.useState('');
  const [kpiRows, setKpiRows] = React.useState([]);
  const [kpiLoading, setKpiLoading] = React.useState(false);
  const [kpiError, setKpiError] = React.useState('');
  const [advancePending, setAdvancePending] = React.useState(null);

  const advanceSourceAppointments = React.useMemo(() => {
    if (agenda.viewMode === 'semana') return agenda.weekGridAppointments;
    return agenda.selectedDayAppointments;
  }, [agenda.viewMode, agenda.weekGridAppointments, agenda.selectedDayAppointments]);

  const advanceOfferByAgendaId = React.useMemo(
    () => buildAdvanceOffersByAgendaId(advanceSourceAppointments),
    [advanceSourceAppointments],
  );

  const listDayAdvanceOffers = React.useMemo(
    () => (listDaySummary?.items ? buildAdvanceOffersByAgendaId(listDaySummary.items) : new Map()),
    [listDaySummary],
  );

  const showProfissionalFilter = (agenda.equipeList?.length || 0) > 1;

  const loadKpiRows = React.useCallback(async () => {
    if (!kpiDrilldown?.status) return;
    setKpiLoading(true);
    setKpiError('');
    try {
      const rows = await agenda.loadKpiDrilldownRows({
        period: kpiPeriod,
        status: kpiDrilldown.status,
        profissionalRoleUserId: kpiProfissionalId,
      });
      setKpiRows(rows);
    } catch (e) {
      setKpiRows([]);
      setKpiError(e?.message || 'Não foi possível carregar a lista.');
    } finally {
      setKpiLoading(false);
    }
  }, [agenda, kpiDrilldown?.status, kpiPeriod, kpiProfissionalId]);

  React.useEffect(() => {
    if (!kpiDrilldown?.status) return;
    const t = setTimeout(() => {
      loadKpiRows();
    }, 150);
    return () => clearTimeout(t);
  }, [kpiDrilldown?.status, kpiPeriod, kpiProfissionalId, loadKpiRows]);

  const openKpiDrilldown = React.useCallback(
    (status) => {
      setKpiPeriod(KPI_DRILLDOWN_PERIOD.HOJE);
      setKpiProfissionalId('');
      setKpiRows([]);
      setKpiError('');
      setKpiDrilldown({ status });
      agenda.ensureEquipeLoaded?.();
    },
    [agenda],
  );

  const handleAdvanceClick = React.useCallback((appointment, offer) => {
    if (!appointment || !offer?.targetHoraInicio || agenda.isNivel1) return;
    setAdvancePending({ appointment, targetHoraInicio: offer.targetHoraInicio });
  }, [agenda.isNivel1]);

  const handleConfirmAdvance = React.useCallback(async () => {
    const { appointment, targetHoraInicio } = advancePending || {};
    if (!appointment?.agendaId || !targetHoraInicio) return;
    const hi = String(targetHoraInicio).slice(0, 5);
    const hf = addMinutesToTime(hi, Number(appointment.duracaoMin) || 45);
    const ok = await agenda.handleReagendar(
      appointment.agendaId,
      {
        novaData: appointment.data,
        novaHoraInicio: `${hi}:00`,
        novaHoraFim: `${hf}:00`,
        observacao: 'Adiantado para preencher horário liberado',
      },
      { successToast: 'Consulta adiantada. Lembre-se de avisar o paciente.' },
    );
    if (ok) setAdvancePending(null);
  }, [advancePending, agenda]);

  React.useEffect(() => {
    if (agenda.viewMode === 'grid' || agenda.viewMode === 'semana') setListDaySummary(null);
  }, [agenda.viewMode]);

  React.useEffect(() => {
    if (agenda.viewMode !== 'semana') setWeekSlotDetail(null);
  }, [agenda.viewMode]);

  const renderSlotActions = React.useCallback(
    (appointment) => {
      const disabled = Boolean(agenda.loading) || agenda.isNivel1;
      return (
        <AgendaSlotActions
          agenda={appointment}
          disabled={disabled}
          onMarcarRealizado={() => {
            if (appointment.agendaId) agenda.handleAtualizarStatus(appointment.agendaId, 'realizado');
          }}
          onMarcarNaoCompareceu={() => {
            if (appointment.agendaId) agenda.handleMarcarNaoCompareceu(appointment.agendaId);
          }}
          onReagendar={() => onSlotReagendar?.(appointment)}
          onCancelar={() => onSlotCancelar?.(appointment)}
          onEnviarWhatsApp={() => agenda.handleEnviarWhatsApp(appointment.agendaId, 'confirmacao_24h')}
        />
      );
    },
    [agenda, onSlotCancelar, onSlotReagendar]
  );

  const handlePrimary = React.useCallback((appointment) => {
    if (appointment.status === 'pendente' || appointment.status === 'aguardando_confirmacao') {
      agenda.updateStatus(appointment, 'confirmado');
      return;
    }
    if (appointment.status === 'cancelado') {
      onSlotReagendar?.(appointment);
      return;
    }

    const patient = patients.find((item) => samePatient(item, appointment));
    if (patient && typeof onStartAttendance === 'function') {
      onStartAttendance(patient, {
        procedimentoNome: appointment.procedimentoNome,
        agendaId: appointment.agendaId,
        catalogoProcedimentoSaudeId: appointment.catalogoProcedimentoSaudeId || '',
        data: appointment.data,
        horaInicio: appointment.horaInicio,
        fromAgendaSlot: true,
      });
      return;
    }
    window.alert('Para iniciar atendimento, vincule este agendamento a um paciente cadastrado no sistema.');
  }, [agenda, onSlotReagendar, onStartAttendance, patients]);

  const handleEditFromWeekDetail = React.useCallback(
    (appointment) => {
      setWeekSlotDetail(null);
      agenda.openEditModal(appointment);
    },
    [agenda]
  );

  const renderSlotActionsWeekDetail = React.useCallback(
    (appointment) => {
      const disabled = Boolean(agenda.loading) || agenda.isNivel1;
      return (
        <AgendaSlotActions
          agenda={appointment}
          disabled={disabled}
          onMarcarRealizado={() => {
            if (appointment.agendaId) agenda.handleAtualizarStatus(appointment.agendaId, 'realizado');
          }}
          onMarcarNaoCompareceu={() => {
            if (appointment.agendaId) agenda.handleMarcarNaoCompareceu(appointment.agendaId);
          }}
          onReagendar={() => {
            setWeekSlotDetail(null);
            onSlotReagendar?.(appointment);
          }}
          onCancelar={() => {
            setWeekSlotDetail(null);
            onSlotCancelar?.(appointment);
          }}
          onEnviarWhatsApp={() => agenda.handleEnviarWhatsApp(appointment.agendaId, 'confirmacao_24h')}
        />
      );
    },
    [agenda, onSlotCancelar, onSlotReagendar]
  );

  const handlePrimaryFromWeekDetail = React.useCallback(
    (appointment) => {
      if (appointment.status === 'pendente' || appointment.status === 'aguardando_confirmacao') {
        handlePrimary(appointment);
        return;
      }
      setWeekSlotDetail(null);
      handlePrimary(appointment);
    },
    [handlePrimary]
  );

  const openWeekCreateAtSlot = React.useCallback(
    (iso, horaHm) => {
      setWeekSlotDetail(null);
      agenda.openCreateModalAtSlot(iso, horaHm);
    },
    [agenda]
  );

  return (
    <div className="w-full min-h-0 font-['Inter',system-ui,sans-serif] text-[#1A1A2E]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-black leading-tight text-[#1A1A2E]">Agenda</h2>
            <p className="mt-1 text-[12px] font-medium text-[#888888]">Gerenciamento completo de agendamentos</p>
          </div>
          {authEnabled ? (
            <div className="shrink-0 pt-0.5">
              <NotificationBell />
            </div>
          ) : null}
        </div>
        {!agenda.isNivel1 && (
          <button
            type="button"
            onClick={() => agenda.openCreateModal(agenda.selectedDay)}
            className="inline-flex max-w-[min(100%,16rem)] shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-brand-primary px-5 py-3 text-center text-[13px] font-bold leading-tight text-white shadow-sm transition-colors hover:bg-brand-primaryDark lg:self-auto"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </button>
        )}
      </div>

      {agenda.error ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] font-bold text-amber-900">{agenda.error}</div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total do Mês" value={agenda.stats.totalMes} icon={CalendarDays} tone="purple" />
        <StatCard
          label="Confirmados"
          value={agenda.stats.confirmados}
          icon={CheckCircle2}
          tone="success"
          interactive
          onClick={() => openKpiDrilldown('confirmado')}
        />
        <StatCard
          label="Pendentes"
          value={agenda.stats.pendentes}
          icon={Clock3}
          tone="warning"
          interactive
          onClick={() => openKpiDrilldown('pendente')}
        />
        <StatCard label="Hoje" value={agenda.stats.hoje} icon={Clock3} tone="today" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        <section className="relative rounded-[14px] border border-[#E8E8E8] bg-white p-4 shadow-sm">
          {agenda.loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[14px] bg-white/70">
              <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            </div>
          ) : null}

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {agenda.viewMode === 'semana' ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button type="button" onClick={agenda.goWeekPrev} aria-label="Semana anterior" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="min-w-0 text-[14px] font-black leading-tight text-[#1A1A2E] sm:text-[16px]">{agenda.weekRangeLabel}</h3>
                <button type="button" onClick={agenda.goWeekNext} aria-label="PrÃ³xima semana" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button type="button" onClick={agenda.goPrevMonth} aria-label="MÃªs anterior" className="shrink-0 rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="min-w-0 flex-1 truncate text-center text-[16px] font-black text-[#1A1A2E]">{agenda.monthLabel}</h3>
                <button type="button" onClick={agenda.goNextMonth} aria-label="PrÃ³ximo mÃªs" className="shrink-0 rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="inline-flex w-fit rounded-lg bg-[#F5F6FA] p-1">
              <button type="button" aria-label="Visualizacao em grade" onClick={() => agenda.setViewMode('grid')} className={`rounded-md p-2 ${agenda.viewMode === 'grid' ? 'bg-brand-primarySubtle text-brand-primaryDark' : 'text-[#888888]'}`}>
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Visualizacao em lista" onClick={() => agenda.setViewMode('list')} className={`rounded-md p-2 ${agenda.viewMode === 'list' ? 'bg-brand-primarySubtle text-brand-primaryDark' : 'text-[#888888]'}`}>
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Visualizacao em semana"
                onClick={() => {
                  agenda.syncWeekFromSelection();
                  agenda.setViewMode('semana');
                }}
                className={`rounded-md p-2 ${agenda.viewMode === 'semana' ? 'bg-brand-primarySubtle text-brand-primaryDark' : 'text-[#888888]'}`}
              >
                <CalendarRange className="h-4 w-4" />
              </button>
            </div>
          </div>

          {agenda.viewMode === 'grid' ? (
            <CalendarGrid agenda={agenda} />
          ) : agenda.viewMode === 'list' ? (
            <ListDayCards agenda={agenda} onOpenDaySummary={setListDaySummary} />
          ) : (
            <WeekTimeGrid
              weekDayIsos={agenda.weekDayIsos}
              appointments={agenda.weekGridAppointments}
              todayIso={agenda.todayIso}
              onOpenSlotDetail={setWeekSlotDetail}
              onClickEmptySlot={agenda.isNivel1 ? null : openWeekCreateAtSlot}
              disponibilidades={agenda.disponibilidades}
              advanceOfferByAgendaId={advanceOfferByAgendaId}
              onAdvanceClick={agenda.isNivel1 ? null : handleAdvanceClick}
            />
          )}
        </section>

        <aside className="hidden lg:block">
          <DayPanel
            selectedDay={agenda.selectedDay}
            appointments={agenda.selectedDayAppointments}
            onPrimary={handlePrimary}
            onEdit={agenda.openEditModal}
            renderSlotActions={renderSlotActions}
            isNivel1={agenda.isNivel1}
            advanceOfferByAgendaId={advanceOfferByAgendaId}
            onAdvanceClick={agenda.isNivel1 ? null : handleAdvanceClick}
          />
        </aside>
      </div>

      {agenda.daySheetOpen ? (
        <div className="fixed inset-0 z-[210] lg:hidden">
          <button type="button" aria-label="Fechar painel do dia" className="absolute inset-0 bg-black/30" onClick={() => agenda.setDaySheetOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[82vh] rounded-t-3xl bg-white p-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300" />
            <DayPanel
              selectedDay={agenda.selectedDay}
              appointments={agenda.selectedDayAppointments}
              onPrimary={handlePrimary}
              onEdit={agenda.openEditModal}
              renderSlotActions={renderSlotActions}
              isNivel1={agenda.isNivel1}
              advanceOfferByAgendaId={advanceOfferByAgendaId}
              onAdvanceClick={agenda.isNivel1 ? null : handleAdvanceClick}
            />
          </div>
        </div>
      ) : null}

      <DaySummaryModal
        group={listDaySummary}
        onClose={() => setListDaySummary(null)}
        onEdit={agenda.openEditModal}
        onPrimary={handlePrimary}
        renderSlotActions={renderSlotActions}
        isNivel1={agenda.isNivel1}
        advanceOfferByAgendaId={listDayAdvanceOffers}
        onAdvanceClick={agenda.isNivel1 ? null : handleAdvanceClick}
      />

      <AgendaWeekSlotDetailModal
        appointment={weekSlotDetail}
        onClose={() => setWeekSlotDetail(null)}
        onPrimary={handlePrimaryFromWeekDetail}
        onEdit={handleEditFromWeekDetail}
        renderSlotActions={renderSlotActionsWeekDetail}
        isNivel1={agenda.isNivel1}
      />

      <AgendaKpiStatusSheet
        status={kpiDrilldown?.status}
        onClose={() => setKpiDrilldown(null)}
        period={kpiPeriod}
        onPeriodChange={setKpiPeriod}
        profissionalRoleUserId={kpiProfissionalId}
        onProfissionalChange={setKpiProfissionalId}
        equipeList={agenda.equipeList}
        showProfissionalFilter={showProfissionalFilter}
        rows={kpiRows}
        loading={kpiLoading}
        error={kpiError}
        onRetry={loadKpiRows}
        todayIso={agenda.todayIso}
        onSelectAppointment={(appt) => {
          setKpiDrilldown(null);
          setWeekSlotDetail(appt);
        }}
      />

      <AgendaAdvanceConfirmModal
        appointment={advancePending?.appointment}
        targetHoraInicio={advancePending?.targetHoraInicio}
        onClose={() => setAdvancePending(null)}
        onConfirm={handleConfirmAdvance}
        isSubmitting={agenda.submittingReagendar}
      />
    </div>
  );
}

