import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';
import { procedimentosApi } from '../../services/api';

function parseUltimaVisitaMs(s) {
  if (!s || s === '-') return 0;
  const parts = String(s).trim().split('/');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts.map((n) => parseInt(n, 10));
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d).getTime();
}

const SORT_OPTIONS = [
  { value: 'nome-asc', label: 'Nome (A–Z)' },
  { value: 'nome-desc', label: 'Nome (Z–A)' },
  { value: 'idade-asc', label: 'Idade (menor)' },
  { value: 'idade-desc', label: 'Idade (maior)' },
  { value: 'visita-desc', label: 'Última visita (recente)' },
  { value: 'visita-asc', label: 'Última visita (antiga)' },
];

function PatientPreviewPanel({
  selectedPatient,
  procedures,
  loadingProcedures,
  detailTitleId,
  closeDetail,
  galleryPhotoCount,
  galleryPreviewSlots,
  getPatientInitials,
  setPatientDetailTab,
  setPatientView,
  shellClassName,
}) {
  return (
    <div className={shellClassName}>
      <button
        type="button"
        onClick={closeDetail}
        className="absolute right-3 top-3 z-20 p-2 rounded-xl border-[2px] border-[#00a88e]/35 bg-[#e6f7f5] text-[#0f766e] hover:bg-[#d1fae5] hover:border-[#00a88e]/50 hover:text-[#0d5c52] transition-colors shadow-sm"
        aria-label="Fechar painel"
      >
        <X className="w-4 h-4" strokeWidth={2.5} />
      </button>

      <div className="w-full flex flex-wrap flex-[1_1_100%] items-center gap-4 rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 pr-12 shadow-sm">
        <PatientAvatar
          patient={selectedPatient}
          getPatientInitials={getPatientInitials}
          className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full border-2 border-[#00a88e]/25 bg-[#e6f7f5] overflow-hidden flex items-center justify-center text-white font-bold"
          initialsClassName="text-base sm:text-lg font-bold"
          spinnerClassName="w-5 h-5"
        />
        <div className="min-w-0 flex-1 basis-[12rem]">
          <h3
            id={detailTitleId}
            className="text-lg sm:text-xl font-bold text-[#0f172a] leading-snug break-words"
          >
            {selectedPatient.nome}
          </h3>
          <p className="mt-1 text-sm text-[#64748b] break-all">{selectedPatient.email || '—'}</p>
          <p className="text-sm text-[#64748b]">{selectedPatient.telefone || '—'}</p>
        </div>
      </div>

      <section className="w-full flex-[1_1_100%] rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[#0f172a]">
          <Clock className="w-5 h-5 text-[#00a88e] shrink-0" strokeWidth={2.25} />
          <h4 className="text-base font-bold">Linha do Tempo de Procedimentos</h4>
        </div>
        {loadingProcedures ? (
          <div className="flex items-center justify-center py-6 text-sm text-[#64748b]">
            <Loader2 className="w-4 h-4 animate-spin mr-2 text-[#00a88e]" />
            Carregando linha do tempo...
          </div>
        ) : procedures.length > 0 ? (
          <div className="relative pl-2">
            <div className="absolute left-[15px] top-3 bottom-3 w-px bg-[#e2e8f0]" aria-hidden />
            <ul className="space-y-3">
              {procedures.map((proc, idx) => (
                <li key={idx} className="relative flex gap-3 pl-8">
                  <span
                    className="absolute left-[11px] top-5 h-3 w-3 rounded-full border-2 border-white bg-[#00a88e] shadow-sm"
                    aria-hidden
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5 sm:p-4 transition-colors hover:border-[#00a88e]/35 hover:bg-[#f0fdfa]/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 text-[#64748b]">
                          <Calendar className="w-4 h-4 shrink-0 text-[#94a3b8]" strokeWidth={2} />
                          <span className="text-sm font-medium">{proc.data}</span>
                          {proc.hora ? (
                            <span className="text-sm text-[#94a3b8]">· {proc.hora}</span>
                          ) : null}
                        </div>
                        <p className="text-base font-bold text-[#0f766e] leading-snug">{proc.nome}</p>
                        <p className="text-sm text-[#64748b]">
                          Realizado por {proc.profissional || '—'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 shrink-0 text-[#cbd5e1] mt-1" strokeWidth={2} aria-hidden />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[#94a3b8]">Nenhum procedimento registrado ainda.</p>
        )}
      </section>

      <section className="w-full flex-[1_1_100%] rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#0f172a]">
            <ImageIcon className="w-5 h-5 text-[#00a88e] shrink-0" strokeWidth={2.25} />
            <h4 className="text-base font-bold">Galeria de Evolução</h4>
          </div>
          <span className="text-sm font-semibold text-[#64748b]">
            {galleryPhotoCount} {galleryPhotoCount === 1 ? 'foto' : 'fotos'}
          </span>
        </div>
        <div className="grid min-h-0 grid-cols-6 gap-1 sm:gap-1.5">
          {galleryPreviewSlots.map((slot) => (
            <div
              key={slot.key}
              className={`relative h-12 min-h-0 overflow-hidden rounded-md border-2 sm:h-14 ${
                slot.highlight ? 'border-[#cbd5e1] bg-[#94a3b8]/35' : 'border-[#e2e8f0] bg-[#e2e8f0]'
              } flex flex-col items-center justify-center`}
            >
              <span className="absolute left-1 top-1 rounded bg-white/90 px-1 py-0.5 text-[8px] font-bold text-[#64748b] shadow-sm sm:text-[9px]">
                {slot.label}
              </span>
              {slot.highlight && selectedPatient.galeria?.length ? (
                <span className="text-[10px] font-semibold text-white drop-shadow-sm sm:text-xs">
                  {selectedPatient.procedures?.[0]?.data || '—'}
                </span>
              ) : (
                <ImageIcon className="h-4 w-4 text-[#94a3b8]/80 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="w-full flex-[1_1_100%] pb-1 max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            setPatientDetailTab('timeline');
            setPatientView('profile');
          }}
          className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#00a88e] px-4 py-3.5 text-sm sm:text-base font-bold text-white shadow-md transition-colors hover:bg-[#00967f] active:scale-[0.99]"
        >
          <ExternalLink className="h-5 w-5 shrink-0 opacity-95" strokeWidth={2.25} />
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
}) {
  const [sortBy, setSortBy] = useState('nome-asc');
  /** Abre o resumo lateral/modal só após clique na lista — não reutiliza seleção da jornada. */
  const [previewPatientCpf, setPreviewPatientCpf] = useState(null);
  const [previewProceduresByPatientId, setPreviewProceduresByPatientId] = useState({});
  const desktopTitleId = 'patient-detail-title';

  const filteredPatients = useMemo(() => {
    const list = patients.filter((p) => {
      if (!patientSearchQuery.trim()) return true;
      const q = patientSearchQuery.toLowerCase();
      return (
        (p.nome || '').toLowerCase().includes(q) ||
        (p.cpf || '').toLowerCase().includes(q) ||
        (p.telefone || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    });

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
  }, [patients, patientSearchQuery, sortBy]);

  const previewPatient =
    (previewPatientCpf && patients.find((p) => p.cpf === previewPatientCpf)) || null;

  useEffect(() => {
    const pid = previewPatient?.id != null ? String(previewPatient.id) : '';
    if (!pid) return undefined;
    if (Object.prototype.hasOwnProperty.call(previewProceduresByPatientId, pid)) return undefined;
    let cancelled = false;
    procedimentosApi
      .byPaciente(pid)
      .then((list) => {
        if (cancelled) return;
        setPreviewProceduresByPatientId((prev) => ({ ...prev, [pid]: Array.isArray(list) ? list : [] }));
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewProceduresByPatientId((prev) => ({ ...prev, [pid]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [previewPatient?.id, previewProceduresByPatientId]);

  const previewProcedures = useMemo(() => {
    const pid = previewPatient?.id != null ? String(previewPatient.id) : '';
    if (!pid) return [];
    const source = Array.isArray(previewProceduresByPatientId[pid])
      ? previewProceduresByPatientId[pid]
      : (Array.isArray(previewPatient?.procedures) ? previewPatient.procedures : []);
    return source.map((proc) => {
      if (proc && (proc.data || proc.nome || proc.profissional)) return proc;
      const createdAt = proc?.criadoEm ? new Date(proc.criadoEm) : null;
      const data = createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : '-';
      const hora = createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
        : '';
      return {
        data,
        hora,
        nome: proc?.procedimentoNome || proc?.nome || 'Procedimento',
        profissional: proc?.profissionalNome || proc?.profissional || '-',
      };
    });
  }, [previewPatient, previewProceduresByPatientId]);

  const previewPatientId = previewPatient?.id != null ? String(previewPatient.id) : '';
  const loadingPreviewProcedures =
    Boolean(previewPatientId) && !Object.prototype.hasOwnProperty.call(previewProceduresByPatientId, previewPatientId);

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
    setPatientDetailTab('timeline');
  };

  useEffect(() => {
    if (!previewPatient) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPreviewPatientCpf(null);
        setSelectedPatientCpf(null);
        setPatientDetailTab('timeline');
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
    <div className="flex flex-col lg:flex-row lg:items-start lg:gap-5 xl:gap-6 w-full min-w-0">
      <div className="min-w-0 flex-1 flex flex-col lg:min-w-[min(100%,19rem)]">
      <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 p-4 sm:p-5 md:p-6 flex flex-col">
        <div className="flex flex-col gap-3 mb-4">
          <div className="relative w-full min-w-0">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-[#00a88e]/60 pointer-events-none" strokeWidth={2.5} />
            <input
              type="search"
              placeholder="Buscar por nome, CPF, telefone ou e-mail..."
              value={patientSearchQuery}
              onChange={(e) => setPatientSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium text-[#0f172a] bg-white focus:outline-none focus:border-[#00a88e]/50 focus:ring-2 focus:ring-[#00a88e]/10 placeholder:text-[#94a3b8]"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-stretch">
            <div className="flex items-center gap-2 min-w-0 flex-1 sm:max-w-md lg:max-w-lg">
              <ArrowUpDown className="w-4 h-4 text-[#00a88e] shrink-0 hidden sm:block" strokeWidth={2.5} />
              <label className="sr-only" htmlFor="patient-sort">
                Ordenar lista
              </label>
              <select
                id="patient-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full min-w-0 px-3 py-3 border-[3px] border-[#00a88e]/20 rounded-xl text-[13px] font-bold text-[#0f172a] bg-white focus:outline-none focus:border-[#00a88e]/50 appearance-none cursor-pointer"
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
              className="shrink-0 w-full sm:w-auto px-4 py-3 sm:py-3 bg-[#00a88e] hover:bg-[#00967f] text-white rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 border-[3px] border-transparent transition-all shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Novo Paciente
            </button>
          </div>
        </div>

        <div className="grid w-full min-w-0 grid-cols-1 content-start gap-3 md:gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(min(100%,16.25rem),1fr))] lg:[grid-template-columns:repeat(auto-fit,minmax(min(100%,17.25rem),1fr))] xl:[grid-template-columns:repeat(auto-fit,minmax(min(100%,18.25rem),1fr))]">
            {filteredPatients.length === 0 ? (
              <div className="col-span-full text-center py-12 text-[#94a3b8] text-[14px]">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhum paciente encontrado
              </div>
            ) : (
              filteredPatients.map((patient) => {
                const selected = selectedPatientCpf === patient.cpf;
                return (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientCpf(patient.cpf);
                      setPreviewPatientCpf(patient.cpf);
                    }}
                    className={`min-h-0 w-full min-w-0 text-left rounded-xl border-[3px] transition-all active:scale-[0.99] p-3 sm:p-3.5 flex flex-col h-full min-h-[4.5rem] sm:min-h-0 ${
                      selected
                        ? 'border-[#00a88e] bg-[#f0fdfa] shadow-sm ring-2 ring-[#00a88e]/15'
                        : 'border-[#e2e8f0] bg-white hover:border-[#00a88e]/35 hover:bg-[#f8fbfb]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 w-full flex-1">
                      <PatientAvatar
                        patient={patient}
                        getPatientInitials={getPatientInitials}
                        className="w-10 h-10 rounded-full border-[2px] border-[#00a88e]/20 bg-[#e6f7f5] overflow-hidden flex items-center justify-center text-white font-bold shrink-0"
                        initialsClassName="text-[12px] font-bold"
                        spinnerClassName="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] sm:text-[14px] lg:text-[15px] font-bold text-[#0f766e] leading-snug line-clamp-2">
                          {patient.nome}
                        </div>
                        <div className="mt-1.5 text-[13px] text-[#64748b] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span>{patient.idade != null ? `${patient.idade} anos` : '—'}</span>
                          {patient.telefone ? (
                            <>
                              <span className="text-[#cbd5e1]" aria-hidden>
                                ·
                              </span>
                              <span className="truncate max-w-full">{patient.telefone}</span>
                            </>
                          ) : null}
                        </div>
                        {patient.email ? (
                          <div className="text-[13px] text-[#64748b] truncate mt-1" title={patient.email}>
                            {patient.email}
                          </div>
                        ) : null}
                        <div className="mt-2 pt-2 border-t border-[#e2e8f0]/80">
                          <div className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wide">
                            Últ. procedimento
                          </div>
                          <div className="text-[13px] font-bold text-[#00a88e] truncate mt-0.5">
                            {patient.ultimaVisita || '—'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 shrink-0 mt-0.5 opacity-80 ${selected ? 'text-[#00a88e]' : 'text-[#94a3b8]'}`}
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                  </button>
                );
              })
            )}
        </div>
      </div>
      </div>

      {previewPatient ? (
        <>
          {/* Mobile / tablet (< lg): modal com backdrop — resumo imediato sem rolar a página */}
          <div
            className="lg:hidden fixed inset-0 z-[140] flex items-end justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Resumo do paciente"
          >
            <button
              type="button"
              className="patient-preview-backdrop absolute inset-0 bg-black/35 backdrop-blur-[2px]"
              aria-label="Fechar resumo do paciente"
              onClick={closeDetail}
            />
            <PatientPreviewPanel
              selectedPatient={previewPatient}
              procedures={previewProcedures}
              loadingProcedures={loadingPreviewProcedures}
              detailTitleId={undefined}
              closeDetail={closeDetail}
              galleryPhotoCount={galleryPhotoCount}
              galleryPreviewSlots={galleryPreviewSlots}
              getPatientInitials={getPatientInitials}
              setPatientDetailTab={setPatientDetailTab}
              setPatientView={setPatientView}
              shellClassName="patient-preview-sheet relative z-10 flex w-full max-w-lg flex-row flex-wrap content-start items-start justify-start gap-4 rounded-t-[20px] border border-[#e2e8f0] border-b-0 bg-[#f1f5f9] p-4 pb-6 shadow-[0_-8px_40px_-12px_rgba(15,23,42,0.2)] sm:rounded-2xl sm:border-b sm:shadow-[0_16px_48px_-10px_rgba(15,23,42,0.14)] max-h-[min(calc(100dvh-env(safe-area-inset-bottom)-12px),92dvh)] overflow-y-auto overflow-x-hidden custom-scrollbar sm:max-h-[min(88dvh,720px)]"
            />
          </div>

          {/* Desktop (lg+): painel lateral que empurra a lista */}
          <aside
            className="hidden lg:flex patient-preview-sheet relative z-10 mt-0 flex-row flex-wrap content-start items-start justify-start gap-4 w-full lg:min-w-[17rem] lg:max-w-full lg:w-[min(52rem,min(48vw,calc(100%-19rem)))] lg:shrink rounded-2xl border border-[#e2e8f0] bg-[#f1f5f9] p-4 sm:p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] lg:sticky lg:top-4 lg:max-h-[min(calc(100dvh-5rem),920px)] overflow-y-auto overflow-x-hidden custom-scrollbar"
            aria-labelledby={desktopTitleId}
            aria-label="Resumo do paciente"
          >
            <PatientPreviewPanel
              selectedPatient={previewPatient}
              procedures={previewProcedures}
              loadingProcedures={loadingPreviewProcedures}
              detailTitleId={desktopTitleId}
              closeDetail={closeDetail}
              galleryPhotoCount={galleryPhotoCount}
              galleryPreviewSlots={galleryPreviewSlots}
              getPatientInitials={getPatientInitials}
              setPatientDetailTab={setPatientDetailTab}
              setPatientView={setPatientView}
              shellClassName="contents"
            />
          </aside>
        </>
      ) : null}
    </div>
  );
}
