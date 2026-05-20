import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';
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

// Apenas filtros client-side restantes (semRetorno e anamneseVencida migraram para server-side)
const QUICK_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'menor', label: 'Menor de idade' },
];

function applyQuickFilter(items, filter) {
  if (filter === 'menor') return items.filter((p) => p.menorDeIdade === true);
  return items;
}

function PatientListCard({ patient, selected, onSelect, getPatientInitials }) {
  const clinical = hasClinicalAlert(patient);
  const lastProc = lastProcedureLabel(patient);
  const lastProcDate = lastProcedureDateForCard(patient);

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
      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border-0 px-4 py-3 text-left shadow-none transition-colors duration-100 sm:min-h-[72px] sm:gap-4 sm:px-5 sm:py-3.5 md:gap-5 md:min-h-[76px] lg:min-h-[80px] lg:px-6 lg:py-4 ${
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-snug text-[#0f172a] sm:text-[15px] md:text-[16px]">
          {patient.nome}
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-x-2 md:mt-1.5">
          {mutedInfoParts.length > 0 || hasLastVisitDate ? (
            <p className="text-[13px] text-[#64748b] sm:text-[14px] md:text-[15px]">
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
          {/* Chips DTO v1 — ordem: anamneseDesatualizada → plano → semRetorno60Dias → menorDeIdade → ehNovo → ehAniversariante */}
          {patient.anamneseDesatualizada ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#fef08a] bg-[#fefce8] px-1.5 py-0.5 text-[11px] font-semibold text-[#854d0e] sm:px-2 sm:text-[12px]">
              Anamnese vencida
            </span>
          ) : null}
          {patient.statusPlanoCodigo != null ? (
            <span
              className="inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[11px] font-semibold sm:px-2 sm:text-[12px]"
              style={
                patient.statusPlanoCorHex
                  ? {
                      backgroundColor: patient.statusPlanoCorHex + '1a',
                      borderColor: patient.statusPlanoCorHex + '66',
                      color: patient.statusPlanoCorHex,
                    }
                  : { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', color: '#475569' }
              }
            >
              {patient.statusPlanoNome || patient.statusPlanoCodigo}
            </span>
          ) : null}
          {patient.semRetorno60Dias ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-1.5 py-0.5 text-[11px] font-semibold text-[#4338ca] sm:px-2 sm:text-[12px]">
              Sem retorno
            </span>
          ) : null}
          {patient.menorDeIdade ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-0.5 text-[11px] font-semibold text-[#2563eb] sm:px-2 sm:text-[12px]">
              Menor de idade
            </span>
          ) : null}
          {patient.ehNovo ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-1.5 py-0.5 text-[11px] font-semibold text-[#0f766e] sm:px-2 sm:text-[12px]">
              Paciente novo
            </span>
          ) : null}
          {patient.ehAniversariante ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#fbcfe8] bg-[#fdf2f8] px-1.5 py-0.5 text-[11px] font-semibold text-[#9d174d] sm:px-2 sm:text-[12px]">
              Aniversariante
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {clinical ? (
          <AlertTriangle
            className="h-4 w-4 text-orange-400 sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5"
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
        <span
          className={`hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[12px] lg:text-[13px] md:inline-flex ${
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

function previewHasExistingAnamneseFromList(list) {
  const rows = (Array.isArray(list) ? [...list] : []).filter((r) => r?.dataHora);
  rows.sort((a, b) => {
    const ta = new Date(a.dataHora).getTime();
    const tb = new Date(b.dataHora).getTime();
    return tb - ta;
  });
  const latest = rows[0] || null;
  if (!latest?.dataHora) return false;
  const t = new Date(latest.dataHora);
  return !Number.isNaN(t.getTime());
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
  previewHasExistingAnamnese = false,
  previewAnamneseLoading = false,
}) {
  const [attendanceChoiceModalOpen, setAttendanceChoiceModalOpen] = useState(false);
  const { isNivel1 } = usePapel();

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
    if (isNivel1) return;
    setPatientDetailTab('prontuario');
    setPatientView('profile');
  };

  const handleIniciarAtendimentoClick = () => {
    if (isNivel1 || previewAnamneseLoading || typeof onStartAttendance !== 'function') return;
    if (previewHasExistingAnamnese) {
      setAttendanceChoiceModalOpen(true);
      return;
    }
    onStartAttendance(selectedPatient);
  };

  const runStartAttendance = (options = {}) => {
    if (typeof onStartAttendance !== 'function') return;
    setAttendanceChoiceModalOpen(false);
    onStartAttendance(selectedPatient, options);
  };

  return (
    <div
      className={`relative flex w-full min-w-0 flex-col gap-4 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-lg ${shellClassName}`}
    >
      {attendanceChoiceModalOpen ? (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAttendanceChoiceModalOpen(false);
          }}
        >
          <div
            className="flex max-h-[min(90dvh,520px)] w-full max-w-md flex-col rounded-t-2xl border border-[#e2e8f0] bg-white shadow-xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-attendance-choice-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] p-4 pb-3 sm:p-5">
              <h2 id="preview-attendance-choice-title" className="pr-2 text-[16px] font-bold leading-snug text-[#0f172a]">
                Como deseja iniciar?
              </h2>
              <button
                type="button"
                onClick={() => setAttendanceChoiceModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:text-[#0f172a]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
              <p className="text-[13px] font-normal leading-snug text-[#64748b]">
                Este paciente já possui anamnese registrada. Escolha se deseja preencher uma nova ficha ou seguir direto para a avaliação.
              </p>
              <button
                type="button"
                onClick={() => runStartAttendance()}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#00967f] active:bg-[#00967f]"
              >
                <Play className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                Fazer outra anamnese
              </button>
              <button
                type="button"
                onClick={() => runStartAttendance({ initialStep: 2 })}
                className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-4 text-[14px] font-medium text-[#475569] transition-colors hover:border-[#cbd5e1] sm:min-h-[44px]"
              >
                Pular para avaliação
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        {!isNivel1 && (
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
        {isNivel1 ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Shield className="h-5 w-5" />
            </div>
            <h4 className="mt-2 text-sm font-bold text-slate-800">Visualização Limitada</h4>
            <p className="mt-1 text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
              Seu nível de permissão (Nível 1) permite apenas visualizar os dados cadastrais básicos deste paciente.
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
            setPatientDetailTab('atendimento');
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
}) {
  const { isNivel1: _isNivel1, canWritePacientes } = usePapel();
  /** Filtros server-side ficam desabilitados enquanto houver texto de busca (rota /search não os suporta). */
  const isSearching = Boolean(patientSearchQuery?.trim());
  /** Abre o resumo lateral/modal só após clique na lista — não reutiliza seleção da jornada. */
  const [previewPatientCpf, setPreviewPatientCpf] = useState(null);
  const [quickFilter, setQuickFilter] = useState('todos');
  const desktopTitleId = 'patient-detail-title';
  const [previewProcedures, setPreviewProcedures] = useState([]);
  const [loadingPreviewProcedures, setLoadingPreviewProcedures] = useState(false);
  const [previewAnamneseList, setPreviewAnamneseList] = useState([]);
  /** Paciente ao qual `previewAnamneseList` corresponde após o último fetch concluído; `null` = nenhum. */
  const [previewAnamneseListOwnerId, setPreviewAnamneseListOwnerId] = useState(null);

  const meta = patientListMeta || {
    first: true,
    last: true,
    totalPages: 0,
    number: 0,
  };
  const totalPagesUi = Math.max(meta.totalPages, 1);
  const pageLabelNum = meta.number + 1;

  const previewPatient =
    (previewPatientCpf &&
      (patientListItems.find((p) => p.cpf === previewPatientCpf) ||
        patients.find((p) => p.cpf === previewPatientCpf))) ||
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
      setPreviewAnamneseList([]);
      setPreviewAnamneseListOwnerId(null);
      return undefined;
    }
    let cancelled = false;
    anamneseApi
      .listPaciente(previewPatientId)
      .then((list) => {
        if (!cancelled) setPreviewAnamneseList(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setPreviewAnamneseList([]);
      })
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

  const previewHasExistingAnamnese =
    Boolean(previewPatientId && previewAnamneseListOwnerId === previewPatientId) &&
    previewHasExistingAnamneseFromList(previewAnamneseList);

  const closeDetail = () => {
    setPreviewPatientCpf(null);
    setSelectedPatientCpf(null);
    setPatientDetailTab('atendimento');
    setPreviewProcedures([]);
  };

  useEffect(() => {
    if (!previewPatient) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPreviewPatientCpf(null);
        setSelectedPatientCpf(null);
        setPatientDetailTab('atendimento');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewPatient, setSelectedPatientCpf, setPatientDetailTab]);

  useEffect(() => {
    if (!previewPatient) return undefined;
    const mq = window.matchMedia('(max-width: 1023px)');
    const syncBodyScroll = () => {
      document.body.style.overflow = mq.matches ? 'hidden' : '';
    };
    syncBodyScroll();
    mq.addEventListener('change', syncBodyScroll);
    return () => {
      mq.removeEventListener('change', syncBodyScroll);
      document.body.style.overflow = '';
    };
  }, [previewPatient]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight text-[#0f172a] sm:text-2xl">
            Gestão de Pacientes
          </h1>
          <p className="mt-1 text-[14px] font-medium text-[#64748b]">
            Histórico completo e dados protegidos
          </p>
        </div>
        {canWritePacientes && (
          <button
            type="button"
            onClick={onCreatePatient}
            className="flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors active:bg-[#00967f] sm:w-auto sm:min-w-0"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Novo Paciente
          </button>
        )}
      </div>

      <div className="flex w-full min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-5">
        <div className="flex min-w-0 flex-1 flex-col lg:min-w-[min(100%,19rem)]">
          <div className="flex min-w-0 flex-col overflow-x-hidden">
            {/* Header: search + chips + sort */}
            <div className="sticky top-0 z-10 bg-transparent">
              {/* Linha principal: pesquisa · ordenação */}
              <div className="flex w-full min-w-0 flex-col gap-2 px-4 pt-3 pb-2 sm:flex-row sm:flex-nowrap sm:items-center md:gap-3">
                <div className="relative order-1 min-h-[44px] min-w-0 flex-1 sm:min-h-0">
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
                    className="h-11 min-h-[44px] w-full min-w-0 rounded-xl border border-[#e2e8f0] bg-white py-2 pl-9 pr-3 text-[16px] text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#00a88e]/50 sm:h-10 sm:min-h-0 sm:text-[14px]"
                    autoComplete="off"
                  />
                </div>

                <div className="relative order-2 flex h-11 min-h-[44px] w-full shrink-0 items-center sm:h-10 sm:min-h-0 sm:w-fit sm:flex-none">
                  <ArrowUpDown
                    className="pointer-events-none absolute left-2 top-1/2 z-10 h-3 w-3 -translate-y-1/2 text-[#94a3b8]"
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
                    className="h-full w-full min-w-[8rem] max-w-none cursor-pointer appearance-none rounded-lg border border-[#e2e8f0] bg-white px-2 py-1.5 pl-7 text-[13px] font-medium leading-snug text-[#475569] outline-none focus:border-[#00a88e]/40 sm:h-10 sm:min-h-0 sm:w-fit sm:min-w-[6.75rem] sm:max-w-[10.75rem] sm:px-1.5 sm:py-1 sm:pl-6 sm:pr-2 sm:text-[11px] sm:leading-tight"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filtros: server-side (plano, anamnese, sem retorno) + local (menor de idade) */}
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                {/* Status de plano — server-side */}
                <select
                  value={statusPlanoFilter}
                  onChange={(e) => setStatusPlanoFilter && setStatusPlanoFilter(e.target.value)}
                  disabled={isSearching || !setStatusPlanoFilter}
                  aria-label="Filtrar por status de plano"
                  className="h-8 cursor-pointer appearance-none rounded-full border border-[#e2e8f0] bg-white px-3 pr-7 text-[13px] font-medium text-[#475569] outline-none transition-colors focus:border-[#00a88e]/40 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.5rem center',
                  }}
                >
                  <option value="">Plano: Todos</option>
                  <option value="sem_plano">Sem plano</option>
                  <option value="plano_ativo">Com plano ativo</option>
                </select>
                {/* Anamnese vencida — server-side toggle */}
                <button
                  type="button"
                  onClick={() => setAnamneseDesatualizadaFilter && setAnamneseDesatualizadaFilter((v) => !v)}
                  disabled={isSearching || !setAnamneseDesatualizadaFilter}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    anamneseDesatualizadaFilter
                      ? 'bg-[#854d0e] text-white'
                      : 'border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#cbd5e1] hover:bg-slate-50'
                  }`}
                >
                  Anamnese vencida
                </button>
                {/* Sem retorno 60d — server-side toggle */}
                <button
                  type="button"
                  onClick={() => setSemRetornoFilter && setSemRetornoFilter((v) => !v)}
                  disabled={isSearching || !setSemRetornoFilter}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    semRetornoFilter
                      ? 'bg-[#4338ca] text-white'
                      : 'border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#cbd5e1] hover:bg-slate-50'
                  }`}
                >
                  Sem retorno 60d
                </button>
                {/* Separador */}
                <span className="h-5 w-px bg-[#e2e8f0]" aria-hidden />
                {/* Filtros locais (todos / menor de idade) */}
                {QUICK_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setQuickFilter(f.value)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      quickFilter === f.value
                        ? 'bg-[#00a88e] text-white'
                        : 'border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#cbd5e1] hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!previewPatient ? (
            <p
              className="lg:hidden border-b border-app-border/80 bg-app-surface px-4 py-2.5 text-center text-[13px] font-medium text-[#64748b]"
              role="status"
            >
              Toque em um paciente da lista para ver o resumo
            </p>
          ) : null}

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
                        onSelect={() => {
                          setSelectedPatientCpf(patient.cpf);
                          setPreviewPatientCpf(patient.cpf);
                        }}
                        getPatientInitials={getPatientInitials}
                      />
                    </li>
                  );
                })
              )}
            </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] bg-white py-2.5">
            <button
              type="button"
              disabled={meta.first || patientListLoading}
              onClick={() => setPatientListPage((p) => Math.max(0, p - 1))}
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc] disabled:pointer-events-none disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <p className="text-[13px] font-semibold text-[#64748b]" aria-live="polite">
              Página {pageLabelNum} de {totalPagesUi}
            </p>
            <button
              type="button"
              disabled={meta.last || patientListLoading}
              onClick={() => setPatientListPage((p) => p + 1)}
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc] disabled:pointer-events-none disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            </div>
          </div>
        </div>

      {previewPatient ? (
        <>
          {/* Mobile (&lt;640px): bottom sheet */}
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
                previewHasExistingAnamnese={previewHasExistingAnamnese}
                previewAnamneseLoading={previewAnamneseLoading}
                shellClassName="patient-preview-sheet w-full border-0 shadow-none"
              />
            </div>
          </div>

          {/* Tablet (640px–1023px): drawer direita */}
          <div className="hidden sm:fixed sm:inset-0 sm:z-[200] sm:flex lg:hidden" role="dialog" aria-modal="true" aria-label="Resumo do paciente">
            <button
              type="button"
              className="absolute inset-0 bg-black/30"
              aria-label="Fechar resumo do paciente"
              onClick={closeDetail}
            />
            <aside className="relative ml-auto flex h-full w-[min(380px,100%)] flex-col overflow-y-auto overflow-x-hidden border-l border-[#e2e8f0] bg-white shadow-xl [-webkit-overflow-scrolling:touch] custom-scrollbar">
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
                previewHasExistingAnamnese={previewHasExistingAnamnese}
                previewAnamneseLoading={previewAnamneseLoading}
                shellClassName="w-full min-w-0 flex-1 border-0 shadow-none"
              />
            </aside>
          </div>

          {/* Desktop (lg+): painel lateral que empurra a lista */}
          <aside
            className="patient-preview-sheet relative z-10 mt-0 hidden w-full shrink-0 flex-col gap-0 lg:flex lg:min-w-[17rem] lg:max-w-full lg:w-[min(52rem,min(48vw,calc(100%-19rem)))] lg:sticky lg:top-4 lg:max-h-[min(calc(100dvh-5rem),920px)] lg:overflow-y-auto lg:overflow-x-hidden lg:p-0 custom-scrollbar"
            aria-labelledby={desktopTitleId}
            aria-label="Resumo do paciente"
          >
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
              previewHasExistingAnamnese={previewHasExistingAnamnese}
              previewAnamneseLoading={previewAnamneseLoading}
              shellClassName="w-full min-w-0"
            />
          </aside>
        </>
      ) : null}
      </div>

    </div>
  );
}
