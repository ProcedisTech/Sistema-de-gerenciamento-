import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, PenLine, Plus, Save, Trash2, User } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { useToast } from '../../contexts/useToast.js';
import { SignatureFullscreenModal } from '../journey/Step4LGPD.jsx';
import { AgendaAvatarInitials } from '../agenda/AgendaAvatarInitials.jsx';
import { formatBrNationalParentheses } from '../../utils/phoneUtils';
import { ConfigFormSectionsSkeleton } from '../shared/ConfigPanelSkeletons';
import {
  maskCPF,
  normalizeCpf,
  isCpfValidCheckDigits,
  isCpfIncomplete,
  sanitizeBirthDateDigits,
  formatBirthDigitsBR,
  validateBirthDateDigits8,
} from '../utils/formatters';
import { EnderecoFields } from '../common/EnderecoFields.jsx';
import { EstadoCivilSelect } from '../patients/EstadoCivilSelect.jsx';
import { formatCargoLabel } from './gestaoUsuariosUtils.js';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: '#22c55e' },
  { value: 'atendendo', label: 'Atendendo', color: '#3b82f6' },
  { value: 'aguardando', label: 'Aguardando', color: '#f59e0b' },
  { value: 'offline', label: 'Offline', color: '#94a3b8' },
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
    cpf: String(pick(data, 'cpf') ?? '').trim(),
    dataNascimento: String(pick(data, 'dataNascimento', 'data_nascimento') ?? '').trim(),
    estadoCivilId: String(pick(data, 'estadoCivilId', 'estado_civil_id') ?? '').trim(),
    cargoNome: String(pick(data, 'cargoNome', 'cargo_nome') ?? '').trim(),
    cep: String(pick(data, 'cep') ?? '').trim(),
    logradouro: String(pick(data, 'logradouro') ?? '').trim(),
    numero: String(pick(data, 'numero') ?? '').trim(),
    complemento: String(pick(data, 'complemento') ?? '').trim(),
    bairro: String(pick(data, 'bairro') ?? '').trim(),
    cidade: String(pick(data, 'cidade') ?? '').trim(),
    uf: String(pick(data, 'uf') ?? '').trim(),
  };
}

/** ISO "YYYY-MM-DD" (retorno do backend) -> exibição "DD/MM/AAAA". */
function isoToDisplayDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
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
 * @param {{
 *   getAuthHeaders: () => Record<string, string>,
 *   onPerfilAtualizado?: (data: { nomeCompleto: string, fotoUrl: string }) => void,
 * }} props
 */
