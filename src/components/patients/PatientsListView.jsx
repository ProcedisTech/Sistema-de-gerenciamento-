import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Play,
  Plus,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';
import { anamneseApi, procedimentosApi } from '../../services/api';

function parseUltimaVisitaMs(s) {
  if (!s || s === '-') return 0;
  const parts = String(s).trim().split('/');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts.map((n) => parseInt(n, 10));
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d).getTime();
}

function hasClinicalAlert(p) {
  return Boolean(String(p?.alergias || '').trim() || String(p?.condicoesSaude || '').trim());
}

/** Dias desde última visita (DD/MM/AAAA); `null` se data ausente ou inválida. */
function daysSinceUltimaVisita(p) {
  const ms = parseUltimaVisitaMs(p?.ultimaVisita);
  if (!ms) return null;
  return (Date.now() - ms) / 86400000;
}

function semRetorno60d(p) {
  const d = daysSinceUltimaVisita(p);
  return d != null && d > 60;
}

function lastProcedureLabel(p) {
  const procs = Array.isArray(p?.procedures) ? p.procedures : [];
  if (!procs.length) return '—';
  const last = procs[procs.length - 1];
  const n = last?.nome || last?.nomeProcedimento;
  return n ? String(n) : '—';
}

/** Data a exibir no rodapé: último procedimento (criadoEm / data) ou fallback ultimaVisita. */
function lastProcedureDateForCard(p) {
  const procs = Array.isArray(p?.procedures) ? p.procedures : [];
  if (procs.length) {
    const last = procs[procs.length - 1];
    if (last?.criadoEm) {
      const t = new Date(last.criadoEm);
      if (!Number.isNaN(t.getTime())) {
        return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      }
    }
    const rawData = last?.data != null ? String(last.data).trim() : '';
    if (rawData && rawData !== '—' && rawData !== '-') return rawData;
  }
  const uv = String(p?.ultimaVisita || '').trim();
  if (uv && uv !== '—' && uv !== '-') return uv;
  return '—';
}

/** Heurística visual: sem visita nem procedimento na lista local. */
function isPatientLikelyNovo(p) {
  const uv = String(p?.ultimaVisita || '').trim();
  const noVisita = !uv || uv === '-' || uv === '—';
  return noVisita && lastProcedureLabel(p) === '—';
}

