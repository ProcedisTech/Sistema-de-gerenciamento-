import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Cake,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  MessageCircle,
  Play,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Stethoscope,
  StickyNote,
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
import { getRailCardActions } from '../../utils/agendaCardActions.js';
import { AgendaRailCardActions } from '../agenda/AgendaRailCardActions.jsx';
import { agendaEnterClass } from '../agenda/agendaEnterClasses.js';
import {
  countActivePatientFilters,
  applyPatientQuickFilter,
  clearAllPatientFilters,
  resolveActiveKpiCardAfterToggle,
  activateFilterByKpiCardId,
  deactivateFilterByKpiCardId,
} from './patientListFilters.js';
import { PatientListPagination } from './PatientListPagination.jsx';
import { usePapel } from '../../hooks/usePapel';
import { anamneseApi, procedimentosApi } from '../../services/api';
import { usePlanosPaciente } from '../planos/usePlanosPaciente.js';
import { useAlertasClinicos } from '../../hooks/useAlertasClinicos.js';
import { calcSessoesPlano } from '../../utils/planejamentoProfileMetrics.js';
import {
  ProcedureTimelineHeading,
  ProcedureTimelineLoading,
  ProcedureTimelineRail,
  ProcedureTimelineEntry,
  ProcedureTimelinePreviewCard,
} from './ProcedureTimelineBlock.jsx';
import {
  nestProcedimentosTimeline,
} from './procedureTimelineUtils.js';
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

