import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  Play,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';
import { PatientStatusIconBadge } from './PatientStatusIconBadge.jsx';
import { getPatientCardStatuses } from './patientListStatusConfig.js';
import { KpiCards } from './KpiCards.jsx';
import { PulseSidebar } from './PulseSidebar.jsx';
import { PatientsTodayStrip } from './PatientsTodayStrip.jsx';
import { PatientFiltersSheet } from './PatientFiltersSheet.jsx';
import { PatientFiltersPopover } from './PatientFiltersPopover.jsx';
import { PatientActiveFilterChips } from './PatientActiveFilterChips.jsx';
import {
  countActivePatientFilters,
  applyPatientQuickFilter,
  clearAllPatientFilters,
  resolveActiveKpiCardFromFilters,
  activateFilterByKpiCardId,
  deactivateFilterByKpiCardId,
} from './patientListFilters.js';
import { PatientListPagination } from './PatientListPagination.jsx';
import { usePapel } from '../../hooks/usePapel';
import { anamneseApi, procedimentosApi } from '../../services/api';
import {
  ProcedureTimelineHeading,
  ProcedureTimelineLoading,
  ProcedureTimelineRail,
  ProcedureTimelineEntry,
  ProcedureTimelinePreviewCard,
} from './ProcedureTimelineBlock.jsx';
import { sortProcedimentosPorCriadoEmDesc } from './procedureTimelineUtils.js';
import { lastProcedureDateForCard, lastProcedureLabel } from '../../utils/patientLastProcedure.js';

function hasClinicalAlert(p) {
  return Boolean(String(p?.alergias || '').trim() || String(p?.condicoesSaude || '').trim());
}


const SORT_OPTIONS = [
  { value: 'nome-asc', label: 'Nome (A–Z)' },
  { value: 'nome-desc', label: 'Nome (Z–A)' },
  { value: 'idade-asc', label: 'Idade (menor)' },
  { value: 'idade-desc', label: 'Idade (maior)' },
  { value: 'visita-desc', label: 'Última visita (recente)' },
  { value: 'visita-asc', label: 'Última visita (antiga)' },
  { value: 'birthday-asc', label: 'Aniversário (mais próximo)' },
];

function applyQuickFilter(items, filter) {
  return applyPatientQuickFilter(items, filter);
}

const PATIENT_CARD_MAX_STATUS_BADGES = 3;

