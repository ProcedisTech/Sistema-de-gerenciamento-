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
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { AGENDA_DURACAO_MINUTOS_OPCOES, formatLongDate, useAgendaPage } from './useAgendaPage';
import { ProcedimentoAutocomplete } from '../shared/ProcedimentoAutocomplete.jsx';
import { WeekTimeGrid } from './WeekTimeGrid';
import AgendaSlotActions from './AgendaSlotActions.jsx';
import CancelarAgendaModal from './CancelarAgendaModal.jsx';
import ReagendarAgendaModal from './ReagendarAgendaModal.jsx';
import NotificationBell from '../layout/NotificationBell.jsx';
import { getStatusColors } from '../../utils/agendaStatusColors.js';

const STATUS_STYLES = {
  confirmado: {
    border: 'border-l-[#0FA37F]',
    dot: 'bg-[#0FA37F]',
    badge: 'bg-[#E1F5EE] text-[#0A7A5E]',
    primary: 'bg-[#0FA37F] hover:bg-[#0d8f6f] text-white',
  },
  pendente: {
    border: 'border-l-[#F5A623]',
    dot: 'bg-[#F5A623]',
    badge: 'bg-[#FFF4E0] text-[#B07D00]',
    primary: 'bg-[#F5A623] hover:bg-[#df941c] text-white',
  },
  cancelado: {
    border: 'border-l-[#E24B4A]',
    dot: 'bg-[#E24B4A]',
    badge: 'bg-[#FCE8E8] text-[#A32D2D]',
    primary: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
  },
  bloqueio: {
    border: 'border-l-slate-400',
    dot: 'bg-slate-400',
    badge: 'bg-slate-200 text-slate-700',
    primary: 'bg-slate-400 hover:bg-slate-500 text-white',
  },
};

const AVATAR_COLORS = ['#7F77DD', '#1D9E75', '#D4537E', '#378ADD', '#D85A30'];

