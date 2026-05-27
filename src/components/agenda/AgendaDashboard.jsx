import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useUsuarioLogado } from '../../hooks/useUsuarioLogado.js';
import { filterAgendaForProfissional } from '../../utils/agendaNovoV2Helpers.js';
import { formatLongDate } from './useAgendaPage';
import { WeekTimeGrid } from './WeekTimeGrid';
import AgendaSlotActions from './AgendaSlotActions.jsx';
import { AgendaSummaryEntryCard } from './AgendaSummaryEntryCard.jsx';
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
import ModoAgendamentoSeletores from './modo-agendamento/ModoAgendamentoSeletores.jsx';
import SlotsListaDoDiaVertical from './modo-agendamento/SlotsListaDoDiaVertical.jsx';
import ConfirmarAgendamentoBar from './modo-agendamento/ConfirmarAgendamentoBar.jsx';
import { agendaEnterClass } from './agendaEnterClasses.js';
import { useAgendaKeyboardShortcuts } from './hooks/useAgendaKeyboardShortcuts.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useToast } from '../../contexts/useToast.js';
import { buildAdvanceOffersByAgendaId } from '../../utils/agendaAdvanceOffer.js';
import { addMinutesToTime } from '../../utils/agendaMapping.js';
import {
  formatListDayCountLabel,
  formatListDayPreviewEntry,
  getEntryPrimaryAppointment,
  getNextAppointmentEntry,
  groupConsecutiveAppointments,
} from '../../utils/agendaDayInsights.js';
import {
  applyActionToAppointmentGroup,
  formatGroupActionResultMessage,
  resolveActionAppointments,
  scheduleRowFromTarget,
} from '../../utils/agendaGroupActions.js';
import { getEntryDomId } from '../../utils/agendaRailHelpers.js';

function samePatient(a, b) {
  if (!a || !b) return false;
  return (
    String(a.id || '') === String(b.pacienteId || '') ||
    String(a.nome || a.nomeCompleto || '').trim() === String(b.pacienteNome || '').trim()
  );
}

