import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Building2, Camera, Loader2 } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { useToast } from '../../contexts/useToast.js';

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj != null && typeof obj === 'object' && k in obj && obj[k] != null && obj[k] !== '') {
      return obj[k];
    }
  }
  return undefined;
}

function mapClinicaFromDto(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    logoUrl: pick(data, 'logoUrl', 'logo_url'),
    nome: String(pick(data, 'nome', 'nomeFantasia', 'nome_fantasia') ?? '').trim(),
    telefone: String(pick(data, 'telefone') ?? '').trim(),
    email: String(pick(data, 'email') ?? '').trim(),
  };
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

/**
 * @param {{
 *   getAuthHeaders: () => Record<string, string>,
 *   onClinicaAtualizada?: (nome: string, logoUrl: string) => void,
 * }} props
 */
export function DadosClinicaPanel({ getAuthHeaders, onClinicaAtualizada }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const formId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const [logoUrlServidor, setLogoUrlServidor] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');

  const fetchHeaders = useCallback(() => {
    const h = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
    return h && typeof h === 'object' ? { ...h } : {};
  }, [getAuthHeaders]);

  const loadClinica = useCallback(async (opts = {}) => {
    const silent = !!opts.silent;
    if (!silent) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const res = await fetch(resolveApiUrl('/api/v1/clinica'), {
        credentials: 'include',
        headers: { ...fetchHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) {
          setLoadError(
            data?.message || data?.detail || data?.error || `Não foi possível carregar a clínica (${res.status}).`
          );
        }
        return null;
      }
      const m = mapClinicaFromDto(data);
      if (!m) {
        if (!silent) setLoadError('Resposta inválida do servidor.');
        return null;
      }
      setNome(m.nome);
      setTelefone(m.telefone);
      setEmail(m.email);
      const srv = m.logoUrl != null && typeof m.logoUrl === 'string' ? m.logoUrl.trim() : '';
      setLogoUrlServidor(srv);
      setFotoPreview(srv ? resolveLogoSrc(srv) : '');
      return { nome: m.nome, logoUrl: srv };
    } catch {
      if (!silent) setLoadError('Falha de rede ao carregar a clínica.');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchHeaders]);

  useEffect(() => {
    loadClinica();
  }, [loadClinica]);

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
      console.log('headers upload:', getAuthHeaders());
      const res = await fetch(resolveApiUrl('/api/v1/clinica/foto'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...fetchHeaders() },
        body: formData,
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        setLogoUrlServidor(json.logoUrl ?? json.logo_url ?? '');
        setFotoPreview(json.logoUrl ?? json.logo_url ?? '');
        onClinicaAtualizada?.(json.nome, json.logoUrl ?? json.logo_url ?? '');
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

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const body = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        logoUrl: logoUrlServidor,
      };

      const res = await fetch(resolveApiUrl('/api/v1/clinica'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...fetchHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(errBody?.message || errBody?.detail || errBody?.error || `Erro ao salvar (${res.status}).`);
        return;
      }
      toast.success('Dados da clínica salvos com sucesso.');
      const snap = await loadClinica();
      if (snap && typeof onClinicaAtualizada === 'function') {
        onClinicaAtualizada(snap.nome, snap.logoUrl ?? snap.logo_url ?? '');
      }
    } catch {
      toast.error('Falha ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
        <Loader2 className="h-9 w-9 animate-spin text-[#00a88e]" aria-hidden />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-center">
        <p className="text-[14px] font-semibold text-red-800">{loadError}</p>
        <button
          type="button"
          onClick={() => loadClinica()}
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5">
      <div>
        <label htmlFor={logoInputId} className="mb-1 block text-[13px] font-bold text-[#00a88e]">
          Logo
        </label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-[#e6f7f5] text-[#00a88e] shadow-sm ring-offset-2 transition hover:border-[#00a88e]/45 focus:outline-none focus:ring-2 focus:ring-[#00a88e]/40"
            aria-label="Alterar logo da clínica"
          >
            {logoSrcResolvido ? (
              <img
                src={logoSrcResolvido}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-10 w-10" strokeWidth={1.75} aria-hidden />
            )}
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#00a88e] text-white shadow">
              <Camera className="h-4 w-4" strokeWidth={2.25} aria-hidden />
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
          <div className="min-w-0 text-[12px] font-medium leading-snug text-[#64748b]">
            Toque no círculo para escolher: preview imediato e envio automático ao servidor.
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-nome`} className="mb-2 block text-[13px] font-bold text-[#00a88e]">
          Nome da clínica
        </label>
        <input
          id={`${formId}-nome`}
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35"
          autoComplete="organization"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-tel`} className="mb-2 block text-[13px] font-bold text-[#00a88e]">
          Telefone
        </label>
        <input
          id={`${formId}-tel`}
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35"
          autoComplete="tel"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-email`} className="mb-2 block text-[13px] font-bold text-[#00a88e]">
          Email
        </label>
        <input
          id={`${formId}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35"
          autoComplete="email"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-[#00a88e] px-4 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#00997f] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
