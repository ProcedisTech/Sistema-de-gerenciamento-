import React, { useState, useEffect } from 'react';
import { Edit2, X, Loader2, Eye, EyeOff, MapPin, Phone, Stethoscope, Shield, ExternalLink } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { getApiErrorToastMessage, equipeApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid, formatPhoneForApi, parsePhoneFromApi } from '../../utils/phoneUtils';
import { getPresetProfileId, getPermissoesPadraoPorPerfilId, formatCargoLabel } from './gestaoUsuariosUtils';
import { PermissoesPorModuloPanel } from './PermissoesPorModuloPanel';
import { PermissoesResumoToggle } from './PermissoesResumoToggle';
import { ConfirmarNavegacaoModal } from './ConfirmarNavegacaoModal';
import { EstadoCivilSelect } from '../patients/EstadoCivilSelect.jsx';

export function EditRoleModal({ usuario, roles, perfisAcesso, permissoes, especialidadesList, onClose, onSuccess, fetchHeaders, readOnly = false, onEditarPerfilNaAba }) {
  const { roleUserId: currentRoleUserId, papel } = useOrg();
  const toast = useToast();
  const [roleId, setRoleId] = useState(usuario.roleId || usuario.role?.id || '');
  const [perfilAcessoId, setPerfilAcessoId] = useState(usuario.perfilAcessoId || '');
  const [nome, setNome] = useState(usuario.nomeCompleto || usuario.usuarioNome || '');
  const [showCpf, setShowCpf] = useState(false);

  // Só leitura: mostra o que o perfil atribuído inclui. Editar de verdade acontece na aba Perfis de Acesso.
  const [permissoesDoNivel, setPermissoesDoNivel] = useState([]);
  const [permissoesExpandidas, setPermissoesExpandidas] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showConfirmEditarPerfil, setShowConfirmEditarPerfil] = useState(false);

  const parsedPhone = parsePhoneFromApi(usuario.telefone || usuario.usuarioTelefone);
  const [telefoneCountryCode, setTelefoneCountryCode] = useState(parsedPhone.countryCode);
  const [telefoneNumero, setTelefoneNumero] = useState(parsedPhone.nationalNumber);
  const [telefoneTouched, setTelefoneTouched] = useState(false);

  const [email, setEmail] = useState(usuario.email || '');
  const [dataNascimento, setDataNascimento] = useState(usuario.dataNascimento || '');
  const [estadoCivilId, setEstadoCivilId] = useState(usuario.estadoCivilId || '');
  const [cep, setCep] = useState(usuario.cep || '');
  const [logradouro, setLogradouro] = useState(usuario.logradouro || '');
  const [numero, setNumero] = useState(usuario.numero || '');
  const [complemento, setComplemento] = useState(usuario.complemento || '');
  const [bairro, setBairro] = useState(usuario.bairro || '');
  const [cidade, setCidade] = useState(usuario.cidade || '');
  const [uf, setUf] = useState(usuario.uf || '');
  const [especialidades, setEspecialidades] = useState(usuario.especialidades || []);
  const [saving, setSaving] = useState(false);

  const isUserOwner = (usuario.perfilAcessoCodigo || '').toUpperCase() === 'DONO';
  const isSelfEdit = String(usuario.id) === String(currentRoleUserId);
  const isDono = papel === 'DONO';
  // O DONO pode ter um cargo (role) na clínica — apenas o nível de acesso (perfilAcesso) fica bloqueado
  const lockNivelField = isUserOwner;
  // E-mail também fica bloqueado para o próprio dono editando a si mesmo
  const lockEmailField = isUserOwner || (isSelfEdit && isDono);

  const loadPermissoesDoNivel = async (perfilId) => {
    if (!perfilId) {
      setPermissoesDoNivel([]);
      return;
    }
    setLoadingTemplate(true);
    // Norma padrão como ponto de partida — usada tanto quando a clínica ainda não
    // customizou este Nível (API retorna []) quanto se a chamada falhar.
    const permissoesPadrao = () => getPermissoesPadraoPorPerfilId(perfilId, perfisAcesso, permissoes);
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfilId}/permissoes`), {
        headers: await fetchHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPermissoesDoNivel(data.length === 0 ? permissoesPadrao() : data);
      } else {
        setPermissoesDoNivel(permissoesPadrao());
      }
    } catch (e) {
      console.error('Erro ao carregar permissões:', e);
      setPermissoesDoNivel(permissoesPadrao());
    } finally {
      setLoadingTemplate(false);
    }
  };

  useEffect(() => {
    // Carrega as permissões atuais do membro (perfil global ou já customizado) ao abrir o modal.
    if (!isUserOwner && perfilAcessoId) {
      loadPermissoesDoNivel(perfilAcessoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditarPerfilClick = () => {
    if (!perfilAcessoId) return;
    if (!readOnly) {
      setShowConfirmEditarPerfil(true);
      return;
    }
    onEditarPerfilNaAba?.(perfilAcessoId);
    onClose();
  };

  const confirmarEditarPerfil = () => {
    setShowConfirmEditarPerfil(false);
    onEditarPerfilNaAba?.(perfilAcessoId);
    onClose();
  };

  const handleCepChangeEdit = async (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    let formattedCep = rawValue;
    if (rawValue.length > 5) {
      formattedCep = rawValue.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    setCep(formattedCep);

    if (rawValue.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setLogradouro(data.logradouro || '');
          setBairro(data.bairro || '');
          setCidade(data.localidade || '');
          setUf(data.uf || '');
          // foca no número
          document.getElementById('edit-numero')?.focus();
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);


  const handleRoleChangeEdit = (selectedRoleId) => {
    setRoleId(selectedRoleId);
    // Não altera o nível de acesso do DONO — ele fica sempre bloqueado
    if (isUserOwner) return;
    const selectedRole = roles.find(r => String(r.id) === String(selectedRoleId));
    if (selectedRole) {
      const presetId = getPresetProfileId(selectedRole.nome, perfisAcesso);
      if (presetId && presetId !== perfilAcessoId) {
        setPerfilAcessoId(presetId);
        loadPermissoesDoNivel(presetId);
      }
    }
  };

  const handlePerfilChangeEdit = (selectedPerfilId) => {
    setPerfilAcessoId(selectedPerfilId);
    loadPermissoesDoNivel(selectedPerfilId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await equipeApi.update(usuario.id, {
        usuarioId: usuario.usuarioId || usuario.usuario?.id,
        nomeCompleto: nome,
        email: email,
        telefone: formatPhoneForApi(telefoneCountryCode, telefoneNumero) || "",
        roleId: roleId || null,
        perfilAcessoId: perfilAcessoId || null,
        dataNascimento: dataNascimento || null,
        estadoCivilId: estadoCivilId || null,
        cep: cep || "",
        logradouro: logradouro || "",
        numero: numero || "",
        complemento: complemento || "",
        bairro: bairro || "",
        cidade: cidade || "",
        uf: uf || "",
        especialidades: especialidades
      });
      toast.success('Acesso atualizado com sucesso.');
      onSuccess();
    } catch (err) {
      console.error('Erro ao atualizar papel:', err);
      toast.error(getApiErrorToastMessage(err, 'Erro ao atualizar acesso.'));
    } finally {
      setSaving(false);
    }
  };

  const sectionCardCls = (err, cls) => `transition-all duration-300 shadow-sm ${cls} ${err ? 'border-red-300 ring-2 ring-red-100' : 'hover:shadow-md hover:border-slate-300'}`;
  const sectionHeadingCls = (cls) => `font-bold tracking-tight ${cls}`;
  const sectionMb = "mb-5";
  const gridGapClass = "gap-x-6 gap-y-5";

  const phoneWrapClass = () => `flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-all shadow-sm ${
    telefoneTouched && telefoneNumero && !isPhoneValid(telefoneCountryCode, telefoneNumero)
      ? 'border-red-300 ring-4 ring-red-100'
      : 'border-slate-200 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10'
  }`;

  return (
    <>
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/60 sm:p-4 md:p-6 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full h-[100dvh] sm:h-auto max-w-full sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto rounded-none sm:rounded-3xl bg-white p-4 sm:p-6 md:p-8 shadow-2xl ring-1 ring-white/10 transition-all duration-300 sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl">
              <Edit2 className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{readOnly ? 'Visualizar Acesso' : 'Editar Acesso'}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{readOnly ? 'Visualize as informações do membro da equipe.' : 'Atualize as informações e permissões do membro da equipe.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200 transition-colors touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto [webkit-overflow-scrolling:touch] pr-1 space-y-6 pb-4">
            {/* Seção 1: Dados Básicos */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-teal-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                  1
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#00a88e]')}>Dados Básicos</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Nome Completo</label>
                  <input
                    required
                    disabled={readOnly}
                    maxLength={80}
                    value={nome}
                    onChange={e => setNome(e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, ''))}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-1">
                    <span>CPF (Não editável)</span>
                    {usuario.cpf && (
                      <button
                        type="button"
                        onClick={() => setShowCpf(!showCpf)}
                        className="text-teal-600 hover:text-teal-700 p-0.5"
                      >
                        {showCpf ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      disabled
                      value={usuario.cpf || 'Não informado'}
                      className={`w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[14px] text-slate-500 outline-none cursor-not-allowed shadow-sm ${!showCpf && usuario.cpf ? 'filter blur-sm select-none' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Data de Nascimento</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    min="1900-01-01"
                    disabled={readOnly}
                    value={dataNascimento}
                    onChange={e => {
                      if (e.target.value.length <= 10) setDataNascimento(e.target.value);
                    }}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Estado Civil</label>
                  <EstadoCivilSelect
                    value={estadoCivilId}
                    disabled={readOnly}
                    onChange={setEstadoCivilId}
                    selectClassName={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm appearance-none ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
              </div>
            </div>

            {/* Nova Seção: Endereço */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-indigo-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[14px] font-bold text-white shadow-sm">
                  <MapPin className="h-4 w-4" />
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-indigo-600')}>Endereço</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">CEP</label>
                  <input
                    maxLength={9}
                    disabled={readOnly}
                    placeholder="00000-000"
                    value={cep}
                    onChange={handleCepChangeEdit}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Logradouro</label>
                  <input
                    maxLength={150}
                    disabled={readOnly}
                    value={logradouro}
                    onChange={e => setLogradouro(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Número</label>
                  <input
                    id="edit-numero"
                    maxLength={20}
                    disabled={readOnly}
                    value={numero}
                    onChange={e => setNumero(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Complemento</label>
                  <input
                    maxLength={100}
                    disabled={readOnly}
                    value={complemento}
                    onChange={e => setComplemento(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Bairro</label>
                  <input
                    maxLength={100}
                    disabled={readOnly}
                    value={bairro}
                    onChange={e => setBairro(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Cidade</label>
                  <input
                    maxLength={100}
                    disabled={readOnly}
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">UF</label>
                  <select
                    value={uf}
                    disabled={readOnly}
                    onChange={e => setUf(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm appearance-none ${readOnly ? 'bg-slate-50/70 cursor-default' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  >
                    <option value="">UF</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-purple-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                  <Phone className="h-4 w-4" />
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#a855f7]')}>Contato</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wider ml-1 ${lockEmailField ? 'text-slate-400' : 'text-teal-700'}`}>
                    E-mail {lockEmailField && '(Dono)'}
                  </label>
                  <input
                    required
                    type="email"
                    disabled={readOnly || lockEmailField}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all shadow-sm ${(readOnly || lockEmailField) ? 'bg-slate-50/70 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    Telefone Celular <span className="font-normal text-slate-400 normal-case">(Opcional)</span>
                  </label>
                  <div className={phoneWrapClass()}>
                    <select
                      value={telefoneCountryCode}
                      disabled={readOnly}
                      onChange={(e) => {
                        setTelefoneCountryCode(e.target.value);
                        setTelefoneNumero('');
                      }}
                      className={`w-16 bg-transparent text-[14px] font-medium text-slate-700 outline-none ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {COUNTRY_PHONE_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.code}
                        </option>
                      ))}
                    </select>
                    <div className="h-5 w-px bg-slate-200 mx-1"></div>
                    <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                      <span className="flex items-center text-[14px] text-slate-500 font-medium pt-0.5">
                        {getDdi(telefoneCountryCode)}
                      </span>
                      <input
                        type="tel"
                        disabled={readOnly}
                        value={telefoneNumero}
                        onChange={(e) => setTelefoneNumero(formatPhoneAsYouType(telefoneCountryCode, e.target.value))}
                        onBlur={() => setTelefoneTouched(true)}
                        placeholder="99999-9999"
                        className="w-full min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 placeholder-slate-400 outline-none"
                      />
                    </div>
                  </div>
                  {telefoneTouched && telefoneNumero && !isPhoneValid(telefoneCountryCode, telefoneNumero) && (
                    <span className="mt-1.5 ml-1 block text-[11px] font-semibold text-red-500">Telefone inválido para {countrySelectDisplayLabel(getCountryByCode(telefoneCountryCode))}.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Seção Especialidades (Opcional) */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-pink-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500 text-[14px] font-bold text-white shadow-sm">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <h4 className={sectionHeadingCls('text-[18px] font-bold text-pink-600')}>Especialidades Clínicas</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Selecione as especialidades de atuação (opcional).</p>
                </div>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                {especialidadesList && especialidadesList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {especialidadesList.map(esp => {
                      const isSelected = especialidades.includes(esp.id);
                      return (
                        <label
                          key={esp.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-pink-300 bg-pink-50 text-pink-900 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-pink-200 hover:bg-pink-50/30'
                          }`}
                        >
                          <div className="flex items-center h-5">
                            <input
                              type="checkbox"
                              disabled={readOnly}
                              className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-600"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEspecialidades([...especialidades, esp.id]);
                                } else {
                                  setEspecialidades(especialidades.filter(id => id !== esp.id));
                                }
                              }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{esp.nome}</span>
                            <span className="text-[11px] text-slate-500 leading-tight mt-0.5">{esp.descricao}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    Nenhuma especialidade cadastrada no sistema.
                  </div>
                )}
              </div>
            </div>

            {/* Seção 3: Acesso e Permissões */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-blue-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                  <Shield className="h-4 w-4" />
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#1d4ed8]')}>Acesso</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    Cargo na Clínica
                  </label>
                  <select
                    value={roleId}
                    disabled={readOnly}
                    onChange={e => handleRoleChangeEdit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
                  >
                    <option value="">Sem cargo específico</option>
                    {roles.filter(r => !['ADMIN', 'ADMINISTRADOR'].includes((r.nome || '').toUpperCase())).map(r => (
                      <option key={r.id} value={r.id}>{formatCargoLabel(r.nome)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wider ml-1 ${lockNivelField ? 'text-slate-400' : 'text-teal-700'}`}>
                    Nível de Acesso {lockNivelField && '(Dono)'}
                  </label>
                  {isUserOwner ? (
                    <input
                      disabled
                      value="Dono — acesso total"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[14px] text-slate-500 outline-none cursor-not-allowed shadow-sm"
                    />
                  ) : (
                    <select
                      required
                      value={perfilAcessoId}
                      disabled={readOnly}
                      onChange={e => handlePerfilChangeEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
                    >
                      <option value="">Selecione...</option>
                      {[...perfisAcesso]
                        .filter(p => (p.codigo || '').toUpperCase() !== 'DONO' && (p.nome || '').toLowerCase() !== 'dono')
                        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))
                      }
                    </select>
                  )}
                </div>
              </div>

              {!isUserOwner && perfilAcessoId && (
                <div className="mt-4">
                  <PermissoesResumoToggle
                    ativas={permissoesDoNivel.length}
                    total={(permissoes || []).length}
                    expandido={permissoesExpandidas}
                    onToggle={() => setPermissoesExpandidas(prev => !prev)}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={handleEditarPerfilClick}
                    className="mt-2 flex items-center gap-1.5 text-[12.5px] font-bold text-slate-500 hover:text-teal-700 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Editar este perfil na aba Perfis de Acesso
                  </button>
                  <div className={`grid transition-all duration-200 ease-out ${permissoesExpandidas ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <PermissoesPorModuloPanel
                        permissoes={permissoes}
                        selecionadas={permissoesDoNivel}
                        loading={loadingTemplate}
                        disabled
                        onChange={() => {}}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 shrink-0 bg-white md:bg-transparent">
            {readOnly ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} className="w-full sm:w-32 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-all touch-manipulation">Fechar</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} className="w-full sm:w-32 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-sm active:scale-95 touch-manipulation">Voltar</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-48 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:pointer-events-none touch-manipulation"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>

    {showConfirmEditarPerfil && (
      <ConfirmarNavegacaoModal
        onCancel={() => setShowConfirmEditarPerfil(false)}
        onConfirm={confirmarEditarPerfil}
      />
    )}
    </>
  );
}
