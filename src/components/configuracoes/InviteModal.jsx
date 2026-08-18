import React, { useState, useEffect } from 'react';
import { UserPlus, X, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { getApiErrorToastMessage, equipeApi } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { COUNTRY_PHONE_CODES, countrySelectDisplayLabel, getCountryByCode } from '../../data/countryPhoneCodes';
import { formatPhoneAsYouType, getDdi, isPhoneValid, formatPhoneForApi } from '../../utils/phoneUtils';
import { getPresetProfileId, getPermissoesPadraoPorPerfilId, formatCargoLabel } from './gestaoUsuariosUtils';
import { PermissoesPorModuloPanel } from './PermissoesPorModuloPanel';
import { PermissoesResumoToggle } from './PermissoesResumoToggle';
import { ConfirmarNavegacaoModal } from './ConfirmarNavegacaoModal';
import { EstadoCivilSelect } from '../patients/EstadoCivilSelect.jsx';

export function InviteModal({ roles, perfisAcesso, permissoes, especialidadesList, onClose, onSuccess, fetchHeaders, onEditarPerfilNaAba }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nome: '', email: '', senha: '', cpf: '', roleId: '', perfilAcessoId: '',
    dataNascimento: '', estadoCivilId: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', especialidades: []
  });
  const [saving, setSaving] = useState(false);
  const [telefoneCountryCode, setTelefoneCountryCode] = useState('BR');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [telefoneTouched, setTelefoneTouched] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  // Só leitura: mostra o que o Nível selecionado inclui. Editar de verdade acontece na aba Perfis de Acesso.
  const [permissoesDoNivel, setPermissoesDoNivel] = useState([]);
  const [permissoesExpandidas, setPermissoesExpandidas] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showConfirmEditarNivel, setShowConfirmEditarNivel] = useState(false);

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
      console.error('Erro ao carregar permissões do nível:', e);
      setPermissoesDoNivel(permissoesPadrao());
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleEditarNivelClick = () => {
    if (!form.perfilAcessoId) return;
    setShowConfirmEditarNivel(true);
  };

  const confirmarEditarNivel = () => {
    setShowConfirmEditarNivel(false);
    onEditarPerfilNaAba?.(form.perfilAcessoId);
    onClose();
  };

  const handleCepChange = async (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    let formattedCep = rawValue;
    if (rawValue.length > 5) {
      formattedCep = rawValue.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    setForm(prev => ({...prev, cep: formattedCep}));

    if (rawValue.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            logradouro: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            uf: data.uf || ''
          }));
          document.getElementById('invite-numero')?.focus();
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

  const handleRoleChangeInvite = (selectedRoleId) => {
    let nextPerfilAcessoId = form.perfilAcessoId;
    const selectedRole = roles.find(r => String(r.id) === String(selectedRoleId));
    if (selectedRole) {
      const presetId = getPresetProfileId(selectedRole.nome, perfisAcesso);
      if (presetId) {
        nextPerfilAcessoId = presetId;
      }
    }
    setForm({ ...form, roleId: selectedRoleId, perfilAcessoId: nextPerfilAcessoId });
    if (nextPerfilAcessoId !== form.perfilAcessoId) {
      loadPermissoesDoNivel(nextPerfilAcessoId);
    }
  };

  const handlePerfilChangeInvite = (selectedPerfilId) => {
    setForm({ ...form, perfilAcessoId: selectedPerfilId });
    loadPermissoesDoNivel(selectedPerfilId);
  };

  const maskCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const validateCPF = (cpf) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.roleId) return toast.error('Selecione um papel.');
    if (!form.perfilAcessoId) return toast.error('Selecione um nível de permissão.');
    if (form.senha.length < 8) return toast.error('A senha deve ter no mínimo 8 caracteres.');
    if (!validateCPF(form.cpf)) return toast.error('CPF inválido. Verifique os números digitados.');

    setSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');

      // Criamos um client temporário SEM persistência para não deslogar o admin atual
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false } }
      );

      // 1. Criar usuário no Supabase usando o client temporário
      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: {
          data: {
            nome_completo: form.nome
          }
        }
      });

      if (signUpError) throw signUpError;
      const usuarioId = signUpData.user?.id;
      if (!usuarioId) throw new Error('Falha ao obter ID do novo usuário no Supabase.');

      const token = signUpData.session?.access_token;

      // 2. Completar Perfil no Backend
      const profileRes = await fetch(resolveApiUrl('/api/auth/completar-perfil'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          nomeCompleto: form.nome,
          email: form.email,
          telefone: formatPhoneForApi(telefoneCountryCode, telefoneNumero) || null,
          cpf: form.cpf,
          dataNascimento: form.dataNascimento || null,
          estadoCivilId: form.estadoCivilId || null,
          cep: form.cep || null,
          logradouro: form.logradouro || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
          especialidades: form.especialidades
        })
      });

      if (!profileRes.ok) {
        const profileErr = await profileRes.json().catch(() => ({}));
        throw new Error(profileErr.message || 'Usuário criado no Supabase, mas erro ao completar perfil no backend.');
      }

      // 3. Vincular à Equipe
      try {
        await equipeApi.create({
          usuarioId,
          roleId: form.roleId,
          perfilAcessoId: form.perfilAcessoId
        });
      } catch (err) {
        throw new Error(getApiErrorToastMessage(err) || 'Perfil completado, mas erro ao vincular à equipe.');
      }

      toast.success('Acesso criado com sucesso!');
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Falha ao criar acesso.');
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
      className="fixed inset-0 z-[200] flex items-start md:items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto [webkit-overflow-scrolling:touch]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[95vw] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto rounded-3xl bg-white p-4 sm:p-6 md:p-8 shadow-2xl ring-1 ring-white/10 my-4 md:my-auto transition-all duration-300 min-h-[70vh] max-h-none md:max-h-[95vh] flex flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 rounded-xl">
              <UserPlus className="h-6 w-6 text-[#00a88e]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Novo Acesso</h3>
              <p className="text-sm text-slate-500 mt-0.5">Cadastre e configure um novo membro para a sua equipe.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200 transition-colors touch-manipulation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-visible md:overflow-y-auto [webkit-overflow-scrolling:touch] pr-1 pb-4 space-y-6">
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
                    maxLength={80}
                    value={form.nome}
                    onChange={e => setForm({...form, nome: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '')})}
                    placeholder="Ex: João da Silva"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">CPF</label>
                  <input
                    required
                    value={form.cpf}
                    onChange={e => setForm({...form, cpf: maskCPF(e.target.value)})}
                    placeholder="123.456.789-10"
                    maxLength={14}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Data de Nascimento <span className="font-normal text-slate-400 normal-case">(Opcional)</span></label>
                  <input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    min="1900-01-01"
                    value={form.dataNascimento}
                    onChange={e => {
                      if (e.target.value.length <= 10) setForm({...form, dataNascimento: e.target.value});
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Estado Civil <span className="font-normal text-slate-400 normal-case">(Opcional)</span></label>
                  <EstadoCivilSelect
                    value={form.estadoCivilId}
                    onChange={v => setForm({...form, estadoCivilId: v})}
                    selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
                  />
                </div>
              </div>
            </div>

            {/* Nova Seção: Especialidades */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-teal-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                  1b
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#00a88e]')}>Especialidades (Opcional)</h4>
              </div>
              <div className="grid grid-cols-1">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Especialidades de Estética / Saúde</label>
                  <div className="flex flex-wrap gap-2">
                    {(especialidadesList || []).map(esp => (
                      <label key={esp.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={form.especialidades.includes(esp.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({...form, especialidades: [...form.especialidades, esp.id]});
                            } else {
                              setForm({...form, especialidades: form.especialidades.filter(id => id !== esp.id)});
                            }
                          }}
                          className="h-4 w-4 text-[#00a88e] rounded border-slate-300 focus:ring-[#00a88e]"
                        />
                        <span className="text-[13px] font-medium text-slate-700">{esp.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-purple-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                  2
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#a855f7]')}>Contato</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">E-mail</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    placeholder="exemplo@google.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    Telefone Celular <span className="font-normal text-slate-400 normal-case">(Opcional)</span>
                  </label>
                  <div className={phoneWrapClass()}>
                    <select
                      value={telefoneCountryCode}
                      onChange={(e) => {
                        setTelefoneCountryCode(e.target.value);
                        setTelefoneNumero('');
                      }}
                      className="w-16 bg-transparent text-[14px] font-medium text-slate-700 outline-none cursor-pointer"
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

            {/* Nova Seção: Endereço */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-purple-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                  2b
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#a855f7]')}>Endereço (Opcional)</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">CEP</label>
                  <input
                    value={form.cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Logradouro</label>
                  <input
                    value={form.logradouro}
                    onChange={e => setForm({...form, logradouro: e.target.value})}
                    placeholder="Ex: Rua das Flores"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Número</label>
                  <input
                    id="invite-numero"
                    value={form.numero}
                    onChange={e => setForm({...form, numero: e.target.value})}
                    placeholder="Ex: 123"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Complemento</label>
                  <input
                    value={form.complemento}
                    onChange={e => setForm({...form, complemento: e.target.value})}
                    placeholder="Ex: Apto 42"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Bairro</label>
                  <input
                    value={form.bairro}
                    onChange={e => setForm({...form, bairro: e.target.value})}
                    placeholder="Ex: Centro"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Cidade</label>
                    <input
                      value={form.cidade}
                      onChange={e => setForm({...form, cidade: e.target.value})}
                      placeholder="Ex: São Paulo"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">UF</label>
                    <input
                      value={form.uf}
                      onChange={e => setForm({...form, uf: e.target.value.toUpperCase()})}
                      placeholder="Ex: SP"
                      maxLength={2}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 3: Acesso e Permissões */}
            <div className={sectionCardCls(false, 'rounded-2xl border border-blue-200 bg-white p-6')}>
              <div className={`flex items-center gap-3 ${sectionMb}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                  3
                </div>
                <h4 className={sectionHeadingCls('text-[18px] font-bold text-[#1d4ed8]')}>Acesso</h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">
                    <span>Senha Temporária</span>
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      className="text-teal-600 hover:text-teal-700 p-0.5 transition-colors focus:outline-none"
                    >
                      {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </label>
                  <input
                    required
                    type={showSenha ? "text" : "password"}
                    minLength={8}
                    value={form.senha}
                    onChange={e => setForm({...form, senha: e.target.value})}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm"
                  />
                </div>
                <div className="hidden md:block"></div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Cargo</label>
                  <select
                    required
                    value={form.roleId}
                    onChange={e => handleRoleChangeInvite(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 shadow-sm appearance-none"
                  >
                    <option value="">Selecione...</option>
                    {roles.filter(r => !['ADMIN', 'ADMINISTRADOR'].includes((r.nome || '').toUpperCase())).map(r => (
                      <option key={r.id} value={r.id}>{formatCargoLabel(r.nome)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-teal-700 ml-1">Nível de Permissão</label>
                  <select
                    required
                    value={form.perfilAcessoId}
                    onChange={e => handlePerfilChangeInvite(e.target.value)}
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
                </div>
              </div>

              {form.perfilAcessoId && (
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
                    onClick={handleEditarNivelClick}
                    className="mt-2 flex items-center gap-1.5 text-[12.5px] font-bold text-slate-500 hover:text-teal-700 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Editar este nível na aba Perfis de Acesso
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end border-t border-slate-100 pt-5 shrink-0 bg-white md:bg-transparent">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-32 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-sm active:scale-95 touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-48 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:pointer-events-none touch-manipulation"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {showConfirmEditarNivel && (
      <ConfirmarNavegacaoModal
        onCancel={() => setShowConfirmEditarNivel(false)}
        onConfirm={confirmarEditarNivel}
      />
    )}
    </>
  );
}
