import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { useToast } from '../../contexts/useToast.js';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'atendendo', label: 'Atendendo' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'offline', label: 'Offline' },
];

const VALID_STATUS = new Set(STATUS_OPTIONS.map((o) => o.value));

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj != null && typeof obj === 'object' && k in obj && obj[k] != null && obj[k] !== '') {
      return obj[k];
    }
  }
  return undefined;
}

function mapPerfilFromDto(data) {
  if (!data || typeof data !== 'object') return null;
  const rawStatus = pick(data, 'statusPresenca', 'status_presenca');
  const statusPresenca =
    typeof rawStatus === 'string' && VALID_STATUS.has(rawStatus) ? rawStatus : 'offline';
  return {
    fotoUrl: pick(data, 'fotoUrl', 'foto_url'),
    nomeCompleto: String(pick(data, 'nomeCompleto', 'nome_completo') ?? '').trim(),
    apelido: String(pick(data, 'apelido') ?? '').trim(),
    telefone: String(pick(data, 'telefone') ?? '').trim(),
    statusPresenca,
  };
}

function resolveFotoSrc(fotoUrl) {
  if (fotoUrl == null || typeof fotoUrl !== 'string') return '';
  const t = fotoUrl.trim();
  if (!t) return '';
  if (t.startsWith('data:') || t.startsWith('blob:')) return t;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return resolveApiUrl(t);
  return t;
}

/**
 * @param {{ getAuthHeaders: () => Record<string, string> }} props
 */
export function PerfilProfissionalPanel({ getAuthHeaders }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const formId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [nomeCompleto, setNomeCompleto] = useState('');
  const [apelido, setApelido] = useState('');
  const [telefone, setTelefone] = useState('');
  const [statusPresenca, setStatusPresenca] = useState('offline');

  /** URL persistida no servidor (para PUT quando o preview local é base64). */
  const [fotoUrlServidor, setFotoUrlServidor] = useState('');
  /** Valor exibido no círculo: URL do servidor ou data URL do arquivo local. */
  const [fotoUrlPreview, setFotoUrlPreview] = useState('');

  const fetchHeaders = useCallback(() => {
    const h = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
    return h && typeof h === 'object' ? { ...h } : {};
  }, [getAuthHeaders]);

  const loadPerfil = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(resolveApiUrl('/api/v1/perfil'), {
        credentials: 'include',
        headers: { ...fetchHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(
          data?.message || data?.detail || data?.error || `Não foi possível carregar o perfil (${res.status}).`
        );
        return;
      }
      const m = mapPerfilFromDto(data);
      if (!m) {
        setLoadError('Resposta inválida do servidor.');
        return;
      }
      setNomeCompleto(m.nomeCompleto);
      setApelido(m.apelido);
      setTelefone(m.telefone);
      setStatusPresenca(m.statusPresenca);
      const srv =
        m.fotoUrl != null && typeof m.fotoUrl === 'string' ? m.fotoUrl.trim() : '';
      setFotoUrlServidor(srv);
      setFotoUrlPreview(srv ? resolveFotoSrc(srv) : '');
    } catch {
      setLoadError('Falha de rede ao carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }, [fetchHeaders]);

  useEffect(() => {
    loadPerfil();
  }, [loadPerfil]);

  const onPickFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === 'string') setFotoUrlPreview(r);
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(resolveApiUrl('/api/v1/perfil/foto'), {
        method: 'POST',
        credentials: 'include',
        headers: { ...fetchHeaders() },
        body: formData,
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        setFotoUrlServidor(json.fotoUrl ?? json.foto_url ?? '');
        toast.success('Foto atualizada.');
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(
          errBody?.message || errBody?.detail || errBody?.error || `Falha ao enviar foto (${res.status}).`
        );
      }
    } catch {
      toast.error('Falha de rede ao enviar a foto.');
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const body = {
        nomeCompleto: nomeCompleto.trim(),
        apelido: apelido.trim(),
        telefone: telefone.trim(),
        statusPresenca,
        fotoUrl: fotoUrlServidor,
      };

      const res = await fetch(resolveApiUrl('/api/v1/perfil'), {
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
      toast.success('Perfil salvo com sucesso.');
      await loadPerfil();
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
          onClick={() => loadPerfil()}
          className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-[13px] font-bold text-red-700 hover:bg-red-50"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const imgSrc = fotoUrlPreview || '';
  const fotoInputId = `${formId}-foto`;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5">
      <div>
        <label htmlFor={fotoInputId} className="mb-1 block text-[13px] font-bold text-[#00a88e]">
          Foto
        </label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e] shadow-sm ring-offset-2 transition hover:border-[#00a88e]/45 focus:outline-none focus:ring-2 focus:ring-[#00a88e]/40"
            aria-label="Alterar foto de perfil"
          >
            {imgSrc ? (
              <img src={imgSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-10 w-10" strokeWidth={1.75} aria-hidden />
            )}
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#00a88e] text-white shadow">
              <Camera className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </span>
          </button>
          <input
            ref={fileInputRef}
            id={fotoInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onPickFoto}
          />
          <div className="min-w-0 text-[12px] font-medium leading-snug text-[#64748b]">
            Toque no círculo para escolher: preview imediato e envio automático ao servidor.
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-nome`} className="mb-2 block text-[13px] font-bold text-[#00a88e]">
          Nome completo
        </label>
        <input
          id={`${formId}-nome`}
          type="text"
          value={nomeCompleto}
          onChange={(e) => setNomeCompleto(e.target.value)}
          className="w-full rounded-xl border-[3px] border-[#e2e8f0] bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35"
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-apelido`} className="mb-2 block text-[13px] font-bold text-[#00a88e]">
          Apelido
        </label>
        <input
          id={`${formId}-apelido`}
          type="text"
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          className="w-full rounded-xl border-[3px] border-[#e2e8f0] bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35"
          autoComplete="nickname"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-tel`} className="mb-2 block text-[13px] font-bold text-[#00a88e]">
          Telefone / WhatsApp
        </label>
        <input
          id={`${formId}-tel`}
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="w-full rounded-xl border-[3px] border-[#e2e8f0] bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35"
          autoComplete="tel"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-status`} className="mb-2 block text-[13px] font-bold text-[#00a88e]">
          Status de presença
        </label>
        <select
          id={`${formId}-status`}
          value={statusPresenca}
          onChange={(e) => setStatusPresenca(e.target.value)}
          className="w-full rounded-xl border-[3px] border-[#e2e8f0] bg-white px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition focus:border-[#00a88e]/35"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-[3px] border-[#00a88e]/25 bg-[#00a88e] px-4 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#00997f] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
