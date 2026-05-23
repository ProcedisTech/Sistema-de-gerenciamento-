import React from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { formatLongDate } from './useAgendaPage';
import { WeekTimeGrid } from './WeekTimeGrid';
import AgendaSlotActions from './AgendaSlotActions.jsx';
import { AgendaAppointmentSummaryCard } from './AgendaAppointmentSummaryCard.jsx';
import { AgendaWeekSlotDetailModal } from './AgendaWeekSlotDetailModal.jsx';
import { AgendaAdvanceConfirmModal } from './AgendaAdvanceConfirmModal.jsx';
import { AgendaTopbar } from './AgendaTopbar.jsx';
import { AgendaControlStrip } from './AgendaControlStrip.jsx';
import { AgendaCalendarGrid } from './AgendaCalendarGrid.jsx';
import { AgendaCalendarSkeleton } from './AgendaCalendarSkeleton.jsx';
import { AgendaDayRail } from './AgendaDayRail.jsx';
import { AgendaDaySheet } from './AgendaDaySheet.jsx';
import { AgendaWeekStrip } from './AgendaWeekStrip.jsx';
import { AgendaKbdHint } from './AgendaKbdHint.jsx';
import { agendaEnterClass } from './agendaEnterClasses.js';
import { useAgendaKeyboardShortcuts } from './hooks/useAgendaKeyboardShortcuts.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { buildAdvanceOffersByAgendaId } from '../../utils/agendaAdvanceOffer.js';
import { addMinutesToTime } from '../../utils/agendaMapping.js';
import {
  formatListDayCountLabel,
  formatListDayPreviewLabel,
  getNextAppointment,
} from '../../utils/agendaDayInsights.js';

function samePatient(a, b) {
  if (!a || !b) return false;
  return (
    String(a.id || '') === String(b.pacienteId || '') ||
    String(a.nome || a.nomeCompleto || '').trim() === String(b.pacienteNome || '').trim()
  );
}