/** Quando o backend enviar ISO da última anamnese no DTO da lista. */
function anamneseVencidaFromPatient(p) {
  const raw = p?.ultimaAnamneseDataHora || p?.ultimaAnamneseEm;
  if (!raw) return false;
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return false;
  const lim = new Date();
  lim.setMonth(lim.getMonth() - 6);
  return t < lim;
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

const patientListAvatarClass =
  'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-[#e6f7f5] sm:h-11 sm:w-11';

/**
 * Cartão de paciente na coluna esquerda (estilo protótipo: branco, sombra, sobre fundo suave).
 */
function PatientListCard({ patient, selected, onSelect, getPatientInitials }) {
  const clinical = hasClinicalAlert(patient);
  const semRet = semRetorno60d(patient);
  const anamVenc = anamneseVencidaFromPatient(patient);
  const menor = patient.idade != null && Number(patient.idade) < 18;
  const novo = isPatientLikelyNovo(patient);
  const lastProcDate = lastProcedureDateForCard(patient);
  const lastProcDateMuted = lastProcDate === '—' || lastProcDate === '-';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full min-w-0 items-start gap-2.5 rounded-lg border-2 p-2.5 text-left shadow-app-card transition-all duration-150 active:bg-emerald-100/50 sm:gap-3 sm:p-3 ${
        selected
          ? 'border-[#0d9488] bg-white shadow-sm ring-1 ring-[#0d9488]/20'
          : 'border-app-border bg-white hover:border-[#2dd4bf] hover:bg-emerald-50/40 hover:shadow-sm'
      }`}
    >
      <PatientAvatar
        patient={patient}
        getPatientInitials={getPatientInitials}
        className={patientListAvatarClass}
        initialsClassName="text-xs font-bold text-app-accent-deep sm:text-[13px]"
        spinnerClassName="h-4 w-4"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <p className="min-w-0 flex-1 truncate text-[14px] font-bold leading-snug text-[#0f172a] sm:text-[15px]">
            {patient.nome}
          </p>
          <Shield
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-accent"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>
        <div className="mt-0.5 space-y-0.5 text-[12px] text-[#64748b] sm:text-[13px]">
          <p>{patient.idade != null ? `${patient.idade} anos` : '—'}</p>
          <p className="truncate" title={patient.telefone || undefined}>
            {patient.telefone || '—'}
          </p>
        </div>
        <div className="mt-1.5 border-t border-slate-100 pt-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
              Último procedimento
            </span>
            <span
              className={
                lastProcDateMuted
                  ? 'shrink-0 text-[13px] font-semibold text-[#cbd5e1]'
                  : 'shrink-0 text-[13px] font-semibold text-app-accent'
              }
              title={String(lastProcDate)}
            >
              {lastProcDate}
            </span>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-0.5">
          {clinical ? (
            <span className="inline-flex items-center rounded-full border border-[#fecaca] bg-[#fef2f2] px-1.5 py-px text-[10px] font-semibold text-[#dc2626]">
              Alerta
            </span>
          ) : null}
          {semRet ? (
            <span className="inline-flex items-center rounded-full border border-[#fed7aa] bg-[#fff7ed] px-1.5 py-px text-[10px] font-semibold text-[#ea580c]">
              Sem retorno
            </span>
          ) : null}
          {anamVenc ? (
            <span className="inline-flex items-center rounded-full border border-[#fecaca] bg-[#fef2f2] px-1.5 py-px text-[10px] font-semibold text-[#dc2626]">
              Anamnese vencida
            </span>
          ) : null}
          {menor ? (
            <span className="inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-px text-[10px] font-semibold text-[#2563eb]">
              Menor
            </span>
          ) : null}
          {novo ? (
            <span className="inline-flex items-center rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-1.5 py-px text-[10px] font-semibold text-[#0f766e]">
              Novo
            </span>
          ) : null}
        </div>
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
  galleryPhotoCount,
  galleryPreviewSlots,
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

  const timelineProcedures =
    previewProcedures.length > 0
      ? previewProcedures.map((proc) => ({
        data: proc.criadoEm
          ? new Date(proc.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          : '-',
        hora: proc.criadoEm
          ? new Date(proc.criadoEm).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })
          : '',
        nome: proc.procedimentoNome || proc.nome || 'Procedimento',
        profissional: proc.profissionalNome || proc.profissional || '—',
      }))
      : (selectedPatient.procedures || []);

  const handleIniciarAtendimentoClick = () => {
    if (previewAnamneseLoading || typeof onStartAttendance !== 'function') return;
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
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e2e8f0] bg-[#e6f7f5]"
          initialsClassName="text-[11px] font-bold text-[#0f766e]"
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
      </div>

      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
          Linha do Tempo de Procedimentos
        </h4>
        {loadingPreviewProcedures ? (
          <div className="py-6 text-center text-[13px] font-normal text-[#64748b]">Carregando procedimentos...</div>
        ) : timelineProcedures.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {timelineProcedures.map((proc, idx) => (
              <li key={idx}>
                <div className="rounded-lg border border-app-border p-3 transition-colors duration-100 shadow-sm hover:bg-app-nav-hover">
                  <p className="text-[11px] font-normal text-[#94a3b8]">
                    {proc.data}
                    {proc.hora ? ` · ${proc.hora}` : ''}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#0f766e]">{proc.nome}</p>
                  <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">Realizado por {proc.profissional || '—'}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-[13px] font-normal text-[#64748b]">Nenhum procedimento registrado</p>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Galeria de Evolução</h4>
          <span className="text-[12px] font-medium text-[#64748b]">
            {galleryPhotoCount} {galleryPhotoCount === 1 ? 'foto' : 'fotos'}
          </span>
        </div>
        <div className="grid min-h-0 grid-cols-6 gap-1.5">
          {galleryPreviewSlots.map((slot) => (
            <div
              key={slot.key}
              className={`relative flex h-10 min-h-0 flex-col items-center justify-center overflow-hidden rounded-md border border-[#f1f5f9] sm:h-12 ${
                slot.highlight ? 'bg-[#e2e8f0]/80' : 'bg-[#f8fafc]'
              }`}
            >
              <span className="absolute left-1 top-1 rounded bg-white/95 px-1 py-0.5 text-[8px] font-semibold text-[#64748b] shadow-sm sm:text-[9px]">
                {slot.label}
              </span>
              {slot.highlight && selectedPatient.galeria?.length ? (
                <span className="text-[10px] font-semibold text-[#475569] drop-shadow-sm sm:text-[11px]">
                  {selectedPatient.procedures?.[0]?.data || '—'}
                </span>
              ) : (
                <ImageIcon className="h-4 w-4 text-[#94a3b8]/90 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
              )}
            </div>
          ))}
        </div>
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
          Ver Visão Geral Completa do Paciente
        </button>
      </div>
    </div>
  );
}

export function PatientsListView({
  patients,
  patientSearchQuery,
  setPatientSearchQuery,
  selectedPatientCpf,
  setSelectedPatientCpf,
  setPatientDetailTab,
  setPatientView,
  getPatientInitials,
  onCreatePatient,
  onStartAttendance,
  patientsListOrder,
  setPatientsListOrder,
}) {
  const [sortBy, setSortBy] = useState(() =>
    patientsListOrder === 'birthday_asc' ? 'birthday-asc' : 'nome-asc'
  );
  /** Abre o resumo lateral/modal só após clique na lista — não reutiliza seleção da jornada. */
  const [previewPatientCpf, setPreviewPatientCpf] = useState(null);
  const [tipoBusca, setTipoBusca] = useState('nome');
  const desktopTitleId = 'patient-detail-title';
  const [previewProcedures, setPreviewProcedures] = useState([]);
  const [loadingPreviewProcedures, setLoadingPreviewProcedures] = useState(false);
  const [previewAnamneseList, setPreviewAnamneseList] = useState([]);
  /** Paciente ao qual `previewAnamneseList` corresponde após o último fetch concluído; `null` = nenhum. */
  const [previewAnamneseListOwnerId, setPreviewAnamneseListOwnerId] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect -- espelhar ordenação vinda do pai */
  useEffect(() => {
    if (patientsListOrder === 'birthday_asc') setSortBy('birthday-asc');
  }, [patientsListOrder]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const normalizeBuscaDigits = (v) => String(v || '').replace(/\D/g, '').toLowerCase();

  const handleBuscaChange = (value) => {
    if (tipoBusca === 'cpf') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const masked = digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      setPatientSearchQuery(masked);
    } else if (tipoBusca === 'telefone') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const masked = digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
      setPatientSearchQuery(masked);
    } else {
      setPatientSearchQuery(value);
    }
  };

  const filteredPatients = useMemo(() => {
    const list = patients.filter((p) => {
      const q = patientSearchQuery.trim();
      if (!q) return true;
      if (tipoBusca === 'cpf') {
        return normalizeBuscaDigits(p.cpf).includes(normalizeBuscaDigits(q));
      }
      if (tipoBusca === 'telefone') {
        return normalizeBuscaDigits(p.telefone).includes(normalizeBuscaDigits(q));
      }
      if (tipoBusca === 'email') {
        return (p.email || '').toLowerCase().includes(q.toLowerCase());
      }
      return (p.nome || '').toLowerCase().includes(q.toLowerCase());
    });

    if (sortBy === 'birthday-asc') {
      return list;
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'nome-desc':
          return (b.nome || '').localeCompare(a.nome || '', 'pt-BR', { sensitivity: 'base' });
        case 'idade-asc':
          return (a.idade ?? 0) - (b.idade ?? 0);
        case 'idade-desc':
          return (b.idade ?? 0) - (a.idade ?? 0);
        case 'visita-desc':
          return parseUltimaVisitaMs(b.ultimaVisita) - parseUltimaVisitaMs(a.ultimaVisita);
        case 'visita-asc':
          return parseUltimaVisitaMs(a.ultimaVisita) - parseUltimaVisitaMs(b.ultimaVisita);
        case 'nome-asc':
        default:
          return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
      }
    });
    return sorted;
  }, [patients, patientSearchQuery, sortBy, tipoBusca]);

  const previewPatient =
    (previewPatientCpf && patients.find((p) => p.cpf === previewPatientCpf)) || null;

  /* eslint-disable react-hooks/set-state-in-effect -- reset ao fechar / carregar procedimentos do preview */
  useEffect(() => {
    if (!previewPatient?.id) {
      setPreviewProcedures([]);
      setLoadingPreviewProcedures(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingPreviewProcedures(true);
    procedimentosApi
      .byPaciente(previewPatient.id)
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
  }, [previewPatient?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Reset ao fechar o preview / lista por paciente (mesmo padrão do efeito de procedimentos acima). */
  /* eslint-disable react-hooks/set-state-in-effect -- branch síncrono ao trocar paciente ou fechar */
  useEffect(() => {
    if (!previewPatient?.id) {
      setPreviewAnamneseList([]);
      setPreviewAnamneseListOwnerId(null);
      return undefined;
    }
    let cancelled = false;
    anamneseApi
      .listPaciente(previewPatient.id)
      .then((list) => {
        if (!cancelled) setPreviewAnamneseList(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setPreviewAnamneseList([]);
      })
      .finally(() => {
        if (!cancelled) setPreviewAnamneseListOwnerId(previewPatient.id);
      });
    return () => {
      cancelled = true;
    };
  }, [previewPatient?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const previewAnamneseLoading = Boolean(
    previewPatient?.id && previewAnamneseListOwnerId !== previewPatient.id,
  );

  const previewHasExistingAnamnese = useMemo(() => {
    if (!previewPatient?.id || previewAnamneseListOwnerId !== previewPatient.id) return false;
    return previewHasExistingAnamneseFromList(previewAnamneseList);
  }, [previewPatient?.id, previewAnamneseListOwnerId, previewAnamneseList]);

  const galleryPhotoCount = useMemo(() => {
    if (!previewPatient?.galeria?.length) return 0;
    return previewPatient.galeria.reduce((acc, s) => acc + (s.fotos?.length || 0), 0);
  }, [previewPatient]);

  const galleryPreviewSlots = useMemo(() => {
    const slots = [];
    if (previewPatient?.galeria?.length) {
      previewPatient.galeria.forEach((sessao, si) => {
        (sessao.fotos || []).forEach((_, fi) => {
          if (slots.length >= 6) return;
          slots.push({
            key: `${si}-${fi}`,
            label: `Foto ${slots.length + 1}`,
            highlight: slots.length === 0,
          });
        });
      });
    }
    while (slots.length < 6) {
      slots.push({
        key: `empty-${slots.length}`,
        label: `Foto ${slots.length + 1}`,
        highlight: false,
      });
    }
    return slots.slice(0, 6);
  }, [previewPatient]);

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
        <button
          type="button"
          onClick={onCreatePatient}
          className="flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors active:bg-[#00967f] sm:w-auto sm:min-w-0"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Novo Paciente
        </button>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-5">
        <div className="flex min-w-0 flex-1 flex-col lg:min-w-[min(100%,19rem)]">
          <div className="overflow-hidden rounded-xl border border-app-border bg-white shadow-sm">
            <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-app-border bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center">
              <select
                value={tipoBusca}
                onChange={(e) => {
                  setTipoBusca(e.target.value);
                  setPatientSearchQuery('');
                }}
                className="h-11 min-h-[44px] w-full shrink-0 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[16px] font-medium text-[#475569] outline-none focus:border-[#00a88e]/40 sm:h-9 sm:min-h-0 sm:w-28 sm:text-[14px]"
                aria-label="Tipo de busca"
              >
                <option value="nome">Nome</option>
                <option value="cpf">CPF</option>
                <option value="telefone">Telefone</option>
                <option value="email">E-mail</option>
              </select>
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <input
                  type="text"
                  value={patientSearchQuery}
                  onChange={(e) => handleBuscaChange(e.target.value)}
                  placeholder={
                    tipoBusca === 'cpf'
                      ? '000.000.000-00'
                      : tipoBusca === 'telefone'
                        ? '(00) 00000-0000'
                        : tipoBusca === 'email'
                          ? 'email@exemplo.com'
                          : 'Buscar paciente...'
                  }
                  className="h-11 min-h-[44px] w-full min-w-0 rounded-lg border border-[#e2e8f0] bg-white py-2 pl-9 pr-3 text-[16px] font-medium text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#00a88e]/40 sm:h-9 sm:min-h-0 sm:text-[14px]"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="relative w-full min-w-0 sm:w-44 sm:shrink-0">
                <ArrowUpDown
                  className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <label className="sr-only" htmlFor="patient-sort">
                  Ordenar lista
                </label>
                <select
                  id="patient-sort"
                  value={sortBy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSortBy(v);
                    setPatientsListOrder?.(v === 'birthday-asc' ? 'birthday_asc' : null);
                  }}
                  className="h-11 min-h-[44px] w-full cursor-pointer appearance-none rounded-lg border border-[#e2e8f0] bg-white py-2 pl-8 pr-3 text-[16px] font-semibold text-[#0f172a] outline-none focus:border-[#00a88e]/40 sm:h-9 sm:min-h-0 sm:text-[13px]"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
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

          <div className="min-w-0 overflow-x-hidden bg-app-surface [-webkit-overflow-scrolling:touch]">
            <ul className="flex list-none flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-3" aria-label="Lista de pacientes">
              {filteredPatients.length === 0 ? (
                <li className="px-2 py-12 text-center text-[14px] font-medium text-[#64748b]">
                  <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Nenhum paciente encontrado
                </li>
              ) : (
                filteredPatients.map((patient) => {
                  const selected = selectedPatientCpf === patient.cpf;
                  return (
                    <li key={patient.id} className="min-w-0">
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
                galleryPhotoCount={galleryPhotoCount}
                galleryPreviewSlots={galleryPreviewSlots}
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
                galleryPhotoCount={galleryPhotoCount}
                galleryPreviewSlots={galleryPreviewSlots}
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
              galleryPhotoCount={galleryPhotoCount}
              galleryPreviewSlots={galleryPreviewSlots}
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
      ) : (
        <aside
          className="patient-preview-sheet relative z-10 mt-0 hidden w-full shrink-0 flex-col gap-0 lg:flex lg:min-w-[17rem] lg:max-w-full lg:w-[min(52rem,min(48vw,calc(100%-19rem)))] lg:sticky lg:top-4 lg:max-h-[min(calc(100dvh-5rem),920px)] lg:overflow-y-auto lg:overflow-x-hidden lg:p-0 custom-scrollbar"
          aria-label="Detalhes do paciente"
        >
          <div
            className="relative flex min-h-[min(280px,calc((100dvh-5rem-2rem)/2))] w-full min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-[#e2e8f0] bg-white p-5 text-center shadow-lg"
            role="status"
          >
            <ImageIcon className="h-9 w-9 text-[#cbd5e1]" strokeWidth={1.25} aria-hidden />
            <p className="px-1 text-[16px] font-semibold leading-snug text-[#334155] sm:text-[17px]">
              Selecione um paciente para ver os detalhes
            </p>
          </div>
        </aside>
      )}
    </div>
    </div>
  );
}
