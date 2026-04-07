import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Clock, ExternalLink, Image as ImageIcon, Plus, Search, X, ArrowUpDown } from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';

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

export function PatientsListView({
  patients,
  patientSearchQuery,
  setPatientSearchQuery,
  selectedPatientCpf,
  setSelectedPatientCpf,
  patientDetailTab,
  setPatientDetailTab,
  setPatientView,
  getPatientInitials,
  onCreatePatient,
}) {
  const [sortBy, setSortBy] = useState('nome-asc');

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

  const selectedPatient = patients.find((p) => p.cpf === selectedPatientCpf) || null;

  const closeDetail = () => {
    setSelectedPatientCpf(null);
    setPatientDetailTab('timeline');
  };

  useEffect(() => {
    if (!selectedPatient) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedPatientCpf(null);
        setPatientDetailTab('timeline');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedPatient, setSelectedPatientCpf, setPatientDetailTab]);

  return (
    <div className="flex flex-col">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 content-start">
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
                    onClick={() => setSelectedPatientCpf(patient.cpf)}
                    className={`min-h-0 text-left rounded-xl border-[3px] transition-all active:scale-[0.99] p-2.5 sm:p-3 flex flex-col h-full ${
                      selected
                        ? 'border-[#00a88e] bg-[#f0fdfa] shadow-sm ring-2 ring-[#00a88e]/15'
                        : 'border-[#e2e8f0] bg-white hover:border-[#00a88e]/35 hover:bg-[#f8fbfb]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
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
                        className={`w-5 h-5 shrink-0 mt-1 hidden sm:block ${selected ? 'text-[#00a88e]' : 'text-[#94a3b8]'}`}
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

      {selectedPatient ? (
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center sm:justify-end sm:p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-detail-title"
        >
          <button
            type="button"
            className="patient-preview-backdrop absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            aria-label="Fechar painel do paciente"
            onClick={closeDetail}
          />
          <div className="patient-preview-sheet relative z-10 flex flex-col w-full sm:w-[min(100vw-1.5rem,21rem)] md:w-[min(100vw-2rem,23.5rem)] lg:w-[min(100vw-2rem,26rem)] max-h-[min(85dvh,620px)] sm:max-h-[min(88vh,560px)] lg:max-h-[min(90vh,640px)] bg-white rounded-t-[20px] sm:rounded-2xl sm:rounded-r-none border border-[#00a88e]/18 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.12)] overflow-hidden max-sm:max-h-[min(calc(100dvh-env(safe-area-inset-bottom)-12px),92dvh)]">
            <div className="flex items-start gap-2.5 px-3 pt-3 pb-2.5 sm:px-3.5 sm:pt-3.5 md:gap-3 md:px-4 md:pt-4 md:pb-3 border-b border-[#00a88e]/10 shrink-0 bg-white">
              <button
                type="button"
                onClick={closeDetail}
                className="p-1.5 rounded-lg border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fbfb] hover:text-[#0f172a] transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wide text-[#94a3b8] mb-0.5">Resumo</p>
                <h3 id="patient-detail-title" className="text-[15px] md:text-[16px] lg:text-[17px] font-bold text-[#0f172a] break-words leading-snug">
                  {selectedPatient.nome}
                </h3>
                <div className="text-[11px] md:text-[12px] text-[#64748b] font-medium space-y-0.5 mt-1 break-all leading-snug">
                  <p>{selectedPatient.email}</p>
                  <p>{selectedPatient.telefone}</p>
                </div>
              </div>
              <PatientAvatar
                patient={selectedPatient}
                getPatientInitials={getPatientInitials}
                className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full border border-[#00a88e]/20 bg-[#e6f7f5] overflow-hidden flex items-center justify-center text-white font-bold shrink-0"
                initialsClassName="text-[12px] sm:text-[13px] font-bold"
                spinnerClassName="w-4 h-4 sm:w-[18px] sm:h-[18px]"
              />
            </div>

            {/* Mobile: CTA duplicado no topo — a barra inferior do app (z-130) cobria o rodapé do sheet (z-50). */}
            <div className="px-3 pb-2 sm:hidden shrink-0 border-b border-[#00a88e]/10 bg-white">
              <button
                type="button"
                onClick={() => {
                  setPatientDetailTab('timeline');
                  setPatientView('profile');
                }}
                className="w-full min-h-[48px] rounded-xl bg-[#00a88e] text-white font-bold text-[13px] flex items-center justify-center gap-2 border-[2px] border-[#00a88e] shadow-sm active:scale-[0.99]"
              >
                <ExternalLink className="w-4 h-4 shrink-0" strokeWidth={2.25} />
                Abrir perfil completo
              </button>
            </div>

            <div
              className="flex gap-2 px-3 py-2 md:px-4 md:py-2.5 border-b border-[#00a88e]/10 shrink-0 bg-[#fafafa] max-sm:flex-nowrap sm:flex-wrap"
              role="tablist"
              aria-label="Seções do resumo"
            >
              {[
                { key: 'timeline', short: 'Linha do tempo', icon: Clock },
                { key: 'galeria', short: 'Galeria', icon: ImageIcon },
              ].map(({ key, short, icon }) => {
                const TabIcon = icon;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={patientDetailTab === key}
                    onClick={() => {
                      setPatientDetailTab(key);
                      setPatientView('list');
                    }}
                    className={`flex flex-1 min-w-0 sm:flex-initial items-center justify-center gap-1.5 max-sm:min-h-[44px] max-sm:px-2 sm:gap-1 md:gap-1.5 sm:px-2 sm:py-1.5 md:px-2.5 md:py-2 font-bold text-[11px] sm:text-[10px] md:text-[11px] transition-all rounded-xl sm:rounded-md ${
                      patientDetailTab === key
                        ? 'text-[#00a88e] bg-white border-[2px] sm:border border-[#00a88e]/35 shadow-sm'
                        : 'text-[#64748b] bg-white/80 sm:bg-transparent border-[2px] sm:border border-[#e2e8f0] sm:border-transparent hover:text-[#00a88e]'
                    }`}
                  >
                    <TabIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 shrink-0" strokeWidth={2.25} />
                    <span className="truncate max-sm:text-center">{short}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 md:px-4 md:py-4 custom-scrollbar">
              {patientDetailTab === 'timeline' && (
                <div className="space-y-2 md:space-y-2.5">
                  <h4 className="text-[11px] md:text-[12px] font-bold uppercase tracking-wide text-[#94a3b8]">Procedimentos</h4>
                  {selectedPatient.procedures && selectedPatient.procedures.length > 0 ? (
                    selectedPatient.procedures.map((proc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 md:p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fbfb]/80 hover:border-[#00a88e]/25 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] md:text-[13px] font-bold text-[#0f766e] break-words leading-snug">{proc.nome}</div>
                            <div className="text-[10px] md:text-[11px] text-[#64748b] mt-0.5">
                              {proc.data} — {proc.hora}
                            </div>
                            <div className="text-[10px] md:text-[11px] text-[#94a3b8]">Por: {proc.profissional}</div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#cbd5e1] shrink-0 mt-0.5" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] md:text-[12px] text-[#94a3b8] text-center py-4 leading-relaxed">Nenhum procedimento registrado</p>
                  )}
                </div>
              )}

              {patientDetailTab === 'galeria' && (
                <div className="space-y-3 md:space-y-3.5">
                  <h4 className="text-[11px] md:text-[12px] font-bold uppercase tracking-wide text-[#94a3b8]">Galeria</h4>
                  {selectedPatient.galeria && selectedPatient.galeria.length > 0 ? (
                    selectedPatient.galeria.map((sessao, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="text-[12px] md:text-[13px] font-bold text-[#0f766e]">{sessao.sessao}</div>
                        <div className="grid grid-cols-3 gap-2">
                          {sessao.fotos.map((foto, fi) => (
                            <div
                              key={fi}
                              className="aspect-square rounded-lg bg-[#e2e8f0] flex items-center justify-center border-[2px] border-[#e2e8f0]"
                            >
                              <ImageIcon className="w-6 h-6 text-[#94a3b8]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] md:text-[12px] text-[#94a3b8] text-center py-4 leading-relaxed">Nenhuma foto registrada</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom),12px)] md:px-4 md:pt-2.5 border-t border-[#00a88e]/10 shrink-0 bg-[#fafafa] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom),16px)]">
              <button
                type="button"
                onClick={() => {
                  setPatientDetailTab('timeline');
                  setPatientView('profile');
                }}
                className="w-full min-h-[48px] sm:min-h-0 px-3 py-3 sm:py-2 md:px-4 md:py-2.5 rounded-xl sm:rounded-lg text-[13px] sm:text-[11px] md:text-[12px] font-bold text-[#00a88e] bg-white border-[2px] sm:border border-[#00a88e]/35 hover:bg-[#f0fdfa] hover:border-[#00a88e]/50 transition-all flex items-center justify-center gap-2 sm:gap-1.5 shadow-sm active:scale-[0.99] sm:active:scale-100"
              >
                <ExternalLink className="w-4 h-4 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 shrink-0 opacity-90" strokeWidth={2.25} />
                Perfil completo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
