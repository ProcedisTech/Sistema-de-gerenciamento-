import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Clock, ExternalLink, Image as ImageIcon, Plus, Search, X, ArrowUpDown } from 'lucide-react';

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Gestão de Pacientes</h3>
          <p className="text-[#64748b] text-[13px] font-medium">Histórico completo e dados protegidos</p>
        </div>
        <button
          type="button"
          onClick={onCreatePatient}
          className="w-full sm:w-auto px-4 py-2 bg-[#00a88e] hover:bg-[#00967f] text-white rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 border-[3px] border-transparent transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Novo Paciente
        </button>
      </div>

      <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 p-4 sm:p-6 flex flex-col min-h-[480px] max-h-[min(72vh,720px)] sm:max-h-[min(76vh,800px)]">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end mb-4 shrink-0">
          <div className="relative flex-1 min-w-0">
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
          <div className="flex items-center gap-2 min-w-0 lg:w-64 xl:w-72">
            <ArrowUpDown className="w-4 h-4 text-[#00a88e] shrink-0 hidden sm:block" strokeWidth={2.5} />
            <label className="sr-only" htmlFor="patient-sort">
              Ordenar lista
            </label>
            <select
              id="patient-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-3 border-[3px] border-[#00a88e]/20 rounded-xl text-[13px] font-bold text-[#0f172a] bg-white focus:outline-none focus:border-[#00a88e]/50 appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 -mr-1 custom-scrollbar">
          {filteredPatients.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8] text-[14px]">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhum paciente encontrado
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => setSelectedPatientCpf(patient.cpf)}
                className="w-full text-left p-3 sm:p-4 rounded-xl border-[3px] transition-all border-[#e2e8f0] bg-white hover:border-[#00a88e]/35 hover:bg-[#f8fbfb] active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0">
                    {getPatientInitials(patient.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] sm:text-[14px] font-bold text-[#0f766e] break-words leading-snug">
                      {patient.nome}
                    </div>
                    <div className="text-[12px] text-[#64748b] mt-1">{patient.idade} anos</div>
                    <div className="text-[12px] text-[#64748b] break-all">{patient.telefone}</div>
                    {patient.email ? (
                      <div className="text-[12px] text-[#64748b] break-all">
                        {patient.email}
                      </div>
                    ) : null}
                    <div className="text-[12px] text-[#64748b] mt-1">Último procedimento</div>
                    <div className="text-[12px] font-bold text-[#00a88e]">{patient.ultimaVisita || '-'}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#94a3b8] flex-shrink-0 mt-1" strokeWidth={2} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedPatient ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-stretch sm:items-stretch sm:justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-detail-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            aria-label="Fechar painel do paciente"
            onClick={closeDetail}
          />
          <div className="relative z-10 flex flex-col w-full sm:max-w-md md:max-w-lg h-[min(92dvh,880px)] sm:h-full bg-white sm:rounded-none rounded-t-[24px] border-t-[3px] sm:border-t-0 sm:border-l-[3px] border-[#00a88e]/25 shadow-2xl overflow-hidden animate-in fade-in duration-200 slide-in-from-bottom-4 sm:slide-in-from-right-4">
            <div className="flex items-start gap-3 p-4 sm:p-5 border-b-[3px] border-[#00a88e]/10 shrink-0">
              <button
                type="button"
                onClick={closeDetail}
                className="p-2 rounded-xl border-[2px] border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fbfb] hover:text-[#0f172a] transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
              <div className="flex-1 min-w-0">
                <h3 id="patient-detail-title" className="text-[17px] font-bold text-[#0f172a] break-words leading-tight">
                  {selectedPatient.nome}
                </h3>
                <div className="text-[13px] text-[#64748b] font-medium space-y-0.5 mt-1 break-all">
                  <p>{selectedPatient.email}</p>
                  <p>{selectedPatient.telefone}</p>
                </div>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-[14px] shrink-0">
                {getPatientInitials(selectedPatient.nome)}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 px-4 sm:px-5 py-3 border-b-[3px] border-[#00a88e]/10 shrink-0">
              {[
                { key: 'timeline', label: 'Linha do Tempo', icon: Clock },
                { key: 'galeria', label: 'Galeria', icon: ImageIcon },
              ].map(({ key, label, icon }) => {
                const TabIcon = icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPatientDetailTab(key);
                      setPatientView('list');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 font-bold text-[12px] transition-all rounded-lg ${
                      patientDetailTab === key
                        ? 'text-[#00a88e] bg-[#f0fdfa] border-[2px] border-[#00a88e]'
                        : 'text-[#64748b] bg-white border-[2px] border-[#e2e8f0] hover:text-[#00a88e]'
                    }`}
                  >
                    <TabIcon className="w-4 h-4 shrink-0" /> {label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 custom-scrollbar">
              {patientDetailTab === 'timeline' && (
                <div className="space-y-3">
                  <h4 className="text-[14px] font-bold text-[#0f172a]">Histórico de Procedimentos</h4>
                  {selectedPatient.procedures && selectedPatient.procedures.length > 0 ? (
                    selectedPatient.procedures.map((proc, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border-[2px] border-[#e2e8f0] bg-[#f8fbfb] hover:border-[#00a88e]/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold text-[#0f766e] break-words">{proc.nome}</div>
                            <div className="text-[12px] text-[#64748b] mt-1">
                              {proc.data} — {proc.hora}
                            </div>
                            <div className="text-[12px] text-[#64748b]">Por: {proc.profissional}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#94a3b8] shrink-0 mt-1" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-[#94a3b8] text-center py-6">Nenhum procedimento registrado</p>
                  )}
                </div>
              )}

              {patientDetailTab === 'galeria' && (
                <div className="space-y-4">
                  <h4 className="text-[14px] font-bold text-[#0f172a]">Galeria de Evolução</h4>
                  {selectedPatient.galeria && selectedPatient.galeria.length > 0 ? (
                    selectedPatient.galeria.map((sessao, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="text-[12px] font-bold text-[#0f766e]">{sessao.sessao}</div>
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
                    <p className="text-[13px] text-[#94a3b8] text-center py-6">Nenhuma foto registrada</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t-[3px] border-[#00a88e]/10 shrink-0 bg-[#f8fbfb]/80 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setPatientDetailTab('timeline');
                  setPatientView('profile');
                }}
                className="w-full px-4 py-3 bg-[#00a88e] hover:bg-[#00967f] text-white rounded-xl font-bold text-[14px] transition-all border-[3px] border-transparent shadow-md flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4 shrink-0" strokeWidth={2.5} /> Ver visão geral completa
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