function normalizeHoraInicial(horaInicial) {
  if (!horaInicial) return null;
  const h = String(horaInicial);
  if (h.length <= 5) return `${h}:00`;
  return h;
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
          const entries = groupConsecutiveAppointments(group.items);
          const firstEntry = entries[0];
          const firstAppt = getEntryPrimaryAppointment(firstEntry);
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
              {firstAppt ? (
                <p className="mt-3 line-clamp-2 text-[12px] font-medium text-[#64748b]">
                  <span className="font-bold text-brand-primary">
                    {firstEntry?.kind === 'group'
                      ? `${firstEntry.horaInicio} → ${firstEntry.horaFim}`
                      : firstAppt.horaInicio}
                  </span>
                  <span className="mx-1.5 text-[#CBD5E1]">·</span>
                  {formatListDayPreviewEntry(firstEntry)}
                  {entries.length > 1 ? (
                    <span className="mt-0.5 block text-[11px] text-[#94a3b8]">
                      +{entries.length - 1} outro{entries.length - 1 === 1 ? '' : 's'}
                    </span>
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

  const entries = groupConsecutiveAppointments(group.items);

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
          {entries.map((entry) => {
            const primary = getEntryPrimaryAppointment(entry);
            const advanceId = primary?.id ? String(primary.id) : '';
            return (
              <AgendaSummaryEntryCard
                key={getEntryDomId(entry)}
                entry={entry}
                onPrimary={(target) => {
                  onPrimary(target);
                  onClose();
                }}
                onEdit={(target) => {
                  onEdit(getEntryPrimaryAppointment(
                    target?.kind === 'group' ? target : { kind: 'single', appointment: target },
                  ) || target);
                  onClose();
                }}
                renderSlotActions={renderSlotActions}
                isNivel1={isNivel1}
                advanceOffer={advanceId ? advanceOfferByAgendaId?.get(advanceId) : undefined}
                onAdvanceClick={onAdvanceClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SoloKpiHeader({ profissionalNome, roleNome, dayRows }) {
  const agendados = dayRows.filter((a) => a.tipo !== 'bloqueio').length;
  const bloqueios = dayRows.filter((a) => a.tipo === 'bloqueio').length;
  const faltas = dayRows.filter((a) => a.status === 'falta' || a.status === 'nao_compareceu').length;

  return (
    <div className="mx-[22px] mb-2 shrink-0 rounded-xl border border-vivid-teal-200 bg-gradient-to-r from-vivid-teal-50 to-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-vivid-teal-700">Minha agenda</p>
      <h2 className="mt-1 text-lg font-bold text-ink-900">{profissionalNome || roleNome || 'Profissional'}</h2>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-ink-600">
        <span>Agendados: {agendados}</span>
        <span>Livres: —</span>
        <span>Faltas: {faltas}</span>
        <span>Bloqueios: {bloqueios}</span>
      </div>
    </div>
  );
}

function ModoAgendamentoPanel({
  modoAgendamento,
  selectedDay,
  onSelecionarSlot,
  onCancel,
  onSuccess,
  abrirConfirmacaoForaDisp,
  compact = false,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
      <SlotsListaDoDiaVertical
        data={selectedDay}
        roleUserFiltro={modoAgendamento.profissionalFiltro?.roleUserId}
        enabled={Boolean(modoAgendamento)}
        selecao={{
          hora: modoAgendamento.horaSelecionada,
          roleUserId: modoAgendamento.slotProfissional?.roleUserId,
        }}
        onSelecionarSlot={onSelecionarSlot}
      />
      <ConfirmarAgendamentoBar
        modo={modoAgendamento}
        data={selectedDay}
        abrirConfirmacaoForaDisp={abrirConfirmacaoForaDisp}
        onCancel={onCancel}
        onSuccess={onSuccess}
        compact={compact}
      />
    </div>
  );
}

export function AgendaDashboard({
  agenda,
  patients = [],
  onStartAttendance,
  authEnabled = false,
  onSlotCancelar,
  clinicaNome = 'Procedi',
  profissionalNome = '',
  shortcutsBlocked: shortcutsBlockedExternal = false,
}) {
  const { roleUserId, roleNome, ehProfissionalClinico } = useUsuarioLogado();

  const viewAgenda = useMemo(
    () => (ehProfissionalClinico ? filterAgendaForProfissional(agenda, roleUserId) : agenda),
    [agenda, roleUserId, ehProfissionalClinico],
  );

  const panelListRef = React.useRef(null);
  const cardRefs = React.useRef({});
  const firstFilterRef = React.useRef(null);
  const [listDaySummary, setListDaySummary] = useState(null);
  const [weekSlotDetail, setWeekSlotDetail] = useState(null);
  const [advancePending, setAdvancePending] = useState(null);
  const [showEntrance, setShowEntrance] = useState(true);
  const [modoAgendamento, setModoAgendamento] = useState(null);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isWideDesktop = useMediaQuery('(min-width: 1440px)');
  const isMobile = !isDesktop;
  const toast = useToast();

  const exitModoAgendamento = useCallback(() => {
    setModoAgendamento(null);
  }, []);

  const enterModoNovo = useCallback(
    (opts = {}) => {
      if (agenda.isNivel1) return;
      const day = opts.dataInicial || agenda.selectedDay;
      agenda.selectDay(day, isMobile);
      setModoAgendamento({
        pacienteSelecionado: null,
        procedimentosSelecionados: [],
        profissionalFiltro: ehProfissionalClinico
          ? { roleUserId, nome: profissionalNome || roleNome }
          : null,
        horaSelecionada: normalizeHoraInicial(opts.horaInicial),
        slotProfissional: null,
        observacao: '',
        horaFimManual: null,
        reagendamentoOrigem: null,
      });
    },
    [agenda, ehProfissionalClinico, roleUserId, profissionalNome, roleNome, isMobile],
  );

  const enterModoReagendar = useCallback(
    (target) => {
      const row = scheduleRowFromTarget(target) || (target?.agendaId ? { agenda: target } : null);
      const appt = row?.agenda;
      if (!appt?.agendaId) return;
      if (appt.data) agenda.selectDay(appt.data, isMobile);
      const profRid = appt.profissionalRoleUserId || appt.roleUserId;
      setModoAgendamento({
        reagendamentoOrigem: {
          agendaId: appt.agendaId,
          pacienteId: appt.pacienteId,
          pacienteNome: appt.pacienteNome,
        },
        pacienteSelecionado: appt.pacienteId
          ? { id: String(appt.pacienteId), nome: appt.pacienteNome || '' }
          : null,
        procedimentosSelecionados: [],
        profissionalFiltro: profRid
          ? { roleUserId: String(profRid), nome: appt.profissionalNome }
          : ehProfissionalClinico
            ? { roleUserId, nome: profissionalNome || roleNome }
            : null,
        horaSelecionada: null,
        slotProfissional: null,
        observacao: '',
        horaFimManual: null,
      });
    },
    [agenda, ehProfissionalClinico, roleUserId, profissionalNome, roleNome, isMobile],
  );

  const handleModoSuccess = useCallback(async () => {
    await agenda.refreshDashboard?.();
    setModoAgendamento(null);
  }, [agenda]);

  const handleSelecionarSlot = useCallback(({ hora, profissional }) => {
    setModoAgendamento((prev) => ({
      ...prev,
      horaSelecionada: hora,
      slotProfissional: {
        roleUserId: profissional.roleUserId,
        nomeProfissional: profissional.nomeProfissional,
        especialidade: profissional.especialidade,
        fotoUrl: profissional.fotoUrl,
      },
      horaFimManual: null,
    }));
  }, []);

  const closeDaySheet = useCallback(() => {
    agenda.closeDaySheet();
  }, [agenda]);

  const handleSelectDay = useCallback(
    (iso, openSheet) => {
      const shouldOpenSheet = isMobile && openSheet !== false;
      agenda.selectDay(iso, shouldOpenSheet);
    },
    [agenda, isMobile],
  );

  useEffect(() => {
    if (isDesktop && agenda.daySheetOpen) closeDaySheet();
  }, [isDesktop, agenda.daySheetOpen, closeDaySheet]);

  useEffect(() => {
    if (!showEntrance) return undefined;
    const id = window.setTimeout(() => setShowEntrance(false), 1800);
    return () => window.clearTimeout(id);
  }, [showEntrance]);

  useEffect(() => {
    if (!modoAgendamento) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitModoAgendamento();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modoAgendamento, exitModoAgendamento]);

  const shortcutsBlocked = useMemo(
    () =>
      Boolean(
        shortcutsBlockedExternal ||
          modoAgendamento ||
          agenda.modalMode ||
          agenda.bloqueioModalOpen ||
          agenda.foraDispModal ||
          listDaySummary ||
          weekSlotDetail ||
          advancePending,
      ),
    [
      shortcutsBlockedExternal,
      modoAgendamento,
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
    onNewAppointment: () => enterModoNovo({ dataInicial: agenda.selectedDay }),
  });

  const advanceSourceAppointments = useMemo(() => {
    if (agenda.viewMode === 'semana') return viewAgenda.filteredWeekGridAppointments;
    return viewAgenda.selectedDayAppointments;
  }, [agenda.viewMode, viewAgenda.filteredWeekGridAppointments, viewAgenda.selectedDayAppointments]);

  const advanceOfferByAgendaId = useMemo(
    () => buildAdvanceOffersByAgendaId(advanceSourceAppointments),
    [advanceSourceAppointments],
  );

  const listDayAdvanceOffers = useMemo(
    () => (listDaySummary?.items ? buildAdvanceOffersByAgendaId(listDaySummary.items) : new Map()),
    [listDaySummary],
  );

  const showProfissional = (agenda.equipeList?.length || 0) > 1;

  const todayAppointments = useMemo(() => {
    return viewAgenda.appointments.filter((item) => String(item.data) === String(agenda.todayIso));
  }, [viewAgenda.appointments, agenda.todayIso]);

  const nextAppointment = useMemo(() => {
    const entries = groupConsecutiveAppointments(todayAppointments);
    const nextEntry = getNextAppointmentEntry(entries, { todayIso: agenda.todayIso });
    return getEntryPrimaryAppointment(nextEntry);
  }, [todayAppointments, agenda.todayIso]);

  const handleAdvanceClick = useCallback(
    (appointment, offer) => {
      if (!appointment || !offer?.targetHoraInicio || agenda.isNivel1) return;
      setAdvancePending({ appointment, targetHoraInicio: offer.targetHoraInicio });
    },
    [agenda.isNivel1],
  );

  const handleConfirmAdvance = useCallback(async () => {
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

  useEffect(() => {
    if (agenda.viewMode === 'grid' || agenda.viewMode === 'semana') setListDaySummary(null);
  }, [agenda.viewMode]);

  useEffect(() => {
    if (agenda.viewMode !== 'semana') setWeekSlotDetail(null);
  }, [agenda.viewMode]);

  const renderSlotActions = useCallback(
    (target) => {
      const items = resolveActionAppointments(target);
      const primary = items[0];
      if (!primary) return null;
      const disabled = Boolean(agenda.loading) || agenda.isNivel1;
      const isGroup = items.length > 1;

      return (
        <AgendaSlotActions
          agenda={primary}
          disabled={disabled}
          onMarcarRealizado={async () => {
            if (isGroup) {
              const result = await applyActionToAppointmentGroup(items, (item) =>
                item.agendaId
                  ? agenda.handleAtualizarStatus(item.agendaId, 'realizado', { successToast: false })
                  : Promise.resolve(false),
              );
              if (result.allOk) toast.success(`${items.length} agendamentos marcados como realizados`);
              else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'realizadas' }));
              return;
            }
            if (primary.agendaId) agenda.handleAtualizarStatus(primary.agendaId, 'realizado');
          }}
          onMarcarNaoCompareceu={async () => {
            if (isGroup) {
              const result = await applyActionToAppointmentGroup(items, (item) =>
                item.agendaId ? agenda.handleMarcarNaoCompareceu(item.agendaId) : Promise.resolve(false),
              );
              if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'marcadas' }));
              return;
            }
            if (primary.agendaId) agenda.handleMarcarNaoCompareceu(primary.agendaId);
          }}
          onReagendar={() => enterModoReagendar(items.length > 1 ? target : primary)}
          onCancelar={() => onSlotCancelar?.(items.length > 1 ? target : primary)}
          onEnviarWhatsApp={async () => {
            if (isGroup) {
              const result = await applyActionToAppointmentGroup(items, (item) =>
                item.agendaId
                  ? agenda.handleEnviarWhatsApp(item.agendaId, 'confirmacao_24h')
                  : Promise.resolve(false),
              );
              if (result.allOk) toast.success(`WhatsApp gerado para ${items.length} agendamentos`);
              else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'enviadas' }));
              return;
            }
            if (primary.agendaId) agenda.handleEnviarWhatsApp(primary.agendaId, 'confirmacao_24h');
          }}
          onRemoverBloqueio={() => agenda.handleRemoverBloqueio(primary)}
        />
      );
    },
    [agenda, enterModoReagendar, onSlotCancelar, toast],
  );

  const handlePrimary = useCallback(
    (target) => {
      const items = resolveActionAppointments(target);
      const appointment = items[0];
      if (!appointment || appointment.tipo === 'bloqueio') return;

      const hasPending = items.some(
        (item) => item.status === 'pendente' || item.status === 'aguardando_confirmacao',
      );
      if (hasPending) {
        void (async () => {
          const pending = items.filter(
            (item) => item.status === 'pendente' || item.status === 'aguardando_confirmacao',
          );
          if (pending.length <= 1) {
            agenda.updateStatus(pending[0] || appointment, 'confirmado');
            return;
          }
          const result = await applyActionToAppointmentGroup(pending, (item) =>
            agenda.handleAtualizarStatus(item.agendaId, 'confirmado', { successToast: false }),
          );
          if (result.allOk) toast.success(`${pending.length} agendamentos confirmados`);
          else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'confirmadas' }));
        })();
        return;
      }

      if (appointment.status === 'cancelado') {
        enterModoReagendar(scheduleRowFromTarget(target) || appointment);
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
    },
    [agenda, enterModoReagendar, onStartAttendance, patients, toast],
  );

  const handleEditAppointment = useCallback(
    (appointment) => {
      if (appointment?.tipo === 'bloqueio') return;
      agenda.openEditModal(appointment);
    },
    [agenda],
  );

  const handleEditFromWeekDetail = useCallback(
    (appointment) => {
      setWeekSlotDetail(null);
      handleEditAppointment(appointment);
    },
    [handleEditAppointment],
  );

  const renderSlotActionsWeekDetail = useCallback(
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
            enterModoReagendar(appointment);
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
    [agenda, enterModoReagendar, onSlotCancelar],
  );

  const handlePrimaryFromWeekDetail = useCallback(
    (appointment) => {
      if (appointment.status === 'pendente' || appointment.status === 'aguardando_confirmacao') {
        handlePrimary(appointment);
        return;
      }
      setWeekSlotDetail(null);
      handlePrimary(appointment);
    },
    [handlePrimary],
  );

  const openWeekCreateAtSlot = useCallback(
    (iso, horaHm) => {
      setWeekSlotDetail(null);
      if (agenda.isNivel1) return;
      enterModoNovo({ dataInicial: iso, horaInicial: horaHm });
    },
    [agenda.isNivel1, enterModoNovo],
  );

  const handleRailConfirmar = useCallback(
    async (target) => {
      const items = resolveActionAppointments(target);
      const pending = items.filter(
        (item) => item.status === 'pendente' || item.status === 'aguardando_confirmacao',
      );
      const toConfirm = pending.length ? pending : items;
      if (toConfirm.length <= 1) {
        const a = toConfirm[0];
        if (a?.agendaId) agenda.handleAtualizarStatus(a.agendaId, 'confirmado');
        return;
      }
      const result = await applyActionToAppointmentGroup(toConfirm, (item) =>
        agenda.handleAtualizarStatus(item.agendaId, 'confirmado', { successToast: false }),
      );
      if (result.allOk) toast.success(`${toConfirm.length} agendamentos confirmados`);
      else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'confirmadas' }));
    },
    [agenda, toast],
  );

  const handleCheckIn = useCallback(
    (target) => {
      if (!target) return;
      const items = resolveActionAppointments(target);
      const appointment = items[0];
      if (!appointment) return;

      const hasPending = items.some(
        (item) => item.status === 'pendente' || item.status === 'aguardando_confirmacao',
      );
      if (hasPending) {
        void handleRailConfirmar(target);
        return;
      }
      if (items.every((item) => item.status === 'confirmado')) {
        handlePrimary(target);
      }
    },
    [handlePrimary, handleRailConfirmar],
  );

  const handleRailIniciarAtendimento = useCallback(
    (target) => {
      handlePrimary(target);
    },
    [handlePrimary],
  );

  const handleRailCancelar = useCallback(
    (target) => {
      const row = scheduleRowFromTarget(target);
      onSlotCancelar?.(row || target);
    },
    [onSlotCancelar],
  );

  const handleRailReagendar = useCallback(
    (target) => {
      const row = scheduleRowFromTarget(target);
      enterModoReagendar(row || target);
    },
    [enterModoReagendar],
  );

  const handleRailWhatsApp = useCallback(
    async (target) => {
      const items = resolveActionAppointments(target);
      if (items.length <= 1) {
        const a = items[0];
        if (a?.agendaId) agenda.handleEnviarWhatsApp(a.agendaId, 'confirmacao_24h');
        return;
      }
      const result = await applyActionToAppointmentGroup(items, (item) =>
        item.agendaId ? agenda.handleEnviarWhatsApp(item.agendaId, 'confirmacao_24h') : Promise.resolve(false),
      );
      if (result.allOk) toast.success(`WhatsApp gerado para ${items.length} agendamentos`);
      else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'enviadas' }));
    },
    [agenda, toast],
  );

  const railProps = {
    selectedDay: agenda.selectedDay,
    appointments: viewAgenda.selectedDayAppointments,
    todayIso: agenda.todayIso,
    showProfissional,
    isNivel1: agenda.isNivel1,
    dense: isDesktop && !isWideDesktop,
    compactActions: isDesktop && !isWideDesktop,
    listRef: panelListRef,
    cardRefs,
    advanceOfferByAgendaId,
    onAdvanceClick: agenda.isNivel1 ? null : handleAdvanceClick,
    onBloquear: () => agenda.openBloqueioModal(agenda.selectedDay),
    onNovoAgendamento: () => enterModoNovo({ dataInicial: agenda.selectedDay }),
    onCheckIn: handleCheckIn,
    onConfirmar: handleRailConfirmar,
    onIniciarAtendimento: handleRailIniciarAtendimento,
    onWhatsApp: handleRailWhatsApp,
    onReagendar: handleRailReagendar,
    onCancelar: handleRailCancelar,
    onEdit: handleEditAppointment,
    onRemoverBloqueio: agenda.handleRemoverBloqueio,
    submittingRemoverBloqueioId: agenda.submittingRemoverBloqueioId,
  };

  const modoPanelProps = {
    modoAgendamento,
    selectedDay: agenda.selectedDay,
    onSelecionarSlot: handleSelecionarSlot,
    onCancel: exitModoAgendamento,
    onSuccess: handleModoSuccess,
    abrirConfirmacaoForaDisp: agenda.abrirConfirmacaoForaDisp,
  };

  const calendarAgenda = useMemo(
    () => (ehProfissionalClinico ? { ...agenda, ...viewAgenda } : agenda),
    [agenda, viewAgenda, ehProfissionalClinico],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 font-sans text-ink-900 lg:gap-2">
      {ehProfissionalClinico && !modoAgendamento ? (
        <SoloKpiHeader
          profissionalNome={profissionalNome}
          roleNome={roleNome}
          dayRows={viewAgenda.selectedDayAppointments || []}
        />
      ) : null}

      {!modoAgendamento ? (
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
      ) : null}

      {agenda.error ? (
        <div className="mx-[22px] shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[12px] font-bold text-amber-900">
          {agenda.error}
        </div>
      ) : null}

      <div className={`mx-[22px] shrink-0 ${agendaEnterClass(showEntrance, 'agenda-delay-150')}`}>
        {modoAgendamento ? (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ModoAgendamentoSeletores
                modo={modoAgendamento}
                onChange={setModoAgendamento}
                ehProfissionalClinico={ehProfissionalClinico}
                usuarioLogado={{ roleUserId, roleNome }}
                equipeList={agenda.equipeList}
                equipeLoading={agenda.equipeLoading}
                procedimentoOptions={agenda.procedimentoOptions}
              />
            </div>
            <button
              type="button"
              onClick={exitModoAgendamento}
              title="Sair do modo agendamento (Esc)"
              className="mt-1 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F6FA] text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <AgendaControlStrip
            statusFilters={agenda.statusFilters}
            onToggleStatus={agenda.toggleStatusFilter}
            onToggleAll={agenda.toggleAllStatusFilters}
            statusCounts={agenda.statusFilterCounts}
            nextAppointment={nextAppointment}
            monthVisibleCount={calendarAgenda.monthVisibleCount ?? 0}
            firstFilterRef={firstFilterRef}
          />
        )}
      </div>

      {!modoAgendamento ? (
        <AgendaWeekStrip
          weekDayIsos={agenda.weekDayIsos}
          selectedDay={agenda.selectedDay}
          todayIso={agenda.todayIso}
          appointmentsByDate={viewAgenda.appointmentsByDate}
          onSelectDay={(iso) => handleSelectDay(iso, true)}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:max-[1199px]:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] min-[1200px]:max-[1439px]:grid-cols-[minmax(0,1.1fr)_minmax(360px,400px)] min-[1440px]:grid-cols-[minmax(0,7fr)_minmax(400px,460px)]">
        <section
          className={`relative flex min-h-0 flex-col overflow-hidden md:max-lg:shrink-0 ${
            agenda.viewMode === 'grid'
              ? 'flex-1 border-0 bg-transparent p-0 shadow-none min-h-0'
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
                agenda={calendarAgenda}
                showEntrance={showEntrance}
                onSelectDay={handleSelectDay}
                isNivel1={agenda.isNivel1}
                onBloquear={railProps.onBloquear}
                onNovoAgendamento={railProps.onNovoAgendamento}
              />
            ) : agenda.viewMode === 'list' ? (
              <ListDayCards agenda={calendarAgenda} onOpenDaySummary={setListDaySummary} className="h-full" />
            ) : (
              <WeekTimeGrid
                className="h-full"
                weekDayIsos={agenda.weekDayIsos}
                appointments={viewAgenda.filteredWeekGridAppointments}
                todayIso={agenda.todayIso}
                onOpenSlotDetail={setWeekSlotDetail}
                onClickEmptySlot={agenda.isNivel1 || modoAgendamento ? null : openWeekCreateAtSlot}
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
          {modoAgendamento ? (
            <ModoAgendamentoPanel {...modoPanelProps} />
          ) : (
            <AgendaDayRail {...railProps} />
          )}
        </aside>
      </div>

      {isMobile ? (
        <AgendaDaySheet open={agenda.daySheetOpen} onClose={closeDaySheet}>
          {modoAgendamento ? (
            <ModoAgendamentoPanel {...modoPanelProps} compact />
          ) : (
            <AgendaDayRail {...railProps} compact />
          )}
        </AgendaDaySheet>
      ) : null}

      <AgendaKbdHint showEntrance={showEntrance} />

      {!agenda.isNivel1 && !agenda.daySheetOpen && !modoAgendamento ? (
        <button
          type="button"
          onClick={() => enterModoNovo({ dataInicial: agenda.todayIso })}
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
