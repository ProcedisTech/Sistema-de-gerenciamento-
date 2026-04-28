import React, { useState, useRef, useEffect } from 'react';
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
import { PatientForm } from './PatientForm.jsx';

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
      profissao,
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
                Novo Paciente
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
      profissao={profissao}
      genero={genero}
      cpf={cpf}
      rg={rg}
      telefoneCountryCode={telefoneCountryCode}
      telefoneNumero={telefoneNumero}
      telefoneTouched={telefoneTouched}
      email={email}
      instagram={instagram}
      tiktok={tiktok}
      endereco={endereco}
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
      onProfissaoChange={setProfissao}
      onGeneroChange={setGenero}
      onCpfChange={setCpf}
      onCpfBlur={handleCpfBlur}
      onRgChange={setRg}
      onTelefoneCountryChange={handleTelefoneCountryChange}
      onTelefoneNumeroChange={setTelefoneNumero}
      onTelefoneBlur={() => setTelefoneTouched(true)}
      onEmailChange={setEmail}
      onInstagramChange={setInstagram}
      onTiktokChange={setTiktok}
      onEnderecoChange={setEndereco}
      onNomeMaeChange={setNomeMae}
      onNomePaiChange={setNomePai}
      onIndicacaoChange={setIndicacao}
      clearError={clearError}
      onFotoChange={handleFotoChange}
      showPhotoUpload
      onSubmit={handleSalvar}
      onCancel={() => setPatientView('list')}
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
          onClick={() => setPatientView('list')}
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