function PatientListCard({ patient, selected, onSelect, getPatientInitials }) {
  const clinical = hasClinicalAlert(patient);
  const lastProc = lastProcedureLabel(patient);
  const lastProcDate = lastProcedureDateForCard(patient);
  const cardStatuses = getPatientCardStatuses(patient);
  const visibleStatuses = cardStatuses.slice(0, PATIENT_CARD_MAX_STATUS_BADGES);
  const hiddenStatusCount = Math.max(0, cardStatuses.length - visibleStatuses.length);

  const mutedInfoParts = [
    patient.idade != null ? `${patient.idade} anos` : null,
    lastProc !== '—' ? lastProc : null,
  ].filter(Boolean);

  const hasLastVisitDate = lastProcDate !== '—' && lastProcDate !== '-';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border-0 px-4 py-3 text-left shadow-none transition-colors duration-100 sm:min-h-[72px] sm:gap-4 sm:px-5 sm:py-3.5 md:gap-5 md:min-h-[76px] lg:min-h-[80px] lg:gap-3 lg:px-4 lg:py-3 ${
        selected
          ? 'bg-emerald-50/70 ring-2 ring-inset ring-[#00a88e]/35 hover:bg-emerald-50/70'
          : 'bg-white hover:bg-slate-50'
      }`}
    >
      <PatientAvatar
        patient={patient}
        getPatientInitials={getPatientInitials}
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-[#e6f7f5] sm:h-11 sm:w-11 lg:h-12 lg:w-12"
        initialsClassName="text-[12px] font-bold sm:text-[13px] lg:text-sm"
        spinnerClassName="h-4 w-4 lg:h-[18px] lg:w-[18px]"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p
          className="min-w-0 w-full truncate text-[14px] font-semibold leading-snug text-[#0f172a] sm:text-[15px] md:text-[16px]"
          title={patient.nome}
        >
          {patient.nome}
        </p>
        {mutedInfoParts.length > 0 || hasLastVisitDate ? (
          <p className="mt-1 text-[13px] text-[#64748b] sm:mt-1.5 sm:text-[14px] md:text-[15px]">
            {mutedInfoParts.map((part, idx) => (
              <React.Fragment key={`muted-${patient.id}-${idx}`}>
                {idx > 0 ? ' · ' : ''}
                {part}
              </React.Fragment>
            ))}
            {hasLastVisitDate ? (
              <>
                {mutedInfoParts.length > 0 ? ' · ' : ''}
                Última visita ·{' '}
                <span className="font-semibold text-[#00a88e]">{lastProcDate}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {/* Ícones de status (ordem por importância, definida em patientListStatusConfig) */}
        {visibleStatuses.length > 0 ? (
          <div className="flex items-center gap-1 sm:gap-1.5">
            {visibleStatuses.map((statusId) => (
              <PatientStatusIconBadge key={statusId} statusId={statusId} />
            ))}
            {hiddenStatusCount > 0 ? (
              <span
                className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] px-1.5 text-[11px] font-bold text-[#64748b] sm:h-8 sm:min-w-[2rem] sm:text-[12px]"
                title={`Mais ${hiddenStatusCount} status`}
              >
                +{hiddenStatusCount}
              </span>
            ) : null}
          </div>
        ) : null}
        {/* Alerta clínico: alergias / condições de saúde — sinal independente dos status acima */}
        {clinical ? (
          <span title="Alergias ou condições de saúde cadastradas">
            <ShieldAlert
              className="h-4 w-4 text-orange-400 sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5"
              strokeWidth={2}
              aria-hidden
            />
          </span>
        ) : null}
        <span
          className={`hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[12px] xl:inline-flex xl:text-[13px] ${
            selected
              ? 'border-[#6ee7c8] bg-emerald-50 text-[#047857]'
              : 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e]'
          }`}
        >
          Ver mais
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 lg:h-[18px] lg:w-[18px] ${selected ? 'text-[#00a88e]' : 'text-[#14b8a6]'}`}
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </div>
    </button>
  );
}