export function PerfilProfissionalPanel({ getAuthHeaders, onPerfilAtualizado }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const formId = useId();
  const sigCanvasRef = useRef(null);
  const sigHasStrokeRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAssinatura, setSavingAssinatura] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [nomeCompleto, setNomeCompleto] = useState('');
  const [apelido, setApelido] = useState('');
  const [telefone, setTelefone] = useState('');
  const [statusPresenca, setStatusPresenca] = useState('offline');

  const [cpf, setCpf] = useState('');
  const [cpfSavedOnServer, setCpfSavedOnServer] = useState(false);
  const [cpfUnlocked, setCpfUnlocked] = useState(false);
  const cpfReadOnly = cpfSavedOnServer && !cpfUnlocked;

  const [dataNascimentoDisplay, setDataNascimentoDisplay] = useState('');
  const [dataNascimentoIso, setDataNascimentoIso] = useState('');
  const [estadoCivilId, setEstadoCivilId] = useState('');
  const [cargoNome, setCargoNome] = useState('');

  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  /** URL persistida no servidor (para PUT quando o preview local é base64). */
  const [fotoUrlServidor, setFotoUrlServidor] = useState('');
  /** Valor exibido na UI: URL do servidor ou data URL do arquivo local. */
  const [fotoUrlPreview, setFotoUrlPreview] = useState('');
  const [assinaturaPadraoPreview, setAssinaturaPadraoPreview] = useState('');
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [mobilePortrait, setMobilePortrait] = useState(false);

  const [errors, setErrors] = useState({});

  const clearError = (field) =>
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const inputClass = (field) => {
    if (errors[field]) {
      return 'w-full px-4 py-3 bg-red-50 border border-red-400 rounded-xl text-[14px] text-[#0f172a] font-medium outline-none transition';
    }
    return 'w-full px-4 py-3 bg-[#f8fbfb] border rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 transition-all border-[#00a88e]/25 focus:border-[#00a88e]';
  };

  const labelCls = (color) => `text-[13px] font-bold ${color}`;
  const gridGapClass = 'gap-x-6 gap-y-5';

  const fetchHeaders = useCallback(async () => {
    const h = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
    return h && typeof h === 'object' ? { ...h } : {};
  }, [getAuthHeaders]);

  const loadPerfil = useCallback(async (opts = {}) => {
    const silent = !!opts.silent;
    if (!silent) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const res = await fetch(resolveApiUrl('/api/v1/perfil'), {
        credentials: 'include',
        headers: { ...(await fetchHeaders()) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) {
          setLoadError(
            data?.message || data?.detail || data?.error || `Não foi possível carregar o perfil (${res.status}).`
          );
        }
        return;
      }
      const m = mapPerfilFromDto(data);
      if (!m) {
        if (!silent) setLoadError('Resposta inválida do servidor.');
        return;
      }
      setNomeCompleto(m.nomeCompleto);
      setApelido(m.apelido);
      // Ao carregar, aplicar máscara no número vindo do backend (dígitos puros)
      const digitsOnly = m.telefone.replace(/\D/g, '');
      setTelefone(digitsOnly ? formatBrNationalParentheses(digitsOnly) : '');
      setStatusPresenca(m.statusPresenca);
      const srv =
        m.fotoUrl != null && typeof m.fotoUrl === 'string' ? m.fotoUrl.trim() : '';
      setFotoUrlServidor(srv);
      setFotoUrlPreview(srv ? resolveFotoSrc(srv) : '');

      setCpf(m.cpf ? maskCPF(m.cpf) : '');
      setCpfSavedOnServer(Boolean(m.cpf));
      setCpfUnlocked(false);
      setDataNascimentoDisplay(isoToDisplayDate(m.dataNascimento));
      setDataNascimentoIso(m.dataNascimento || '');
      setEstadoCivilId(m.estadoCivilId || '');
      setCargoNome(m.cargoNome || '');
      setCep(m.cep);
      setLogradouro(m.logradouro);
      setNumero(m.numero);
      setComplemento(m.complemento);
      setBairro(m.bairro);
      setCidade(m.cidade);
      setUf(m.uf);
    } catch {
      if (!silent) setLoadError('Falha de rede ao carregar o perfil.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchHeaders]);

  const loadAssinaturaPadrao = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/v1/perfil/assinatura'), {
        credentials: 'include',
        headers: { ...(await fetchHeaders()) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const assinatura = String(data?.assinaturaPadrao ?? data?.assinatura_padrao ?? '').trim();
      setAssinaturaPadraoPreview(assinatura);
    } catch {
      // ignore
    }
  }, [fetchHeaders]);

  useEffect(() => {
    loadPerfil();
  }, [loadPerfil]);

  useEffect(() => {
    loadAssinaturaPadrao();
  }, [loadAssinaturaPadrao]);

  // Detecta orientação mobile para o modal de assinatura — não remover
  useEffect(() => {
    const ev = () => {
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      setMobilePortrait(isMobile && isPortrait);
    };
    ev();
    window.addEventListener('resize', ev);
    return () => window.removeEventListener('resize', ev);
  }, []);

  // --- Handlers de assinatura (intocados) ---

  const saveAssinaturaPadrao = async (assinaturaPadrao) => {
    if (!assinaturaPadrao) return;
    setSavingAssinatura(true);
    try {
      const res = await fetch(resolveApiUrl('/api/v1/perfil/assinatura'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...(await fetchHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assinaturaPadrao }),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          errBody?.message || errBody?.detail || errBody?.error || `Erro ao salvar assinatura (${res.status}).`
        );
        return;
      }
      setAssinaturaPadraoPreview(assinaturaPadrao);
      toast.success('Assinatura padrão salva com sucesso.');
      setSignatureModalOpen(false);
    } catch {
      toast.error('Falha ao salvar assinatura padrão.');
    } finally {
      setSavingAssinatura(false);
    }
  };

  const removeAssinaturaPadrao = async () => {
    setSavingAssinatura(true);
    try {
      const res = await fetch(resolveApiUrl('/api/v1/perfil/assinatura'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...(await fetchHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assinaturaPadrao: null }),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          errBody?.message || errBody?.detail || errBody?.error || `Erro ao remover assinatura (${res.status}).`
        );
        return;
      }
      setAssinaturaPadraoPreview('');
      toast.success('Assinatura removida.');
    } catch {
      toast.error('Falha ao remover assinatura.');
    } finally {
      setSavingAssinatura(false);
    }
  };

  // --- Handler de foto (intocado) ---

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
        headers: { ...(await fetchHeaders()) },
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

  const handleDataNascimentoChange = (raw) => {
    const digits = sanitizeBirthDateDigits(raw);
    setDataNascimentoDisplay(formatBirthDigitsBR(digits));
    clearError('dataNascimento');
    if (digits.length === 8) {
      const r = validateBirthDateDigits8(digits);
      setDataNascimentoIso(r.ok ? r.iso : '');
    } else {
      setDataNascimentoIso('');
    }
  };

  // --- Submit (PUT /api/v1/perfil) ---

  const handleSubmit = async (ev) => {
    ev.preventDefault();

    // Validação inline
    const e = {};
    if (!nomeCompleto.trim()) e.nome = true;
    if (!telefone.trim()) e.telefone = true;
    if (!isCpfValidCheckDigits(cpf)) e.cpf = true;
    if (!dataNascimentoIso) e.dataNascimento = true;
    if (!estadoCivilId) e.estadoCivil = true;
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setSaving(true);
    try {
      const body = {
        nomeCompleto: nomeCompleto.trim(),
        apelido: apelido.trim(),
        // Enviar apenas dígitos — backend não deve receber parênteses/traços da máscara
        telefone: telefone.replace(/\D/g, ''),
        statusPresenca,
        fotoUrl: fotoUrlServidor,
        cpf: normalizeCpf(cpf),
        dataNascimento: dataNascimentoIso,
        estadoCivilId,
        cep: cep.trim() || null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        uf: uf.trim() || null,
      };

      const res = await fetch(resolveApiUrl('/api/v1/perfil'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...(await fetchHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setErrors((prev) => ({ ...prev, cpf: true }));
          setCpfUnlocked(true);
          toast.error(errBody?.error || 'Já existe um usuário cadastrado com este CPF.');
        } else {
          toast.error(errBody?.error || errBody?.message || errBody?.detail || `Erro ao salvar (${res.status}).`);
        }
        return;
      }
      onPerfilAtualizado?.({
        nomeCompleto: body.nomeCompleto,
        fotoUrl: fotoUrlServidor,
      });
      toast.success('Perfil salvo com sucesso.');
      await loadPerfil({ silent: true });
    } catch {
      toast.error('Falha ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    void loadPerfil();
    void loadAssinaturaPadrao();
  };

  // --- Estados de carregamento ---

  if (loadError && !loading) {
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

  const fotoInputId = `${formId}-foto`;

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-5xl space-y-6">
      <div className="mb-2 flex items-center gap-4">
        <div className="rounded-2xl border border-app-border bg-[#e6f7f5] p-3 text-[#00a88e]">
          <User className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Meu Perfil</h3>
          <p className="text-[14px] font-medium text-[#64748b]">
            Informações pessoais e identidade profissional
          </p>
        </div>
      </div>

      {loading ? (
        <>
          <div className="mb-2 flex justify-center">
            <div className="h-24 w-24 animate-pulse rounded-full bg-[#f1f5f9]" />
          </div>
          <div className="mb-4 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`sk-pill-${i}`} className="h-7 w-20 animate-pulse rounded-full bg-[#f1f5f9]" />
            ))}
          </div>
          <ConfigFormSectionsSkeleton sections={4} cardRounded="2xl" />
        </>
      ) : (
        <>
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative mb-2 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-[#e6f7f5] shadow-sm transition-all hover:border-[#00a88e] focus:outline-none focus:ring-2 focus:ring-[#00a88e]/40"
              aria-label="Alterar foto de perfil"
            >
              {fotoUrlPreview ? (
                <img src={fotoUrlPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <AgendaAvatarInitials name={nomeCompleto || 'Usuário'} size={96} />
              )}
              <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#00a88e] shadow">
                <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.5} aria-hidden />
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
            <p className="-mt-2 mb-3 text-center text-[12px] font-medium text-[#94a3b8]">
              Foto de perfil (opcional)
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {STATUS_OPTIONS.map((o) => {
                const active = statusPresenca === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setStatusPresenca(o.value)}
                    className={[
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition',
                      active
                        ? 'border-[#00a88e]/30 bg-white text-[#0f172a] shadow-sm'
                        : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: o.color }}
                    />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {/* Card 1 — Informações Pessoais */}
          <div className="rounded-2xl border border-[#00a88e]/25 bg-white p-6 transition-colors">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[14px] font-bold text-white shadow-sm">
                1
              </div>
              <h4 className="text-[18px] font-bold text-[#0f766e]">Informações Pessoais &amp; Documentos</h4>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
              <div className="md:col-span-2 space-y-1.5">
                <label htmlFor={`${formId}-nome`} className={labelCls('text-[#00a88e]')}>
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  id={`${formId}-nome`}
                  type="text"
                  value={nomeCompleto}
                  onChange={(e) => {
                    setNomeCompleto(e.target.value);
                    clearError('nome');
                  }}
                  className={inputClass('nome')}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.nome)}
                />
                {errors.nome ? (
                  <p className="text-[12px] font-semibold text-red-600" role="alert">
                    Nome é obrigatório.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-apelido`} className={labelCls('text-[#00a88e]')}>
                  Apelido
                </label>
                <input
                  id={`${formId}-apelido`}
                  type="text"
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  className={inputClass('apelido')}
                  autoComplete="nickname"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-tel`} className={labelCls('text-[#00a88e]')}>
                  Telefone / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  id={`${formId}-tel`}
                  type="tel"
                  inputMode="numeric"
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(formatBrNationalParentheses(e.target.value));
                    clearError('telefone');
                  }}
                  placeholder="(00) 00000-0000"
                  className={inputClass('telefone')}
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.telefone)}
                />
                {errors.telefone ? (
                  <p className="text-[12px] font-semibold text-red-600" role="alert">
                    Telefone é obrigatório.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-cpf`} className={labelCls('text-[#00a88e]')}>
                  CPF <span className="text-red-500">*</span>
                </label>
                {cpfReadOnly ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={`${formId}-cpf`}
                      type="text"
                      value={cpf}
                      readOnly
                      disabled
                      className={`${inputClass('cpf')} cursor-not-allowed bg-slate-100 text-slate-500`}
                    />
                    <button
                      type="button"
                      onClick={() => setCpfUnlocked(true)}
                      className="shrink-0 whitespace-nowrap text-[12px] font-bold text-[#00a88e] underline underline-offset-2 hover:text-[#00967f]"
                    >
                      Alterar CPF
                    </button>
                  </div>
                ) : (
                  <input
                    id={`${formId}-cpf`}
                    type="text"
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => {
                      setCpf(maskCPF(e.target.value));
                      clearError('cpf');
                    }}
                    onBlur={() => {
                      if (isCpfIncomplete(cpf)) {
                        setErrors((prev) => ({ ...prev, cpf: true }));
                      }
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={inputClass('cpf')}
                    autoComplete="off"
                    aria-invalid={Boolean(errors.cpf)}
                  />
                )}
                {errors.cpf ? (
                  <p className="text-[12px] font-semibold text-red-600" role="alert">
                    CPF inválido ou já utilizado por outro usuário.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-nascimento`} className={labelCls('text-[#00a88e]')}>
                  Data de nascimento <span className="text-red-500">*</span>
                </label>
                <input
                  id={`${formId}-nascimento`}
                  type="text"
                  inputMode="numeric"
                  value={dataNascimentoDisplay}
                  onChange={(e) => handleDataNascimentoChange(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className={inputClass('dataNascimento')}
                  autoComplete="bday"
                  aria-invalid={Boolean(errors.dataNascimento)}
                />
                {errors.dataNascimento ? (
                  <p className="text-[12px] font-semibold text-red-600" role="alert">
                    Data de nascimento é obrigatória e deve ser válida.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-estado-civil`} className={labelCls('text-[#00a88e]')}>
                  Estado civil <span className="text-red-500">*</span>
                </label>
                <EstadoCivilSelect
                  id={`${formId}-estado-civil`}
                  value={estadoCivilId}
                  onChange={(v) => {
                    setEstadoCivilId(v);
                    clearError('estadoCivil');
                  }}
                  error={Boolean(errors.estadoCivil)}
                  selectClassName={inputClass('estadoCivil')}
                />
                {errors.estadoCivil ? (
                  <p className="text-[12px] font-semibold text-red-600" role="alert">
                    Estado civil é obrigatório.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Card 2 — Endereço Completo com ViaCEP */}
          <div className="rounded-2xl border border-amber-200 bg-white p-6 transition-colors">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[14px] font-bold text-white shadow-sm">
                2
              </div>
              <div>
                <h4 className="text-[18px] font-bold text-[#b45309]">Endereço</h4>
                <p className="text-[12px] font-medium text-[#92400e]">
                  Opcional — informe o CEP para preencher automaticamente
                </p>
              </div>
            </div>
            <EnderecoFields
              variant="profile"
              cep={cep}
              onCepChange={setCep}
              rua={logradouro}
              onRuaChange={setLogradouro}
              numero={numero}
              onNumeroChange={setNumero}
              complemento={complemento}
              onComplementoChange={setComplemento}
              bairro={bairro}
              onBairroChange={setBairro}
              cidade={cidade}
              onCidadeChange={setCidade}
              estado={uf}
              onEstadoChange={setUf}
            />
          </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {/* Card 3 — Cargo & Função */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-500 text-[14px] font-bold text-white shadow-sm">
                3
              </div>
              <h4 className="text-[18px] font-bold text-slate-700">Cargo &amp; Função</h4>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[15px] font-bold text-[#0f172a]">
                {cargoNome ? formatCargoLabel(cargoNome) : 'Sem cargo atribuído'}
              </p>
            </div>
            <p className="mt-2 text-[12px] font-medium text-[#64748b]">
              O cargo é definido pela administração da clínica. Apenas o proprietário pode alterá-lo na Gestão de
              Equipe.
            </p>
          </div>

          {/* Card 4 — Identidade Profissional */}
          <div className="rounded-2xl border border-blue-200 bg-white p-6 transition-colors">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-[14px] font-bold text-white shadow-sm">
                4
              </div>
              <h4 className="text-[18px] font-bold text-[#1d4ed8]">Identidade Profissional</h4>
            </div>
            <div className="space-y-2">
              <span className={labelCls('text-[#3b82f6]')}>Assinatura padrão</span>
              <button
                type="button"
                onClick={() => setSignatureModalOpen(true)}
                aria-label={
                  assinaturaPadraoPreview ? 'Alterar assinatura padrão' : 'Adicionar assinatura padrão'
                }
                className={[
                  'group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 py-6 transition',
                  assinaturaPadraoPreview
                    ? 'border-[#3b82f6]/40 bg-[#eff6ff]'
                    : 'border-dashed border-blue-200 bg-[#eff6ff]/50 hover:border-[#3b82f6]/50 hover:bg-[#eff6ff]',
                ].join(' ')}
              >
                {assinaturaPadraoPreview ? (
                  <>
                    <img
                      src={assinaturaPadraoPreview}
                      alt="Assinatura padrão"
                      className="mx-auto h-16 max-w-[200px] object-contain"
                    />
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3b82f6]">
                      <PenLine className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                      Alterar assinatura
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-[#3b82f6] group-hover:bg-blue-200">
                      <PenLine className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                    </div>
                    <span className="text-[12px] font-semibold text-slate-500 group-hover:text-[#3b82f6]">
                      Clique para adicionar sua assinatura
                    </span>
                  </>
                )}
              </button>
              {assinaturaPadraoPreview ? (
                <button
                  type="button"
                  onClick={removeAssinaturaPadrao}
                  disabled={savingAssinatura}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2.5 text-[12px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAssinatura ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  )}
                  Remover assinatura
                </button>
              ) : null}
            </div>
          </div>
          </div>

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
        </>
      )}

      <SignatureFullscreenModal
        open={signatureModalOpen}
        title="Assinatura Padrão"
        onClose={() => {
          if (!savingAssinatura) setSignatureModalOpen(false);
        }}
        canvasRef={sigCanvasRef}
        hasStrokeRef={sigHasStrokeRef}
        mobilePortrait={mobilePortrait}
        onConfirm={saveAssinaturaPadrao}
      />
    </form>
  );
}
