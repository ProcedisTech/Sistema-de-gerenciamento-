import React, { useMemo, useState } from 'react';
import { Save, Loader2, UserRound, Plus, Camera, AlertTriangle, Calendar, ChevronRight, ChevronDown } from 'lucide-react';
import {
  maskCPF,
  maskRG,
  validateBirthDateDigits8,
  birthDateValidationUserMessage,
} from '../utils/formatters';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid } from '../../utils/phoneUtils';
import { PACIENTE_FIELD_MAX } from '../../utils/patientFieldMaxLength';
import { EnderecoFields } from '../common/EnderecoFields.jsx';
import ProfissaoSelect from './ProfissaoSelect';
import { EstadoCivilSelect } from './EstadoCivilSelect';

const FieldReq = () => <span className="text-red-500">*</span>;

/**
 * Formulário compartilhado create/edit de paciente.
 * `variant`: `page` (telas cheias), `modal`, `profile` (painel no perfil — estilo denso).
 */
export function PatientForm({
  mode,
  readOnly = false,
  variant = 'page',
  nome,
  dataNascimentoDisplay,
  idade,
  sexo,
  estadoCivilId,
  profissaoId,
  cpf,
  rg,
  telefoneCountryCode,
  telefoneNumero,
  telefoneTouched,
  email,
  instagram,
  tiktok,
  cep,
  enderecoRua,
  enderecoNumero,
  enderecoComplemento,
  enderecoBairro,
  enderecoCidade,
  enderecoEstado,
  nomeMae,
  nomePai,
  indicacao,
  dataNascimentoIso,
  fotoPerfilPreview,
  errors = {},
  cpfErrorText = '',
  erroBanner = '',
  onNomeChange,
  onDataNascimentoDisplayChange,
  onSexoChange,
  onEstadoCivilChange,
  onProfissaoIdChange,
  onCpfChange,
  onCpfBlur,
  onRgChange,
  onTelefoneCountryChange,
  onTelefoneNumeroChange,
  onTelefoneBlur,
  onEmailChange,
  onInstagramChange,
  onTiktokChange,
  onCepChange,
  onEnderecoRuaChange,
  onEnderecoNumeroChange,
  onEnderecoComplementoChange,
  onEnderecoBairroChange,
  onEnderecoCidadeChange,
  onEnderecoEstadoChange,
  onNomeMaeChange,
  onNomePaiChange,
  onIndicacaoChange,
  clearError,
  onFotoChange,
  showPhotoUpload = false,
  onSubmit,
  onCancel,
  salvando = false,
  submitLabel,
  cancelLabel = 'Cancelar',
  cpfInputId = 'patient-form-cpf',
  onManageAlerts,
  showFormHeading = false,
  formHeading = 'Editar Paciente',
}) {
  const isModalVariant = variant === 'modal' || variant === 'profile';
  const showBirthCalendarIcon = variant === 'modal';

  const cpfDisabled = mode === 'edit';

  const labelCls = (pageColorClass) =>
    isModalVariant ? 'text-[13px] font-medium text-slate-800' : `text-[13px] font-bold ${pageColorClass}`;

  const sectionHeadingCls = (pageColorClass) =>
    isModalVariant ? 'text-[18px] font-bold text-slate-900' : pageColorClass;

  const sectionCardCls = (hasError, pageNormalClasses) =>
    isModalVariant
      ? `rounded-xl border bg-white p-5 transition-colors ${
          hasError ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
        }`
      : pageNormalClasses;

  const inputClass = (field) => {
    if (isModalVariant) {
      const err = field != null && errors[field];
      return `w-full rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#f8fbfb] border rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'
    }`;
  };

  const selectPersonalClass = (field) => {
    if (isModalVariant) {
      const err = errors[field];
      return `w-full appearance-none rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#f8fbfb] border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 appearance-none transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-[#00a88e]/25 focus:border-[#00a88e]'
    }`;
  };

  const docInputClass = (field) => {
    if (isModalVariant) {
      const err = field === 'cpf' && (errors.cpf || cpfErrorText);
      return `w-full rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#eff6ff] border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 transition-all ${
      errors.cpf || cpfErrorText ? 'border-red-400 bg-red-50' : 'border-[#3b82f6]/30 focus:border-[#3b82f6]'
    }`;
  };

  const rgInputClass = () => {
    if (isModalVariant) {
      return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20';
    }
    return 'w-full px-4 py-3 bg-[#eff6ff] border border-blue-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 focus:border-[#3b82f6] transition-all';
  };

  const emailInputClass = () => {
    if (isModalVariant) {
      return `w-full rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        errors.email ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#faf5ff] border rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all ${errors.email ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus:border-[#a855f7]'}`;
  };

  const socialInputClass = () => {
    if (isModalVariant) {
      return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20';
    }
    return 'w-full px-4 py-3 bg-[#faf5ff] border border-[#a855f7]/30 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 focus:border-[#a855f7] transition-all';
  };

  const complementInputClass = () => {
    if (isModalVariant) {
      return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20';
    }
    return 'w-full px-4 py-3 bg-[#fffbeb] border border-amber-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 focus:border-[#f59e0b] transition-all';
  };

  const phoneWrapClass = () => {
    const invalid = telefoneTouched && !isPhoneValid(telefoneCountryCode ?? 'BR', telefoneNumero);
    if (isModalVariant) {
      return `flex items-stretch gap-0 rounded-lg border bg-white transition focus-within:border-[#00a88e] focus-within:ring-1 focus-within:ring-[#00a88e]/20 ${
        errors.telefone || invalid ? 'border-red-300 bg-red-50/60' : 'border-slate-200'
      }`;
    }
    return `flex items-stretch gap-1 rounded-xl border bg-[#faf5ff] transition-all focus-within:ring-4 focus-within:ring-[#a855f7]/20 ${
      errors.telefone || invalid ? 'border-red-400 bg-red-50' : 'border-[#a855f7]/30 focus-within:border-[#a855f7]'
    }`;
  };

  const idadeInputClass = () => {
    if (isModalVariant) {
      return 'w-full cursor-not-allowed rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[14px] font-medium text-slate-500';
    }
    return 'w-full px-4 py-3 bg-[#e2e8f0]/40 border border-app-border rounded-xl text-[14px] text-[#0f172a] font-bold cursor-not-allowed';
  };

  const hasPersonalSectionError =
    Boolean(errors.nome) ||
    Boolean(errors.dataNascimento) ||
    Boolean(errors.sexo) ||
    Boolean(errors.estadoCivil) ||
    Boolean(errors.profissao);

  const birthDigitsForUi = String(dataNascimentoDisplay ?? '').replace(/\D/g, '');
  const dataNascimentoFieldMessage = useMemo(() => {
    if (birthDigitsForUi.length === 8 && !dataNascimentoIso) {
      const br = validateBirthDateDigits8(birthDigitsForUi);
      if (!br.ok) return birthDateValidationUserMessage(br.reason);
    }
    return null;
  }, [birthDigitsForUi, dataNascimentoIso]);

  const defaultSubmitLabel = mode === 'create' ? 'Cadastrar Paciente' : (submitLabel ?? 'Salvar Alterações');

  const gridGapClass = isModalVariant ? 'gap-x-5 gap-y-4' : 'gap-x-6 gap-y-5';

  const sectionMb = isModalVariant ? 'mb-5' : 'mb-6';

  const idadeInputValue =
    idade !== '' && idade != null
      ? String(idade).includes('anos')
        ? String(idade)
        : `${idade} anos`
      : '';

  const isWideModal = variant === 'modal';
  const requiredFieldValues = [nome, dataNascimentoDisplay, sexo, estadoCivilId, profissaoId, cpf, telefoneNumero];
  const requiredFilledCount = requiredFieldValues.filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== '',
  ).length;
  const requiredTotal = requiredFieldValues.length;
  const hasComplementaryData = Boolean(instagram || tiktok || nomeMae || nomePai || indicacao);
  const [complementaryOpen, setComplementaryOpen] = useState(hasComplementaryData);

  return (
    <form
      onSubmit={onSubmit}
      className={isWideModal ? 'space-y-4' : isModalVariant ? 'space-y-5' : 'space-y-6'}
      aria-busy={salvando || undefined}
    >
      {showFormHeading ? (
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h4 className="text-[17px] font-bold text-[#0f172a]">{formHeading}</h4>
          {mode === 'edit' && typeof onManageAlerts === 'function' ? (
            <button
              type="button"
              onClick={onManageAlerts}
              className="inline-flex items-center gap-1 rounded-lg bg-[#dc2626] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#b91c1c]"
            >
              Gerenciar Alertas do Paciente
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      {showPhotoUpload && mode === 'create' && !isWideModal ? (
        <>
          <div className={`flex justify-center ${isModalVariant ? '-mt-1 mb-1' : 'mb-2'}`}>
            <label className="group relative cursor-pointer" title="Adicionar foto de perfil">
              <div
                className={
                  isModalVariant
                    ? 'flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm transition-all hover:border-[#00a88e]/40'
                    : 'flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-app-border bg-[#e6f7f5] shadow-sm transition-all group-hover:border-[#00a88e]'
                }
              >
                {fotoPerfilPreview ? (
                  <img src={fotoPerfilPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound
                    className={isModalVariant ? 'h-9 w-9 text-slate-300' : 'h-10 w-10 text-[#00a88e]/50'}
                    strokeWidth={1.5}
                  />
                )}
              </div>
              <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#00a88e] shadow">
                <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFotoChange} />
            </label>
          </div>
          <p
            className={
              isModalVariant
                ? '-mt-2 mb-1 text-center text-[12px] font-medium text-slate-500'
                : '-mt-2 mb-2 text-center text-[12px] font-medium text-[#94a3b8]'
            }
          >
            Foto de perfil (opcional)
          </p>
        </>
      ) : null}

      {(Object.keys(errors).length > 0 || erroBanner) && (
        <div
          className={
            isModalVariant
              ? 'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5 text-[13px] font-semibold text-red-700'
              : 'flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-bold text-red-600'
          }
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.5} />
          <span>
            {erroBanner ||
              (Object.keys(errors).length > 0 ? 'Por favor, preencha todos os campos obrigatórios (*).' : '')}
          </span>
        </div>
      )}

      {isWideModal ? (
        <>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {showPhotoUpload && mode === 'create' ? (
                <label
                  className="group flex shrink-0 cursor-pointer flex-col items-center gap-1"
                  title="Adicionar foto de perfil"
                >
                  <div className="relative">
                    <div
                      className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full shadow-sm transition-all ${
                        fotoPerfilPreview
                          ? 'border-2 border-[#00a88e] bg-white'
                          : 'border-2 border-dashed border-[#00a88e]/50 bg-[#e6f7f5] group-hover:border-[#00a88e] group-hover:bg-[#d9f2ee]'
                      }`}
                    >
                      {fotoPerfilPreview ? (
                        <img src={fotoPerfilPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="h-6 w-6 text-[#00a88e]" strokeWidth={1.75} />
                      )}
                    </div>
                    {!fotoPerfilPreview ? (
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#00a88e] shadow">
                        <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      </div>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-bold leading-none text-[#00a88e]">Foto</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onFotoChange}
                  />
                </label>
              ) : null}
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#00a88e]">
                  {requiredFilledCount} de {requiredTotal} campos obrigatórios preenchidos
                </p>
                <div className="mt-1.5 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-[#00a88e]/15">
                  <div
                    className="h-full rounded-full bg-[#00a88e] transition-all"
                    style={{ width: `${Math.round((requiredFilledCount / requiredTotal) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div
              className={`rounded-xl border bg-white p-4 transition-colors ${
                hasPersonalSectionError ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
              }`}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                  1
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#0f766e]')}>Dados Pessoais</h4>
              </div>
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls('text-[#00a88e]')}>
                    Nome Completo <FieldReq />
                  </label>
                  <input
                    type="text"
                    value={nome}
                    disabled={readOnly}
                    maxLength={PACIENTE_FIELD_MAX.nomeCompleto}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[0-9]/g, '').slice(0, PACIENTE_FIELD_MAX.nomeCompleto);
                      onNomeChange(value);
                      clearError?.('nome');
                    }}
                    placeholder="Nome completo do paciente"
                    className={inputClass('nome')}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={labelCls('text-[#00a88e]')}>
                      Nascimento <FieldReq />
                    </label>
                    <div className="flex items-stretch gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="bday"
                        value={dataNascimentoDisplay}
                        disabled={readOnly}
                        onChange={(e) => {
                          onDataNascimentoDisplayChange(e.target.value);
                          clearError?.('dataNascimento');
                        }}
                        placeholder="dd/mm/aaaa"
                        maxLength={10}
                        className={`min-w-0 flex-1 ${inputClass('dataNascimento')}`}
                      />
                      {showBirthCalendarIcon ? (
                        <label
                          className="relative flex shrink-0 cursor-pointer items-center px-2 text-slate-400 transition hover:text-[#00a88e]"
                          title="Escolher data no calendário"
                        >
                          <Calendar className="h-4 w-4" strokeWidth={2} />
                          <input
                            type="date"
                            value={dataNascimentoIso || ''}
                            max={new Date().toISOString().slice(0, 10)}
                            disabled={readOnly}
                            onChange={(e) => {
                              const iso = e.target.value;
                              if (!iso) return;
                              const [y, m, d] = iso.split('-');
                              onDataNascimentoDisplayChange(`${d}/${m}/${y}`);
                              clearError?.('dataNascimento');
                            }}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            aria-label="Escolher data de nascimento no calendário"
                          />
                        </label>
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
                      value={idadeInputValue}
                      placeholder="Automática"
                      disabled
                      className={idadeInputClass()}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={labelCls('text-[#00a88e]')}>
                      Sexo <FieldReq />
                    </label>
                    <select
                      value={sexo}
                      disabled={readOnly}
                      onChange={(e) => {
                        onSexoChange(e.target.value);
                        clearError?.('sexo');
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
                    <EstadoCivilSelect
                      id="patient-form-estado-civil"
                      value={estadoCivilId}
                      disabled={readOnly}
                      error={Boolean(errors?.estadoCivil)}
                      onChange={(value) => {
                        onEstadoCivilChange(value);
                        clearError?.('estadoCivil');
                      }}
                      selectClassName={selectPersonalClass('estadoCivil')}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls('text-[#00a88e]')}>
                    Profissão <FieldReq />
                  </label>
                  <ProfissaoSelect
                    value={profissaoId ?? null}
                    disabled={readOnly}
                    onChange={(uuid) => {
                      onProfissaoIdChange(uuid);
                      clearError?.('profissao');
                    }}
                    error={Boolean(errors?.profissao)}
                    variant={isModalVariant ? 'modal' : 'default'}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                    2
                  </div>
                  <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#1d4ed8]')}>Documentos</h4>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={labelCls('text-[#3b82f6]')}>
                      CPF <FieldReq />
                    </label>
                    <input
                      id={cpfInputId}
                      type="text"
                      name="cpf"
                      value={cpf}
                      readOnly={cpfDisabled}
                      aria-readonly={cpfDisabled || undefined}
                      maxLength={PACIENTE_FIELD_MAX.cpfFormatado}
                      onChange={(e) => {
                        if (cpfDisabled) return;
                        onCpfChange(maskCPF(e.target.value));
                        clearError?.('cpf');
                      }}
                      onBlur={cpfDisabled ? undefined : onCpfBlur}
                      placeholder="000.000.000-00"
                      autoComplete="off"
                      aria-invalid={Boolean(errors.cpf || cpfErrorText)}
                      aria-describedby={cpfErrorText ? `${cpfInputId}-error` : undefined}
                      className={cpfDisabled || readOnly ? idadeInputClass() : docInputClass('cpf')}
                    />
                    {cpfDisabled ? (
                      <p className="text-[12px] font-medium text-slate-500">Não pode ser alterado.</p>
                    ) : null}
                    {cpfErrorText ? (
                      <p id={`${cpfInputId}-error`} className="text-[12px] font-bold text-red-600" role="alert">
                        {cpfErrorText}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls('text-[#3b82f6]')}>RG</label>
                    <input
                      type="text"
                      value={rg}
                      disabled={readOnly}
                      maxLength={PACIENTE_FIELD_MAX.rgFormatado}
                      onChange={(e) => onRgChange(maskRG(e.target.value))}
                      placeholder="00.000.000-0"
                      className={rgInputClass()}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`flex flex-1 flex-col rounded-xl border p-6 transition-colors ${
                  errors.telefone || errors.email ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                } bg-white`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                    3
                  </div>
                  <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#7e22ce]')}>Contato</h4>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-5">
                  <div className="space-y-1.5">
                    <label className={labelCls('text-[#a855f7]')}>
                      Telefone <FieldReq />
                    </label>
                    <div className={phoneWrapClass()}>
                      <select
                        value={telefoneCountryCode}
                        disabled={readOnly}
                        title={getCountryByCode(telefoneCountryCode).name}
                        onChange={(e) => {
                          onTelefoneCountryChange(e.target.value);
                          clearError?.('telefone');
                        }}
                        className={
                          isModalVariant
                            ? 'max-w-[5.75rem] min-w-0 shrink-0 truncate rounded-l-lg border-0 bg-transparent py-2.5 pl-2 pr-1 text-[12px] font-medium text-slate-600 outline-none sm:max-w-[7.25rem]'
                            : 'max-w-[5.75rem] min-w-0 shrink-0 truncate rounded-l-[9px] border-0 bg-transparent py-3 pl-2 pr-1 text-[12px] font-medium text-[#475569] outline-none sm:max-w-[7.25rem]'
                        }
                        aria-label="País"
                      >
                        {[
                          COUNTRY_PHONE_CODES.find((c) => c.code === 'BR'),
                          ...COUNTRY_PHONE_CODES.filter((c) => c.code !== 'BR'),
                        ]
                          .filter(Boolean)
                          .map((c) => (
                            <option key={c.code} value={c.code} title={c.name}>
                              {countrySelectDisplayLabel(c)}
                            </option>
                          ))}
                      </select>
                      <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                        <span
                          className={
                            isModalVariant
                              ? 'flex shrink-0 items-center tabular-nums text-[13px] font-semibold text-slate-500'
                              : 'flex shrink-0 items-center tabular-nums text-[13px] font-semibold text-[#a855f7]'
                          }
                        >
                          {getDdi(telefoneCountryCode)}
                        </span>
                        <input
                          type="tel"
                          value={telefoneNumero}
                          disabled={readOnly}
                          maxLength={PACIENTE_FIELD_MAX.telefoneNumero}
                          autoComplete="tel-national"
                          onChange={(e) => {
                            onTelefoneNumeroChange(formatPhoneAsYouType(telefoneCountryCode, e.target.value));
                            clearError?.('telefone');
                          }}
                          onBlur={onTelefoneBlur}
                          placeholder={telefoneCountryCode === 'BR' ? '(00) 00000-0000' : 'Número'}
                          className={
                            isModalVariant
                              ? 'min-w-0 flex-1 rounded-r-lg bg-transparent py-2.5 pr-3 text-[14px] font-medium text-slate-900 outline-none'
                              : 'min-w-0 flex-1 rounded-r-[9px] bg-transparent py-3 pr-3 text-[14px] font-medium outline-none'
                          }
                        />
                      </div>
                    </div>
                    {telefoneTouched && !isPhoneValid(telefoneCountryCode ?? 'BR', telefoneNumero) && (
                      <p className="text-[12px] font-bold text-red-600">Número inválido para este país</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls('text-[#a855f7]')}>E-mail</label>
                    <input
                      type="email"
                      value={email}
                      disabled={readOnly}
                      maxLength={PACIENTE_FIELD_MAX.email}
                      onChange={(e) => {
                        onEmailChange(e.target.value);
                        clearError?.('email');
                      }}
                      placeholder="email@exemplo.com"
                      className={emailInputClass()}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[14px] font-bold text-white shadow-sm">
                  4
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#b45309]')}>Endereço</h4>
              </div>
              <EnderecoFields
                variant={variant === 'page' ? 'page' : variant === 'profile' ? 'profile' : 'modal'}
                readOnly={readOnly}
                cep={cep}
                onCepChange={onCepChange}
                rua={enderecoRua}
                onRuaChange={onEnderecoRuaChange}
                numero={enderecoNumero}
                onNumeroChange={onEnderecoNumeroChange}
                complemento={enderecoComplemento}
                onComplementoChange={onEnderecoComplementoChange}
                bairro={enderecoBairro}
                onBairroChange={onEnderecoBairroChange}
                cidade={enderecoCidade}
                onCidadeChange={onEnderecoCidadeChange}
                estado={enderecoEstado}
                onEstadoChange={onEnderecoEstadoChange}
                pageColorClass="text-[#f59e0b]"
                errors={errors}
                clearError={clearError}
              />

              <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setComplementaryOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2.5 text-[12.5px] font-bold text-amber-700 transition hover:bg-amber-50"
                  aria-expanded={complementaryOpen}
                >
                  <span>+ Informações Complementares (5)</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${complementaryOpen ? 'rotate-180' : ''}`}
                    strokeWidth={2.5}
                  />
                </button>

                {complementaryOpen ? (
                  <div className="mt-4 flex flex-col gap-5">
                    <div className="space-y-1.5">
                      <label className={labelCls('text-[#a855f7]')}>Instagram</label>
                      <input
                        type="text"
                        value={instagram}
                        disabled={readOnly}
                        maxLength={PACIENTE_FIELD_MAX.instagram}
                        onChange={(e) => onInstagramChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.instagram))}
                        placeholder="@usuario"
                        className={socialInputClass()}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls('text-[#a855f7]')}>TikTok</label>
                      <input
                        type="text"
                        value={tiktok}
                        disabled={readOnly}
                        maxLength={PACIENTE_FIELD_MAX.tiktok}
                        onChange={(e) => onTiktokChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.tiktok))}
                        placeholder="@usuario"
                        className={socialInputClass()}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls('text-[#f59e0b]')}>Nome da Mãe</label>
                      <input
                        type="text"
                        value={nomeMae}
                        disabled={readOnly}
                        maxLength={PACIENTE_FIELD_MAX.nomeMae}
                        onChange={(e) => onNomeMaeChange(e.target.value)}
                        placeholder="Nome completo"
                        className={complementInputClass()}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls('text-[#f59e0b]')}>Nome do Pai</label>
                      <input
                        type="text"
                        value={nomePai}
                        disabled={readOnly}
                        maxLength={PACIENTE_FIELD_MAX.nomePai}
                        onChange={(e) => onNomePaiChange(e.target.value)}
                        placeholder="Nome completo"
                        className={complementInputClass()}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls('text-[#f59e0b]')}>Indicação</label>
                      <input
                        type="text"
                        value={indicacao}
                        disabled={readOnly}
                        maxLength={PACIENTE_FIELD_MAX.indicacao}
                        onChange={(e) => onIndicacaoChange(e.target.value)}
                        placeholder="Quem indicou o paciente?"
                        className={complementInputClass()}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
      <div
        className={sectionCardCls(
          hasPersonalSectionError,
          `rounded-2xl border p-6 transition-colors ${
            hasPersonalSectionError ? 'border-red-300 bg-red-50/10' : 'border-[#00a88e]/25 bg-white'
          }`,
        )}
      >
        <div className={`flex items-center gap-3 ${sectionMb}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
            1
          </div>
          <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#0f766e]')}>Dados Pessoais</h4>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
          <div className="md:col-span-2 space-y-1.5">
            <label className={labelCls('text-[#00a88e]')}>
              Nome Completo <FieldReq />
            </label>
            <input
              type="text"
              value={nome}
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.nomeCompleto}
              onChange={(e) => {
                const value = e.target.value.replace(/[0-9]/g, '').slice(0, PACIENTE_FIELD_MAX.nomeCompleto);
                onNomeChange(value);
                clearError?.('nome');
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
                disabled={readOnly}
                onChange={(e) => {
                  onDataNascimentoDisplayChange(e.target.value);
                  clearError?.('dataNascimento');
                }}
                placeholder={isModalVariant ? 'dd/mm/aaaa' : 'DD/MM/AAAA'}
                maxLength={10}
                className={`min-w-0 flex-1 ${inputClass('dataNascimento')}`}
              />
              {showBirthCalendarIcon ? (
                <label
                  className="relative flex shrink-0 cursor-pointer items-center px-2 text-slate-400 transition hover:text-[#00a88e]"
                  title="Escolher data no calendário"
                >
                  <Calendar className="h-4 w-4" strokeWidth={2} />
                  <input
                    type="date"
                    value={dataNascimentoIso || ''}
                    max={new Date().toISOString().slice(0, 10)}
                    disabled={readOnly}
                    onChange={(e) => {
                      const iso = e.target.value;
                      if (!iso) return;
                      const [y, m, d] = iso.split('-');
                      onDataNascimentoDisplayChange(`${d}/${m}/${y}`);
                      clearError?.('dataNascimento');
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Escolher data de nascimento no calendário"
                  />
                </label>
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
              value={idadeInputValue}
              placeholder="Calculada automaticamente"
              disabled
              className={idadeInputClass()}
            />
            {mode === 'edit' ? (
              <p className="text-[12px] font-medium text-slate-500">Calculada automaticamente.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#00a88e]')}>
              Sexo <FieldReq />
            </label>
            <select
              value={sexo}
              disabled={readOnly}
              onChange={(e) => {
                onSexoChange(e.target.value);
                clearError?.('sexo');
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
            <EstadoCivilSelect
              id="patient-form-estado-civil"
              value={estadoCivilId}
              disabled={readOnly}
              error={Boolean(errors?.estadoCivil)}
              onChange={(value) => {
                onEstadoCivilChange(value);
                clearError?.('estadoCivil');
              }}
              selectClassName={selectPersonalClass('estadoCivil')}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className={labelCls('text-[#00a88e]')}>
              Profissão <FieldReq />
            </label>
            <ProfissaoSelect
              value={profissaoId ?? null}
              disabled={readOnly}
              onChange={(uuid) => {
                onProfissaoIdChange(uuid);
                clearError?.('profissao');
              }}
              error={Boolean(errors?.profissao)}
              variant={isModalVariant ? 'modal' : 'default'}
            />
          </div>
        </div>
      </div>

      <div className={sectionCardCls(false, 'rounded-2xl border border-blue-200 bg-white p-6')}>
        <div className={`flex items-center gap-3 ${sectionMb}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
            2
          </div>
          <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#1d4ed8]')}>Documentos</h4>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#3b82f6]')}>
              CPF <FieldReq />
            </label>
            <input
              id={cpfInputId}
              type="text"
              name="cpf"
              value={cpf}
              readOnly={cpfDisabled}
              aria-readonly={cpfDisabled || undefined}
              maxLength={PACIENTE_FIELD_MAX.cpfFormatado}
              onChange={(e) => {
                if (cpfDisabled) return;
                onCpfChange(maskCPF(e.target.value));
                clearError?.('cpf');
              }}
              onBlur={cpfDisabled ? undefined : onCpfBlur}
              placeholder="000.000.000-00"
              autoComplete="off"
              aria-invalid={Boolean(errors.cpf || cpfErrorText)}
              aria-describedby={cpfErrorText ? `${cpfInputId}-error` : undefined}
              className={cpfDisabled || readOnly ? idadeInputClass() : docInputClass('cpf')}
            />
            {cpfDisabled ? (
              <p className="text-[12px] font-medium text-slate-500">O CPF não pode ser alterado após o cadastro.</p>
            ) : null}
            {cpfErrorText ? (
              <p id={`${cpfInputId}-error`} className="text-[12px] font-bold text-red-600" role="alert">
                {cpfErrorText}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#3b82f6]')}>RG</label>
            <input
              type="text"
              value={rg}
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.rgFormatado}
              onChange={(e) => onRgChange(maskRG(e.target.value))}
              placeholder="00.000.000-0"
              className={rgInputClass()}
            />
          </div>
        </div>
      </div>

      <div
        className={sectionCardCls(
          Boolean(errors.telefone || errors.email),
          `rounded-2xl border p-6 transition-colors ${
            errors.telefone || errors.email ? 'border-red-300 bg-red-50/10' : 'border-[#a855f7]/25 bg-white'
          }`,
        )}
      >
        <div className={`flex items-center gap-3 ${sectionMb}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
            3
          </div>
          <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#7e22ce]')}>Contato</h4>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#a855f7]')}>
              Telefone <FieldReq />
            </label>
            <div className={phoneWrapClass()}>
              <select
                value={telefoneCountryCode}
                disabled={readOnly}
                title={getCountryByCode(telefoneCountryCode).name}
                onChange={(e) => {
                  onTelefoneCountryChange(e.target.value);
                  clearError?.('telefone');
                }}
                className={
                  isModalVariant
                    ? 'max-w-[5.75rem] min-w-0 shrink-0 truncate rounded-l-lg border-0 bg-transparent py-2.5 pl-2 pr-1 text-[12px] font-medium text-slate-600 outline-none sm:max-w-[7.25rem]'
                    : 'max-w-[5.75rem] min-w-0 shrink-0 truncate rounded-l-[9px] border-0 bg-transparent py-3 pl-2 pr-1 text-[12px] font-medium text-[#475569] outline-none sm:max-w-[7.25rem]'
                }
                aria-label="País"
              >
                {[
                  COUNTRY_PHONE_CODES.find((c) => c.code === 'BR'),
                  ...COUNTRY_PHONE_CODES.filter((c) => c.code !== 'BR'),
                ]
                  .filter(Boolean)
                  .map((c) => (
                    <option key={c.code} value={c.code} title={c.name}>
                      {countrySelectDisplayLabel(c)}
                    </option>
                  ))}
              </select>
              <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                <span
                  className={
                    isModalVariant
                      ? 'flex shrink-0 items-center tabular-nums text-[13px] font-semibold text-slate-500'
                      : 'flex shrink-0 items-center tabular-nums text-[13px] font-semibold text-[#a855f7]'
                  }
                >
                  {getDdi(telefoneCountryCode)}
                </span>
                <input
                  type="tel"
                  value={telefoneNumero}
                  disabled={readOnly}
                  maxLength={PACIENTE_FIELD_MAX.telefoneNumero}
                  autoComplete="tel-national"
                  onChange={(e) => {
                    onTelefoneNumeroChange(formatPhoneAsYouType(telefoneCountryCode, e.target.value));
                    clearError?.('telefone');
                  }}
                  onBlur={onTelefoneBlur}
                  placeholder={telefoneCountryCode === 'BR' ? '(00) 00000-0000' : 'Número'}
                  className={
                    isModalVariant
                      ? 'min-w-0 flex-1 rounded-r-lg bg-transparent py-2.5 pr-3 text-[14px] font-medium text-slate-900 outline-none'
                      : 'min-w-0 flex-1 rounded-r-[9px] bg-transparent py-3 pr-3 text-[14px] font-medium outline-none'
                  }
                />
              </div>
            </div>
            {telefoneTouched && !isPhoneValid(telefoneCountryCode ?? 'BR', telefoneNumero) && (
              <p className="text-[12px] font-bold text-red-600">Número inválido para este país</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#a855f7]')}>E-mail</label>
            <input
              type="email"
              value={email}
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.email}
              onChange={(e) => {
                onEmailChange(e.target.value);
                clearError?.('email');
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
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.instagram}
              onChange={(e) => onInstagramChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.instagram))}
              placeholder="@usuario"
              className={socialInputClass()}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#a855f7]')}>TikTok</label>
            <input
              type="text"
              value={tiktok}
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.tiktok}
              onChange={(e) => onTiktokChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.tiktok))}
              placeholder="@usuario"
              className={socialInputClass()}
            />
          </div>
        </div>
      </div>

      <div className={sectionCardCls(false, 'rounded-2xl border border-amber-200 bg-white p-6')}>
        <div className={`flex items-center gap-3 ${sectionMb}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[14px] font-bold text-white shadow-sm">
            4
          </div>
          <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#b45309]')}>Informações Complementares</h4>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
          <div className="md:col-span-2">
            <EnderecoFields
              variant={variant === 'page' ? 'page' : variant === 'profile' ? 'profile' : 'modal'}
              readOnly={readOnly}
              cep={cep}
              onCepChange={onCepChange}
              rua={enderecoRua}
              onRuaChange={onEnderecoRuaChange}
              numero={enderecoNumero}
              onNumeroChange={onEnderecoNumeroChange}
              complemento={enderecoComplemento}
              onComplementoChange={onEnderecoComplementoChange}
              bairro={enderecoBairro}
              onBairroChange={onEnderecoBairroChange}
              cidade={enderecoCidade}
              onCidadeChange={onEnderecoCidadeChange}
              estado={enderecoEstado}
              onEstadoChange={onEnderecoEstadoChange}
              pageColorClass="text-[#f59e0b]"
              errors={errors}
              clearError={clearError}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#f59e0b]')}>Nome da Mãe</label>
            <input
              type="text"
              value={nomeMae}
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.nomeMae}
              onChange={(e) => onNomeMaeChange(e.target.value)}
              placeholder="Nome completo"
              className={complementInputClass()}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls('text-[#f59e0b]')}>Nome do Pai</label>
            <input
              type="text"
              value={nomePai}
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.nomePai}
              onChange={(e) => onNomePaiChange(e.target.value)}
              placeholder="Nome completo"
              className={complementInputClass()}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className={labelCls('text-[#f59e0b]')}>Indicação</label>
            <input
              type="text"
              value={indicacao}
              disabled={readOnly}
              maxLength={PACIENTE_FIELD_MAX.indicacao}
              onChange={(e) => onIndicacaoChange(e.target.value)}
              placeholder="Quem indicou o paciente?"
              className={complementInputClass()}
            />
          </div>
        </div>
      </div>
        </>
      )}

      <div
        className={
          isModalVariant
            ? 'flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center'
            : 'flex flex-col-reverse items-stretch justify-between gap-3 border-t-[3px] border-[#00a88e]/15 pt-4 sm:flex-row sm:items-center'
        }
      >
        <button
          type="button"
          onClick={onCancel}
          className={
            isModalVariant
              ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-700 outline-none transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto'
              : 'flex w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-6 py-3 text-[14px] font-bold text-[#00a88e] shadow-sm outline-none transition hover:border-[#00a88e] hover:bg-[#e6f7f5] sm:w-auto'
          }
        >
          {readOnly ? 'Fechar' : cancelLabel}
        </button>
        {!readOnly && (
          <button
            type="submit"
            disabled={salvando}
            className={
              isModalVariant
                ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-[#00a88e] px-5 py-2.5 text-[14px] font-semibold text-white outline-none transition hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
                : 'flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-6 py-3 text-[14px] font-bold text-white shadow-md outline-none transition hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
            }
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2.5} />}
            {defaultSubmitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