function PatientPreviewPanel({
  selectedPatient,
  detailTitleId,
  closeDetail,
  getPatientInitials,
  setPatientDetailTab,
  setPatientView,
  shellClassName,
  previewProcedures = [],
  loadingPreviewProcedures = false,
  onStartAttendance,
  previewAnamneseLoading = false,
  captureProfileNavSnapshot,
}) {
  const { isNivel1, canSeeProntuario, canStartAnamnese } = usePapel();

  /** Origem ordenada mais recentes primeiro — API ou legado `{ data, nome, … }`. */
  const procedureSourceSorted = useMemo(() => {
    const raw =
      previewProcedures.length > 0 ? previewProcedures : (selectedPatient.procedures || []);
    return sortProcedimentosPorCriadoEmDesc(raw);
  }, [previewProcedures, selectedPatient.procedures]);

  /** Linhas já formatadas pt-BR; mesma ordem que `procedureSourceSorted`. */
  const timelineRows = useMemo(
    () =>
      procedureSourceSorted.map((proc) => ({
        data: proc.criadoEm
          ? new Date(proc.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          : proc.data != null
            ? String(proc.data).trim() || '-'
            : '-',
        hora: proc.criadoEm
          ? new Date(proc.criadoEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })
          : proc.hora != null
            ? String(proc.hora).trim()
            : '',
        nome: proc.procedimentoNome || proc.nome || 'Procedimento',
        profissional: proc.profissionalNome || proc.profissional || '—',
      })),
    [procedureSourceSorted],
  );

  const PREVIEW_TIMELINE_MAX = 3;
  const previewTimelineTruncated = timelineRows.length > PREVIEW_TIMELINE_MAX;

  const goToPacienteProntuario = () => {
    if (!canSeeProntuario) return;
    if (selectedPatient?.cpf) captureProfileNavSnapshot?.(selectedPatient.cpf);
    setPatientDetailTab('prontuario');
    setPatientView('profile');
  };

  const handleIniciarAtendimentoClick = () => {
    if (!canStartAnamnese || previewAnamneseLoading || typeof onStartAttendance !== 'function') return;
    onStartAttendance(selectedPatient);
  };

  return (
    <div
      className={`relative flex w-full min-w-0 flex-col gap-4 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-lg ${shellClassName}`}
    >
      <button
        type="button"
        onClick={closeDetail}
        className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:text-[#0f172a]"
        aria-label="Fechar painel"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>

      <div className="flex w-full min-w-0 flex-wrap items-start gap-3 border-b border-[#f1f5f9] pb-4 pr-12 sm:pr-24 lg:pr-[7.25rem]">
        <PatientAvatar
          patient={selectedPatient}
          getPatientInitials={getPatientInitials}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#e6f7f5]"
          initialsClassName="text-[11px] font-bold"
          spinnerClassName="h-4 w-4"
        />
        <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
          <h3 id={detailTitleId} className="text-[16px] font-bold leading-snug text-[#0f172a] break-words">
            {selectedPatient.nome}
          </h3>
          {selectedPatient.email ? (
            <p className="mt-1 text-[13px] font-normal text-[#64748b] break-all">{selectedPatient.email}</p>
          ) : null}
          <p className={`text-[13px] font-normal text-[#64748b] ${selectedPatient.email ? 'mt-0.5' : 'mt-1'}`}>
            {selectedPatient.telefone || '—'}
          </p>
        </div>
        {canStartAnamnese && (
          <div className="flex w-full shrink-0 flex-col items-stretch justify-start sm:ml-auto sm:w-auto sm:max-w-[13rem] sm:items-end">
            <button
              type="button"
              onClick={handleIniciarAtendimentoClick}
              disabled={previewAnamneseLoading || typeof onStartAttendance !== 'function'}
              className="flex min-h-[48px] w-full flex-row items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-3 py-2 text-[13px] font-semibold leading-snug text-white transition-colors hover:bg-[#00967f] active:bg-[#00967f] disabled:pointer-events-none disabled:opacity-60 sm:min-h-[44px] sm:w-auto sm:max-w-full sm:px-3.5 sm:text-[12px] sm:leading-tight"
            >
              {previewAnamneseLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2.25} aria-hidden />
              ) : (
                <Play className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              )}
              <span className="min-w-0 whitespace-normal text-center sm:text-right">Iniciar Atendimento</span>
            </button>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <ProcedureTimelineHeading title="Linha do Tempo de Procedimentos" />
        {!canSeeProntuario ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Shield className="h-5 w-5" />
            </div>
            <h4 className="mt-2 text-sm font-bold text-slate-800">Visualização Limitada</h4>
            <p className="mt-1 text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
              Você não possui permissão para ver os procedimentos deste paciente.
            </p>
          </div>
        ) : loadingPreviewProcedures ? (
          <ProcedureTimelineLoading message="Carregando procedimentos…" />
        ) : timelineRows.length > 0 ? (
          <ProcedureTimelineRail>
            {(previewTimelineTruncated ? timelineRows.slice(0, PREVIEW_TIMELINE_MAX) : timelineRows).map(
              (proc, idx, arr) => {
                const fusedTail = previewTimelineTruncated && idx === arr.length - 1;
                const key =
                  fusedTail ? `preview-proc-tail-${idx}` : `${idx}-${proc.data}-${proc.nome}-${proc.profissional}`;
                return (
                  <ProcedureTimelineEntry key={key}>
                    <ProcedureTimelinePreviewCard
                      dateLabel={proc.data}
                      timeLabel={proc.hora}
                      procedureName={proc.nome}
                      professionalName={proc.profissional || '—'}
                      fusedVerMais={fusedTail}
                      verMaisLabel="Ver mais"
                      onPress={goToPacienteProntuario}
                    />
                  </ProcedureTimelineEntry>
                );
              },
            )}
          </ProcedureTimelineRail>
        ) : (
          <p className="py-6 text-center text-[13px] font-normal text-[#64748b]">Nenhum procedimento registrado</p>
        )}
      </div>

      <div className="max-lg:pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            if (selectedPatient?.cpf) captureProfileNavSnapshot?.(selectedPatient.cpf);
            setPatientDetailTab('planos');
            setPatientView('profile');
          }}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f]"
        >
          <ExternalLink className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.25} />
          {isNivel1 ? 'Ver Cadastro do Paciente' : 'Ver Visão Geral Completa do Paciente'}
        </button>
      </div>
    </div>
  );
}

