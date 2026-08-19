import React from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { formatLongDate } from './useAgendaPage';
import { WeekTimeGrid } from './WeekTimeGrid';
import AgendaSlotActions from './AgendaSlotActions.jsx';
import { AgendaSummaryEntryCard } from './AgendaSummaryEntryCard.jsx';
import { AgendaWeekSlotDetailModal } from './AgendaWeekSlotDetailModal.jsx';
import { AgendaAdvanceConfirmModal } from './AgendaAdvanceConfirmModal.jsx';
import { AgendaNovoChoiceModal } from './AgendaNovoChoiceModal.jsx';
import { ModalEscolhaAssinatura } from '../assinaturas/ModalEscolhaAssinatura.jsx';
import { SolicitarAnamneseModal } from '../anamnese/SolicitarAnamneseModal.jsx';
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
import { toDateKey } from '../../utils/agendaDateUtils.js';
import {
  applyGroupActionAndRefresh,
  formatGroupActionResultMessage,
  resolveActionAppointments,
  resolveActionTargetFromDayAppointments,
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 lg:gap-4">
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

export function AgendaDashboard({
  agenda,
  patients = [],
  onStartAttendance,
  onSlotCancelar,
  onSlotReagendar,
  clinicaNome = 'Procedi',
  clinicaSlug = '',
  profissionalNome = '',
  shortcutsBlocked: shortcutsBlockedExternal = false,
}) {
  const panelListRef = React.useRef(null);
  const cardRefs = React.useRef({});
  const firstFilterRef = React.useRef(null);
  const [listDaySummary, setListDaySummary] = React.useState(null);
  const [weekSlotDetail, setWeekSlotDetail] = React.useState(null);
  const [advancePending, setAdvancePending] = React.useState(null);
  const [novoChoiceOpen, setNovoChoiceOpen] = React.useState(false);
  const [showEntrance, setShowEntrance] = React.useState(true);
  const [anamneseEscolhaOpen, setAnamneseEscolhaOpen] = React.useState(false);
  const [anamneseSolicitacao, setAnamneseSolicitacao] = React.useState(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = !isDesktop;
  const toast = useToast();

  const closeDaySheet = React.useCallback(() => {
    agenda.closeDaySheet();
  }, [agenda]);

  const openNovoChoice = React.useCallback(() => {
    if (agenda.isNivel1) return;
    setNovoChoiceOpen(true);
  }, [agenda.isNivel1]);

  const closeNovoChoice = React.useCallback(() => {
    setNovoChoiceOpen(false);
  }, []);

  const handleEscolherAgendamento = React.useCallback(() => {
    setNovoChoiceOpen(false);
    agenda.openCreateModal(agenda.selectedDay);
  }, [agenda]);

  const handleEscolherBloqueio = React.useCallback(() => {
    setNovoChoiceOpen(false);
    agenda.openBloqueioModal(agenda.selectedDay);
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
          advancePending ||
          novoChoiceOpen,
      ),
    [
      shortcutsBlockedExternal,
      agenda.modalMode,
      agenda.bloqueioModalOpen,
      agenda.foraDispModal,
      listDaySummary,
      weekSlotDetail,
      advancePending,
      novoChoiceOpen,
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
      if (!agenda.isNivel1) openNovoChoice();
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

  const nextAppointment = React.useMemo(() => {
    const entries = groupConsecutiveAppointments(todayAppointments);
    const nextEntry = getNextAppointmentEntry(entries, { todayIso: agenda.todayIso });
    return getEntryPrimaryAppointment(nextEntry);
  }, [todayAppointments, agenda.todayIso]);

  const handleAdvanceClick = React.useCallback((appointment, offer) => {
    if (!appointment || !offer?.targetHoraInicio || agenda.isNivel1) return;
    setAdvancePending({ appointment, targetHoraInicio: offer.targetHoraInicio });
  }, [agenda.isNivel1]);

  const handleEnviarAnamnese = React.useCallback(
    (appointment) => {
      const patient = patients.find((item) => samePatient(item, appointment));
      const pacienteId = patient?.id || appointment?.pacienteId;
      if (!pacienteId) {
        toast.error('Não foi possível identificar o paciente deste agendamento.');
        return;
      }
      if (!clinicaSlug) {
        toast.error('Para enviar a anamnese, primeiro configure o identificador (slug) da clínica em Configurações > Anamnese.');
        return;
      }
      const phone = patient?.whatsapp || patient?.telefone || appointment?.pacienteTelefone;
      const name = patient?.nomeCompleto || patient?.nome || appointment?.pacienteNome || 'Paciente';
      const cpf = patient?.cpf || appointment?.pacienteCpf || '';
      setAnamneseSolicitacao({
        pacienteId: String(pacienteId),
        telefonePaciente: phone || '',
        pacienteNome: name,
        pacienteCpf: cpf,
      });
      setAnamneseEscolhaOpen(true);
    },
    [patients, clinicaSlug, toast]
  );

  const handleEscolherAnamneseQr = React.useCallback(() => {
    setAnamneseEscolhaOpen(false);
    setAnamneseSolicitacao((curr) => (curr ? { ...curr, escolha: { metodoCodigo: 'DISPOSITIVO_PROPRIO_LOCAL', canalCodigo: null } } : curr));
  }, []);

  const handleEscolherAnamneseWhatsApp = React.useCallback(() => {
    if (!anamneseSolicitacao?.telefonePaciente) {
      toast.error('Paciente sem telefone cadastrado.');
      return;
    }
    setAnamneseEscolhaOpen(false);
    setAnamneseSolicitacao((curr) => (curr ? { ...curr, escolha: { metodoCodigo: 'DISPOSITIVO_PROPRIO_REMOTO', canalCodigo: 'WHATSAPP' } } : curr));
  }, [anamneseSolicitacao, toast]);

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

  const batchRefresh = agenda.refreshDashboard;

  const renderSlotActions = React.useCallback(
    (target, { closeOverlay } = {}) => {
      const items = resolveActionAppointments(target);
      const primary = items[0];
      if (!primary) return null;
      const disabled = Boolean(agenda.loading) || agenda.isNivel1;
      const isGroup = items.length > 1;
      const batchOpts = { successToast: false, skipDashboardRefresh: true };

      return (
        <AgendaSlotActions
          agenda={primary}
          disabled={disabled}
          onMarcarRealizado={async () => {
            if (isGroup) {
              const result = await applyGroupActionAndRefresh(
                items,
                (item) =>
                  item.agendaId
                    ? agenda.handleAtualizarStatus(item.agendaId, 'realizado', batchOpts)
                    : Promise.resolve(false),
                batchRefresh,
              );
              if (result.allOk) toast.success(`${items.length} agendamentos marcados como realizados`);
              else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'realizadas' }));
              return;
            }
            if (primary.agendaId) agenda.handleAtualizarStatus(primary.agendaId, 'realizado');
          }}
          onMarcarNaoCompareceu={async () => {
            if (isGroup) {
              const result = await applyGroupActionAndRefresh(
                items,
                (item) =>
                  item.agendaId
                    ? agenda.handleMarcarNaoCompareceu(item.agendaId, batchOpts)
                    : Promise.resolve(false),
                batchRefresh,
              );
              if (result.allOk) toast.success(`${items.length} agendamentos marcados como não compareceu`);
              else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'marcadas' }));
              return;
            }
            if (primary.agendaId) agenda.handleMarcarNaoCompareceu(primary.agendaId);
          }}
          onReagendar={() => {
            closeOverlay?.();
            onSlotReagendar?.(items.length > 1 ? target : primary);
          }}
          onCancelar={() => {
            closeOverlay?.();
            onSlotCancelar?.(items.length > 1 ? target : primary);
          }}
          onEnviarWhatsApp={async () => {
            if (isGroup) {
              const result = await applyGroupActionAndRefresh(
                items,
                (item) =>
                  item.agendaId
                    ? agenda.handleEnviarWhatsApp(item.agendaId, 'confirmacao_24h')
                    : Promise.resolve(false),
                batchRefresh,
              );
              if (result.allOk) toast.success(`WhatsApp gerado para ${items.length} agendamentos`);
              else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'enviadas' }));
              return;
            }
            if (primary.agendaId) agenda.handleEnviarWhatsApp(primary.agendaId, 'confirmacao_24h');
          }}
          onEnviarAnamnese={() => handleEnviarAnamnese(primary)}
          onRemoverBloqueio={() => agenda.handleRemoverBloqueio(primary)}
        />
      );
    },
    [agenda, batchRefresh, onSlotCancelar, onSlotReagendar, toast, handleEnviarAnamnese],
  );

  const handlePrimary = React.useCallback((target) => {
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
        const result = await applyGroupActionAndRefresh(
          pending,
          (item) => agenda.handleAtualizarStatus(item.agendaId, 'confirmado', { successToast: false, skipDashboardRefresh: true }),
          agenda.refreshDashboard,
        );
        if (result.allOk) toast.success(`${pending.length} agendamentos confirmados`);
        else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'confirmadas' }));
      })();
      return;
    }

    if (appointment.status === 'cancelado') {
      onSlotReagendar?.(scheduleRowFromTarget(target) || appointment);
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
        tipoProcedimentoCodigo:
          appointment.tipoProcedimentoCodigo ?? appointment.rawSlot?.tipoProcedimentoCodigo ?? '',
        procedimentoFeitoOrigemId:
          appointment.procedimentoFeitoOrigemId ?? appointment.rawSlot?.procedimentoFeitoOrigemId ?? null,
        isAgendaRetorno:
          String(appointment.tipoProcedimentoCodigo ?? appointment.rawSlot?.tipoProcedimentoCodigo ?? '')
            .toLowerCase() === 'retorno',
        planejamentoItemId: appointment.planejamentoItemId ?? null,
        lote: items.map(a => ({
          agendaId: a.id || a.agendaId,
          procedimentoNome: a.tipoProcedimento?.nome || a.procedimentoNome,
          catalogoProcedimentoSaudeId: a.catalogoProcedimentoSaudeId,
          planejamentoItemId: a.planejamentoItemId ?? null,
        })),
      });
      return;
    }
    window.alert('Para iniciar atendimento, vincule este agendamento a um paciente cadastrado no sistema.');
  }, [agenda, onSlotReagendar, onStartAttendance, patients, toast]);

  const resolveWeekTarget = React.useCallback(
    (appt) => {
      if (!appt) return null;
      if (appt.kind === 'group' || appt.kind === 'single') return appt;
      const targetDate = toDateKey(appt.data || appt.dataAgendamento || appt.date);
      const dayRows = (agenda.filteredWeekGridAppointments || []).filter(
        (r) => toDateKey(r.data) === targetDate,
      );
      if (dayRows.length > 0) {
        const resolved = resolveActionTargetFromDayAppointments(dayRows, appt);
        if (resolved) return resolved;
      }
      if (Array.isArray(appt.appointments)) return { kind: 'group', ...appt };
      return { kind: 'single', appointment: appt };
    },
    [agenda.filteredWeekGridAppointments],
  );

  const onOpenWeekSlotDetail = React.useCallback(
    (appt) => {
      setWeekSlotDetail(resolveWeekTarget(appt));
    },
    [resolveWeekTarget],
  );

  const closeWeekSlotDetail = React.useCallback(() => {
    setWeekSlotDetail(null);
  }, []);

  const handleWeekPrimary = React.useCallback(
    (target) => {
      const items = resolveActionAppointments(target);
      const hasPending = items.some(
        (item) => item.status === 'pendente' || item.status === 'aguardando_confirmacao',
      );
      if (!hasPending) closeWeekSlotDetail();
      handlePrimary(target);
    },
    [closeWeekSlotDetail, handlePrimary],
  );

  const renderSlotActionsForWeek = React.useCallback(
    (target) => renderSlotActions(target, { closeOverlay: closeWeekSlotDetail }),
    [closeWeekSlotDetail, renderSlotActions],
  );

  const openWeekCreateAtSlot = React.useCallback(
    (iso, horaHm) => {
      setWeekSlotDetail(null);
      agenda.openCreateModalAtSlot(iso, horaHm);
    },
    [agenda]
  );

  const handleRailConfirmar = React.useCallback(
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
      const result = await applyGroupActionAndRefresh(
        toConfirm,
        (item) => agenda.handleAtualizarStatus(item.agendaId, 'confirmado', { successToast: false, skipDashboardRefresh: true }),
        agenda.refreshDashboard,
      );
      if (result.allOk) toast.success(`${toConfirm.length} agendamentos confirmados`);
      else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'confirmadas' }));
    },
    [agenda, toast],
  );

  const handleCheckIn = React.useCallback(
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

  const handleRailIniciarAtendimento = React.useCallback(
    (target) => {
      handlePrimary(target);
    },
    [handlePrimary],
  );

  const handleRailCancelar = React.useCallback(
    (target) => {
      const row = scheduleRowFromTarget(target);
      onSlotCancelar?.(row || target);
    },
    [onSlotCancelar],
  );

  const handleRailReagendar = React.useCallback(
    (target) => {
      const row = scheduleRowFromTarget(target);
      onSlotReagendar?.(row || target);
    },
    [onSlotReagendar],
  );

  const handleRailWhatsApp = React.useCallback(
    async (target) => {
      const items = resolveActionAppointments(target);
      if (items.length <= 1) {
        const a = items[0];
        if (a?.agendaId) agenda.handleEnviarWhatsApp(a.agendaId, 'confirmacao_24h');
        return;
      }
      const result = await applyGroupActionAndRefresh(
        items,
        (item) =>
          item.agendaId ? agenda.handleEnviarWhatsApp(item.agendaId, 'confirmacao_24h') : Promise.resolve(false),
        agenda.refreshDashboard,
      );
      if (result.allOk) toast.success(`WhatsApp gerado para ${items.length} agendamentos`);
      else if (result.partial) toast.error(formatGroupActionResultMessage(result, { verb: 'enviadas' }));
    },
    [agenda, toast],
  );

  const handleRailAnamnese = React.useCallback(
    (target) => {
      const items = resolveActionAppointments(target);
      if (items.length > 0) {
        handleEnviarAnamnese(items[0]);
      }
    },
    [handleEnviarAnamnese]
  );

  const railProps = {
    selectedDay: agenda.selectedDay,
    appointments: agenda.selectedDayAppointments,
    todayIso: agenda.todayIso,
    showProfissional,
    isNivel1: agenda.isNivel1,
    dense: isDesktop,
    compactActions: isDesktop,
    listRef: panelListRef,
    cardRefs,
    advanceOfferByAgendaId,
    onAdvanceClick: agenda.isNivel1 ? null : handleAdvanceClick,
    onNovoClick: openNovoChoice,
    onCheckIn: handleCheckIn,
    onConfirmar: handleRailConfirmar,
    onIniciarAtendimento: handleRailIniciarAtendimento,
    onWhatsApp: handleRailWhatsApp,
    onEnviarAnamnese: handleRailAnamnese,
    onReagendar: handleRailReagendar,
    onCancelar: handleRailCancelar,
    onRemoverBloqueio: agenda.handleRemoverBloqueio,
    onOpenSlotDetail: onOpenWeekSlotDetail,
    submittingRemoverBloqueioId: agenda.submittingRemoverBloqueioId,
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 font-sans text-ink-900 lg:gap-2">
      <div className={agendaEnterClass(showEntrance, 'agenda-delay-100')}>
        <AgendaTopbar
          clinicaNome={clinicaNome}
          profissionalNome={profissionalNome}
          viewMode={agenda.viewMode}
          onChangeViewMode={agenda.setViewMode}
          onSyncWeekFromSelection={agenda.syncWeekFromSelection}
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <section
          className={`relative flex min-h-0 flex-col overflow-hidden md:max-lg:shrink-0 lg:min-w-0 lg:flex-1 ${
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
                onNovoClick={openNovoChoice}
                showNovoButton={!agenda.isNivel1}
              />
            ) : agenda.viewMode === 'list' ? (
              <ListDayCards agenda={agenda} onOpenDaySummary={setListDaySummary} className="h-full" />
            ) : (
              <WeekTimeGrid
                className="h-full"
                weekDayIsos={agenda.weekDayIsos}
                appointments={agenda.filteredWeekGridAppointments}
                todayIso={agenda.todayIso}
                onOpenSlotDetail={onOpenWeekSlotDetail}
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

        <aside className={`hidden min-h-0 shrink-0 lg:flex lg:w-[380px] lg:flex-col min-[1200px]:w-[440px] min-[1440px]:w-[480px] 4xl:w-[520px] ${agendaEnterClass(showEntrance, 'agenda-delay-250')}`}>
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
          onClick={openNovoChoice}
          className="fixed bottom-24 right-4 z-[200] flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-all duration-150 hover:bg-brand-primaryDark hover:shadow-xl active:scale-[0.98] motion-reduce:active:scale-100 lg:hidden"
          aria-label="Novo"
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}

      <DaySummaryModal
        group={listDaySummary}
        onClose={() => setListDaySummary(null)}
        onPrimary={handlePrimary}
        renderSlotActions={renderSlotActions}
        isNivel1={agenda.isNivel1}
        advanceOfferByAgendaId={listDayAdvanceOffers}
        onAdvanceClick={agenda.isNivel1 ? null : handleAdvanceClick}
      />

      <AgendaWeekSlotDetailModal
        target={weekSlotDetail}
        onClose={closeWeekSlotDetail}
        onPrimary={handleWeekPrimary}
        renderSlotActions={renderSlotActionsForWeek}
        isNivel1={agenda.isNivel1}
        advanceOfferByAgendaId={advanceOfferByAgendaId}
        onAdvanceClick={agenda.isNivel1 ? null : handleAdvanceClick}
      />

      <AgendaAdvanceConfirmModal
        appointment={advancePending?.appointment}
        targetHoraInicio={advancePending?.targetHoraInicio}
        onClose={() => setAdvancePending(null)}
        onConfirm={handleConfirmAdvance}
        isSubmitting={agenda.submittingReagendar}
      />

      <AgendaNovoChoiceModal
        open={novoChoiceOpen}
        onClose={closeNovoChoice}
        onEscolherAgendamento={handleEscolherAgendamento}
        onEscolherBloqueio={handleEscolherBloqueio}
      />

      <ModalEscolhaAssinatura
        open={anamneseEscolhaOpen}
        onClose={() => {
          setAnamneseEscolhaOpen(false);
          setAnamneseSolicitacao(null);
        }}
        opcoes={{ tablet: false, qrCode: true, link: true }}
        onSelectQrCode={handleEscolherAnamneseQr}
        onSelectLink={handleEscolherAnamneseWhatsApp}
      />

      <SolicitarAnamneseModal
        open={Boolean(anamneseSolicitacao?.escolha)}
        escolha={anamneseSolicitacao?.escolha}
        payload={anamneseSolicitacao}
        onClose={() => setAnamneseSolicitacao(null)}
        onCancelar={() => {
          setAnamneseSolicitacao((curr) => (curr ? { ...curr, escolha: undefined } : null));
          setAnamneseEscolhaOpen(true);
        }}
        onConcluido={() => setAnamneseSolicitacao(null)}
      />
    </div>
  );
}