function initials(name) {
  const parts = String(name || 'Paciente').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function hashColor(name) {
  const value = String(name || 'Paciente');
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash + value.charCodeAt(i) * (i + 1)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
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
  if (status === 'falta' || status === 'realizado') return false;
  return true;
}

function isAppointmentBloqueio(appointment) {
  return appointment?.tipo === 'bloqueio' || appointment?.status === 'bloqueio';
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
  const renderedIcon = React.createElement(icon, { className: 'h-4 w-4', strokeWidth: 2.4 });
  const iconClass =
    tone === 'success'
      ? 'bg-[#E1F5EE] text-[#0FA37F]'
      : tone === 'warning'
        ? 'bg-[#FFF4E0] text-[#F5A623]'
        : tone === 'purple'
          ? 'bg-[#F0EAFF] text-[#8B5CF6]'
          : 'bg-white/20 text-white';

  return (
    <div className={`rounded-[12px] border p-4 shadow-sm ${isToday ? 'border-[#0FA37F] bg-[#0FA37F] text-white' : 'border-[#E8E8E8] bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[11px] font-semibold ${isToday ? 'text-white/85' : 'text-[#888888]'}`}>{label}</div>
          <div className={`mt-1 text-[24px] font-bold leading-none ${isToday ? 'text-white' : tone === 'success' ? 'text-[#0FA37F]' : tone === 'warning' ? 'text-[#F5A623]' : 'text-[#1A1A2E]'}`}>
            {value}
          </div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}>
          {renderedIcon}
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ appointment, onPrimary, onEdit, onRemoveBloqueio, renderSlotActions }) {
  const bloqueio = isAppointmentBloqueio(appointment);
  const styles = STATUS_STYLES[bloqueio ? 'bloqueio' : appointment.status] || STATUS_STYLES.pendente;
  const statusTone = getStatusColors(appointment.status);

  return (
    <div className={`rounded-[12px] border border-[#E8E8E8] border-l-[3px] ${styles.border} bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black text-white"
            style={{ backgroundColor: bloqueio ? '#94a3b8' : hashColor(appointment.pacienteNome) }}
          >
            {initials(appointment.pacienteNome)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-[#1A1A2E]">{appointment.pacienteNome}</div>
            <div className="flex min-w-0 items-center gap-1.5">
              {!bloqueio ? (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: appointment.corHex || '#00a88e' }}
                  aria-hidden
                />
              ) : null}
              <div className="truncate text-[11px] font-medium text-[#888888]">{appointment.procedimentoNome}</div>
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
            STATUS_STYLES[bloqueio ? 'bloqueio' : appointment.status] ? styles.badge : `${statusTone.bg} ${statusTone.text}`
          }`}
        >
          {bloqueio ? 'Bloqueado' : statusTone.label || appointment.status}
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
        {!bloqueio && showPrimaryActionButton(appointment.status) ? (
          <button
            type="button"
            onClick={() => onPrimary(appointment)}
            className={`${BTN_ACTION} rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${styles.primary}`}
          >
            {actionLabel(appointment.status)}
          </button>
        ) : bloqueio ? (
          <button
            type="button"
            onClick={() => onRemoveBloqueio?.(appointment)}
            className={`${BTN_ACTION} rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-800 transition-colors hover:bg-slate-200`}
          >
            Remover bloqueio
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
      {!bloqueio && typeof renderSlotActions === 'function' ? (
        <div className="mt-2 border-t border-[#f1f5f9] pt-2">{renderSlotActions(appointment)}</div>
      ) : null}
    </div>
  );
}

function DayPanel({ selectedDay, appointments, onPrimary, onEdit, onRemoveBloqueio, renderSlotActions }) {
  return (
    <div className="h-full rounded-[14px] border border-[#C5EDE1] bg-white">
      <div className="rounded-t-[14px] border-b border-[#C5EDE1] bg-[#E8F9F4] p-4">
        <div className="flex items-center gap-2 text-[12px] font-bold text-[#0A7A5E]">
          <CalendarDays className="h-4 w-4" />
          <span>{formatDayHeading(selectedDay)}</span>
        </div>
        <div className="mt-1 text-[18px] font-black text-[#0A7A5E]">
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
              onRemoveBloqueio={onRemoveBloqueio}
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
        className="grid grid-cols-7 justify-items-center gap-px sm:gap-0.5"
      >
        {agenda.calendarCells.map((cell) => {
          if (!cell.inCurrentMonth) {
            return (
              <div
                key={cell.iso}
                aria-hidden="true"
                className="aspect-square w-[92%] max-w-full sm:w-[65.2%]"
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
              className={`relative flex aspect-square w-[92%] max-w-full min-w-0 shrink-0 items-center justify-center rounded-[10px] border p-1 sm:w-[65.2%] sm:p-0 transition-all focus:outline-none focus:ring-2 focus:ring-[#0FA37F]/30 ${
                cell.isToday
                  ? 'border-[#0FA37F] bg-[#0FA37F] text-white shadow-sm hover:bg-[#0d8f6f]'
                  : isSelected
                    ? 'border-[#0FA37F] bg-[#E8F9F4] text-[#1A1A2E] hover:bg-[#dcf5ec]'
                    : hasEvents
                      ? 'border-[#C5EDE1]/80 bg-[#E8F0ED] text-[#1A1A2E] hover:bg-[#dfece8]'
                      : 'border-transparent bg-white text-[#1A1A2E] hover:bg-[#F5F6FA]'
              }`}
            >
              <span className="text-[15px] font-bold leading-none sm:text-[14px]">{cell.day}</span>
              {dayAppointments.length > 0 ? (
                <span
                  className={`absolute right-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-black sm:right-1 sm:top-1 sm:h-[17px] sm:w-[17px] sm:text-[9px] ${
                    cell.isToday ? 'bg-white text-[#0FA37F]' : 'bg-[#0FA37F] text-white'
                  }`}
                >
                  {dayAppointments.length}
                </span>
              ) : null}
              <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1 sm:bottom-1.5 sm:gap-1">
                {dots.map((item) => (
                  <span
                    key={item.id}
                    className={`h-1.5 w-1.5 rounded-full ${cell.isToday ? 'bg-white' : STATUS_STYLES[isAppointmentBloqueio(item) ? 'bloqueio' : item.status]?.dot || 'bg-[#0FA37F]'}`}
                  />
                ))}
                {hasMore ? <span className={`text-[10px] font-black leading-none ${cell.isToday ? 'text-white' : 'text-[#888888]'}`}>...</span> : null}
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
            className="flex w-full flex-col rounded-xl border border-[#00a88e]/15 bg-white p-4 text-left shadow-sm transition-all hover:border-[#00a88e]/30"
          >
            <p className="break-words text-[14px] font-bold leading-snug text-[#0f172a] [overflow-wrap:anywhere]">
              {formatLongDate(group.date)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-app-border bg-[#e6f7f5] px-2 py-0.5 text-[11px] font-bold text-[#0f766e]">
                {group.items.length} agendamento{group.items.length === 1 ? '' : 's'}
              </span>
              {isToday ? (
                <span className="rounded-md border border-[#00a88e]/25 bg-[#00a88e]/10 px-2 py-0.5 text-[11px] font-bold text-[#0f766e]">
                  Hoje
                </span>
              ) : null}
            </div>
            {first ? (
              <p className="mt-3 line-clamp-2 text-[12px] font-medium text-[#64748b]">
                <span className="font-bold text-[#00a88e]">{first.horaInicio}</span>
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

function DaySummaryModal({ group, onClose, onEdit, onPrimary, onRemoveBloqueio, renderSlotActions }) {
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
              onRemoveBloqueio={(item) => {
                onRemoveBloqueio?.(item);
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

function AgendaFormModal({ agenda, onExcluirClick }) {
  const horaInicioInputRef = React.useRef(null);
  if (!agenda.modalMode) return null;
  const isEdit = agenda.modalMode === 'edit';

  const openHoraInicioPicker = () => {
    const el = horaInicioInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Safari / contexto sem gesto
      }
    }
    el.focus();
  };
  const bloqueio = agenda.form.tipo === 'bloqueio';
  const modalTitle = (() => {
    if (bloqueio) return isEdit ? 'Editar bloqueio' : 'Bloquear horário';
    return isEdit ? 'Editar Agendamento' : 'Novo Agendamento';
  })();
  const modalSubtitle = bloqueio
    ? 'Defina data, horário e motivo. Nenhum paciente será vinculado.'
    : 'Preencha os dados obrigatorios para atualizar a agenda.';
  const horarioConflita = Boolean(agenda.horarioConflita);
  const horarioInputClass = `mt-1 w-full rounded-lg border px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F] ${
    horarioConflita ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-300' : 'border-[#E8E8E8]'
  }`;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={agenda.closeModal} aria-label="Fechar modal" />
      <div className="relative max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E8E8E8] p-5">
          <div>
            <h3 className="text-[18px] font-black text-[#1A1A2E]">{modalTitle}</h3>
            <p className="text-[12px] font-medium text-[#888888]">{modalSubtitle}</p>
          </div>
          <button type="button" onClick={agenda.closeModal} className="rounded-xl p-2 text-[#64748b] hover:bg-[#F5F6FA]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          {agenda.formErrors._global ? (
            <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] font-bold text-amber-900">
              {agenda.formErrors._global}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E8E8E8] bg-[#F5F6FA] px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-[#1A1A2E]">
              <input
                type="checkbox"
                checked={bloqueio}
                disabled={isEdit}
                onChange={(event) => agenda.updateForm('tipo', event.target.checked ? 'bloqueio' : 'atendimento')}
                className="h-4 w-4 rounded border-[#E8E8E8] text-[#0FA37F] focus:ring-[#0FA37F]"
              />
              Bloquear horário
            </label>
            {agenda.slotsOcupadosLoading ? (
              <span className="text-[11px] font-semibold text-[#888888]">Carregando ocupação do dia…</span>
            ) : null}
          </div>

          {!bloqueio ? (
            <>
              <FieldError error={agenda.formErrors.pacienteId}>
                <label className="text-[12px] font-bold text-[#1A1A2E]">Paciente*</label>
                <select
                  value={agenda.form.pacienteId}
                  onChange={(event) => agenda.updateForm('pacienteId', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8E8E8] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1A1A2E] outline-none focus:border-[#0FA37F]"
                >
                  <option value="">Selecione</option>
                  {agenda.patientOptions.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.nome}</option>
                  ))}
                </select>
                {agenda.patientOptions.length === 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-[#888888]">Cadastre pacientes na aba Pacientes para agendar.</p>
                ) : null}
              </FieldError>

              <FieldError error={agenda.formErrors.procedimentoNome}>
                <label className="text-[12px] font-bold text-[#1A1A2E]">Procedimento*</label>
                <div className="mt-1">
                  <ProcedimentoAutocomplete
                    value={agenda.form.procedimentoNome || ''}
                    onChange={(nome, catalogoId) => {
                      agenda.updateForm('procedimentoNome', nome);
                      agenda.updateForm('catalogoProcedimentoSaudeId', catalogoId || '');
                    }}
                    placeholder="Ex: Botox, Preenchimento..."
                    catalogoOptions={agenda.procedimentoOptions.map((o) => ({
                      id: o.id,
                      nomeProcedimento: o.nome,
                    }))}
                    error={Boolean(agenda.formErrors.procedimentoNome)}
                  />
                </div>
              </FieldError>
            </>
          ) : (
            <div className="md:col-span-2">
              <FieldError error={agenda.formErrors.motivoBloqueio}>
                <label className="text-[12px] font-bold text-[#1A1A2E]">Motivo do bloqueio*</label>
                <textarea
                  value={agenda.form.motivoBloqueio || ''}
                  onChange={(event) => agenda.updateForm('motivoBloqueio', event.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-[#E8E8E8] px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]"
                  placeholder="Ex.: Treinamento, manutenção, folga…"
                />
              </FieldError>
            </div>
          )}

          <div>
            <label className="text-[12px] font-bold text-[#1A1A2E]">Data*</label>
            <input
              type="date"
              min={agenda.todayIso}
              value={agenda.form.data}
              onChange={(event) => agenda.updateForm('data', event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E8E8E8] px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]"
            />
            {(() => {
              const past =
                Boolean(agenda.form.data) && agenda.form.data < agenda.todayIso;
              const msg =
                agenda.formErrors.data ||
                (past ? 'Data inválida — não é possível agendar para o passado.' : '');
              return msg ? <p className="mt-1 text-sm text-red-500">{msg}</p> : null;
            })()}
          </div>

          <FieldError error={agenda.formErrors.horaInicio}>
            <label className="text-[12px] font-bold text-[#1A1A2E]" htmlFor="agenda-hora-inicio">
              Horário*
            </label>
            <input
              id="agenda-hora-inicio"
              ref={horaInicioInputRef}
              type="time"
              value={agenda.form.horaInicio}
              title={horarioConflita ? 'Horário ocupado' : undefined}
              onChange={(event) => agenda.updateForm('horaInicio', event.target.value)}
              onClick={openHoraInicioPicker}
              className={horarioInputClass}
            />
            {horarioConflita ? (
              <p className="mt-1 text-[11px] font-bold text-amber-700">Horário ocupado</p>
            ) : null}
            {horarioConflita && agenda.proximoHorarioLivre ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold text-[#64748b]">
                  Próximo horário livre sugerido: <span className="font-bold text-[#1A1A2E]">{agenda.proximoHorarioLivre}</span>
                </p>
                <button
                  type="button"
                  onClick={() => agenda.updateForm('horaInicio', agenda.proximoHorarioLivre)}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold text-amber-900 hover:bg-amber-50"
                >
                  Aplicar sugestão
                </button>
              </div>
            ) : null}
          </FieldError>

          <FieldError error={agenda.formErrors.duracaoMin}>
            <label className="text-[12px] font-bold text-[#1A1A2E]" htmlFor="agenda-duracao-min">
              Duração (min)*
            </label>
            <select
              id="agenda-duracao-min"
              value={String(agenda.form.duracaoMin ?? '')}
              onChange={(event) => agenda.updateForm('duracaoMin', event.target.value)}
              className="mt-1 w-full cursor-pointer rounded-lg border border-[#E8E8E8] bg-white px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]"
            >
              {AGENDA_DURACAO_MINUTOS_OPCOES.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </FieldError>

          {!bloqueio ? (
            <div>
              <label className="text-[12px] font-bold text-[#1A1A2E]">Telefone</label>
              <input value={agenda.form.telefone} onChange={(event) => agenda.updateForm('telefone', event.target.value)} className="mt-1 w-full rounded-lg border border-[#E8E8E8] px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]" />
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="text-[12px] font-bold text-[#1A1A2E]">Observações</label>
            <textarea value={agenda.form.observacao} onChange={(event) => agenda.updateForm('observacao', event.target.value)} rows={3} className="mt-1 w-full resize-none rounded-lg border border-[#E8E8E8] px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]" />
          </div>
        </div>

        <div className="flex flex-col-reverse flex-wrap gap-2 border-t border-[#E8E8E8] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-none">
            {isEdit ? (
              <button
                type="button"
                onClick={() => {
                  if (typeof onExcluirClick === 'function') onExcluirClick();
                }}
                className={`${BTN_ACTION} items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50`}
              >
                <Trash2 className="h-4 w-4 shrink-0" /> Excluir agendamento
              </button>
            ) : null}
          </div>
          <div className="flex w-full min-w-0 flex-wrap justify-end gap-2 sm:w-auto sm:max-w-full">
            <button
              type="button"
              onClick={agenda.closeModal}
              className={`${BTN_ACTION} rounded-lg border border-[#E8E8E8] px-4 py-2.5 text-[13px] font-bold text-[#64748b] hover:bg-[#F5F6FA]`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={agenda.saveAppointment}
              className={`${BTN_ACTION} rounded-lg bg-[#0FA37F] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#0d8f6f]`}
            >
              {isEdit ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldError({ error, children }) {
  return (
    <div>
      {children}
      {error ? <div className="mt-1 text-[11px] font-bold text-red-600">{error}</div> : null}
    </div>
  );
}

export function AgendaDashboard({ patients = [], onStartAttendance, authEnabled = false }) {
  const agenda = useAgendaPage({ patients, authEnabled });
  const [listDaySummary, setListDaySummary] = React.useState(null);
  const [modalCancelar, setModalCancelar] = React.useState(null);
  const [modalReagendar, setModalReagendar] = React.useState(null);
  const [cancelSubmitting, setCancelSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (agenda.viewMode === 'grid' || agenda.viewMode === 'semana') setListDaySummary(null);
  }, [agenda.viewMode]);

  const renderSlotActions = React.useCallback(
    (appointment) => {
      if (isAppointmentBloqueio(appointment)) return null;
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
          onReagendar={() => setModalReagendar({ agenda: appointment })}
          onCancelar={() => setModalCancelar({ agenda: appointment })}
          onEnviarWhatsApp={() => agenda.handleEnviarWhatsApp(appointment.id, 'confirmacao_24h')}
        />
      );
    },
    [agenda]
  );

  const handleConfirmCancelar = React.useCallback(
    async (payload) => {
      const row = modalCancelar?.agenda;
      if (!row?.agendaId || !payload) return;
      setCancelSubmitting(true);
      try {
        const ok = await agenda.handleCancelar(row.agendaId, payload);
        if (ok) setModalCancelar(null);
      } finally {
        setCancelSubmitting(false);
      }
    },
    [agenda, modalCancelar?.agenda]
  );

  const handleConfirmReagendar = React.useCallback(
    async (payload) => {
      const row = modalReagendar?.agenda;
      if (!row?.agendaId || !payload) return;
      const ok = await agenda.handleReagendar(row.agendaId, payload);
      if (ok) setModalReagendar(null);
    },
    [agenda, modalReagendar?.agenda]
  );

  const handleExcluirFromEditModal = React.useCallback(() => {
    const row = agenda.editingAppointment;
    if (row?.agendaId) {
      setModalCancelar({ agenda: row });
      agenda.closeModal();
    }
  }, [agenda]);

  const handlePrimary = React.useCallback((appointment) => {
    if (isAppointmentBloqueio(appointment)) return;
    if (appointment.status === 'pendente' || appointment.status === 'aguardando_confirmacao') {
      agenda.updateStatus(appointment, 'confirmado');
      return;
    }
    if (appointment.status === 'cancelado') {
      setModalReagendar({ agenda: appointment });
      return;
    }

    const patient = patients.find((item) => samePatient(item, appointment));
    if (patient && typeof onStartAttendance === 'function') {
      onStartAttendance(patient, {
        procedimentoNome: appointment.procedimentoNome,
        agendaId: appointment.agendaId,
        catalogoProcedimentoSaudeId: appointment.catalogoProcedimentoSaudeId || '',
      });
      return;
    }
    window.alert('Para iniciar atendimento, vincule este agendamento a um paciente cadastrado no sistema.');
  }, [agenda, onStartAttendance, patients]);

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
          className="inline-flex max-w-[min(100%,16rem)] shrink-0 items-center justify-center gap-2 self-start rounded-[10px] bg-[#0FA37F] px-4 py-3 text-center text-[12px] font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#0d8f6f] lg:self-auto"
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
              <Loader2 className="h-8 w-8 animate-spin text-[#0FA37F]" />
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
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-black text-[#1A1A2E]">{agenda.monthLabel}</h3>
                <button type="button" onClick={agenda.goPrevMonth} aria-label="Mês anterior" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={agenda.goNextMonth} aria-label="Próximo mês" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="inline-flex w-fit rounded-lg bg-[#F5F6FA] p-1">
              <button type="button" aria-label="Visualizacao em grade" onClick={() => agenda.setViewMode('grid')} className={`rounded-md p-2 ${agenda.viewMode === 'grid' ? 'bg-[#E8F9F4] text-[#0FA37F]' : 'text-[#888888]'}`}>
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Visualizacao em lista" onClick={() => agenda.setViewMode('list')} className={`rounded-md p-2 ${agenda.viewMode === 'list' ? 'bg-[#E8F9F4] text-[#0FA37F]' : 'text-[#888888]'}`}>
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Visualizacao em semana"
                onClick={() => {
                  agenda.syncWeekFromSelection();
                  agenda.setViewMode('semana');
                }}
                className={`rounded-md p-2 ${agenda.viewMode === 'semana' ? 'bg-[#E8F9F4] text-[#0FA37F]' : 'text-[#888888]'}`}
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
              renderSlotActions={renderSlotActions}
              disponibilidades={agenda.disponibilidades}
              periodos={agenda.periodos}
            />
          )}
        </section>

        <aside className="hidden lg:block">
          <DayPanel
            selectedDay={agenda.selectedDay}
            appointments={agenda.selectedDayAppointments}
            onPrimary={handlePrimary}
            onEdit={agenda.openEditModal}
            onRemoveBloqueio={(item) => agenda.updateStatus(item, 'cancelado')}
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
              onRemoveBloqueio={(item) => agenda.updateStatus(item, 'cancelado')}
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
        onRemoveBloqueio={(item) => agenda.updateStatus(item, 'cancelado')}
        renderSlotActions={renderSlotActions}
      />

      <AgendaFormModal agenda={agenda} onExcluirClick={handleExcluirFromEditModal} />

      {modalCancelar?.agenda ? (
        <CancelarAgendaModal
          agenda={modalCancelar.agenda}
          onClose={() => setModalCancelar(null)}
          onConfirm={handleConfirmCancelar}
          isSubmitting={cancelSubmitting}
        />
      ) : null}

      {modalReagendar?.agenda ? (
        <ReagendarAgendaModal
          agenda={modalReagendar.agenda}
          onClose={() => setModalReagendar(null)}
          onConfirm={handleConfirmReagendar}
          isSubmitting={agenda.submittingReagendar}
        />
      ) : null}
    </div>
  );
}
