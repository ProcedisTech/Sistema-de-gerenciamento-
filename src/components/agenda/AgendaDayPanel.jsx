import React from 'react';
import { CalendarOff, Lock, Plus } from 'lucide-react';
import { formatLongDate } from './useAgendaPage';
import { AgendaAppointmentSummaryCard } from './AgendaAppointmentSummaryCard.jsx';
import { countByStatus, filterAppointmentsByStatus, formatWeekdayLong } from '../../utils/agendaDayInsights.js';

const STATUS_FILTER_CHIPS = [
  { key: 'confirmado', label: 'confirmados' },
  { key: 'pendente', label: 'pendentes' },
  { key: 'cancelado', label: 'cancelados' },
];

export function AgendaDayPanel({
  selectedDay,
  appointments,
  onPrimary,
  onEdit,
  renderSlotActions,
  isNivel1 = false,
  advanceOfferByAgendaId,
  onAdvanceClick,
  onBloquear,
  onNovoAgendamento,
  showProfissional = false,
  inProgressAppointment = null,
  nextAppointment = null,
  todayIso,
  listRef,
  cardRefs,
}) {
  const [statusFilter, setStatusFilter] = React.useState(null);
  const counts = React.useMemo(() => countByStatus(appointments), [appointments]);

  React.useEffect(() => {
    setStatusFilter(null);
  }, [selectedDay]);

  const filtered = React.useMemo(
    () => filterAppointmentsByStatus(appointments, statusFilter),
    [appointments, statusFilter],
  );

  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));
  }, [filtered]);

  const nextId = nextAppointment?.id ? String(nextAppointment.id) : null;
  const inProgressId = inProgressAppointment?.id ? String(inProgressAppointment.id) : null;

  const renderCard = (appointment, { variant = 'panel', badgeExtra = null } = {}) => (
    <div
      key={appointment.id}
      ref={(el) => {
        if (cardRefs && appointment.id) cardRefs.current[String(appointment.id)] = el;
      }}
    >
      {badgeExtra}
      <AgendaAppointmentSummaryCard
        appointment={appointment}
        onPrimary={onPrimary}
        onEdit={onEdit}
        renderSlotActions={renderSlotActions}
        isNivel1={isNivel1}
        variant={variant}
        showProfissional={showProfissional}
        advanceOffer={advanceOfferByAgendaId?.get(String(appointment.id))}
        onAdvanceClick={onAdvanceClick}
      />
    </div>
  );

  const statusChips = STATUS_FILTER_CHIPS.filter((c) => counts[c.key] > 0);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-calendar-border bg-white shadow-sm">
      <div className="shrink-0 rounded-t-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-blue-50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black text-brand-primaryDark">
              <span className="capitalize">{formatWeekdayLong(selectedDay)}</span>
              <span className="font-semibold text-brand-primaryDark/80"> · {formatLongDate(selectedDay)}</span>
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-brand-primary px-3 py-1 text-xs font-bold text-white">
            {appointments.length} agend.
          </span>
        </div>
        {statusChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {statusChips.map((chip) => {
              const active = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatusFilter(active ? null : chip.key)}
                  className={`min-h-9 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                    active
                      ? 'bg-brand-primary text-white'
                      : 'bg-white/80 text-brand-primaryDark ring-1 ring-teal-200 hover:bg-white'
                  }`}
                >
                  {counts[chip.key]} {chip.label}
                </button>
              );
            })}
            {counts.bloqueio > 0 ? (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'bloqueio' ? null : 'bloqueio')}
                className={`min-h-9 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                  statusFilter === 'bloqueio'
                    ? 'bg-slate-600 text-white'
                    : 'bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-white'
                }`}
              >
                {counts.bloqueio} bloqueio{counts.bloqueio === 1 ? '' : 's'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!isNivel1 ? (
        <div className="flex shrink-0 gap-2 border-b border-[#E8E8E8] bg-white px-3 py-2.5">
          <button
            type="button"
            onClick={onBloquear}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Lock className="h-4 w-4" />
            Bloquear horário
          </button>
          <button
            type="button"
            onClick={onNovoAgendamento}
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-brand-primaryDark hover:shadow-md active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">Novo Agendamento</span>
          </button>
        </div>
      ) : null}

      <div
        ref={listRef}
        key={selectedDay}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pr-2 custom-scrollbar"
      >
        {inProgressAppointment && !statusFilter ? (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white motion-safe:animate-pulse">
                Em andamento
              </span>
            </div>
            {renderCard(inProgressAppointment, { variant: 'highlight' })}
          </div>
        ) : null}

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[#E8E8E8] bg-[#F5F6FA] px-4 py-8 text-center">
            <CalendarOff className="mb-3 h-10 w-10 text-slate-400" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-[#555]">Sem agendamentos neste dia.</p>
            <p className="mt-1 text-xs text-[#888888]">Adicione um novo ou aproveite para descansar.</p>
            {!isNivel1 ? (
              <button
                type="button"
                onClick={onNovoAgendamento}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-primary bg-white px-4 py-2.5 text-sm font-bold text-brand-primaryDark transition-colors hover:bg-brand-primaryGhost"
              >
                <Plus className="h-4 w-4" />
                Novo Agendamento
              </button>
            ) : null}
          </div>
        ) : (
          sorted.map((appointment) => {
            const id = String(appointment.id);
            if (inProgressId && id === inProgressId) return null;
            const isNext =
              selectedDay === todayIso && nextId && id === nextId && appointment.status !== 'cancelado';
            if (isNext) {
              return (
                <div key={appointment.id}>
                  <span className="mb-1 inline-block text-[10px] font-bold uppercase tracking-wide text-teal-800">
                    Próximo
                  </span>
                  {renderCard(appointment, { variant: 'highlight' })}
                </div>
              );
            }
            return renderCard(appointment);
          })
        )}
      </div>
    </div>
  );
}
