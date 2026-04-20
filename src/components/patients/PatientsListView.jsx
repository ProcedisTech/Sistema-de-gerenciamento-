import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Play,
  Plus,
  Search,
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

function rowStatusDot(p) {
  if (hasClinicalAlert(p)) return { className: 'bg-[#ef4444]', title: 'Alerta clínico' };
  if (semRetorno60d(p)) return { className: 'bg-[#f59e0b]', title: 'Sem retorno há 60+ dias' };
  return { className: 'bg-[#22c55e]', title: 'Ativo' };
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
                <div className="rounded-lg border border-[#f1f5f9] p-3 transition-colors duration-100 hover:border-[#00a88e]/30">
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
    <div className="flex w-full min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-5">
      <div className="flex min-w-0 flex-1 flex-col lg:min-w-[min(100%,19rem)]">
        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
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
                          : 'Buscar por nome...'
                  }
                  className="h-11 min-h-[44px] w-full min-w-0 rounded-lg border border-[#e2e8f0] bg-white py-2 pl-9 pr-3 text-[16px] font-medium text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#00a88e]/40 sm:h-9 sm:min-h-0 sm:text-[14px]"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:min-w-0 sm:flex-nowrap">
              <div className="relative min-w-0 flex-1 sm:w-44 sm:flex-none">
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
              <button
                type="button"
                onClick={onCreatePatient}
                className="flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white transition-colors active:bg-[#00967f] sm:ml-auto sm:w-auto sm:min-h-[44px]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Novo Paciente
              </button>
            </div>
          </div>

          <div className="min-w-0 overflow-x-hidden [-webkit-overflow-scrolling:touch]">
            {/* Mobile: cards */}
            <div className="divide-y divide-[#f1f5f9] sm:hidden">
              {filteredPatients.length === 0 ? (
                <div className="px-4 py-12 text-center text-[14px] font-medium text-[#64748b]">
                  <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Nenhum paciente encontrado
                </div>
              ) : (
                filteredPatients.map((patient) => {
                  const selected = selectedPatientCpf === patient.cpf;
                  const dot = rowStatusDot(patient);
                  const clinical = hasClinicalAlert(patient);
                  const semRet = semRetorno60d(patient);
                  const anamVenc = anamneseVencidaFromPatient(patient);
                  const menor = patient.idade != null && Number(patient.idade) < 18;
                  const novo = isPatientLikelyNovo(patient);
                  const procLabel = lastProcedureLabel(patient);
                  const visitLabel = patient.ultimaVisita || '—';
                  const procMuted = procLabel === '—' || procLabel === '-';
                  const visitMuted = !patient.ultimaVisita || visitLabel === '—' || visitLabel === '-';
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientCpf(patient.cpf);
                        setPreviewPatientCpf(patient.cpf);
                      }}
                      className={`flex min-h-[72px] w-full gap-3 p-3 text-left transition-colors active:bg-[#fafafa] ${
                        selected ? 'bg-[#f0fdfa]' : 'bg-white'
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot.className}`}
                        title={dot.title}
                        aria-hidden
                      />
                      <PatientAvatar
                        patient={patient}
                        getPatientInitials={getPatientInitials}
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e2e8f0] bg-[#e6f7f5]"
                        initialsClassName="text-[12px] font-bold text-[#0f766e]"
                        spinnerClassName="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold leading-snug text-[#0f172a]">{patient.nome}</p>
                            <p className="text-[13px] text-[#64748b]">
                              {patient.idade != null ? `${patient.idade} anos` : '—'}
                            </p>
                          </div>
                          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-[#cbd5e1]" aria-hidden />
                        </div>
                        <p
                          className={`mt-1 text-[13px] font-medium ${procMuted ? 'text-[#cbd5e1]' : 'text-[#475569]'}`}
                        >
                          <span className="text-[#94a3b8]">Proc.:</span> {procLabel}
                        </p>
                        <p className={`text-[12px] font-medium ${visitMuted ? 'text-[#cbd5e1]' : 'text-[#64748b]'}`}>
                          <span className="text-[#94a3b8]">Visita:</span> {visitLabel}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {clinical ? (
                            <span className="inline-flex items-center rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[11px] font-semibold text-[#dc2626]">
                              Alerta
                            </span>
                          ) : null}
                          {semRet ? (
                            <span className="inline-flex items-center rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#ea580c]">
                              Sem retorno
                            </span>
                          ) : null}
                          {anamVenc ? (
                            <span className="inline-flex items-center rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[11px] font-semibold text-[#dc2626]">
                              Anamnese vencida
                            </span>
                          ) : null}
                          {menor ? (
                            <span className="inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                              Menor
                            </span>
                          ) : null}
                          {novo ? (
                            <span className="inline-flex items-center rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-2 py-0.5 text-[11px] font-semibold text-[#0f766e]">
                              Novo
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Tablet+ : tabela */}
            <table className="hidden w-full min-w-0 table-fixed border-collapse text-left sm:table">
              <thead>
                <tr className="border-y border-[#e2e8f0] bg-[#f8fafc]">
                  <th className="min-w-0 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                    Paciente
                  </th>
                  <th className="hidden w-[160px] shrink-0 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8] md:table-cell">
                    Último procedimento
                  </th>
                  <th className="hidden w-[120px] shrink-0 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8] md:table-cell">
                    Última visita
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8] lg:table-cell">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-[14px] font-medium text-[#64748b]">
                      <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Nenhum paciente encontrado
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const selected = selectedPatientCpf === patient.cpf;
                    const dot = rowStatusDot(patient);
                    const clinical = hasClinicalAlert(patient);
                    const semRet = semRetorno60d(patient);
                    const anamVenc = anamneseVencidaFromPatient(patient);
                    const menor = patient.idade != null && Number(patient.idade) < 18;
                    const novo = isPatientLikelyNovo(patient);
                    const procLabel = lastProcedureLabel(patient);
                    const visitLabel = patient.ultimaVisita || '—';
                    const procMuted = procLabel === '—' || procLabel === '-';
                    const visitMuted = !patient.ultimaVisita || visitLabel === '—' || visitLabel === '-';
                    return (
                      <tr
                        key={patient.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedPatientCpf(patient.cpf);
                          setPreviewPatientCpf(patient.cpf);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedPatientCpf(patient.cpf);
                            setPreviewPatientCpf(patient.cpf);
                          }
                        }}
                        className={`box-border min-h-[56px] cursor-pointer border-b border-[#f1f5f9] py-1.5 transition-colors duration-100 hover:bg-[#fafafa] md:min-h-[64px] md:py-2 ${
                          selected ? 'border-l-[3px] border-l-[#00a88e] bg-[#f0fdfa]' : 'border-l-[3px] border-l-transparent'
                        }`}
                      >
                        <td className="px-4 align-middle">
                          <div className="flex min-w-0 items-center gap-3 md:gap-4">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full md:h-2.5 md:w-2.5 ${dot.className}`}
                              title={dot.title}
                              aria-label={dot.title}
                            />
                            <PatientAvatar
                              patient={patient}
                              getPatientInitials={getPatientInitials}
                              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e2e8f0] bg-[#e6f7f5] sm:h-11 sm:w-11 md:h-12 md:w-12"
                              initialsClassName="text-[12px] font-bold text-[#0f766e] sm:text-[13px] md:text-[14px]"
                              spinnerClassName="h-4 w-4 md:h-5 md:w-5"
                            />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate text-[15px] font-semibold leading-snug text-[#0f172a] sm:text-[16px] md:text-[17px]">
                                {patient.nome}
                              </span>
                              <span className="text-[13px] font-normal leading-tight text-[#64748b] sm:text-[14px] md:text-[15px]">
                                {patient.idade != null ? `${patient.idade} anos` : '—'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden max-w-[180px] px-4 align-middle md:table-cell w-[180px]">
                          <span
                            className={`block truncate text-[13px] font-medium md:text-[14px] ${procMuted ? 'text-[#cbd5e1]' : 'text-[#475569]'}`}
                            title={procLabel}
                          >
                            {procLabel}
                          </span>
                        </td>
                        <td className="hidden w-[130px] shrink-0 whitespace-nowrap px-4 align-middle md:table-cell">
                          <span
                            className={`text-[13px] font-medium md:text-[14px] ${visitMuted ? 'text-[#cbd5e1]' : 'text-[#475569]'}`}
                          >
                            {visitLabel}
                          </span>
                        </td>
                        <td className="hidden px-4 align-middle lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {clinical ? (
                              <span className="inline-flex items-center rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[11px] font-semibold text-[#dc2626]">
                                Alerta
                              </span>
                            ) : null}
                            {semRet ? (
                              <span className="inline-flex items-center rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#ea580c]">
                                Sem retorno
                              </span>
                            ) : null}
                            {anamVenc ? (
                              <span className="inline-flex items-center rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[11px] font-semibold text-[#dc2626]">
                                Anamnese vencida
                              </span>
                            ) : null}
                            {menor ? (
                              <span className="inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                                Menor
                              </span>
                            ) : null}
                            {novo ? (
                              <span className="inline-flex items-center rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-2 py-0.5 text-[11px] font-semibold text-[#0f766e]">
                                Novo
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
      ) : null}
    </div>
  );
}