function ListDayCards({ agenda, onOpenDaySummary, className = '' }) {
  if (agenda.groupedAppointments.length === 0) {
    return (
      <div className={`flex h-full items-center justify-center rounded-xl border border-dashed border-[#E8E8E8] bg-white p-6 text-center text-[13px] font-semibold text-[#888888] ${className}`}>
        Nenhum agendamento no mês.
      </div>
    );
  }

  return (
    <div className={`custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 ${className}`}>
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
                {formatListDayCountLabel(group.items)}
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
                {formatListDayPreviewLabel(first)}
                {group.items.length > 1 ? (
                  <span className="mt-0.5 block text-[11px] text-[#94a3b8]">+{group.items.length - 1} outros</span>
                ) : null}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
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
              {formatListDayCountLabel(group.items, { suffix: ' neste dia' })}
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
  clinicaNome = 'Procedi',
  profissionalNome = '',
  shortcutsBlocked: shortcutsBlockedExternal = false,
}) {
  const panelListRef = React.useRef(null);
  const cardRefs = React.useRef({});
  const firstFilterRef = React.useRef(null);
  const [listDaySummary, setListDaySummary] = React.useState(null);
  const [weekSlotDetail, setWeekSlotDetail] = React.useState(null);
  const [advancePending, setAdvancePending] = React.useState(null);
  const [showEntrance, setShowEntrance] = React.useState(true);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = !isDesktop;

  const closeDaySheet = React.useCallback(() => {
    agenda.closeDaySheet();
  }, [agenda]);

  const handleSelectDay = React.useCallback(
    (iso, openSheet) => {
      const shouldOpenSheet = isMobile && openSheet !== false;
      agenda.selectDay(iso, shouldOpenSheet);
    },
    [agenda, isMobile],
  );

  React.useEffect(() => {
    if (isDesktop && agenda.daySheetOpen) closeDaySheet();
  }, [isDesktop, agenda.daySheetOpen, closeDaySheet]);

  React.useEffect(() => {
    if (!showEntrance) return undefined;
    const id = window.setTimeout(() => setShowEntrance(false), 1800);
    return () => window.clearTimeout(id);
  }, [showEntrance]);

  const shortcutsBlocked = React.useMemo(
    () =>
      Boolean(
        shortcutsBlockedExternal ||
          agenda.modalMode ||
          agenda.bloqueioModalOpen ||
          agenda.foraDispModal ||
          listDaySummary ||
          weekSlotDetail ||
          advancePending,
      ),
    [
      shortcutsBlockedExternal,
      agenda.modalMode,
      agenda.bloqueioModalOpen,
      agenda.foraDispModal,
      listDaySummary,
      weekSlotDetail,
      advancePending,
    ],
  );

  useAgendaKeyboardShortcuts({
    enabled: isDesktop,
    blocked: shortcutsBlocked,
    onPrevMonth: agenda.goPrevMonth,
    onNextMonth: agenda.goNextMonth,
    onToday: agenda.goToToday,
    onFocusFirstFilter: () => firstFilterRef.current?.focus(),
    onNewAppointment: () => {
      if (!agenda.isNivel1) agenda.openCreateModal(agenda.selectedDay);
    },
  });

  const advanceSourceAppointments = React.useMemo(() => {
    if (agenda.viewMode === 'semana') return agenda.filteredWeekGridAppointments;
    return agenda.selectedDayAppointments;
  }, [agenda.viewMode, agenda.filteredWeekGridAppointments, agenda.selectedDayAppointments]);

  const advanceOfferByAgendaId = React.useMemo(
    () => buildAdvanceOffersByAgendaId(advanceSourceAppointments),
    [advanceSourceAppointments],
  );

  const listDayAdvanceOffers = React.useMemo(
    () => (listDaySummary?.items ? buildAdvanceOffersByAgendaId(listDaySummary.items) : new Map()),
    [listDaySummary],
  );

  const showProfissional = (agenda.equipeList?.length || 0) > 1;

  const todayAppointments = React.useMemo(() => {
    return agenda.appointments.filter((item) => String(item.data) === String(agenda.todayIso));
  }, [agenda.appointments, agenda.todayIso]);

  const nextAppointment = React.useMemo(
    () => getNextAppointment(todayAppointments, { todayIso: agenda.todayIso }),
    [todayAppointments, agenda.todayIso],
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
        observacao: 'Adiantado para preencher hor�rio liberado',
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
          onRemoverBloqueio={() => agenda.handleRemoverBloqueio(appointment)}
        />
      );
    },
    [agenda, onSlotCancelar, onSlotReagendar]
  );

  const handlePrimary = React.useCallback((appointment) => {
    if (appointment.tipo === 'bloqueio') return;
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

  const handleEditAppointment = React.useCallback(
    (appointment) => {
      if (appointment?.tipo === 'bloqueio') return;
      agenda.openEditModal(appointment);
    },
    [agenda]
  );

  const handleEditFromWeekDetail = React.useCallback(
    (appointment) => {
      setWeekSlotDetail(null);
      handleEditAppointment(appointment);
    },
    [handleEditAppointment]
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
          onRemoverBloqueio={() => agenda.handleRemoverBloqueio(appointment)}
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

  const handleCheckIn = React.useCallback(
    (appointment) => {
      if (!appointment) return;
      if (appointment.status === 'pendente' || appointment.status === 'aguardando_confirmacao') {
        if (appointment.agendaId) agenda.handleAtualizarStatus(appointment.agendaId, 'confirmado');
        return;
      }
      if (appointment.status === 'confirmado') {
        handlePrimary(appointment);
      }
    },
    [agenda, handlePrimary],
  );

  const handleRailConfirmar = React.useCallback(
    (appointment) => {
      if (appointment?.agendaId) agenda.handleAtualizarStatus(appointment.agendaId, 'confirmado');
    },
    [agenda],
  );

  const handleRailIniciarAtendimento = React.useCallback(
    (appointment) => {
      handlePrimary(appointment);
    },
    [handlePrimary],
  );

  const handleRailCancelar = React.useCallback(
    (appointment) => {
      onSlotCancelar?.(appointment);
    },
    [onSlotCancelar],
  );

  const handleRailWhatsApp = React.useCallback(
    (appointment) => {
      if (appointment?.agendaId) agenda.handleEnviarWhatsApp(appointment.agendaId, 'confirmacao_24h');
    },
    [agenda],
  );

  const railProps = {
    selectedDay: agenda.selectedDay,
    appointments: agenda.selectedDayAppointments,
    todayIso: agenda.todayIso,
    showProfissional,
    isNivel1: agenda.isNivel1,
    listRef: panelListRef,
    cardRefs,
    advanceOfferByAgendaId,
    onAdvanceClick: agenda.isNivel1 ? null : handleAdvanceClick,
    onBloquear: () => agenda.openBloqueioModal(agenda.selectedDay),
    onNovoAgendamento: () => agenda.openCreateModal(agenda.selectedDay),
    onCheckIn: handleCheckIn,
    onConfirmar: handleRailConfirmar,
    onIniciarAtendimento: handleRailIniciarAtendimento,
    onWhatsApp: handleRailWhatsApp,
    onReagendar: onSlotReagendar,
    onCancelar: handleRailCancelar,
    onEdit: handleEditAppointment,
    onRemoverBloqueio: agenda.handleRemoverBloqueio,
    submittingRemoverBloqueioId: agenda.submittingRemoverBloqueioId,
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 font-sans text-ink-900">
      <div className={agendaEnterClass(showEntrance, 'agenda-delay-100')}>
        <AgendaTopbar
          clinicaNome={clinicaNome}
          profissionalNome={profissionalNome}
          viewMode={agenda.viewMode}
          onChangeViewMode={agenda.setViewMode}
          onSyncWeekFromSelection={agenda.syncWeekFromSelection}
          authEnabled={authEnabled}
        />
      </div>

      {agenda.error ? (
        <div className="mx-[22px] shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[12px] font-bold text-amber-900">
          {agenda.error}
        </div>
      ) : null}

      <div className={`mx-[22px] shrink-0 ${agendaEnterClass(showEntrance, 'agenda-delay-150')}`}>
        <AgendaControlStrip
          statusFilters={agenda.statusFilters}
          onToggleStatus={agenda.toggleStatusFilter}
          onToggleAll={agenda.toggleAllStatusFilters}
          statusCounts={agenda.statusFilterCounts}
          nextAppointment={nextAppointment}
          firstFilterRef={firstFilterRef}
        />
      </div>

      <AgendaWeekStrip
        weekDayIsos={agenda.weekDayIsos}
        selectedDay={agenda.selectedDay}
        todayIso={agenda.todayIso}
        appointmentsByDate={agenda.appointmentsByDate}
        onSelectDay={(iso) => handleSelectDay(iso, true)}
      />

      <div className="grid min-h-0 flex-1 flex-col gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(420px,480px)]">
        <section
          className={`relative flex min-h-0 flex-col overflow-hidden md:max-lg:shrink-0 ${
            agenda.viewMode === 'grid'
              ? 'flex-1 border-0 bg-transparent p-0 shadow-none md:max-lg:h-auto'
              : 'rounded-xl border border-[#E8E8E8] bg-white p-3 shadow-sm md:max-lg:h-[42vh]'
          }`}
        >
          {agenda.viewMode !== 'grid' ? (
          <div className="mb-2 flex shrink-0 items-center gap-2">
            {agenda.viewMode === 'semana' ? (
              <>
                <button type="button" onClick={agenda.goWeekPrev} aria-label="Semana anterior" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="min-w-0 flex-1 truncate text-center text-sm font-black text-[#1A1A2E] sm:text-[15px]">
                  {agenda.weekRangeLabel}
                </h3>
                <button type="button" onClick={agenda.goWeekNext} aria-label="Próxima semana" className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={agenda.goPrevMonth} aria-label="Mês anterior" className="shrink-0 rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="min-w-0 flex-1 truncate text-center text-sm font-black text-[#1A1A2E] sm:text-[15px]">
                  {agenda.monthLabel}
                </h3>
                <button type="button" onClick={agenda.goNextMonth} aria-label="Próximo mês" className="shrink-0 rounded-lg p-1.5 text-[#64748b] hover:bg-[#F5F6FA]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden">
            {agenda.loading ? (
              <AgendaCalendarSkeleton />
            ) : agenda.viewMode === 'grid' ? (
              <AgendaCalendarGrid
                agenda={agenda}
                showEntrance={showEntrance}
                onSelectDay={handleSelectDay}
              />
            ) : agenda.viewMode === 'list' ? (
              <ListDayCards agenda={agenda} onOpenDaySummary={setListDaySummary} className="h-full" />
            ) : (
              <WeekTimeGrid
                className="h-full"
                weekDayIsos={agenda.weekDayIsos}
                appointments={agenda.filteredWeekGridAppointments}
                todayIso={agenda.todayIso}
                onOpenSlotDetail={setWeekSlotDetail}
                onClickEmptySlot={agenda.isNivel1 ? null : openWeekCreateAtSlot}
                disponibilidades={agenda.disponibilidades}
                advanceOfferByAgendaId={advanceOfferByAgendaId}
                onAdvanceClick={agenda.isNivel1 ? null : handleAdvanceClick}
                onRemoverBloqueio={agenda.isNivel1 ? null : agenda.handleRemoverBloqueio}
                submittingRemoverBloqueioId={agenda.submittingRemoverBloqueioId}
              />
            )}
          </div>
        </section>

        <aside className={`hidden min-h-0 lg:flex lg:flex-col ${agendaEnterClass(showEntrance, 'agenda-delay-250')}`}>
          <AgendaDayRail {...railProps} />
        </aside>
      </div>

      {isMobile ? (
        <AgendaDaySheet open={agenda.daySheetOpen} onClose={closeDaySheet}>
          <AgendaDayRail {...railProps} compact />
        </AgendaDaySheet>
      ) : null}

      <AgendaKbdHint showEntrance={showEntrance} />

      {!agenda.isNivel1 && !agenda.daySheetOpen ? (
        <button
          type="button"
          onClick={() => agenda.openCreateModal(agenda.todayIso)}
          className="fixed bottom-24 right-4 z-[200] flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-all duration-150 hover:bg-brand-primaryDark hover:shadow-xl active:scale-[0.98] motion-reduce:active:scale-100 lg:hidden"
          aria-label="Novo agendamento"
        >
          <Plus className="h-6 w-6" />
        </button>
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

