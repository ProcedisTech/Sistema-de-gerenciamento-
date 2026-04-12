import React, { useEffect, useState } from 'react';
import { UserCheck, AlertTriangle, Search } from 'lucide-react';
import {
  maskCPF,
  maskRG,
  maskTelefone,
  calculateAgeFromISODate,
  getPatientInitials,
  sanitizeBirthDateDigits,
  formatBirthDigitsBR,
  validateBirthDateDigits8,
  birthDateValidationUserMessage,
} from '../utils/formatters';
import { PROFISSOES } from '../../data/profissoes';
import { ESTADOS_CIVIS } from '../../data/estadosCivis';

export function Step1CheckIn({
  activeTab,
  setActiveTab,
  searchQuery, setSearchQuery,
  selectedPatientCpf,
  setSelectedPatientCpf,
  patients,
  nome, setNome,
  dataNascimento, setDataNascimento,
  idade, setIdade,
  sexo, setSexo,
  estadoCivilId, setEstadoCivilId,
  profissao, setProfissao,
  endereco, setEndereco,
  cpf, setCpf,
  rg, setRg,
  telefone, setTelefone,
  email, setEmail,
  step1Errors, setStep1Errors,
  selectPatient,
}) {
  const [dataNascimentoDisplay, setDataNascimentoDisplay] = useState('');
  const [tipoBusca, setTipoBusca] = useState('nome');
  const [profissoesFiltradas, setProfissoesFiltradas] = useState([]);
  const [showProfissoes, setShowProfissoes] = useState(false);

  const normalizeBuscaDigits = (v) => String(v || '').replace(/\D/g, '').toLowerCase();

  const handleProfissaoChange = (value) => {
    setProfissao(value);
    setStep1Errors((prev) => ({ ...prev, profissao: false }));
    if (value.trim().length > 1) {
      const filtradas = PROFISSOES.filter((p) =>
        p.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8);
      setProfissoesFiltradas(filtradas);
      setShowProfissoes(filtradas.length > 0);
    } else {
      setProfissoesFiltradas([]);
      setShowProfissoes(false);
    }
  };

  const handleBuscaChange = (value) => {
    if (tipoBusca === 'cpf') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const masked = digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      setSearchQuery(masked);
    } else if (tipoBusca === 'telefone') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const masked = digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
      setSearchQuery(masked);
    } else {
      setSearchQuery(value);
    }
  };

  useEffect(() => {
    if (!dataNascimento) return;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataNascimento).trim());
    if (!m) return;
    const digits = `${m[3]}${m[2]}${m[1]}`;
    setDataNascimentoDisplay(formatBirthDigitsBR(digits));
  }, [dataNascimento]);

  const handleDataNascimentoChange = (raw) => {
    const digits = sanitizeBirthDateDigits(raw);
    const display = formatBirthDigitsBR(digits);
    setDataNascimentoDisplay(display);

    if (digits.length === 8) {
      const r = validateBirthDateDigits8(digits);
      if (r.ok) {
        setDataNascimento(r.iso);
        const age = calculateAgeFromISODate(r.iso);
        setIdade(age !== '' ? age : '');
      } else {
        setDataNascimento('');
        setIdade('');
      }
    } else {
      setDataNascimento('');
      setIdade('');
    }
  };

  const birthDigitsForUi = dataNascimentoDisplay.replace(/\D/g, '');
  let dataNascimentoFieldMessage = null;
  if (birthDigitsForUi.length === 8 && !dataNascimento) {
    const br = validateBirthDateDigits8(birthDigitsForUi);
    if (!br.ok) dataNascimentoFieldMessage = birthDateValidationUserMessage(br.reason);
  }

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.trim();
    if (!q) return true;
    if (tipoBusca === 'cpf') {
      return normalizeBuscaDigits(p.cpf).includes(normalizeBuscaDigits(q));
    }
    if (tipoBusca === 'telefone') {
      return normalizeBuscaDigits(p.telefone).includes(normalizeBuscaDigits(q));
    }
    return (p.nome || '').toLowerCase().includes(q.toLowerCase());
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
          onClick={() => {
            setActiveTab('novo');
            setSelectedPatientCpf(null);
            setNome('');
            setDataNascimento('');
            setIdade('');
            setSexo('');
            setEstadoCivilId('');
            setProfissao('');
            setEndereco('');
            setCpf('');
            setRg('');
            setTelefone('');
            setEmail('');
            setStep1Errors({});
            setDataNascimentoDisplay('');
          }}
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
          <div className="flex gap-2 items-stretch min-w-0">
            <select
              value={tipoBusca}
              onChange={(e) => {
                setTipoBusca(e.target.value);
                setSearchQuery('');
              }}
              className="shrink-0 border-[2px] border-[#e2e8f0] rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#475569] focus:border-[#00a88e] outline-none bg-white min-w-0 max-w-[9.5rem] sm:max-w-none"
              aria-label="Tipo de busca"
            >
              <option value="nome">Nome</option>
              <option value="cpf">CPF</option>
              <option value="telefone">Telefone</option>
            </select>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00a88e] pointer-events-none" strokeWidth={2.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleBuscaChange(e.target.value)}
                placeholder={
                  tipoBusca === 'cpf'
                    ? '000.000.000-00'
                    : tipoBusca === 'telefone'
                      ? '(00) 00000-0000'
                      : 'Buscar por nome...'
                }
                autoComplete="off"
                className="w-full min-w-0 pl-12 pr-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e]"
              />
            </div>
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
              Por favor, preencha todos os campos obrigatórios (*) para avançar.
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
                    const value = e.target.value.replace(/[0-9]/g, '');
                    setNome(value);
                    setStep1Errors({...step1Errors, nome: false});
                  }}
                  placeholder="Nome completo do paciente"
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.nome ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Data de Nascimento <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday"
                  value={dataNascimentoDisplay}
                  onChange={(e) => {
                    handleDataNascimentoChange(e.target.value);
                    setStep1Errors({...step1Errors, dataNascimento: false});
                  }}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.dataNascimento ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                />
                {dataNascimentoFieldMessage ? (
                  <p className="text-[12px] font-bold text-red-600" role="alert">
                    {dataNascimentoFieldMessage}
                  </p>
                ) : null}
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
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Estado Civil <span className="text-red-500">*</span></label>
                <select
                  value={estadoCivilId}
                  onChange={(e) => {
                    setEstadoCivilId(e.target.value);
                    setStep1Errors({...step1Errors, estadoCivil: false});
                  }}
                  className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${step1Errors.estadoCivil ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                >
                  <option value="">Selecione...</option>
                  {ESTADOS_CIVIS.map((ec) => (
                    <option key={ec.id} value={ec.id}>
                      {ec.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[13px] font-bold text-[#00a88e]">Profissão <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={profissao}
                    onChange={(e) => handleProfissaoChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowProfissoes(false), 150)}
                    placeholder="Digite sua profissão..."
                    autoComplete="off"
                    className={`w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${step1Errors.profissao ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'}`}
                  />
                  {showProfissoes ? (
                    <div className="absolute z-50 w-full bg-white border-[2px] border-[#00a88e]/30 rounded-xl shadow-lg mt-1 overflow-hidden">
                      {profissoesFiltradas.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onMouseDown={() => {
                            setProfissao(p);
                            setShowProfissoes(false);
                            setStep1Errors((prev) => ({ ...prev, profissao: false }));
                          }}
                          className="w-full text-left px-4 py-2 text-[13px] text-[#334155] hover:bg-[#e6f7f5] hover:text-[#0f766e] transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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

          {/* Endereço (opcional) */}
          <div className="border-[3px] border-[#f59e0b]/25 rounded-2xl p-6 bg-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#f59e0b] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">4</div>
              <h4 className="text-[18px] font-bold text-[#b45309]">Endereço</h4>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#f59e0b]">Endereço</label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF"
                className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all"
              />
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
