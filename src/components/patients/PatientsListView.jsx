import React from 'react';
import { ChevronRight, Clock, ExternalLink, Image as ImageIcon, Plus, Search } from 'lucide-react';

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
}) {
  const filteredPatients = patients.filter((p) => {
    if (!patientSearchQuery.trim()) return true;
    const q = patientSearchQuery.toLowerCase();
    return (
      (p.nome || '').toLowerCase().includes(q) ||
      (p.cpf || '').toLowerCase().includes(q) ||
      (p.telefone || '').toLowerCase().includes(q)
    );
  });

  const selectedPatient = patients.find((p) => p.cpf === selectedPatientCpf) || null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Gestao de Pacientes</h3>
          <p className="text-[#64748b] text-[13px] font-medium">Historico completo e dados protegidos</p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-[#00a88e] hover:bg-[#00967f] text-white rounded-xl font-bold text-[13px] flex items-center gap-1.5 border-[3px] border-transparent transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Novo Paciente
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
        <div className="w-full lg:w-[360px] flex-shrink-0">
          <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 p-4 flex flex-col h-full">
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-[#00a88e]/60" strokeWidth={2.5} />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium text-[#0f172a] bg-white focus:outline-none focus:border-[#00a88e]/50 focus:ring-2 focus:ring-[#00a88e]/10 placeholder:text-[#94a3b8]"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredPatients.length === 0 ? (
                <div className="text-center py-8 text-[#94a3b8] text-[14px]">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nenhum paciente encontrado
                </div>
              ) : (
                filteredPatients.map((patient) => {
                  const isSelected = selectedPatientCpf === patient.cpf;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatientCpf(patient.cpf)}
                      className={`w-full text-left p-3 rounded-xl border-[3px] transition-all ${
                        isSelected
                          ? 'border-[#00a88e] bg-[#f0fdfa]'
                          : 'border-[#e2e8f0] bg-white hover:border-[#00a88e]/30 hover:bg-[#f8fbfb]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0 mt-0.5">
                          {getPatientInitials(patient.nome)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-bold text-[#0f766e]">{patient.nome}</div>
                          <div className="text-[12px] text-[#64748b]">{patient.idade} anos</div>
                          <div className="text-[12px] text-[#64748b]">{patient.telefone}</div>
                          <div className="text-[12px] text-[#64748b]">Ultimo procedimento</div>
                          <div className="text-[12px] font-bold text-[#00a88e] mt-1">{patient.ultimaVisita || '-'}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {selectedPatient ? (
            <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 p-6 flex flex-col h-full">
              <div className="flex items-start justify-between pb-4 border-b-[3px] border-[#00a88e]/10">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[18px] font-bold text-[#0f172a]">{selectedPatient.nome}</h3>
                  <div className="text-[13px] text-[#64748b] font-medium space-y-1 mt-1">
                    <p>{selectedPatient.email}</p>
                    <p>{selectedPatient.telefone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="w-12 h-12 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-[16px] flex-shrink-0">
                    {getPatientInitials(selectedPatient.nome)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 mb-4 pb-4 border-b-[3px] border-[#00a88e]/10">
                {[
                  { key: 'timeline', label: 'Linha do Tempo de Procedimentos', icon: Clock },
                  { key: 'galeria', label: 'Galeria de Evolucao', icon: ImageIcon },
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
                      className={`flex items-center gap-1.5 px-3 py-2 font-bold text-[12px] whitespace-nowrap transition-all rounded-lg ${
                        patientDetailTab === key
                          ? 'text-[#00a88e] bg-[#f0fdfa] border-[2px] border-[#00a88e]'
                          : 'text-[#64748b] bg-white border-[2px] border-[#e2e8f0] hover:text-[#00a88e]'
                      }`}
                    >
                      <TabIcon className="w-4 h-4" /> {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto">
                {patientDetailTab === 'timeline' && (
                  <div className="space-y-3">
                    <h4 className="text-[14px] font-bold text-[#0f172a]">Historico de Procedimentos</h4>
                    {selectedPatient.procedures && selectedPatient.procedures.length > 0 ? (
                      selectedPatient.procedures.map((proc, idx) => (
                        <div key={idx} className="p-4 rounded-xl border-[2px] border-[#e2e8f0] bg-[#f8fbfb] hover:border-[#00a88e]/30 transition-all cursor-pointer">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-[14px] font-bold text-[#0f766e]">{proc.nome}</div>
                              <div className="text-[12px] text-[#64748b] mt-1">{proc.data} - {proc.hora}</div>
                              <div className="text-[12px] text-[#64748b]">Por: {proc.profissional}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#94a3b8] flex-shrink-0 mt-1" />
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
                    <h4 className="text-[14px] font-bold text-[#0f172a]">Galeria de Evolucao</h4>
                    {selectedPatient.galeria && selectedPatient.galeria.length > 0 ? (
                      selectedPatient.galeria.map((sessao, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="text-[12px] font-bold text-[#0f766e]">{sessao.sessao}</div>
                          <div className="grid grid-cols-3 gap-2">
                            {sessao.fotos.map((foto, fi) => (
                              <div key={fi} className="aspect-square rounded-lg bg-[#e2e8f0] flex items-center justify-center border-[2px] border-[#e2e8f0]">
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

              <div className="mt-4 pt-4 border-t-[3px] border-[#00a88e]/10">
                <button
                  type="button"
                  onClick={() => {
                    setPatientDetailTab('timeline');
                    setPatientView('profile');
                  }}
                  className="w-full px-4 py-3 bg-[#00a88e] hover:bg-[#00967f] text-white rounded-xl font-bold text-[14px] transition-all border-[3px] border-transparent shadow-md flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" strokeWidth={2.5} /> Ver Visao Geral Completa do Paciente
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 p-6 h-full flex flex-col items-center justify-center text-[#94a3b8]">
              <ImageIcon className="w-16 h-16 opacity-20 mb-3" />
              <p className="text-[14px] font-medium">Selecione um paciente para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

