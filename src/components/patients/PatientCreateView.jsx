import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, UserPlus, UserRound, Plus, AlertTriangle, X, Calendar } from 'lucide-react';
import {
  maskCPF,
  maskRG,
  normalizeCpf,
  isCpfIncomplete,
  calculateAgeFromISODate,
  sanitizeBirthDateDigits,
  formatBirthDigitsBR,
  validateBirthDateDigits8,
  birthDateValidationUserMessage,
} from '../utils/formatters';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid, formatPhoneForApi } from '../../utils/phoneUtils';
import { pacientesApi } from '../../services/api';
import { PROFISSOES } from '../../data/profissoes';
import { ESTADOS_CIVIS } from '../../data/estadosCivis';
import { useToast } from '../../contexts/useToast.js';
import { convertToWebP } from '../../utils/imageUtils';

export function PatientCreateView({ setPatientView, onPatientCreated, variant = 'page' }) {
  const isModal = variant === 'modal';
  const scrollBodyRef = useRef(null);
  const toast = useToast();

  const scrollFormTop = () => {
    if (isModal && scrollBodyRef.current) {
      scrollBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModal]);
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
  const [telefoneCountryCode, setTelefoneCountryCode] = useState('BR');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [telefoneTouched, setTelefoneTouched] = useState(false);
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
  const fotoBlobUrlRef = useRef(null);
  const [fotoPerfilFile, setFotoPerfilFile] = useState(null);
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState(null);

  useEffect(() => {
    return () => {
      if (fotoBlobUrlRef.current) {
        URL.revokeObjectURL(fotoBlobUrlRef.current);
        fotoBlobUrlRef.current = null;
      }
    };
  }, []);

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.');
      e.target.value = '';
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('A imagem deve ter no máximo 5 MB.');
      e.target.value = '';
      return;
    }
    if (fotoBlobUrlRef.current) {
      URL.revokeObjectURL(fotoBlobUrlRef.current);
      fotoBlobUrlRef.current = null;
    }
    fotoBlobUrlRef.current = URL.createObjectURL(file);
    setFotoPerfilPreview(fotoBlobUrlRef.current);
    const converted = await convertToWebP(file, 0.85, 1920);
    setFotoPerfilFile(converted);
  };

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
    if (!telefoneNumero.trim() || !isPhoneValid(telefoneCountryCode, telefoneNumero)) e.telefone = true;
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
      scrollFormTop();
      return;
    }

    const cpfDigits = normalizeCpf(cpf);
    if (cpfDigits.length !== 11) {
      setErrors((prev) => ({ ...prev, cpf: true }));
      setErro('Por favor, preencha todos os campos obrigatórios (*).');
      toast.error('O CPF deve conter 11 dígitos.');
      scrollFormTop();
      return;
    }

    setErro('');
    setErrors({});
    setSalvando(true);

    try {
      const payload = {
        nomeCompleto: nome.trim(),
        dataNascimento: dataNascimento || null,
        cpf: cpfDigits || null,
        rg: rg.replace(/\D/g, '') || null,
        telefone: formatPhoneForApi(telefoneCountryCode, telefoneNumero) || null,
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

      const created = await pacientesApi.create(payload);
      const patientId = created?.id ?? created?.pacienteId;
      if (fotoPerfilFile && patientId) {
        try {
          await pacientesApi.uploadFotoPerfil(patientId, fotoPerfilFile);
        } catch (uploadErr) {
          console.warn(uploadErr);
          toast.error('Paciente cadastrado, mas a foto de perfil não pôde ser enviada.');
        }
      }
      setSucesso(true);
      if (onPatientCreated) onPatientCreated();
      setTimeout(() => setPatientView('list'), 1500);
    } catch (err) {
      const msg = err?.message || '';
      const clean = msg.replace(/^\[HTTP \d+\]\s*/, '').trim();
      setErro(clean || 'Erro ao cadastrar paciente.');
    } finally {
      setSalvando(false);
    }
  };

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: false }));

  const handleCpfBlur = () => {
    if (isCpfIncomplete(cpf)) {
      setErrors((prev) => ({ ...prev, cpf: true }));
      toast.error('O CPF deve conter 11 dígitos.');
    }
  };

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

  const FieldReq = () => <span className="text-red-500">*</span>;

  const labelCls = (pageColorClass) =>
    isModal ? 'text-[13px] font-medium text-slate-800' : `text-[13px] font-bold ${pageColorClass}`;

  const sectionHeadingCls = (pageColorClass) =>
    isModal ? 'text-[18px] font-bold text-slate-900' : pageColorClass;

  const sectionCardCls = (hasError, pageNormalClasses) =>
    isModal
      ? `rounded-xl border bg-white p-5 transition-colors ${
          hasError ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
        }`
      : pageNormalClasses;

  const inputClass = (field) => {
    if (isModal) {
      const err = field != null && errors[field];
      return `w-full rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'
    }`;
  };

  const selectPersonalClass = (field) => {
    if (isModal) {
      const err = errors[field];
      return `w-full appearance-none rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#f8fbfb] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'
    }`;
  };

  const docInputClass = (field) => {
    if (isModal) {
      const err = field === 'cpf' && errors.cpf;
      return `w-full rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#eff6ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 transition-all ${
      errors.cpf ? 'border-red-400 bg-red-50' : 'border-[#3b82f6]/30 focus:border-[#3b82f6]'
    }`;
  };

  const rgInputClass = () => {
    if (isModal) {
      return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20';
    }
    return 'w-full px-4 py-3 bg-[#eff6ff] border-[3px] border-[#3b82f6]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 focus:border-[#3b82f6] transition-all';
  };

  const emailInputClass = () => {
    if (isModal) {
      return `w-full rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        errors.email ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#faf5ff] border-[3px] rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${errors.email ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`;
  };

  const socialInputClass = () => {
    if (isModal) {
      return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20';
    }
    return 'w-full px-4 py-3 bg-[#faf5ff] border-[3px] border-[#a855f7]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all';
  };

  const complementInputClass = () => {
    if (isModal) {
      return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20';
    }
    return 'w-full px-4 py-3 bg-[#fffbeb] border-[3px] border-[#f59e0b]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all';
  };

  const phoneWrapClass = () => {
    const invalid = telefoneTouched && !isPhoneValid(telefoneCountryCode, telefoneNumero);
    if (isModal) {
      return `flex items-stretch gap-0 rounded-lg border bg-white transition focus-within:border-[#00a88e] focus-within:ring-1 focus-within:ring-[#00a88e]/20 ${
        errors.telefone || invalid ? 'border-red-300 bg-red-50/60' : 'border-slate-200'
      }`;
    }
    return `flex items-stretch gap-1 rounded-xl border-[3px] bg-[#faf5ff] transition-all focus-within:ring-4 focus-within:ring-[#a855f7]/20 ${
      errors.telefone || invalid ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus-within:border-[#a855f7]'
    }`;
  };

  const idadeInputClass = () => {
    if (isModal) {
      return 'w-full cursor-not-allowed rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[14px] font-medium text-slate-500';
    }
    return 'w-full px-4 py-3 bg-[#e2e8f0]/40 border-[3px] border-[#00a88e]/15 rounded-xl text-[14px] text-[#0f172a] font-bold cursor-not-allowed';
  };

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

  const successContent = (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#dcfce7]">
        <Save className="h-8 w-8 text-[#16a34a]" strokeWidth={2} />
      </div>
      <h3 className="mb-2 text-[20px] font-bold text-[#0f172a]">Paciente cadastrado</h3>
      <p className="text-[14px] text-[#64748b]">Redirecionando para a lista...</p>
    </div>
  );

  const renderModalShell = (body) => (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        role="dialog"
        aria-labelledby="patient-create-title"
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00a88e] text-white shadow-sm">
              <UserPlus className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 id="patient-create-title" className="text-[18px] font-bold text-slate-900 sm:text-[20px]">
                Cadastrar Novo Paciente
              </h3>
              <p className="text-[13px] font-medium text-slate-500">Preencha todos os dados obrigatórios</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPatientView('list')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
        <div ref={scrollBodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {body}
        </div>
      </div>
    </div>
  );

  if (sucesso) {
    if (isModal) {
      return renderModalShell(successContent);
    }
    return successContent;
  }

  const formInner = (
    <form onSubmit={handleSalvar} className={isModal ? 'space-y-5' : 'space-y-6'}>
        {/* Avatar — foto de perfil opcional */}
        <div className={`flex justify-center ${isModal ? '-mt-1 mb-1' : 'mb-2'}`}>
          <label className="group relative cursor-pointer" title="Adicionar foto de perfil">
            <div
              className={
                isModal
                  ? 'flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm transition-all hover:border-[#00a88e]/40'
                  : 'flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#00a88e]/30 bg-[#e6f7f5] shadow-sm transition-all group-hover:border-[#00a88e]'
              }
            >
              {fotoPerfilPreview ? (
                <img src={fotoPerfilPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound
                  className={isModal ? 'h-9 w-9 text-slate-300' : 'h-10 w-10 text-[#00a88e]/50'}
                  strokeWidth={1.5}
                />
              )}
            </div>
            <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#00a88e] shadow">
              <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFotoChange}
            />
          </label>
        </div>
        <p
          className={
            isModal
              ? '-mt-2 mb-1 text-center text-[12px] font-medium text-slate-500'
              : '-mt-2 mb-2 text-center text-[12px] font-medium text-[#94a3b8]'
          }
        >
          Foto de perfil (opcional)
        </p>

        {(Object.keys(errors).length > 0 || erro) && (
          <div
            className={
              isModal
                ? 'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5 text-[13px] font-semibold text-red-700'
                : 'flex items-start gap-2 rounded-xl border-[3px] border-red-200 bg-red-50 px-4 py-3 text-[14px] font-bold text-red-600'
            }
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.5} />
            <span>
              {erro ||
                (Object.keys(errors).length > 0 ? 'Por favor, preencha todos os campos obrigatórios (*).' : '')}
            </span>
          </div>
        )}

        {/* Dados Pessoais — alinhado ao Step1CheckIn (jornada) */}
        <div
          className={sectionCardCls(
            hasPersonalSectionError,
            `rounded-2xl border-[3px] p-6 transition-colors ${
              hasPersonalSectionError ? 'border-red-300 bg-red-50/10' : 'border-[#00a88e]/25 bg-white'
            }`
          )}
        >
          <div className={`flex items-center gap-3 ${isModal ? 'mb-5' : 'mb-6'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
              1
            </div>
            <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#0f766e]')}>Dados Pessoais</h4>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isModal ? 'gap-x-5 gap-y-4' : 'gap-x-6 gap-y-5'}`}>
            <div className="md:col-span-2 space-y-1.5">
              <label className={labelCls('text-[#00a88e]')}>
                Nome Completo <FieldReq />
              </label>
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
              <label className={labelCls('text-[#00a88e]')}>
                Data de Nascimento <FieldReq />
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="bday"
                  value={dataNascimentoDisplay}
                  onChange={(e) => {
                    handleDataNascimentoChange(e.target.value);
                    clearError('dataNascimento');
                  }}
                  placeholder={isModal ? 'dd/mm/aaaa' : 'DD/MM/AAAA'}
                  maxLength={10}
                  className={`min-w-0 flex-1 ${inputClass('dataNascimento')}`}
                />
                {isModal ? (
                  <span
                    className="flex shrink-0 items-center text-slate-300"
                    aria-hidden
                  >
                    <Calendar className="h-4 w-4" strokeWidth={2} />
                  </span>
                ) : null}
              </div>
              {dataNascimentoFieldMessage ? (
                <p className="text-[12px] font-bold text-red-600" role="alert">
                  {dataNascimentoFieldMessage}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#00a88e]')}>Idade</label>
              <input
                type="text"
                value={idade !== '' ? `${idade} anos` : ''}
                placeholder="Calculada automaticamente"
                disabled
                className={idadeInputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#00a88e]')}>
                Sexo <FieldReq />
              </label>
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
                <option value="N">Prefiro não dizer</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#00a88e]')}>
                Estado Civil <FieldReq />
              </label>
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
              <label className={labelCls('text-[#00a88e]')}>
                Profissão <FieldReq />
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={profissao}
                  onChange={(e) => handleProfissaoChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowProfissoes(false), 150)}
                  placeholder={
                    isModal ? 'Ex: Advogada, Empresário, Estudante…' : 'Digite sua profissão...'
                  }
                  autoComplete="off"
                  className={inputClass('profissao')}
                />
                {showProfissoes ? (
                  <div
                    className={
                      isModal
                        ? 'absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg'
                        : 'absolute z-50 mt-1 w-full overflow-hidden rounded-xl border-[2px] border-[#00a88e]/30 bg-white shadow-lg'
                    }
                  >
                    {profissoesFiltradas.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onMouseDown={() => {
                          setProfissao(p);
                          setShowProfissoes(false);
                          clearError('profissao');
                        }}
                        className="w-full px-4 py-2 text-left text-[13px] text-[#334155] transition-colors hover:bg-[#e6f7f5] hover:text-[#0f766e]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className={labelCls('text-[#00a88e]')}>Gênero</label>
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
        <div
          className={sectionCardCls(
            false,
            'rounded-2xl border-[3px] border-[#3b82f6]/25 bg-white p-6'
          )}
        >
          <div className={`flex items-center gap-3 ${isModal ? 'mb-5' : 'mb-6'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
              2
            </div>
            <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#1d4ed8]')}>Documentos</h4>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isModal ? 'gap-x-5 gap-y-4' : 'gap-x-6 gap-y-5'}`}>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#3b82f6]')}>
                CPF <FieldReq />
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => {
                  setCpf(maskCPF(e.target.value));
                  clearError('cpf');
                }}
                onBlur={handleCpfBlur}
                placeholder="000.000.000-00"
                className={docInputClass('cpf')}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#3b82f6]')}>RG</label>
              <input
                type="text"
                value={rg}
                onChange={(e) => setRg(maskRG(e.target.value))}
                placeholder="00.000.000-0"
                className={rgInputClass()}
              />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div
          className={sectionCardCls(
            Boolean(errors.telefone || errors.email),
            `rounded-2xl border-[3px] p-6 transition-colors ${
              errors.telefone || errors.email ? 'border-red-300 bg-red-50/10' : 'border-[#a855f7]/25 bg-white'
            }`
          )}
        >
          <div className={`flex items-center gap-3 ${isModal ? 'mb-5' : 'mb-6'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
              3
            </div>
            <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#7e22ce]')}>Contato</h4>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isModal ? 'gap-x-5 gap-y-4' : 'gap-x-6 gap-y-5'}`}>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#a855f7]')}>
                Telefone <FieldReq />
              </label>
              <div className={phoneWrapClass()}>
                <select
                  value={telefoneCountryCode}
                  title={getCountryByCode(telefoneCountryCode).name}
                  onChange={(e) => {
                    setTelefoneCountryCode(e.target.value);
                    setTelefoneNumero('');
                    setTelefoneTouched(false);
                    clearError('telefone');
                  }}
                  className={
                    isModal
                      ? 'max-w-[7.25rem] min-w-0 shrink-0 truncate rounded-l-lg border-0 bg-transparent py-2.5 pl-2 pr-1 text-[12px] font-medium text-slate-600 outline-none'
                      : 'max-w-[7.25rem] min-w-0 shrink-0 truncate rounded-l-[9px] border-0 bg-transparent py-3 pl-2 pr-1 text-[12px] font-medium text-[#475569] outline-none'
                  }
                  aria-label="País"
                >
                  {[
                    COUNTRY_PHONE_CODES.find((c) => c.code === 'BR'),
                    ...COUNTRY_PHONE_CODES.filter((c) => c.code !== 'BR'),
                  ].filter(Boolean).map((c) => (
                    <option key={c.code} value={c.code} title={c.name}>
                      {countrySelectDisplayLabel(c)}
                    </option>
                  ))}
                </select>
                <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                  <span
                    className={
                      isModal
                        ? 'flex shrink-0 items-center tabular-nums text-[13px] font-semibold text-slate-500'
                        : 'flex shrink-0 items-center tabular-nums text-[13px] font-semibold text-[#a855f7]'
                    }
                  >
                    {getDdi(telefoneCountryCode)}
                  </span>
                  <input
                    type="tel"
                    value={telefoneNumero}
                    autoComplete="tel-national"
                    onChange={(e) => {
                      setTelefoneNumero(formatPhoneAsYouType(telefoneCountryCode, e.target.value));
                      clearError('telefone');
                    }}
                    onBlur={() => setTelefoneTouched(true)}
                    placeholder={telefoneCountryCode === 'BR' ? '(00) 00000-0000' : 'Número'}
                    className={
                      isModal
                        ? 'min-w-0 flex-1 rounded-r-lg bg-transparent py-2.5 pr-3 text-[14px] font-medium text-slate-900 outline-none'
                        : 'min-w-0 flex-1 rounded-r-[9px] bg-transparent py-3 pr-3 text-[14px] font-medium outline-none'
                    }
                  />
                </div>
              </div>
              {telefoneTouched && !isPhoneValid(telefoneCountryCode, telefoneNumero) && (
                <p className="text-[12px] font-bold text-red-600">Número inválido para este país</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#a855f7]')}>
                E-mail <FieldReq />
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError('email');
                }}
                placeholder="email@exemplo.com"
                className={emailInputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#a855f7]')}>Instagram</label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@usuario"
                className={socialInputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#a855f7]')}>TikTok</label>
              <input
                type="text"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="@usuario"
                className={socialInputClass()}
              />
            </div>
          </div>
        </div>

        {/* Informações Complementares */}
        <div
          className={sectionCardCls(
            false,
            'rounded-2xl border-[3px] border-[#f59e0b]/25 bg-white p-6'
          )}
        >
          <div className={`flex items-center gap-3 ${isModal ? 'mb-5' : 'mb-6'}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[14px] font-bold text-white shadow-sm">
              4
            </div>
            <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#b45309]')}>
              Informações Complementares
            </h4>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isModal ? 'gap-x-5 gap-y-4' : 'gap-x-6 gap-y-5'}`}>
            <div className="md:col-span-2 space-y-1.5">
              <label className={labelCls('text-[#f59e0b]')}>Endereço</label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF"
                className={complementInputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#f59e0b]')}>Nome da Mãe</label>
              <input
                type="text"
                value={nomeMae}
                onChange={(e) => setNomeMae(e.target.value)}
                placeholder="Nome completo"
                className={complementInputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls('text-[#f59e0b]')}>Nome do Pai</label>
              <input
                type="text"
                value={nomePai}
                onChange={(e) => setNomePai(e.target.value)}
                placeholder="Nome completo"
                className={complementInputClass()}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className={labelCls('text-[#f59e0b]')}>Indicação</label>
              <input
                type="text"
                value={indicacao}
                onChange={(e) => setIndicacao(e.target.value)}
                placeholder="Quem indicou o paciente?"
                className={complementInputClass()}
              />
            </div>
          </div>
        </div>

        {/* Botões */}
        <div
          className={
            isModal
              ? 'flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center'
              : 'flex flex-col-reverse items-stretch justify-between gap-3 border-t-[3px] border-[#00a88e]/15 pt-4 sm:flex-row sm:items-center'
          }
        >
          <button
            type="button"
            onClick={() => setPatientView('list')}
            className={
              isModal
                ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 outline-none transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto'
                : 'flex w-full items-center justify-center gap-2 rounded-xl border-[3px] border-[#00a88e]/25 bg-white px-6 py-3 text-[14px] font-bold text-[#00a88e] shadow-sm outline-none transition hover:border-[#00a88e] hover:bg-[#e6f7f5] sm:w-auto'
            }
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className={
              isModal
                ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-[#00a88e] px-5 py-2.5 text-[14px] font-semibold text-white outline-none transition hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
                : 'flex w-full items-center justify-center gap-2 rounded-xl border-[3px] border-transparent bg-[#00a88e] px-6 py-3 text-[14px] font-bold text-white shadow-md outline-none transition hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
            }
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2.5} />}
            Cadastrar Paciente
          </button>
        </div>
      </form>
  );

  if (isModal) {
    return renderModalShell(formInner);
  }

  return (
    <div className="animate-in fade-in duration-300 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPatientView('list')}
          className="inline-flex items-center gap-2 text-[14px] font-bold text-[#00a88e] transition-all hover:text-[#00967f]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Voltar para Pacientes
        </button>
      </div>

      <div className="mb-2 flex items-center gap-4">
        <div className="rounded-2xl border-[3px] border-[#00a88e]/25 bg-[#e6f7f5] p-3 text-[#00a88e]">
          <UserPlus className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Novo Paciente</h3>
          <p className="text-[14px] font-medium text-[#64748b]">Identificação e dados pessoais</p>
        </div>
      </div>

      {formInner}
    </div>
  );
}