export function PatientsListView({
  patients,
  patientListItems = [],
  patientListPage: _patientListPage,
  setPatientListPage,
  patientListLoading = false,
  patientListMeta,
  patientListSortBy,
  setPatientListSortBy,
  patientSearchQuery,
  setPatientSearchQuery,
  selectedPatientCpf,
  setSelectedPatientCpf,
  setPatientDetailTab,
  setPatientView,
  getPatientInitials,
  onCreatePatient,
  onStartAttendance,
  isRecepcionista: _isRecepcionista,
  statusPlanoFilter = '',
  setStatusPlanoFilter,
  anamneseDesatualizadaFilter = false,
  setAnamneseDesatualizadaFilter,
  semRetornoFilter = false,
  setSemRetornoFilter,
  ehNovoFilter = false,
  setEhNovoFilter,
  ehAniversarianteFilter = false,
  setEhAniversarianteFilter,
  kpi,
  kpiLoading = false,
  nomeUsuario = '',
  onNavigateToAgenda,
  patientQuickFilter = 'todos',
  setPatientQuickFilter,
  captureProfileNavSnapshot,
}) {
  const { isNivel1: _isNivel1, canCreatePacientes } = usePapel();
  /** Filtros server-side ficam desabilitados enquanto houver texto de busca (rota /search não os suporta). */
  const isSearching = Boolean(patientSearchQuery?.trim());
  /** Abre o resumo lateral/modal só após clique na lista — não reutiliza seleção da jornada. */
  const [previewPatientCpf, setPreviewPatientCpf] = useState(null);
  /** Paciente vindo da sidebar quando ainda não está na página atual da lista. */
  const [previewPatientSeed, setPreviewPatientSeed] = useState(null);
  const quickFilter = patientQuickFilter;
  const setQuickFilter = setPatientQuickFilter ?? (() => {});
  const [activeKpiCard, setActiveKpiCard] = useState(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const filterButtonRef = useRef(null);
  const desktopTitleId = 'patient-detail-title';
  const [previewProcedures, setPreviewProcedures] = useState([]);
  const [loadingPreviewProcedures, setLoadingPreviewProcedures] = useState(false);
  /** Paciente cujo fetch de anamnese do preview terminou; `null` = nenhum / resetado. */
  const [previewAnamneseListOwnerId, setPreviewAnamneseListOwnerId] = useState(null);
  const activeFiltersCount = useMemo(
    () =>
      countActivePatientFilters({
        isSearching,
        patientListSortBy,
        statusPlanoFilter,
        anamneseDesatualizadaFilter,
        semRetornoFilter,
        ehNovoFilter,
        ehAniversarianteFilter,
        quickFilter,
      }),
    [
      isSearching,
      patientListSortBy,
      statusPlanoFilter,
      anamneseDesatualizadaFilter,
      semRetornoFilter,
      ehNovoFilter,
      ehAniversarianteFilter,
      quickFilter,
    ]
  );
  const filterCtx = useMemo(
    () => ({
      isSearching,
      patientListSortBy,
      statusPlanoFilter,
      setStatusPlanoFilter,
      anamneseDesatualizadaFilter,
      setAnamneseDesatualizadaFilter,
      semRetornoFilter,
      setSemRetornoFilter,
      ehNovoFilter,
      setEhNovoFilter,
      ehAniversarianteFilter,
      setEhAniversarianteFilter,
      quickFilter,
      setQuickFilter,
    }),
    [
      isSearching,
      patientListSortBy,
      statusPlanoFilter,
      setStatusPlanoFilter,
      anamneseDesatualizadaFilter,
      setAnamneseDesatualizadaFilter,
      semRetornoFilter,
      setSemRetornoFilter,
      ehNovoFilter,
      setEhNovoFilter,
      ehAniversarianteFilter,
      setEhAniversarianteFilter,
      quickFilter,
      setQuickFilter,
    ]
  );

  const onFilterChange = () => {
    setActiveKpiCard(resolveActiveKpiCardFromFilters(filterCtx));
  };

  const handleActivateFilter = (cardId) => {
    if (activeKpiCard === cardId) {
      setActiveKpiCard(null);
      if (cardId === 'ativos') return;
      deactivateFilterByKpiCardId(filterCtx, cardId);
      return;
    }
    if (cardId === 'ativos') {
      clearAllPatientFilters(filterCtx);
      setActiveKpiCard('ativos');
      return;
    }
    activateFilterByKpiCardId(filterCtx, cardId);
    setActiveKpiCard(cardId);
  };

  const meta = patientListMeta || {
    first: true,
    last: true,
    totalPages: 0,
    number: 0,
  };

  const previewPatient =
    (previewPatientCpf &&
      (patientListItems.find((p) => p.cpf === previewPatientCpf) ||
        patients.find((p) => p.cpf === previewPatientCpf) ||
        (previewPatientSeed?.cpf === previewPatientCpf ? previewPatientSeed : null))) ||
    null;
  const previewPatientId = previewPatient?.id ?? null;

  /* eslint-disable react-hooks/set-state-in-effect -- reset ao fechar / carregar procedimentos do preview */
  useEffect(() => {
    if (!previewPatientId) {
      setPreviewProcedures([]);
      setLoadingPreviewProcedures(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingPreviewProcedures(true);
    procedimentosApi
      .byPaciente(previewPatientId)
      .then((data) => {
        if (!cancelled) setPreviewProcedures(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPreviewProcedures([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreviewProcedures(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewPatientId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Reset ao fechar o preview / lista por paciente (mesmo padrão do efeito de procedimentos acima). */
  /* eslint-disable react-hooks/set-state-in-effect -- branch síncrono ao trocar paciente ou fechar */
  useEffect(() => {
    if (!previewPatientId) {
      setPreviewAnamneseListOwnerId(null);
      return undefined;
    }
    let cancelled = false;
    anamneseApi
      .listPaciente(previewPatientId)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreviewAnamneseListOwnerId(previewPatientId);
      });
    return () => {
      cancelled = true;
    };
  }, [previewPatientId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const previewAnamneseLoading = Boolean(
    previewPatientId && previewAnamneseListOwnerId !== previewPatientId,
  );

  const filteredPatientListItems = applyQuickFilter(patientListItems, quickFilter);

  const closeDetail = () => {
    setPreviewPatientCpf(null);
    setPreviewPatientSeed(null);
    setSelectedPatientCpf(null);
    setPatientDetailTab('planos');
    setPreviewProcedures([]);
  };

  const openPatientPreview = (patient, { fromSidebar = false } = {}) => {
    if (!patient?.cpf) return;
    setSelectedPatientCpf(patient.cpf);
    setPreviewPatientCpf(patient.cpf);
    setPreviewPatientSeed(fromSidebar ? patient : null);
  };

  useEffect(() => {
    if (!previewPatient) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPreviewPatientCpf(null);
        setPreviewPatientSeed(null);
        setSelectedPatientCpf(null);
        setPatientDetailTab('planos');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewPatient, setSelectedPatientCpf, setPatientDetailTab]);

  useEffect(() => {
    if (!previewPatient) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewPatient]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="min-w-0 text-[22px] font-bold leading-tight text-[#0f172a] sm:text-2xl">
          Pacientes
        </h1>
      </div>

      <KpiCards
        kpi={kpi}
        loading={kpiLoading}
        activeCard={activeKpiCard}
        onActivateFilter={handleActivateFilter}
      />

      <PatientsTodayStrip kpi={kpi} loading={kpiLoading} />

      <div className="flex w-full min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-5">
        <div className="flex min-w-0 flex-1 flex-col lg:min-w-[min(100%,19rem)]">
          <div className="flex min-w-0 flex-col">
            {/* Header: search + chips + sort */}
            <div className="sticky top-0 z-10 bg-transparent">
              {/* < xl: busca full-width (coluna estreita com PulseSidebar/preview) */}
              <div className="px-4 pt-3 pb-2 xl:hidden">
                <div className="relative min-h-[44px] min-w-0">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, CPF ou telefone…"
                    className="h-11 min-h-[44px] w-full min-w-0 rounded-xl border border-[#e2e8f0] bg-white py-2 pl-9 pr-3 text-[16px] text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#00a88e]/50"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* xl+: busca + ordenação + filtros (wrap quando a coluna aperta) */}
              <div className="hidden w-full min-w-0 flex-row flex-wrap items-center gap-3 px-4 pt-3 pb-2 xl:flex">
                <div className="relative min-h-10 min-w-[12rem] w-full flex-1 basis-[min(100%,20rem)]">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, CPF ou telefone…"
                    className="h-10 w-full min-w-[12rem] rounded-xl border border-[#e2e8f0] bg-white py-2 pl-9 pr-3 text-[14px] text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#00a88e]/50"
                    autoComplete="off"
                  />
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                  <div className="relative flex h-10 shrink-0 items-center">
                  <ArrowUpDown
                    className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <label className="sr-only" htmlFor="patient-sort">
                    Ordenar lista
                  </label>
                  <select
                    id="patient-sort"
                    value={patientListSortBy}
                    onChange={(e) => setPatientListSortBy(e.target.value)}
                    className="h-10 w-auto max-w-[11.5rem] shrink-0 cursor-pointer appearance-none truncate rounded-lg border border-[#e2e8f0] bg-white py-0 pl-7 pr-2.5 text-[13px] font-medium text-[#475569] outline-none focus:border-[#00a88e]/40"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  </div>

                  <div className="relative shrink-0">
                  <button
                    ref={filterButtonRef}
                    type="button"
                    onClick={() => setFilterPopoverOpen((v) => !v)}
                    className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#475569] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                    aria-expanded={filterPopoverOpen}
                    aria-haspopup="dialog"
                    aria-label={
                      activeFiltersCount > 0
                        ? `Filtrar, ${activeFiltersCount} ativos`
                        : 'Filtrar'
                    }
                  >
                    <Filter className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                    Filtrar
                    {activeFiltersCount > 0 ? (
                      <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#00a88e] px-1 text-[11px] font-bold text-white">
                        {activeFiltersCount}
                      </span>
                    ) : null}
                  </button>
                  <PatientFiltersPopover
                    open={filterPopoverOpen}
                    onClose={() => setFilterPopoverOpen(false)}
                    anchorRef={filterButtonRef}
                    ctx={filterCtx}
                    onFilterChange={onFilterChange}
                  />
                  </div>
                  {canCreatePacientes ? (
                    <button
                      type="button"
                      onClick={onCreatePatient}
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#00a88e] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f]"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Novo Paciente
                    </button>
                  ) : null}
                </div>
              </div>

              {/* < xl: ordenação + filtros + novo paciente (sticky) */}
              <div className="flex flex-wrap gap-2 px-4 pb-2 xl:hidden">
                <div className="relative flex h-9 min-w-[8.5rem] flex-1 items-center">
                  <ArrowUpDown
                    className="pointer-events-none absolute left-2 top-1/2 z-10 h-3 w-3 -translate-y-1/2 text-[#94a3b8]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <label className="sr-only" htmlFor="patient-sort-mobile">
                    Ordenar lista
                  </label>
                  <select
                    id="patient-sort-mobile"
                    value={patientListSortBy}
                    onChange={(e) => setPatientListSortBy(e.target.value)}
                    className="h-9 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-[#e2e8f0] bg-white py-1 pl-7 pr-2 text-[13px] font-medium text-[#475569] outline-none focus:border-[#00a88e]/40"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(true)}
                  className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#475569] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                  aria-label={
                    activeFiltersCount > 0
                      ? `Filtrar, ${activeFiltersCount} ativos`
                      : 'Filtrar'
                  }
                >
                  <Filter className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                  Filtrar
                  {activeFiltersCount > 0 ? (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#00a88e] px-1 text-[11px] font-bold text-white">
                      {activeFiltersCount}
                    </span>
                  ) : null}
                </button>
                {canCreatePacientes ? (
                  <button
                    type="button"
                    onClick={onCreatePatient}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#00a88e] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f] sm:px-4"
                  >
                    <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                    <span className="whitespace-nowrap">Novo Paciente</span>
                  </button>
                ) : null}
              </div>

              <PatientActiveFilterChips ctx={filterCtx} onFilterChange={onFilterChange} />
            </div>
          </div>

          <div className="px-4">
            <div className="relative min-w-0 overflow-x-hidden [-webkit-overflow-scrolling:touch]">
            {patientListLoading ? (
              <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-slate-50/60 backdrop-blur-[1px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#00a88e]" aria-hidden />
                <span className="sr-only">Carregando lista…</span>
              </div>
            ) : null}
            <ul
              className="flex list-none flex-col gap-2 sm:gap-2.5 md:gap-3"
              aria-label="Lista de pacientes"
            >
              {!patientListLoading && filteredPatientListItems.length === 0 ? (
                <li className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-12 text-center text-[14px] font-medium text-[#64748b] shadow-sm">
                  <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {patientListItems.length === 0
                    ? 'Nenhum paciente encontrado'
                    : 'Nenhum paciente neste filtro'}
                </li>
              ) : patientListItems.length === 0 ? null : (
                filteredPatientListItems.map((patient) => {
                  const selected = selectedPatientCpf === patient.cpf;
                  return (
                    <li
                      key={patient.id}
                      className="min-w-0 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm"
                    >
                      <PatientListCard
                        patient={patient}
                        selected={selected}
                        onSelect={() => openPatientPreview(patient)}
                        getPatientInitials={getPatientInitials}
                      />
                    </li>
                  );
                })
              )}
            </ul>
            </div>
            <PatientListPagination
              page={meta.number}
              totalPages={meta.totalPages}
              loading={patientListLoading}
              first={meta.first}
              last={meta.last}
              onPageChange={setPatientListPage}
            />
          </div>
        </div>
        {/* ─── Coluna direita: PulseSidebar (sem preview) ou drawer overlay (com preview) ─── */}
        {previewPatient ? (
          <>
            {/* Mobile (<640px): bottom sheet */}
            <div
              className="fixed inset-0 z-[200] flex flex-col justify-end sm:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Resumo do paciente"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
                aria-label="Fechar resumo do paciente"
                onClick={closeDetail}
              />
              <div className="relative z-10 w-full max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-t-2xl border border-b-0 border-[#e2e8f0] bg-white pb-[env(safe-area-inset-bottom)] [-webkit-overflow-scrolling:touch] custom-scrollbar">
                <div className="sticky top-0 z-20 flex justify-center bg-white pt-3 pb-1">
                  <div className="h-1 w-10 rounded-full bg-[#e2e8f0]" aria-hidden />
                </div>
                <PatientPreviewPanel
                  key={previewPatient.cpf || String(previewPatient.id || '')}
                  selectedPatient={previewPatient}
                  detailTitleId={undefined}
                  closeDetail={closeDetail}
                  getPatientInitials={getPatientInitials}
                  setPatientDetailTab={setPatientDetailTab}
                  setPatientView={setPatientView}
                  previewProcedures={previewProcedures}
                  loadingPreviewProcedures={loadingPreviewProcedures}
                  onStartAttendance={onStartAttendance}
                  previewAnamneseLoading={previewAnamneseLoading}
                  captureProfileNavSnapshot={captureProfileNavSnapshot}
                  shellClassName="patient-preview-sheet w-full border-0 shadow-none"
                />
              </div>
            </div>

            {/* sm+: drawer direita (overlay em todas as larguras) */}
            <div className="hidden sm:fixed sm:inset-0 sm:z-[200] sm:flex" role="dialog" aria-modal="true" aria-label="Resumo do paciente">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Fechar resumo do paciente"
                onClick={closeDetail}
              />
              <aside className="relative ml-auto flex h-[100dvh] w-[min(380px,100%)] flex-col overflow-y-auto overflow-x-hidden border-l border-[#e2e8f0] bg-white shadow-xl [-webkit-overflow-scrolling:touch] custom-scrollbar">
                <PatientPreviewPanel
                  key={previewPatient.cpf || String(previewPatient.id || '')}
                  selectedPatient={previewPatient}
                  detailTitleId={desktopTitleId}
                  closeDetail={closeDetail}
                  getPatientInitials={getPatientInitials}
                  setPatientDetailTab={setPatientDetailTab}
                  setPatientView={setPatientView}
                  previewProcedures={previewProcedures}
                  loadingPreviewProcedures={loadingPreviewProcedures}
                  onStartAttendance={onStartAttendance}
                  previewAnamneseLoading={previewAnamneseLoading}
                  captureProfileNavSnapshot={captureProfileNavSnapshot}
                  shellClassName="w-full min-w-0 flex-1 border-0 shadow-none"
                />
              </aside>
            </div>
          </>
        ) : (
          <PulseSidebar
            kpi={kpi}
            loading={kpiLoading}
            nomeUsuario={nomeUsuario}
            onNavigateToAgenda={onNavigateToAgenda}
            onSelectPatient={(patient) => openPatientPreview(patient, { fromSidebar: true })}
            getPatientInitials={getPatientInitials}
          />
        )}
      </div>

      <PatientFiltersSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        ctx={filterCtx}
        onFilterChange={onFilterChange}
      />
    </div>
  );
}
