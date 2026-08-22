import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Building2, Loader2, Plus, Save, Search } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { useToast } from '../../contexts/useToast.js';
import { useOrg } from '../../contexts/OrgContext.jsx';
import { usePapel } from '../../hooks/usePapel.js';
import {
  getApiErrorToastMessage,
  organizacaoApi,
} from '../../services/api.js';
import { formatCnpjInput, isValidCnpj } from '../../utils/cnpj.js';
import { maskCep, onlyDigitsCep } from '../../utils/cepUtils.js';
import { useCepLookup } from '../hooks/useCepLookup.js';
import { ConfigFormSectionsSkeleton } from '../shared/ConfigPanelSkeletons';

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj != null && typeof obj === 'object' && k in obj && obj[k] != null) {
      return obj[k];
    }
  }
  return undefined;
}

function strField(v) {
  if (v == null) return '';
  return String(v).trim();
}

function resolveLogoSrc(logoUrl) {
  if (logoUrl == null || typeof logoUrl !== 'string') return '';
  const t = logoUrl.trim();
  if (!t) return '';
  if (t.startsWith('data:') || t.startsWith('blob:')) return t;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return resolveApiUrl(t);
  return t;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function findOrgRow(list, orgId) {
  if (!Array.isArray(list) || !orgId) return null;
  const idStr = String(orgId).trim();
  return (
    list.find(
      (o) =>
        o &&
        typeof o === 'object' &&
        (String(o.id ?? '') === idStr || String(o.organizacaoSaudeId ?? '') === idStr)
    ) ?? null
  );
}

function mapRowToForm(row) {
  const cnpjRaw = strField(pick(row, 'cnpj'));
  const cnpjDigits = cnpjRaw.replace(/\D/g, '').slice(0, 14);
  const ig = strField(pick(row, 'instagramHandle', 'instagram_handle'));
  return {
    razaoSocial: strField(pick(row, 'razaoSocial', 'razao_social')),
    nomeFantasia: strField(pick(row, 'nomeFantasia', 'nome_fantasia', 'nome')),
    cnpjDisplay: formatCnpjInput(cnpjDigits),
    inscricaoEstadual: strField(pick(row, 'inscricaoEstadual', 'inscricao_estadual')),
    inscricaoMunicipal: strField(pick(row, 'inscricaoMunicipal', 'inscricao_municipal')),
    telefonePrincipal: strField(pick(row, 'telefonePrincipal', 'telefone_principal')),
    whatsapp: strField(pick(row, 'whatsapp')),
    email: strField(pick(row, 'email')),
    siteUrl: strField(pick(row, 'siteUrl', 'site_url')),
    instagramHandle: ig.replace(/^@+/, ''),
    cep: (() => {
      const c = strField(pick(row, 'cep')).replace(/\D/g, '').slice(0, 8);
      return c.length === 8 ? maskCep(c) : strField(pick(row, 'cep'));
    })(),
    enderecoLogradouro: strField(pick(row, 'enderecoLogradouro', 'endereco_logradouro')),
    enderecoNumero: strField(pick(row, 'enderecoNumero', 'endereco_numero')),
    enderecoComplemento: strField(pick(row, 'enderecoComplemento', 'endereco_complemento')),
    enderecoBairro: strField(pick(row, 'enderecoBairro', 'endereco_bairro')),
    enderecoCidade: strField(pick(row, 'enderecoCidade', 'endereco_cidade')),
    enderecoEstado: strField(pick(row, 'enderecoEstado', 'endereco_estado'))
      .toUpperCase()
      .slice(0, 2),
    enderecoPais: strField(pick(row, 'enderecoPais', 'endereco_pais')) || 'Brasil',
    responsavelTecnicoNome: strField(pick(row, 'responsavelTecnicoNome', 'responsavel_tecnico_nome')),
    responsavelTecnicoRegistro: strField(
      pick(row, 'responsavelTecnicoRegistro', 'responsavel_tecnico_registro')
    ),
    logoUrl: strField(pick(row, 'logoUrl', 'logo_url')),
  };
}

/**
 * @param {{
 *   getAuthHeaders: () => Record<string, string>,
 *   onClinicaAtualizada?: (nome: string, logoUrl: string) => void,
 * }} props
 */
export function DadosClinicaPanel({ getAuthHeaders, onClinicaAtualizada }) {
  const toast = useToast();
  const { orgId } = useOrg();
  const { isAdmin } = usePapel();
  const fileInputRef = useRef(null);
  const formId = useId();
  const { lookup, status: cepLookupStatus, reset: resetCepLookup } = useCepLookup();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpjDisplay, setCnpjDisplay] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');

  const [telefonePrincipal, setTelefonePrincipal] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');

  const [cep, setCep] = useState('');
  const [enderecoLogradouro, setEnderecoLogradouro] = useState('');
  const [enderecoNumero, setEnderecoNumero] = useState('');
  const [enderecoComplemento, setEnderecoComplemento] = useState('');
  const [enderecoBairro, setEnderecoBairro] = useState('');
  const [enderecoCidade, setEnderecoCidade] = useState('');
  const [enderecoEstado, setEnderecoEstado] = useState('');
  const [enderecoPais, setEnderecoPais] = useState('Brasil');

  const [responsavelTecnicoNome, setResponsavelTecnicoNome] = useState('');
  const [responsavelTecnicoRegistro, setResponsavelTecnicoRegistro] = useState('');

  const [logoUrlServidor, setLogoUrlServidor] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');

  const fetchHeaders = useCallback(async () => {
    const h = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    return h && typeof h === 'object' ? { ...h } : {};
  }, [getAuthHeaders]);

  const applyRow = useCallback((row) => {
    const m = mapRowToForm(row);
    setRazaoSocial(m.razaoSocial);
    setNomeFantasia(m.nomeFantasia);
    setCnpjDisplay(m.cnpjDisplay);
    setInscricaoEstadual(m.inscricaoEstadual);
    setInscricaoMunicipal(m.inscricaoMunicipal);
    setTelefonePrincipal(m.telefonePrincipal);
    setWhatsapp(m.whatsapp);
    setEmail(m.email);
    setSiteUrl(m.siteUrl);
    setInstagramHandle(m.instagramHandle);
    setCep(m.cep);
    setEnderecoLogradouro(m.enderecoLogradouro);
    setEnderecoNumero(m.enderecoNumero);
    setEnderecoComplemento(m.enderecoComplemento);
    setEnderecoBairro(m.enderecoBairro);
    setEnderecoCidade(m.enderecoCidade);
    setEnderecoEstado(m.enderecoEstado);
    setEnderecoPais(m.enderecoPais || 'Brasil');
    setResponsavelTecnicoNome(m.responsavelTecnicoNome);
    setResponsavelTecnicoRegistro(m.responsavelTecnicoRegistro);
    const srv = m.logoUrl;
    setLogoUrlServidor(srv);
    setFotoPreview(srv ? resolveLogoSrc(srv) : '');
    resetCepLookup();
  }, [resetCepLookup]);

  const loadOrganizacao = useCallback(
    async (opts = {}) => {
      const silent = !!opts.silent;
      if (!orgId) {
        if (!silent) {
          setLoadError('Organização não definida.');
          setLoading(false);
        }
        return null;
      }
      if (!silent) {
        setLoading(true);
        setLoadError('');
      }
      try {
        const list = await organizacaoApi.getMinhas();
        const row = findOrgRow(list, orgId);
        if (!row) {
          if (!silent) setLoadError('Não foi possível carregar os dados da clínica para esta organização.');
          return null;
        }
        applyRow(row);
        return row;
      } catch (e) {
        if (!silent) {
          setLoadError(getApiErrorToastMessage(e, 'Falha ao carregar dados da clínica.'));
        }
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orgId, applyRow]
  );

  useEffect(() => {
    loadOrganizacao();
  }, [loadOrganizacao]);

  const onPickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === 'string') setFotoPreview(r);
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(resolveApiUrl('/api/v1/clinica/foto'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...(await fetchHeaders()) },
        body: formData,
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const url = json.logoUrl ?? json.logo_url ?? '';
        setLogoUrlServidor(url);
        setFotoPreview(url ? resolveLogoSrc(url) : '');
        const nomeShell =
          strField(json.nome ?? json.nomeFantasia) || nomeFantasia.trim() || razaoSocial.trim();
        onClinicaAtualizada?.(nomeShell, url);
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(
          errBody?.message || errBody?.detail || errBody?.error || `Falha ao enviar logo (${res.status}).`
        );
      }
    } catch {
      toast.error('Falha de rede ao enviar o logo.');
    }
  };

  const handleBuscarCep = async () => {
    const out = await lookup(cep);
    if (!out.ok) return;
    if (out.skipped) {
      toast.error('Informe um CEP com 8 dígitos.');
      return;
    }
    if (!out.data) {
      if (out.fetchFailed) {
        toast.error('Não foi possível consultar o CEP. Tente novamente.');
        return;
      }
      toast.error('CEP não encontrado.');
      return;
    }
    const d = out.data;
    setEnderecoLogradouro(d.rua || '');
    setEnderecoBairro(d.bairro || '');
    setEnderecoCidade(d.cidade || '');
    setEnderecoEstado((d.estado || '').toUpperCase().slice(0, 2));
    if (d.complemento && !enderecoComplemento.trim()) {
      setEnderecoComplemento(d.complemento);
    }
    toast.success('Endereço preenchido pelo CEP.');
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!isAdmin) return;
    if (!orgId) {
      toast.error('Organização não definida.');
      return;
    }

    const rs = razaoSocial.trim();
    const nf = nomeFantasia.trim();
    const cnpjDigits = cnpjDisplay.replace(/\D/g, '');
    if (!rs || !nf || !cnpjDigits) {
      toast.error('Preencha Razão social, Nome fantasia e CNPJ.');
      return;
    }
    if (!isValidCnpj(cnpjDigits)) {
      toast.error('CNPJ inválido.');
      return;
    }
    const em = email.trim();
    if (em && !EMAIL_RE.test(em)) {
      toast.error('E-mail inválido.');
      return;
    }

    const stripIg = (s) => s.replace(/^@+/, '').trim();

    const patchDto = {
      razaoSocial: rs,
      nomeFantasia: nf,
      cnpj: cnpjDigits,
      inscricaoEstadual: inscricaoEstadual.trim(),
      inscricaoMunicipal: inscricaoMunicipal.trim(),
      telefonePrincipal: telefonePrincipal.trim(),
      whatsapp: whatsapp.trim(),
      email: em,
      siteUrl: siteUrl.trim(),
      instagramHandle: stripIg(instagramHandle),
      cep: onlyDigitsCep(cep),
      enderecoLogradouro: enderecoLogradouro.trim(),
      enderecoNumero: enderecoNumero.trim(),
      enderecoComplemento: enderecoComplemento.trim(),
      enderecoBairro: enderecoBairro.trim(),
      enderecoCidade: enderecoCidade.trim(),
      enderecoEstado: enderecoEstado.trim().toUpperCase().slice(0, 2),
      enderecoPais: enderecoPais.trim() || 'Brasil',
      responsavelTecnicoNome: responsavelTecnicoNome.trim(),
      responsavelTecnicoRegistro: responsavelTecnicoRegistro.trim(),
      logoUrl: logoUrlServidor.trim(),
    };

    setSaving(true);
    try {
      await organizacaoApi.atualizar(orgId, patchDto);
      toast.success('Dados da clínica salvos com sucesso.');
      await loadOrganizacao({ silent: true });
      const nomeShell = nf || rs;
      onClinicaAtualizada?.(nomeShell, logoUrlServidor.trim());
    } catch (e) {
      toast.error(getApiErrorToastMessage(e, 'Erro ao salvar dados da clínica.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    void loadOrganizacao();
  };

  const dis = !isAdmin;
  const readonlyInputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-medium text-slate-600 outline-none cursor-not-allowed';
  const greenInput =
    'w-full px-4 py-3 bg-[#f8fbfb] border rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all border-[#00a88e]/25 focus:border-[#00a88e]';
  const purpleInput =
    'w-full px-4 py-3 bg-[#faf5ff] border rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#a855f7]/20 transition-all border-[#a855f7]/30 focus:border-[#a855f7]';
  const amberInput =
    'w-full px-4 py-3 bg-[#fffbeb] border border-amber-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 transition-all focus:border-[#f59e0b] text-[#0f172a]';
  const blueInput =
    'w-full px-4 py-3 bg-[#eff6ff] border rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#3b82f6]/20 transition-all border-[#3b82f6]/30 focus:border-[#3b82f6]';
  const inputCls = (themeClass) => (dis ? readonlyInputClass : themeClass);
  const labelCls = (color) => `text-[13px] font-bold ${color}`;
  const gridGapClass = 'gap-x-6 gap-y-5';
  const cep8Ok = onlyDigitsCep(cep).length === 8;

  if (loadError && !loading) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-center">
        <p className="text-[14px] font-semibold text-red-800">{loadError}</p>
        <button
          type="button"
          onClick={() => loadOrganizacao()}
          className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-[13px] font-bold text-red-700 hover:bg-red-50"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const imagemExibida = fotoPreview || logoUrlServidor;
  const logoInputId = `${formId}-logo`;
  const logoSrcResolvido = imagemExibida ? resolveLogoSrc(imagemExibida) : '';

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6">
      {dis ? (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-600"
        >
          Você não tem permissão para editar os dados da clínica. Entre em contato com um administrador.
        </div>
      ) : null}

      <div className="mb-2 flex items-center gap-4">
        <div className="rounded-2xl border border-app-border bg-[#e6f7f5] p-3 text-[#00a88e]">
          <Building2 className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Dados da Clínica</h3>
          <p className="text-[14px] font-medium text-[#64748b]">
            Identificação, contato e endereço da organização
          </p>
        </div>
      </div>

      {loading ? (
        <>
          <div className="mb-2 flex justify-center">
            <div className="h-24 w-24 animate-pulse rounded-full bg-[#f1f5f9]" />
          </div>
          <ConfigFormSectionsSkeleton sections={4} cardRounded="2xl" />
        </>
      ) : (
        <>
          {isAdmin ? (
            <>
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-[#e6f7f5] shadow-sm transition-all hover:border-[#00a88e] focus:outline-none focus:ring-2 focus:ring-[#00a88e]/40"
                  aria-label="Alterar logo da clínica"
                >
                  {logoSrcResolvido ? (
                    <img src={logoSrcResolvido} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-10 w-10 text-[#00a88e]/50" strokeWidth={1.5} aria-hidden />
                  )}
                  <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#00a88e] shadow">
                    <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.5} aria-hidden />
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  id={logoInputId}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={onPickLogo}
                />
              </div>
              <p className="-mt-2 mb-2 text-center text-[12px] font-medium text-[#94a3b8]">
                Logo da clínica (opcional)
              </p>
            </>
          ) : logoSrcResolvido ? (
            <>
              <div className="mb-2 flex justify-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                  <img src={logoSrcResolvido} alt="" className="h-full w-full object-cover" />
                </div>
              </div>
              <p className="-mt-2 mb-2 text-center text-[12px] font-medium text-[#94a3b8]">Logo da clínica</p>
            </>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {/* Card 1 — Identificação */}
          <div className="rounded-2xl border border-[#00a88e]/25 bg-white p-6 transition-colors">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                1
              </div>
              <h4 className="text-[18px] font-bold text-[#0f766e]">Identificação</h4>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
              <div className="md:col-span-2 space-y-1.5">
                <label className={labelCls('text-[#00a88e]')} htmlFor={`${formId}-razao`}>
                  Razão social <span className="text-red-600">*</span>
                </label>
                <input
                  id={`${formId}-razao`}
                  type="text"
                  value={razaoSocial}
                  onChange={dis ? undefined : (e) => setRazaoSocial(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(greenInput)}
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#00a88e]')} htmlFor={`${formId}-fantasia`}>
                  Nome fantasia <span className="text-red-600">*</span>
                </label>
                <input
                  id={`${formId}-fantasia`}
                  type="text"
                  value={nomeFantasia}
                  onChange={dis ? undefined : (e) => setNomeFantasia(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(greenInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#00a88e]')} htmlFor={`${formId}-cnpj`}>
                  CNPJ <span className="text-red-600">*</span>
                </label>
                <input
                  id={`${formId}-cnpj`}
                  type="text"
                  inputMode="numeric"
                  value={cnpjDisplay}
                  onChange={dis ? undefined : (e) => setCnpjDisplay(formatCnpjInput(e.target.value))}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(greenInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#00a88e]')} htmlFor={`${formId}-ie`}>
                  Inscrição estadual
                </label>
                <input
                  id={`${formId}-ie`}
                  type="text"
                  value={inscricaoEstadual}
                  onChange={dis ? undefined : (e) => setInscricaoEstadual(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(greenInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#00a88e]')} htmlFor={`${formId}-im`}>
                  Inscrição municipal
                </label>
                <input
                  id={`${formId}-im`}
                  type="text"
                  value={inscricaoMunicipal}
                  onChange={dis ? undefined : (e) => setInscricaoMunicipal(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(greenInput)}
                />
              </div>
            </div>
          </div>

          {/* Card 2 — Contato */}
          <div className="rounded-2xl border border-[#a855f7]/25 bg-white p-6 transition-colors">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a855f7] text-[14px] font-bold text-white shadow-sm">
                2
              </div>
              <h4 className="text-[18px] font-bold text-[#7e22ce]">Contato</h4>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#a855f7]')} htmlFor={`${formId}-telp`}>
                  Telefone principal
                </label>
                <input
                  id={`${formId}-telp`}
                  type="tel"
                  value={telefonePrincipal}
                  onChange={dis ? undefined : (e) => setTelefonePrincipal(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(purpleInput)}
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#a855f7]')} htmlFor={`${formId}-wa`}>
                  WhatsApp
                </label>
                <input
                  id={`${formId}-wa`}
                  type="tel"
                  value={whatsapp}
                  onChange={dis ? undefined : (e) => setWhatsapp(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(purpleInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#a855f7]')} htmlFor={`${formId}-mail`}>
                  E-mail
                </label>
                <input
                  id={`${formId}-mail`}
                  type="email"
                  value={email}
                  onChange={dis ? undefined : (e) => setEmail(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(purpleInput)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#a855f7]')} htmlFor={`${formId}-site`}>
                  Site
                </label>
                <input
                  id={`${formId}-site`}
                  type="url"
                  value={siteUrl}
                  onChange={dis ? undefined : (e) => setSiteUrl(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(purpleInput)}
                  autoComplete="url"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelCls('text-[#a855f7]')} htmlFor={`${formId}-ig`}>
                  Instagram (@handle)
                </label>
                <input
                  id={`${formId}-ig`}
                  type="text"
                  value={instagramHandle}
                  onChange={dis ? undefined : (e) => setInstagramHandle(e.target.value.replace(/^@+/, ''))}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(purpleInput)}
                  placeholder="ex.: minha_clinica"
                />
              </div>
            </div>
          </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {/* Card 3 — Endereço */}
          <div className="rounded-2xl border border-amber-200 bg-white p-6 transition-colors">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[14px] font-bold text-white shadow-sm">
                3
              </div>
              <h4 className="text-[18px] font-bold text-[#b45309]">Endereço</h4>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
              <div className="md:col-span-2 space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-cep`}>
                  CEP
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <input
                    id={`${formId}-cep`}
                    type="text"
                    inputMode="numeric"
                    value={cep}
                    onChange={dis ? undefined : (e) => setCep(maskCep(e.target.value))}
                    disabled={dis}
                    readOnly={dis}
                    className={`${inputCls(amberInput)} sm:min-w-0 sm:flex-1`}
                    autoComplete="postal-code"
                    placeholder="00000-000"
                  />
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => void handleBuscarCep()}
                      disabled={!cep8Ok || cepLookupStatus === 'loading'}
                      className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {cepLookupStatus === 'loading' ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Search className="h-4 w-4" aria-hidden />
                      )}
                      Buscar
                    </button>
                  ) : null}
                </div>
                {cepLookupStatus === 'not_found' || cepLookupStatus === 'error' ? (
                  <p className="mt-1 text-[12px] font-semibold text-amber-800" role="status">
                    Não foi possível consultar o CEP. Preencha o endereço manualmente.
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-log`}>
                  Logradouro
                </label>
                <input
                  id={`${formId}-log`}
                  type="text"
                  value={enderecoLogradouro}
                  onChange={dis ? undefined : (e) => setEnderecoLogradouro(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(amberInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-num`}>
                  Número
                </label>
                <input
                  id={`${formId}-num`}
                  type="text"
                  value={enderecoNumero}
                  onChange={dis ? undefined : (e) => setEnderecoNumero(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(amberInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-comp`}>
                  Complemento
                </label>
                <input
                  id={`${formId}-comp`}
                  type="text"
                  value={enderecoComplemento}
                  onChange={dis ? undefined : (e) => setEnderecoComplemento(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(amberInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-bairro`}>
                  Bairro
                </label>
                <input
                  id={`${formId}-bairro`}
                  type="text"
                  value={enderecoBairro}
                  onChange={dis ? undefined : (e) => setEnderecoBairro(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(amberInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-cidade`}>
                  Cidade
                </label>
                <input
                  id={`${formId}-cidade`}
                  type="text"
                  value={enderecoCidade}
                  onChange={dis ? undefined : (e) => setEnderecoCidade(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(amberInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-uf`}>
                  Estado (UF)
                </label>
                <input
                  id={`${formId}-uf`}
                  type="text"
                  maxLength={2}
                  value={enderecoEstado}
                  onChange={dis ? undefined : (e) => setEnderecoEstado(e.target.value.slice(0, 2))}
                  onBlur={
                    dis
                      ? undefined
                      : () => setEnderecoEstado((prev) => prev.trim().toUpperCase().slice(0, 2))
                  }
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(amberInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#f59e0b]')} htmlFor={`${formId}-pais`}>
                  País
                </label>
                <input
                  id={`${formId}-pais`}
                  type="text"
                  value={enderecoPais}
                  onChange={dis ? undefined : (e) => setEnderecoPais(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(amberInput)}
                />
              </div>
            </div>
          </div>

          {/* Card 4 — Responsável Técnico */}
          <div className="rounded-2xl border border-blue-200 bg-white p-6 transition-colors">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                4
              </div>
              <h4 className="text-[18px] font-bold text-[#1d4ed8]">Responsável Técnico</h4>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#3b82f6]')} htmlFor={`${formId}-rt-nome`}>
                  Nome do responsável
                </label>
                <input
                  id={`${formId}-rt-nome`}
                  type="text"
                  value={responsavelTecnicoNome}
                  onChange={dis ? undefined : (e) => setResponsavelTecnicoNome(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(blueInput)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls('text-[#3b82f6]')} htmlFor={`${formId}-rt-reg`}>
                  Registro profissional
                </label>
                <input
                  id={`${formId}-rt-reg`}
                  type="text"
                  value={responsavelTecnicoRegistro}
                  onChange={dis ? undefined : (e) => setResponsavelTecnicoRegistro(e.target.value)}
                  disabled={dis}
                  readOnly={dis}
                  className={inputCls(blueInput)}
                  placeholder="ex.: CRBM-DF 12345"
                />
              </div>
            </div>
          </div>
          </div>

          {isAdmin ? (
            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t-[3px] border-[#00a88e]/15 pt-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleCancel}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-6 py-3 text-[14px] font-bold text-[#00a88e] shadow-sm outline-none transition hover:border-[#00a88e] hover:bg-[#e6f7f5] sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-6 py-3 text-[14px] font-bold text-white shadow-md outline-none transition hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                )}
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </form>
  );
}
