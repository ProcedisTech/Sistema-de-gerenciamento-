import React, { useState } from 'react';
import { ArrowLeft, Save, Loader2, UserPlus, AlertTriangle } from 'lucide-react';
import {
  maskCPF,
  maskRG,
  maskTelefone,
  calculateAgeFromISODate,
  sanitizeBirthDateDigits,
  formatBirthDigitsBR,
  validateBirthDateDigits8,
  birthDateValidationUserMessage,
} from '../utils/formatters';
import { pacientesApi } from '../../services/api';
import { PROFISSOES } from '../../data/profissoes';
import { ESTADOS_CIVIS } from '../../data/estadosCivis';
import { useToast } from '../../contexts/useToast.js';

export function PatientCreateView({ setPatientView, onPatientCreated }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [idade, setIdade] = useState('');
  const [sexo, setSexo] = useState('');
  const [estadoCivilId, setEstadoCivilId] = useState('');
  const [profissao, setProfissao] = useState('');
  const [profissoesFiltradas, setProfissoesFiltradas] = useState([]);
  const [showProfissoes, setShowProfissoes] = useState(false);
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [nomePai, setNomePai] = useState('');
  const [indicacao, setIndicacao] = useState('');
  const [genero, setGenero] = useState('');
  const [errors, setErrors] = useState({});

  const [dataNascimentoDisplay, setDataNascimentoDisplay] = useState('');

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

  const validate = () => {
    const e = {};
    if (!nome.trim()) e.nome = true;
    if (!dataNascimento) e.dataNascimento = true;
    if (!sexo.trim()) e.sexo = true;
    if (!estadoCivilId.trim()) e.estadoCivil = true;
    if (!profissao.trim()) e.profissao = true;
    if (!cpf.trim()) e.cpf = true;
    if (!telefone.trim()) e.telefone = true;
    if (!email.trim()) e.email = true;
    return e;
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    const isValid = Object.keys(validationErrors).length === 0;
    if (!isValid) {
      setErrors(validationErrors);
      const dnDigits = dataNascimentoDisplay.replace(/\D/g, '');
      const cy = new Date().getFullYear();
      if (validationErrors.dataNascimento) {
        if (dnDigits.length > 0 && dnDigits.length < 8) {
          setErro(birthDateValidationUserMessage('incomplete', cy));
        } else if (dnDigits.length === 8 && !dataNascimento) {
          const r = validateBirthDateDigits8(dnDigits);
          setErro(!r.ok ? birthDateValidationUserMessage(r.reason, cy) : 'Preencha os campos obrigatórios.');
        } else {
          setErro('Preencha os campos obrigatórios.');
        }
      } else {
        setErro('Preencha os campos obrigatórios.');
      }
      toast.error('Preencha todos os campos obrigatórios antes de continuar.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setErro('');
    setErrors({});
    setSalvando(true);

    try {
      const payload = {
        nomeCompleto: nome.trim(),
        dataNascimento: dataNascimento || null,
        cpf: cpf.replace(/\D/g, '') || null,
        rg: rg.replace(/\D/g, '') || null,
        telefone: telefone || null,
        email: email || null,
        instagram: instagram || null,
        tiktok: tiktok || null,
        nomeMae: nomeMae || null,
        nomePai: nomePai || null,
        profissao: profissao || null,
        indicacao: indicacao || null,
        endereco: endereco || null,
        sexo: sexo || null,
        genero: genero || null,
        estadoCivilId: estadoCivilId || undefined,
      };

      const cpfDigits = cpf.replace(/\D/g, '');
      if (cpfDigits.length !== 11) {
        setErrors((prev) => ({ ...prev, cpf: 'CPF deve conter 11 dígitos' }));
        setErro('Por favor, preencha todos os campos obrigatórios (*).');
        return;
      }

      await pacientesApi.create(payload);
      setSucesso(true);
      if (onPatientCreated) onPatientCreated();

      setTimeout(() => setPatientView('list'), 1500);
    } catch (err) {
      const msg = err.message || '';
      const clean = msg.replace(/^\[HTTP \d+\]\s*/, '').trim();
      setErro(clean || 'Erro ao cadastrar paciente.');
    } finally {
      setSalvando(false);
    }
  };

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: false }));

  const handleProfissaoChange = (value) => {
    setProfissao(value);
    clearError('profissao');
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

  const inputClass = (field) =>
    `w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'
    }`;

  const selectPersonalClass = (field) =>
    `w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'
    }`;

  const hasPersonalSectionError =
    Boolean(errors.nome) ||
    Boolean(errors.dataNascimento) ||
    Boolean(errors.sexo) ||
    Boolean(errors.estadoCivil) ||
    Boolean(errors.profissao);

  const birthDigitsForUi = dataNascimentoDisplay.replace(/\D/g, '');
  let dataNascimentoFieldMessage = null;
  if (birthDigitsForUi.length === 8 && !dataNascimento) {
    const br = validateBirthDateDigits8(birthDigitsForUi);
    if (!br.ok) dataNascimentoFieldMessage = birthDateValidationUserMessage(br.reason);
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-[#dcfce7] flex items-center justify-center mb-4">
          <Save className="w-8 h-8 text-[#16a34a]" strokeWidth={2} />
        </div>
        <h3 className="text-[20px] font-bold text-[#0f172a] mb-2">Paciente cadastrado</h3>
        <p className="text-[#64748b] text-[14px]">Redirecionando para a lista...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPatientView('list')}
          className="inline-flex items-center gap-2 text-[#00a88e] hover:text-[#00967f] font-bold text-[14px] transition-all"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Voltar para Pacientes
        </button>
      </div>

      <div className="flex items-center gap-4 mb-2">
        <div className="bg-[#e6f7f5] p-3 rounded-2xl text-[#00a88e] border-[3px] border-[#00a88e]/25">
          <UserPlus className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Novo Paciente</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Identificação e dados pessoais</p>
        </div>
      </div>

      <form onSubmit={handleSalvar} className="space-y-6">
        {(Object.keys(errors).length > 0 || erro) && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[14px] font-bold border-[3px] border-red-200 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <span>
              {erro ||
                (Object.keys(errors).length > 0 ? 'Por favor, preencha todos os campos obrigatórios (*).' : '')}
            </span>
          </div>
        )}

        {/* Dados Pessoais — alinhado ao Step1CheckIn (jornada) */}
        <div
          className={`border-[3px] rounded-2xl p-6 transition-colors ${
            hasPersonalSectionError ? 'border-red-300 bg-red-50/10' : 'border-[#00a88e]/25 bg-white'
          }`}
        >
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
                  clearError('nome');
                }}
                placeholder="Nome completo do paciente"
                className={inputClass('nome')}
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
                  clearError('dataNascimento');
                }}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={inputClass('dataNascimento')}
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
                  clearError('sexo');
                }}
                className={selectPersonalClass('sexo')}
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
                  clearError('estadoCivil');
                }}
                className={selectPersonalClass('estadoCivil')}
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
                  className={inputClass('profissao')}
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
                          clearError('profissao');
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
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e]">Gênero</label>
              <input
                type="text"
                value={genero}
                onChange={(e) => setGenero(e.target.value)}
                placeholder="Como se identifica"
                className={inputClass()}
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
              <input type="text" value={cpf} onChange={(e) => { setCpf(maskCPF(e.target.value)); clearError('cpf'); }} placeholder="000.000.000-00" className={`w-full px-4 py-3 bg-[#eff6ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 transition-all ${errors.cpf ? 'border-red-400 bg-red-50' : 'border-[#3b82f6]/30 focus:border-[#3b82f6]'}`} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#3b82f6]">RG</label>
              <input type="text" value={rg} onChange={(e) => setRg(maskRG(e.target.value))} placeholder="00.000.000-0" className="w-full px-4 py-3 bg-[#eff6ff] border-[3px] border-[#3b82f6]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 focus:border-[#3b82f6] transition-all" />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div
          className={`border-[3px] rounded-2xl p-6 transition-colors ${
            errors.telefone || errors.email ? 'border-red-300 bg-red-50/10' : 'border-[#a855f7]/25 bg-white'
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#a855f7] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">3</div>
            <h4 className="text-[18px] font-bold text-[#7e22ce]">Contato</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#a855f7]">Telefone <span className="text-red-500">*</span></label>
              <input type="text" value={telefone} onChange={(e) => { setTelefone(maskTelefone(e.target.value)); clearError('telefone'); }} placeholder="(00) 00000-0000" className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${errors.telefone ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#a855f7]">E-mail <span className="text-red-500">*</span></label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearError('email'); }} placeholder="email@exemplo.com" className={`w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${errors.email ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#a855f7]">Instagram</label>
              <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" className="w-full px-4 py-3 bg-[#faf5ff] border-[3px] border-[#a855f7]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#a855f7]">TikTok</label>
              <input type="text" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@usuario" className="w-full px-4 py-3 bg-[#faf5ff] border-[3px] border-[#a855f7]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all" />
            </div>
          </div>
        </div>

        {/* Informações Complementares */}
        <div className="border-[3px] border-[#f59e0b]/25 rounded-2xl p-6 bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#f59e0b] text-white flex items-center justify-center font-bold text-[14px] shadow-sm">4</div>
            <h4 className="text-[18px] font-bold text-[#b45309]">Informações Complementares</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[13px] font-bold text-[#f59e0b]">Endereço</label>
              <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade - UF" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#f59e0b]">Nome da Mãe</label>
              <input type="text" value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} placeholder="Nome completo" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#f59e0b]">Nome do Pai</label>
              <input type="text" value={nomePai} onChange={(e) => setNomePai(e.target.value)} placeholder="Nome completo" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[13px] font-bold text-[#f59e0b]">Indicação</label>
              <input type="text" value={indicacao} onChange={(e) => setIndicacao(e.target.value)} placeholder="Quem indicou o paciente?" className="w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all" />
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t-[3px] border-[#00a88e]/15">
          <button type="button" onClick={() => setPatientView('list')} className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-sm border-[3px] text-[#00a88e] bg-white border-[#00a88e]/25 hover:bg-[#e6f7f5] hover:border-[#00a88e]">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] transition-all outline-none shadow-md border-[3px] border-transparent text-white bg-[#00a88e] hover:bg-[#00967f] disabled:opacity-60 disabled:cursor-not-allowed">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={2.5} />}
            Cadastrar Paciente
          </button>
        </div>
      </form>
    </div>
  );
}
