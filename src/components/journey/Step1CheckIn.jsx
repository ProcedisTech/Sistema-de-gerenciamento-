import React from 'react';
import { UserCheck, AlertTriangle, Square, CheckSquare, Shield, Search } from 'lucide-react';
import { maskCPF, maskRG, maskTelefone, calculateAgeFromISODate, getPatientInitials } from '../utils/formatters';

export function Step1CheckIn({
  activeTab,
  setActiveTab,
  searchQuery, setSearchQuery,
  selectedPatientCpf,
  patients,
  nome, setNome,
  dataNascimento, setDataNascimento,
  idade, setIdade,
  sexo, setSexo,
  estadoCivil, setEstadoCivil,
  profissao, setProfissao,
  alergias, setAlergias,
  cpf, setCpf,
  rg, setRg,
  telefone, setTelefone,
  email, setEmail,
  lgpdInicial, setLgpdInicial,
  step1Errors, setStep1Errors,
  selectPatient,
}) {
  const handleDataNascimentoChange = (e) => {
    const novaData = e.target.value;
    setDataNascimento(novaData);
    if (novaData) {
      const idadeCalculada = calculateAgeFromISODate(novaData);
      setIdade(idadeCalculada);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return [p.nome, p.cpf, p.telefone]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#e6f7f5] p-3 rounded-2xl text-[#00a88e] border-[3px] border-[#00a88e]/25">
          <UserCheck className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Check-in do Paciente</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Identificação e dados pessoais</p>
        </div>
      </div>

      <div className="flex bg-[#f8fbfb] p-1.5 rounded-2xl mb-8 border-[3px] border-[#00a88e]/15">
        <button
          type="button"
          onClick={() => setActiveTab('existente')}
          className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${
            activeTab === 'existente'
              ? 'bg-[#00a88e] text-white shadow-md'
              : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'
          }`}
        >
          Paciente Existente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('novo')}
          className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all ${
            activeTab === 'novo'
              ? 'bg-[#00a88e] text-white shadow-md'
              : 'text-[#64748b] hover:text-[#00a88e] hover:bg-white'
          }`}
        >
          Novo Paciente
        </button>
      </div>

      {activeTab === 'existente' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00a88e]" strokeWidth={2.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, CPF ou telefone..."
              className="w-full pl-12 pr-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
            />
          </div>

          {filteredPatients.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredPatients.map((p) => {
                const isSelected = (selectedPatientCpf || '') === (p.cpf || '');
                return (
                <div
                  key={p.id}
                  onClick={() => selectPatient(p)}
                  className={`p-4 border-[3px] rounded-xl cursor-pointer transition-all flex items-center gap-4 ${
                    isSelected
                      ? 'bg-[#e6f7f5] border-[#00a88e]'
                      : 'bg-white border-[#00a88e]/15 hover:border-[#00a88e]/50 hover:bg-[#f8fbfb]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#00a88e] text-white flex items-center justify-center font-bold text-[16px] flex-shrink-0 shadow-sm">
                    {getPatientInitials(p.nome)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[16px] font-bold text-[#0f766e] mb-1.5">
                      {p.nome}
                    </h4>
                    <div className="text-[13px] text-[#475569] space-y-0.5 mb-2 font-medium">
                      <p>{p.cpf}</p>
                      <p>{p.telefone}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#ef4444] text-[12px] font-bold bg-red-50 w-fit px-2.5 py-1.5 rounded-lg border-[3px] border-red-100">
                      <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} /> Alergias: {p.alergias || '—'}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="text-center py-8 text-[#64748b] font-medium">
              Nenhum paciente encontrado
            </div>
          )}
        </div>
      ) : (
        <form className="space-y-6">
          {Object.keys(step1Errors).length > 0 && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[14px] font-bold border-[3px] border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
              Por favor, preencha todos os campos obrigatórios (*) e o termo LGPD para avançar.
            </div>
          )}

          {/* Dados Pessoais */}
          <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.nome || step1Errors.dataNascimento || step1Errors.sexo || step1Errors.estadoCivil || step1Errors.profissao ? 'border-red-300 bg-red-50/10' : 'border-[#00a88e]/25 bg-white'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#00a88e] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">1</div>
              <h4 className="text-[18px] font-bold text-[#0f766e]">Dados Pessoais</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Nome Completo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setStep1Errors({...step1Errors, nome: false});
                  }}
                  placeholder="Nome completo do paciente"
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.nome ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Data de Nascimento <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => {
                    handleDataNascimentoChange(e);
                    setStep1Errors({...step1Errors, dataNascimento: false});
                  }}
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.dataNascimento ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Idade</label>
                <input
                  type="text"
                  value={idade !== '' ? `${idade} anos` : ''}
                  placeholder="Calculada automaticamente"
                  disabled
                  className="w-full px-4 py-3 bg-[#e2e8f0]/40 border-[3px] border-[#00a88e]/15 rounded-xl text-[14px] text-[#0f172a] font-bold cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Sexo <span className="text-red-500">*</span></label>
                <select
                  value={sexo}
                  onChange={(e) => {
                    setSexo(e.target.value);
                    setStep1Errors({...step1Errors, sexo: false});
                  }}
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${step1Errors.sexo ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                >
                  <option value="">Selecione...</option>
                  <option value="f">Feminino</option>
                  <option value="m">Masculino</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Estado Civil <span className="text-red-500">*</span></label>
                <select
                  value={estadoCivil}
                  onChange={(e) => {
                    setEstadoCivil(e.target.value);
                    setStep1Errors({...step1Errors, estadoCivil: false});
                  }}
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${step1Errors.estadoCivil ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                >
                  <option value="">Selecione...</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Profissão <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={profissao}
                  onChange={(e) => {
                    setProfissao(e.target.value);
                    setStep1Errors({...step1Errors, profissao: false});
                  }}
                  placeholder="Ex: Advogada, Empresário, Estudante..."
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.profissao ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                />
              </div>
            </div>
          </div>

          {/* Documentos */}
          <div className="border-[3px] border-[#3b82f6]/25 rounded-2xl p-6 bg-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">2</div>
              <h4 className="text-[18px] font-bold text-[#1d4ed8]">Documentos</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#3b82f6]">CPF <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => {
                    setCpf(maskCPF(e.target.value));
                    setStep1Errors({...step1Errors, cpf: false});
                  }}
                  placeholder="000.000.000-00"
                  className={`w-full px-4 py-3 bg-[#eff6ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 transition-all ${step1Errors.cpf ? 'border-red-400 bg-red-50' : 'border-[#3b82f6]/30 focus:border-[#3b82f6]'}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#3b82f6]">RG</label>
                <input
                  type="text"
                  value={rg}
                  onChange={(e) => setRg(maskRG(e.target.value))}
                  placeholder="00.000.000-0"
                  className="w-full px-4 py-3 bg-[#eff6ff] border-[3px] border-[#3b82f6]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 focus:border-[#3b82f6] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className={`border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.telefone || step1Errors.email ? 'border-red-300 bg-red-50/10' : 'border-[#a855f7]/25 bg-white'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#a855f7] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">3</div>
              <h4 className="text-[18px] font-bold text-[#7e22ce]">Contato</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#a855f7]">Telefone <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(maskTelefone(e.target.value));
                    setStep1Errors({...step1Errors, telefone: false});
                  }}
                  placeholder="(00) 00000-0000"
                  className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${step1Errors.telefone ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#a855f7]">E-mail <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setStep1Errors({...step1Errors, email: false});
                  }}
                  placeholder="email@exemplo.com"
                  className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${step1Errors.email ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`}
                />
              </div>
            </div>
          </div>

          {/* Histórico Médico */}
          <div className={`bg-[#fef2f2] border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.alergias ? 'border-red-400 ring-[5px] ring-red-100' : 'border-red-300'}`}>
            <div className="flex items-center gap-3 mb-6 text-[#dc2626]">
              <AlertTriangle className="w-6 h-6" strokeWidth={2.5} />
              <h4 className="text-[18px] font-bold">Histórico Médico Importante</h4>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#dc2626]">Alergias <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={alergias}
                onChange={(e) => {
                  setAlergias(e.target.value);
                  setStep1Errors({...step1Errors, alergias: false});
                }}
                placeholder="Ex: Penicilina, Látex, ou digite 'Nenhuma'"
                className={`w-full px-4 py-3 bg-white border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-red-200 transition-all ${step1Errors.alergias ? 'border-red-500 bg-red-50' : 'border-red-300 focus:border-red-500'}`}
              />
              {step1Errors.alergias && <p className="text-[12px] text-red-600 font-bold mt-1">Este campo é obrigatório.</p>}
            </div>
          </div>

          {/* LGPD */}
          <div className={`bg-[#f0fdfa] border-[3px] rounded-2xl p-6 transition-colors ${step1Errors.lgpdInicial ? 'border-red-400 ring-[5px] ring-red-100' : 'border-[#00a88e]/30'}`}>
            <div className="flex items-center gap-3 mb-5 text-[#00a88e]">
              <Shield className="w-6 h-6" strokeWidth={2.5} />
              <h4 className="text-[18px] font-bold text-[#0f766e]">Termo LGPD Inicial</h4>
            </div>
            <div
              onClick={() => {
                setLgpdInicial(!lgpdInicial);
                setStep1Errors({...step1Errors, lgpdInicial: false});
              }}
              className={`flex items-start gap-4 p-4 bg-white border-[3px] rounded-xl cursor-pointer hover:bg-[#e6f7f5] transition-all shadow-sm ${step1Errors.lgpdInicial ? 'border-red-300 bg-red-50/50' : 'border-[#00a88e]/25'}`}
            >
              {lgpdInicial ? (
                <CheckSquare className="w-6 h-6 text-[#00a88e] mt-0.5" strokeWidth={2.5} />
              ) : (
                <Square className={`w-6 h-6 mt-0.5 ${step1Errors.lgpdInicial ? 'text-red-400' : 'text-[#00a88e]/40'}`} strokeWidth={2.5} />
              )}
              <div>
                <p className={`text-[15px] font-bold mb-1 ${lgpdInicial ? 'text-[#00a88e]' : step1Errors.lgpdInicial ? 'text-red-600' : 'text-[#0f766e]'}`}>
                  O paciente assinou o termo da LGPD
                </p>
                <p className="text-[13px] text-[#475569] font-medium leading-relaxed">
                  Declaro que li e concordo com os termos de uso e autorizo o tratamento dos meus dados pessoais.
                </p>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

