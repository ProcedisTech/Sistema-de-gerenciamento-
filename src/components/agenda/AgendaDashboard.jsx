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
  UserRound,
  X,
} from 'lucide-react';
import { formatLongDate } from './useAgendaPage';
import { WeekTimeGrid } from './WeekTimeGrid';
import AgendaSlotActions from './AgendaSlotActions.jsx';
import NotificationBell from '../layout/NotificationBell.jsx';
import { getStatusColors } from '../../utils/agendaStatusColors.js';

const STATUS_STYLES = {
  confirmado: {
    border: 'border-l-brand-primary',
    dot: 'bg-brand-primary',
    badge: 'bg-brand-primarySubtle text-brand-primaryDark',
    primary: 'bg-brand-primary hover:bg-brand-primaryDark text-white',
  },
  pendente: {
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-800',
    primary: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  cancelado: {
    border: 'border-l-red-500',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
    primary: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
  },
  reagendado: {
    border: 'border-purple-300',
    dot: 'bg-purple-400',
    badge: 'bg-purple-100 text-purple-800',
    primary: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  },
};

const AVATAR_GRADIENTS = [
  { from: '#7F77DD', to: '#5B53C4' },
  { from: '#1D9E75', to: '#127A57' },
  { from: '#D4537E', to: '#A93C61' },
  { from: '#378ADD', to: '#2566B0' },
  { from: '#D85A30', to: '#A93D1B' },
];

const STATUS_BADGE_CLASSES = {
  confirmado: 'text-green-600 bg-green-100',
  pendente: 'text-amber-600 bg-amber-100',
  realizado: 'text-slate-600 bg-slate-100',
  cancelado: 'text-red-600 bg-red-100',
  falta: 'text-red-700 bg-red-50',
  aguardando_confirmacao: 'text-amber-700 bg-amber-50',
  reagendado: 'bg-purple-100 text-purple-800',
};

function initials(name) {
  const parts = String(name || 'Paciente').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function hashGradient(name) {
  const value = String(name || 'Paciente');
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash + value.charCodeAt(i) * (i + 1)) % 997;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function formatDayHeading(iso) {
  if (!iso) return '';
  return formatLongDate(iso);
}

function actionLabel(status) {
  if (status === 'pendente' || status === 'aguardando_confirmacao') return 'Confirmar';
  if (status === 'cancelado') return 'Reagendar';
  return 'Iniciar Atendimento';
}

function showPrimaryActionButton(status) {
  if (status === 'falta' || status === 'realizado' || status === 'reagendado') return false;
  return true;
}

function samePatient(a, b) {
  if (!a || !b) return false;
  return (
    String(a.id || '') === String(b.pacienteId || '') ||
    String(a.nome || a.nomeCompleto || '').trim() === String(b.pacienteNome || '').trim()
  );
}

/** Evita botões esticando em larguras intermediárias (cards / lista / modal). */
const BTN_ACTION =
  'inline-flex max-w-[min(100%,14rem)] shrink-0 justify-center whitespace-normal text-center leading-tight';

function StatCard({ label, value, icon, tone = 'default' }) {
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

  return (
    <div
      className={`rounded-[12px] border p-4 shadow-sm transition-shadow ${
        isToday
          ? 'border-transparent bg-gradient-to-br from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700'
          : 'border-calendar-border bg-white hover:border-gray-300 hover:shadow-md'
      }`}
    >
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
    </div>
  );
}

function AppointmentCard({ appointment, onPrimary, onEdit, renderSlotActions }) {
  const isReagendado = appointment.status === 'reagendado';
  const styles = STATUS_STYLES[appointment.status] || STATUS_STYLES.pendente;
  const statusTone = getStatusColors(appointment.status);
  const grad = hashGradient(appointment.pacienteNome);
  const avatarStyle = { background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` };
  const badgeClass = STATUS_BADGE_CLASSES[appointment.status] || STATUS_BADGE_CLASSES.pendente;

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white shadow-sm transition-all overflow-hidden hover:border-teal-300 hover:shadow-lg">
      <div className="h-1.5" style={{ backgroundColor: appointment.corHex || '#14B8A6' }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-white"
              style={avatarStyle}
            >
              {initials(appointment.pacienteNome)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-[#1A1A2E]">{appointment.pacienteNome}</div>
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: appointment.corHex || '#14B8A6' }}
                  aria-hidden
                />
                <div className={`truncate text-[11px] font-medium ${appointment.procedimentoNome ? 'text-[#888888]' : 'text-amber-700'}`}>
                  {appointment.procedimentoNome || 'Sem procedimento informado'}
                </div>
              </div>
            </div>
          </div>
          <span
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
              isReagendado ? 'bg-purple-100 text-purple-800' : badgeClass
            }`}
          >
            {isReagendado ? 'Reagendado' : statusTone.label || appointment.status}
          </span>
        </div>

        <div className="mt-3 space-y-1.5 text-[11px] font-medium text-[#555]">
          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 text-[#888888]" />
            <span>{appointment.horaInicio} ({appointment.duracaoMin} min)</span>
          </div>
          <div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 text-[#888888]" />
            <span>{appointment.profissionalNome}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-stretch justify-end gap-2">
          {showPrimaryActionButton(appointment.status) ? (
            <button
              type="button"
              onClick={() => onPrimary(appointment)}
              className={`${BTN_ACTION} rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${styles.primary}`}
            >
              {actionLabel(appointment.status)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onEdit(appointment)}
            className={`${BTN_ACTION} rounded-lg border border-[#E8E8E8] bg-white px-3 py-2 text-[11px] font-bold text-[#64748b] transition-colors hover:bg-[#F5F6FA]`}
          >
            Editar
          </button>
        </div>
        {typeof renderSlotActions === 'function' ? (
          <div className="mt-2 border-t border-[#f1f5f9] pt-2">{renderSlotActions(appointment)}</div>
        ) : null}
      </div>
    </div>
  );
}

function DayPanel({ selectedDay, appointments, onPrimary, onEdit, renderSlotActions }) {
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
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onPrimary={onPrimary}
              onEdit={onEdit}
              renderSlotActions={renderSlotActions}
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
        Nenhum agendamento no mês.
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
                <span className="mx-1.5 text-[#CBD5E1]">·</span>
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

function DaySummaryModal({ group, onClose, onEdit, onPrimary, renderSlotActions }) {
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
            <AppointmentCard
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

  React.useEffect(() => {
    if (agenda.viewMode === 'grid' || agenda.viewMode === 'semana') setListDaySummary(null);
  }, [agenda.viewMode]);

  const renderSlotActions = React.useCallback(
    (appointment) => {
      const disabled = Boolean(agenda.loading);
      return (
        <AgendaSlotActions
          agenda={appointment}
          disabled={disabled}
          onMarcarRealizado={() => {
            if (appointment.agendaId) agenda.handleAtualizarStatus(appointment.agendaId, 'realizado');
          }}
          onMarcarFalta={() => {
            if (appointment.agendaId) agenda.handleAtualizarStatus(appointment.agendaId, 'falta');
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
        <button
          type="button"
          onClick={() => agenda.openCreateModal(agenda.selectedDay)}
          className="inline-flex max-w-[min(100%,16rem)] shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-brand-primary px-5 py-3 text-center text-[13px] font-bold leading-tight text-white shadow-sm transition-colors hover:bg-brand-primaryDark lg:self-auto"
        >
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </button>
      </div>

      {agenda.error ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] font-bold text-amber-900">{agenda.error}</div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total do Mês" value={agenda.stats.totalMes} icon={CalendarDays} tone="purple" />
        <StatCard label="Confirmados" value={agenda.stats.confirmados} icon={CheckCircle2} tone="success" />
        <StatCard label="Pendentes" value={agenda.stats.pendentes} icon={Clock3} tone="warning" />
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
                <button type="button" onClick={agenda.goWeekNext} aria-label="Próxima semana" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button type="button" onClick={agenda.goPrevMonth} aria-label="Mês anterior" className="shrink-0 rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="min-w-0 flex-1 truncate text-center text-[16px] font-black text-[#1A1A2E]">{agenda.monthLabel}</h3>
                <button type="button" onClick={agenda.goNextMonth} aria-label="Próximo mês" className="shrink-0 rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
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
              onEdit={agenda.openEditModal}
              onClickEmptySlot={agenda.openCreateModalAtSlot}
              renderSlotActions={renderSlotActions}
              disponibilidades={agenda.disponibilidades}
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
      />
    </div>
  );
}