/** Espelha AgendaDashboard.jsx — monta as options de tolerância a partir de um slot de agenda. */
function buildAgendaSlotOptions(slot) {
  return {
    agendaId: slot.agendaId,
    data: slot.data,
    horaInicio: slot.horaInicio,
    fromAgendaSlot: true,
    procedimentoNome: slot.procedimentoNome,
    catalogoProcedimentoSaudeId: slot.catalogoProcedimentoSaudeId,
    planejamentoItemId: slot.planejamentoItemId ?? null,
    tipoProcedimentoCodigo: slot.tipoProcedimentoCodigo,
    procedimentoFeitoOrigemId: slot.procedimentoFeitoOrigemId,
    isAgendaRetorno: String(slot.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno',
  };
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
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-[#e6f7f5] sm:h-12 sm:w-12"
        initialsClassName="text-[12px] font-bold sm:text-[14px]"
        spinnerClassName="h-4 w-4 sm:h-5 sm:w-5"
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

function AlertasClinicosDrawerBlock({ patient, patientId }) {
  const [expanded, setExpanded] = useState(false);
  const { alertasPerfil, alertasAnamnese, resumo, isLoading } = useAlertasClinicos(
    patientId || patient?.id,
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5 text-[12px] text-[#64748b]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00a88e]" />
        <span>Verificando alertas clínicos…</span>
      </div>
    );
  }

  // 1. Alergias (alimentar + princípio ativo + declarações críticas de alergia)
  const alergiasFromPerfil = (alertasPerfil || []).filter(
    (c) => c.secao === 'alergias' || c.secao === 'alergiasPrincipioAtivo',
  );
  const alergiasFromAnamnese = (alertasAnamnese || []).filter(
    (c) => c.severidade === 'critica' || /alerg/i.test(c.titulo || c.valor || ''),
  );
  const alergiasPatient = String(patient?.alergias || '').trim();

  // 2. Condições de risco / antecedentes / medicamentos
  const riscoFromPerfil = (alertasPerfil || []).filter(
    (c) =>
      c.secao === 'antecedentes' ||
      c.secao === 'medicamentos' ||
      c.secao === 'condicoesSaude',
  );
  const riscoFromAnamnese = (alertasAnamnese || []).filter(
    (c) => c.severidade !== 'critica' && !/alerg/i.test(c.titulo || c.valor || ''),
  );
  const riscoPatient = String(patient?.condicoesSaude || '').trim();

  const totalAlergias = [
    ...alergiasFromPerfil.map((a) => a.valor || a.titulo || a.nome),
    ...alergiasFromAnamnese.map((a) => a.valor || a.titulo),
    ...(alergiasPatient ? alergiasPatient.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : []),
  ];
  const uniqueAlergias = [...new Set(totalAlergias.filter(Boolean))];

  const totalRiscos = [
    ...riscoFromPerfil.map((r) => r.valor || r.titulo || r.nome),
    ...riscoFromAnamnese.map((r) => r.valor || r.titulo),
    ...(riscoPatient ? riscoPatient.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : []),
  ];
  const uniqueRiscos = [...new Set(totalRiscos.filter(Boolean))];

  const hasAlertas = uniqueAlergias.length > 0 || uniqueRiscos.length > 0;

  if (!hasAlertas) {
    if (!resumo?.temVigente && !alergiasPatient && !riscoPatient) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-2 text-[12px] font-medium text-slate-600">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>Nenhuma anamnese preenchida ainda</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3.5 py-2 text-[12px] font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span>Sem restrições ou alergias anotadas</span>
      </div>
    );
  }

  const isCritical = uniqueAlergias.length > 0;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isCritical
          ? 'border-rose-200/90 bg-rose-50/40'
          : 'border-amber-200/90 bg-amber-50/40'
      }`}
    >
      {/* Barra de resumo minimalista estilo Hub */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full min-h-[42px] items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/40 rounded-2xl"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-2 w-2 shrink-0 rounded-full ${
              isCritical ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12px]">
            <span
              className={`font-bold ${
                isCritical ? 'text-rose-900' : 'text-amber-900'
              }`}
            >
              {isCritical
                ? `${uniqueAlergias.length} ${
                    uniqueAlergias.length === 1 ? 'alerta crítico' : 'alertas críticos'
                  }`
                : 'Alertas de saúde'}
            </span>
            {uniqueRiscos.length > 0 && (
              <span
                className={`text-[11px] font-medium ${
                  isCritical ? 'text-rose-700/80' : 'text-amber-800/80'
                }`}
              >
                · {uniqueRiscos.length} {uniqueRiscos.length === 1 ? 'risco' : 'riscos'}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
              isCritical
                ? 'bg-rose-100/80 text-rose-800'
                : 'bg-amber-100/80 text-amber-800'
            }`}
          >
            {expanded ? 'Ocultar' : 'Ver detalhes'}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              isCritical ? 'text-rose-600' : 'text-amber-600'
            } ${expanded ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
          />
        </div>
      </button>

      {/* Detalhes expandidos sob demanda (estilo lista limpa com bullets) */}
      {expanded && (
        <div
          className={`space-y-2.5 border-t px-3.5 py-3 text-[12px] ${
            isCritical
              ? 'border-rose-200/60 bg-white/60'
              : 'border-amber-200/60 bg-white/60'
          } rounded-b-2xl`}
        >
          {uniqueAlergias.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-800">
                <span>🔴</span>
                <span>Declarações Críticas / Alergias ({uniqueAlergias.length})</span>
              </div>
              <ul className="space-y-1 pl-1">
                {uniqueAlergias.map((a, i) => (
                  <li
                    key={`alergia-item-${i}`}
                    className="flex items-start gap-2 text-[12px] font-semibold leading-snug text-slate-800"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {uniqueRiscos.length > 0 && (
            <div className={uniqueAlergias.length > 0 ? 'border-t border-slate-200/60 pt-2' : ''}>
              <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                <span>🟡</span>
                <span>Demais Declarações / Riscos ({uniqueRiscos.length})</span>
              </div>
              <ul className="space-y-1 pl-1">
                {uniqueRiscos.map((r, i) => (
                  <li
                    key={`risco-item-${i}`}
                    className="flex items-start gap-2 text-[12px] font-medium leading-snug text-slate-700"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlanoAtivoDrawerBlock({ patientId }) {
  const { planos, loading } = usePlanosPaciente({
    pacienteId: patientId,
    enabled: Boolean(patientId),
  });

  const planoAtivo = useMemo(() => {
    return (
      (Array.isArray(planos) ? planos : []).find(
        (p) => p.statusCodigo === 'em_andamento' || p.statusCodigo === 'ativo',
      ) || null
    );
  }, [planos]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5 text-[12px] text-[#64748b]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00a88e]" />
        <span>Verificando planos de tratamento…</span>
      </div>
    );
  }

  const { feitas: concluidos, total } = calcSessoesPlano(planoAtivo?.itens);

  if (!loading && (!planoAtivo || total === 0)) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-2 text-[12px]">
        <div className="flex items-center gap-2 text-slate-600">
          <Activity className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">Plano de Tratamento:</span>
          <span className="font-medium text-slate-500">Sem plano ativo</span>
        </div>
      </div>
    );
  }

  if (!planoAtivo || total === 0) return null;

  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((concluidos / total) * 100))) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#00a88e]/20 bg-[#e6f7f5]/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#0f766e]">
          <Activity className="h-3.5 w-3.5 text-[#00a88e]" />
          <span className="truncate">Plano: {planoAtivo.observacao || 'Tratamento em Andamento'}</span>
        </div>
        <span className="shrink-0 rounded-full bg-[#00a88e] px-2 py-0.5 text-[10px] font-bold text-white">
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#00a88e]/15">
        <div
          className="h-full rounded-full bg-[#00a88e] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] font-medium text-[#0f766e]/90">
        {concluidos} de {total} sessões realizadas
      </p>
    </div>
  );
}

function NotasDrawerBlock({ patient }) {
  const notaTexto =
    patient?.observacoes ||
    patient?.observacao ||
    patient?.notasGerais ||
    patient?.observacoesImportantes ||
    (typeof patient?.notas === 'string' ? patient?.notas : '') ||
    '';

  const indicacao = patient?.indicacao ? String(patient.indicacao).trim() : '';

  if (!notaTexto.trim() && !indicacao) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
        <StickyNote className="h-3.5 w-3.5 text-slate-500" />
        Nota Rápida / Observação
      </div>
      {notaTexto.trim() ? (
        <p className="whitespace-pre-wrap text-[12px] font-medium leading-relaxed text-slate-700">
          {notaTexto.trim()}
        </p>
      ) : null}
      {indicacao ? (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <span>Indicação:</span>
          <span className="font-bold text-slate-700">{indicacao}</span>
        </div>
      ) : null}
    </div>
  );
}

function PatientPreviewPanel({
  selectedPatient,
  detailTitleId,
  closeDetail,
  getPatientInitials,
  setPatientDetailTab,
  setPatientView,
  shellClassName = '',
  previewProcedures = [],
  loadingPreviewProcedures = false,
  onStartAttendance,
  previewAnamneseLoading = false,
  captureProfileNavSnapshot,
  agendaSchedule,
  previewAgendaSlot,
}) {
  const { isNivel1, canSeeProntuario, canStartAnamnese } = usePapel();

  const [expandedRetornosMap, setExpandedRetornosMap] = useState({});

  const toggleRetornosExpanded = (procId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedRetornosMap((prev) => ({
      ...prev,
      [String(procId)]: !prev[String(procId)],
    }));
  };

  /** Árvore aninhada de procedimentos com retornos vinculados. */
  const nestedTimeline = useMemo(() => {
    const raw =
      previewProcedures.length > 0 ? previewProcedures : (selectedPatient.procedures || []);
    return nestProcedimentosTimeline(raw);
  }, [previewProcedures, selectedPatient.procedures]);

  const PREVIEW_TIMELINE_MAX = 3;
  const previewTimelineTruncated = nestedTimeline.length > PREVIEW_TIMELINE_MAX;
  const visibleRoots = useMemo(
    () => (previewTimelineTruncated ? nestedTimeline.slice(0, PREVIEW_TIMELINE_MAX) : nestedTimeline),
    [nestedTimeline, previewTimelineTruncated],
  );

  const goToPacienteProntuario = () => {
    if (!canSeeProntuario) return;
    if (selectedPatient?.cpf) captureProfileNavSnapshot?.(selectedPatient.cpf);
    setPatientDetailTab('prontuario');
    setPatientView('profile');
  };

  const handleIniciarAtendimentoClick = () => {
    if (!canStartAnamnese || previewAnamneseLoading || typeof onStartAttendance !== 'function') return;
    onStartAttendance(selectedPatient, previewAgendaSlot ? buildAgendaSlotOptions(previewAgendaSlot) : {});
  };

  const rawPhone = String(selectedPatient?.telefone || '').replace(/\D/g, '');
  const waUrl = rawPhone
    ? `https://wa.me/55${rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone}`
    : null;

  const idadeLabel =
    selectedPatient?.idade != null ? `${selectedPatient.idade} anos` : null;

  const dataNascFormatted = selectedPatient?.dataNascimento
    ? new Date(selectedPatient.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : null;

  return (
    <div
      className={`relative flex w-full min-w-0 flex-col gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-lg ${shellClassName}`}
    >
      <button
        type="button"
        onClick={closeDetail}
        className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[#64748b] shadow-2xs transition-all hover:bg-slate-50 hover:text-[#0f172a]"
        aria-label="Fechar painel"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <div className="flex w-full min-w-0 items-start gap-3.5 border-b border-[#f1f5f9] pb-4 pr-10">
        <PatientAvatar
          patient={selectedPatient}
          getPatientInitials={getPatientInitials}
          className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#e6f7f5] shadow-xs"
          initialsClassName="text-[16px] sm:text-[18px] font-bold text-white"
          spinnerClassName="h-5 w-5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 id={detailTitleId} className="text-[17px] font-bold capitalize leading-snug text-[#0f172a] break-words">
              {selectedPatient.nome}
            </h3>
            {selectedPatient.ehAniversariante && (
              <span className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-700 shadow-2xs">
                <Cake className="h-3 w-3" />
                Aniversariante hoje!
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-medium text-[#64748b]">
            {idadeLabel && (
              <span className="font-semibold text-[#00a88e]">
                {idadeLabel} {dataNascFormatted ? `(${dataNascFormatted})` : ''}
              </span>
            )}
            {selectedPatient.telefone && (
              <>
                <span className="text-slate-300">·</span>
                <span>{selectedPatient.telefone}</span>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                    title="Abrir conversa no WhatsApp"
                  >
                    <MessageCircle className="h-3 w-3" />
                    WhatsApp
                  </a>
                )}
              </>
            )}
          </div>
          {selectedPatient.email && (
            <p className="mt-0.5 text-[12px] text-[#64748b] break-all">{selectedPatient.email}</p>
          )}
        </div>
      </div>

      <AlertasClinicosDrawerBlock patient={selectedPatient} patientId={selectedPatient?.id} />
      <PlanoAtivoDrawerBlock patientId={selectedPatient?.id} />
      <NotasDrawerBlock patient={selectedPatient} />

      <div className="grid grid-cols-2 gap-2">
        {canStartAnamnese && (
          <button
            type="button"
            onClick={handleIniciarAtendimentoClick}
            disabled={previewAnamneseLoading || typeof onStartAttendance !== 'function'}
            className="flex min-h-[42px] w-full flex-row items-center justify-center gap-1.5 rounded-xl bg-[#00a88e] px-2 py-2 text-[12px] font-bold text-white shadow-xs transition-all hover:bg-[#00967f] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 sm:text-[12.5px]"
            title="Iniciar Atendimento"
          >
            {previewAnamneseLoading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={2.25} aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0 fill-white" strokeWidth={2.5} aria-hidden />
            )}
            <span className="truncate">Iniciar Atendimento</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (selectedPatient?.cpf) captureProfileNavSnapshot?.(selectedPatient.cpf);
            setPatientDetailTab('planos');
            setPatientView('profile');
          }}
          className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[#00a88e]/35 bg-[#e6f7f5]/40 px-2 py-2 text-[12px] font-bold text-[#007463] shadow-2xs transition-all hover:border-[#00a88e]/70 hover:bg-[#e6f7f5]/90 active:scale-[0.99] sm:text-[12.5px] ${
            !canStartAnamnese ? 'col-span-2' : ''
          }`}
          title={isNivel1 ? 'Ver Cadastro' : 'Ver Perfil'}
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#00a88e]" strokeWidth={2.25} />
          <span className="truncate">{isNivel1 ? 'Ver Cadastro' : 'Ver Perfil'}</span>
        </button>
      </div>

      {previewAgendaSlot && !isNivel1 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
          <h4 className="text-[13px] font-bold text-[#0f172a]">Agendamento de Hoje</h4>
          <AgendaRailCardActions
            appointment={previewAgendaSlot}
            actions={getRailCardActions(previewAgendaSlot.status, canStartAnamnese)}
            compact={false}
            onConfirmar={() => agendaSchedule?.handleAtualizarStatus(previewAgendaSlot.agendaId, 'confirmado')}
            onCheckIn={() => agendaSchedule?.handleAtualizarStatus(previewAgendaSlot.agendaId, 'paciente_chegou')}
            onIniciarAtendimento={() => onStartAttendance?.(selectedPatient, buildAgendaSlotOptions(previewAgendaSlot))}
            onWhatsApp={() => agendaSchedule?.handleEnviarWhatsApp(previewAgendaSlot.agendaId)}
            onEnviarAnamnese={() => agendaSchedule?.openDaySheet(previewAgendaSlot.data, previewAgendaSlot)}
            onReagendar={() => agendaSchedule?.openReagendarModal(previewAgendaSlot, [previewAgendaSlot])}
            onCancelar={() => agendaSchedule?.handleCancelar(previewAgendaSlot.agendaId)}
            className="w-full"
          />
        </div>
      ) : null}

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
        ) : visibleRoots.length > 0 ? (
          <>
            <ProcedureTimelineRail>
              {visibleRoots.map((root, idx) => {
                const rootKey =
                  root.id != null && root.id !== ''
                    ? `drawer-proc-${root.id}`
                    : `drawer-proc-idx-${idx}`;
                const criado = root.criadoEm ? new Date(root.criadoEm) : null;
                const dateLabel = criado
                  ? criado.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                  : root.data != null
                    ? String(root.data).trim() || '-'
                    : '-';
                const timeLabel = criado
                  ? criado.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    })
                  : root.hora != null
                    ? String(root.hora).trim()
                    : '';
                const nomeProc = root.procedimentoNome || root.nome || 'Procedimento';
                const retornos = Array.isArray(root.retornos) ? root.retornos : [];
                const retornoCount = retornos.length;
                const isRetornosExpanded = Boolean(expandedRetornosMap[String(root.id)]);
                const fotosCount = Array.isArray(root.fotos) ? root.fotos.length : 0;
                const hasObservacao = Boolean(root.observacao && String(root.observacao).trim());
                const hasTermo = Boolean(root.temTermo || root.termoAssinado || root.assinaturaVinculada);

                return (
                  <React.Fragment key={rootKey}>
                    <ProcedureTimelineEntry depth={0}>
                      <ProcedureTimelinePreviewCard
                        dateLabel={dateLabel}
                        timeLabel={timeLabel}
                        procedureName={nomeProc}
                        professionalName={root.profissionalNome || root.profissional || '—'}
                        depth={0}
                        retornoCount={retornoCount}
                        isRetoque={Boolean(root.isRetoque)}
                        statusNome={root.statusNome || ''}
                        fotosCount={fotosCount}
                        hasTermo={hasTermo}
                        hasObservacao={hasObservacao}
                        onToggleRetornos={retornoCount > 0 ? (e) => toggleRetornosExpanded(root.id, e) : undefined}
                        isRetornosExpanded={isRetornosExpanded}
                        onPress={goToPacienteProntuario}
                      />
                    </ProcedureTimelineEntry>

                    {isRetornosExpanded &&
                      retornos.map((child, childIdx) => {
                        const childKey =
                          child.id != null && child.id !== ''
                            ? `drawer-retorno-${child.id}`
                            : `drawer-retorno-${root.id}-${childIdx}`;
                        const childCriado = child.criadoEm ? new Date(child.criadoEm) : null;
                        const childDate = childCriado
                          ? childCriado.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                          : child.data != null
                            ? String(child.data).trim() || '-'
                            : '-';
                        const childHora = childCriado
                          ? childCriado.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'America/Sao_Paulo',
                            })
                          : child.hora != null
                            ? String(child.hora).trim()
                            : '';
                        const childNome = child.procedimentoNome || child.nome || 'Retorno';
                        const childFotos = Array.isArray(child.fotos) ? child.fotos.length : 0;
                        const childObs = Boolean(child.observacao && String(child.observacao).trim());
                        const childTermo = Boolean(
                          child.temTermo || child.termoAssinado || child.assinaturaVinculada,
                        );

                        return (
                          <ProcedureTimelineEntry key={childKey} depth={1}>
                            <ProcedureTimelinePreviewCard
                              dateLabel={childDate}
                              timeLabel={childHora}
                              procedureName={childNome}
                              professionalName={child.profissionalNome || child.profissional || '—'}
                              depth={1}
                              retornoCount={0}
                              isRetoque={Boolean(child.isRetoque)}
                              statusNome={child.statusNome || ''}
                              fotosCount={childFotos}
                              hasTermo={childTermo}
                              hasObservacao={childObs}
                              onPress={goToPacienteProntuario}
                            />
                          </ProcedureTimelineEntry>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </ProcedureTimelineRail>
            {previewTimelineTruncated && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={goToPacienteProntuario}
                  className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[12.5px] font-bold text-[#00a88e] shadow-2xs transition-all hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
                >
                  <span>Ver mais no prontuário ({nestedTimeline.length} {nestedTimeline.length === 1 ? 'procedimento' : 'procedimentos'})</span>
                  <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="py-6 text-center text-[13px] font-normal text-[#64748b]">Nenhum procedimento registrado</p>
        )}
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
  semAgendamentoFuturoFilter = false,
  setSemAgendamentoFuturoFilter,
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
  agendaSchedule,
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
  const [previewAgendaSlot, setPreviewAgendaSlot] = useState(null);
  const [loadingPreviewProcedures, setLoadingPreviewProcedures] = useState(false);
  /** Paciente cujo fetch de anamnese do preview terminou; `null` = nenhum / resetado. */
  const [previewAnamneseListOwnerId, setPreviewAnamneseListOwnerId] = useState(null);
  const [showEntrance, setShowEntrance] = useState(true);

  useEffect(() => {
    if (!showEntrance) return undefined;
    const id = window.setTimeout(() => setShowEntrance(false), 1800);
    return () => window.clearTimeout(id);
  }, [showEntrance]);

  const activeFiltersCount = useMemo(
    () =>
      countActivePatientFilters({
        isSearching,
        patientListSortBy,
        statusPlanoFilter,
        anamneseDesatualizadaFilter,
        semAgendamentoFuturoFilter,
        ehNovoFilter,
        ehAniversarianteFilter,
        quickFilter,
      }),
    [
      isSearching,
      patientListSortBy,
      statusPlanoFilter,
      anamneseDesatualizadaFilter,
      semAgendamentoFuturoFilter,
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
      semAgendamentoFuturoFilter,
      setSemAgendamentoFuturoFilter,
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
      semAgendamentoFuturoFilter,
      setSemAgendamentoFuturoFilter,
      ehNovoFilter,
      setEhNovoFilter,
      ehAniversarianteFilter,
      setEhAniversarianteFilter,
      quickFilter,
      setQuickFilter,
    ]
  );

  /**
   * `def`/`willBeActive` chegam de quem chamou activate/deactivate no mesmo evento — usar isso
   * em vez de reler `filterCtx` evita resolver com o valor antigo (o setState do toggle ainda não
   * foi commitado quando este callback roda). `def` null = "limpar tudo" (handleClearAll).
   */
  const onFilterChange = (def, willBeActive) => {
    setActiveKpiCard(def ? resolveActiveKpiCardAfterToggle(filterCtx, def, willBeActive) : null);
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
    setPreviewAgendaSlot(null);
  };

  const openPatientPreview = (patient, { fromSidebar = false, agendaSlot = null } = {}) => {
    if (!patient?.cpf) return;
    setSelectedPatientCpf(patient.cpf);
    setPreviewPatientCpf(patient.cpf);
    setPreviewPatientSeed(fromSidebar ? patient : null);
    setPreviewAgendaSlot(agendaSlot);
  };

  /** PulseSidebar só tem o slot cru (kpi.agendamentosHoje) — resolve o paciente completo antes de iniciar. */
  const handleStartAttendanceFromSlot = (slot) => {
    if (!slot?.pacienteId || typeof onStartAttendance !== 'function') return;
    const pid = String(slot.pacienteId);
    const fullPatient =
      patients.find((p) => String(p.id) === pid) || patientListItems.find((p) => String(p.id) === pid);
    if (!fullPatient) return;
    onStartAttendance(fullPatient, buildAgendaSlotOptions(slot));
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
      <div
        className={`flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${agendaEnterClass(showEntrance, 'agenda-delay-100')}`}
      >
        <h1 className="min-w-0 text-[22px] font-bold leading-tight text-[#0f172a] sm:text-2xl">
          Pacientes
        </h1>
      </div>

      <div className={agendaEnterClass(showEntrance, 'agenda-delay-150')}>
        <KpiCards
          kpi={kpi}
          loading={kpiLoading}
          activeCard={activeKpiCard}
          onActivateFilter={handleActivateFilter}
        />

        <PatientsTodayStrip
          kpi={kpi}
          loading={kpiLoading}
          onSelectPatient={(agendaSlot) => {
            if (!agendaSlot?.pacienteId) return;
            const pid = String(agendaSlot.pacienteId);
            const fullPatient =
              patients.find((p) => String(p.id) === pid) ||
              patientListItems.find((p) => String(p.id) === pid);
            if (fullPatient) {
              openPatientPreview(fullPatient, { fromSidebar: true, agendaSlot });
            }
          }}
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-5">
        <div className="flex min-w-0 flex-1 flex-col lg:min-w-[min(100%,19rem)]">
          <div className="flex min-w-0 flex-col">
            {/* Header: search + chips + sort */}
            <div
              className={`sticky top-0 z-10 bg-transparent ${agendaEnterClass(showEntrance, 'agenda-delay-200')}`}
            >
              {/* < lg: busca full-width (coluna estreita com PulseSidebar/preview) */}
              <div className="px-4 pt-3 pb-2 lg:hidden">
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

              {/* xl+: ordenação + filtros (busca e Novo Paciente no GlobalHeader lg+) */}
              <div className="hidden w-full min-w-0 flex-row flex-wrap items-center justify-end gap-3 px-4 pt-3 pb-2 xl:flex">
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
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#00a88e] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f] sm:px-4 lg:hidden"
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
            <div
              className={`relative min-w-0 overflow-x-hidden [-webkit-overflow-scrolling:touch] ${agendaEnterClass(showEntrance, 'agenda-delay-250')}`}
            >
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
                  agendaSchedule={agendaSchedule}
                  previewAgendaSlot={previewAgendaSlot}
                  shellClassName="patient-preview-sheet w-full border-0 shadow-none"
                />
              </div>
            </div>

            {/* sm+: drawer direita flutuante com bordas suaves e arredondadas (sem quinas pontudas na tela) */}
            <div
              className="hidden sm:fixed sm:inset-0 sm:z-[200] sm:flex sm:justify-end sm:p-3 sm:pr-4"
              role="dialog"
              aria-modal="true"
              aria-label="Resumo do paciente"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity"
                aria-label="Fechar resumo do paciente"
                onClick={closeDetail}
              />
              <aside className="relative z-10 flex h-full max-h-[calc(100dvh-1.5rem)] w-[min(410px,100%)] flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl [-webkit-overflow-scrolling:touch] custom-scrollbar">
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
                  agendaSchedule={agendaSchedule}
                  previewAgendaSlot={previewAgendaSlot}
                  shellClassName="w-full min-w-0 flex-1 border-0 shadow-none"
                />
              </aside>
            </div>
          </>
        ) : (
          <div className={agendaEnterClass(showEntrance, 'agenda-delay-250')}>
            <PulseSidebar
              kpi={kpi}
              loading={kpiLoading}
              nomeUsuario={nomeUsuario}
              onNavigateToAgenda={onNavigateToAgenda}
              onSelectPatient={(patient) => openPatientPreview(patient, { fromSidebar: true })}
              getPatientInitials={getPatientInitials}
              agendaSchedule={agendaSchedule}
              onStartAttendance={handleStartAttendanceFromSlot}
            />
          </div>
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
