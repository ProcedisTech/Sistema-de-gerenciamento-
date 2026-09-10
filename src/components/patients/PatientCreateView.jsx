import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, UserPlus, X } from 'lucide-react';
import {
  normalizeCpf,
  isCpfIncomplete,
  isCpfValidCheckDigits,
  calculateAgeFromISODate,
  sanitizeBirthDateDigits,
  formatBirthDigitsBR,
  validateBirthDateDigits8,
  birthDateValidationUserMessage,
} from '../utils/formatters';
import { formatPhoneForApi } from '../../utils/phoneUtils';
import { getPacienteCreateErrorFeedback, pacientesApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { convertToWebP } from '../../utils/imageUtils';
import { validatePacienteFormBasics } from '../../utils/patientFormValidation';
import { normalizeCepForApi } from '../../utils/cepUtils.js';
import { mapBackendPatient } from '../../utils/patientMapping';
import { PatientForm } from './PatientForm.jsx';
import { usePapel } from '../../hooks/usePapel';

export function PatientCreateView({
  setPatientView,
  onPatientCreated,
  onSuccess,
  onClose,
  variant = 'page',
  hostMode = 'patients',
  zIndex = 210,
}) {
  const isModal = variant === 'modal';
  const isAgendaHost = hostMode === 'agenda';
  const scrollBodyRef = useRef(null);
  const toast = useToast();
  const { isNivel1 } = usePapel();

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    setPatientView('list');
  }, [onClose, setPatientView]);

  const scrollFormTop = () => {
    if (isModal && scrollBodyRef.current) {
      scrollBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModal]);

  useEffect(() => {
    if (!isModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isModal, handleClose]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [idade, setIdade] = useState('');
  const [sexo, setSexo] = useState('');
  const [estadoCivilId, setEstadoCivilId] = useState('');
  const [profissaoId, setProfissaoId] = useState(null);
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [telefoneCountryCode, setTelefoneCountryCode] = useState('BR');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [telefoneTouched, setTelefoneTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [enderecoRua, setEnderecoRua] = useState('');
  const [enderecoNumero, setEnderecoNumero] = useState('');
  const [enderecoComplemento, setEnderecoComplemento] = useState('');
  const [enderecoBairro, setEnderecoBairro] = useState('');
  const [enderecoCidade, setEnderecoCidade] = useState('');
  const [enderecoEstado, setEnderecoEstado] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [nomePai, setNomePai] = useState('');
  const [indicacao, setIndicacao] = useState('');
  const [errors, setErrors] = useState({});
  const [cpfErrorText, setCpfErrorText] = useState('');

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
    const e = validatePacienteFormBasics({
      nome,
      dataNascimentoIso: dataNascimento,
      sexo,
      estadoCivilId,
      profissaoId,
      cpf,
      telefoneCountryCode,
      telefoneNumero,
      email,
    });
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
      setCpfErrorText('O CPF deve conter 11 dígitos.');
      setErro('Por favor, preencha todos os campos obrigatórios (*).');
      toast.error('O CPF deve conter 11 dígitos.');
      scrollFormTop();
      return;
    }

    if (!isCpfValidCheckDigits(cpfDigits)) {
      const msg = 'CPF inválido. Verifique os dígitos verificadores.';
      setErrors((prev) => ({ ...prev, cpf: true }));
      setCpfErrorText(msg);
      setErro(msg);
      toast.error(msg);
      scrollFormTop();
      return;
    }

    setErro('');
    setCpfErrorText('');
    setErrors({});
    setSalvando(true);

    try {
      const payload = {
        nomeCompleto: nome.trim(),
        dataNascimento: dataNascimento || null,
        cpf: cpfDigits || null,
        rg: rg.replace(/\D/g, '') || null,
        telefone: formatPhoneForApi(telefoneCountryCode, telefoneNumero) || null,
        email: (email ?? '').trim() || null,
        instagram: instagram || null,
        tiktok: tiktok || null,
        nomeMae: nomeMae || null,
        nomePai: nomePai || null,
        profissaoId: profissaoId || null,
        indicacao: indicacao || null,
        cep: normalizeCepForApi(cep),
        enderecoRua: enderecoRua.trim() || null,
        enderecoNumero: enderecoNumero.trim() || null,
        enderecoComplemento: enderecoComplemento.trim() || null,
        enderecoBairro: enderecoBairro.trim() || null,
        enderecoCidade: enderecoCidade.trim() || null,
        enderecoEstado: enderecoEstado.trim().toUpperCase().slice(0, 2) || null,
        endereco: null,
        sexo: sexo || null,
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

      const patient = mapBackendPatient(created);
      if (isAgendaHost) {
        if (onSuccess && patient) onSuccess(patient);
        handleClose();
      } else {
        setSucesso(true);
        setTimeout(() => setPatientView('list'), 1500);
      }
    } catch (err) {
      const fb = getPacienteCreateErrorFeedback(err);
      setErro(fb.banner);
      if (fb.highlightCpf) {
        setErrors((prev) => ({ ...prev, cpf: true }));
        setCpfErrorText(fb.cpfField || fb.banner);
      } else {
        setCpfErrorText('');
      }
      toast.error(fb.banner);
      scrollFormTop();
    } finally {
      setSalvando(false);
    }
  };

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: false }));

  const handleCpfBlur = () => {
    if (isCpfIncomplete(cpf)) {
      setErrors((prev) => ({ ...prev, cpf: true }));
      setCpfErrorText('O CPF deve conter 11 dígitos.');
      toast.error('O CPF deve conter 11 dígitos.');
    }
  };

  const handleTelefoneCountryChange = (code) => {
    setTelefoneCountryCode(code);
    setTelefoneNumero('');
    setTelefoneTouched(false);
    clearError('telefone');
  };

  const successContent = (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#dcfce7]">
        <Save className="h-8 w-8 text-[#16a34a]" strokeWidth={2} />
      </div>
      <h3 className="mb-2 text-[20px] font-bold text-[#0f172a]">Paciente cadastrado</h3>
      <p className="text-[14px] text-[#64748b]">
        {isAgendaHost ? 'Paciente selecionado no agendamento.' : 'Redirecionando para a lista...'}
      </p>
    </div>
  );

  const renderModalShell = (body) => (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-label="Fechar"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-create-title"
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00a88e] text-white shadow-sm">
              <UserPlus className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 id="patient-create-title" className="text-[18px] font-bold text-slate-900 sm:text-[20px]">
                Novo Paciente
              </h3>
              <p className="text-[13px] font-medium text-slate-500">Preencha todos os dados obrigatórios</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
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

  if (isNivel1) {
    const errorContent = (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100 shadow-sm">
          <X className="h-8 w-8" strokeWidth={2} />
        </div>
        <h3 className="mb-2 text-[20px] font-bold text-slate-900">Acesso Restrito</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6">
          Seu perfil possui permissões apenas de visualização. Não é permitido cadastrar novos pacientes.
        </p>
        <button
          type="button"
          onClick={() => setPatientView('list')}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          Voltar para a Lista
        </button>
      </div>
    );

    if (isModal) {
      return renderModalShell(errorContent);
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
        {errorContent}
      </div>
    );
  }

  if (sucesso) {
    if (isModal) {
      return renderModalShell(successContent);
    }
    return successContent;
  }

  const formVariant = isModal ? 'modal' : 'page';

  const formInner = (
    <PatientForm
      mode="create"
      variant={formVariant}
      nome={nome}
      dataNascimentoDisplay={dataNascimentoDisplay}
      idade={idade}
      sexo={sexo}
      estadoCivilId={estadoCivilId}
      profissaoId={profissaoId}
      cpf={cpf}
      rg={rg}
      telefoneCountryCode={telefoneCountryCode}
      telefoneNumero={telefoneNumero}
      telefoneTouched={telefoneTouched}
      email={email}
      instagram={instagram}
      tiktok={tiktok}
      cep={cep}
      enderecoRua={enderecoRua}
      enderecoNumero={enderecoNumero}
      enderecoComplemento={enderecoComplemento}
      enderecoBairro={enderecoBairro}
      enderecoCidade={enderecoCidade}
      enderecoEstado={enderecoEstado}
      nomeMae={nomeMae}
      nomePai={nomePai}
      indicacao={indicacao}
      dataNascimentoIso={dataNascimento}
      fotoPerfilPreview={fotoPerfilPreview}
      errors={errors}
      cpfErrorText={cpfErrorText}
      erroBanner={erro}
      onNomeChange={setNome}
      onDataNascimentoDisplayChange={handleDataNascimentoChange}
      onSexoChange={setSexo}
      onEstadoCivilChange={setEstadoCivilId}
      onProfissaoIdChange={setProfissaoId}
      onCpfChange={setCpf}
      onCpfBlur={handleCpfBlur}
      onRgChange={setRg}
      onTelefoneCountryChange={handleTelefoneCountryChange}
      onTelefoneNumeroChange={setTelefoneNumero}
      onTelefoneBlur={() => setTelefoneTouched(true)}
      onEmailChange={setEmail}
      onInstagramChange={setInstagram}
      onTiktokChange={setTiktok}
      onCepChange={setCep}
      onEnderecoRuaChange={setEnderecoRua}
      onEnderecoNumeroChange={setEnderecoNumero}
      onEnderecoComplementoChange={setEnderecoComplemento}
      onEnderecoBairroChange={setEnderecoBairro}
      onEnderecoCidadeChange={setEnderecoCidade}
      onEnderecoEstadoChange={setEnderecoEstado}
      onNomeMaeChange={setNomeMae}
      onNomePaiChange={setNomePai}
      onIndicacaoChange={setIndicacao}
      clearError={clearError}
      onFotoChange={handleFotoChange}
      showPhotoUpload
      onSubmit={handleSalvar}
      onCancel={handleClose}
      salvando={salvando}
      cpfInputId="patient-create-cpf"
    />
  );

  if (isModal) {
    return renderModalShell(formInner);
  }

  return (
    <div className="animate-in fade-in duration-300 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-2 text-[14px] font-bold text-[#00a88e] transition-all hover:text-[#00967f]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} /> Voltar para Pacientes
        </button>
      </div>

      <div className="mb-2 flex items-center gap-4">
        <div className="rounded-2xl border border-app-border bg-[#e6f7f5] p-3 text-[#00a88e]">
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
