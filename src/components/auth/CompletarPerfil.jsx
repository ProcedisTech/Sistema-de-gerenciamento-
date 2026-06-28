import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, User } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch } from '../../services/api';
import { formatBrNationalParentheses } from '../../utils/phoneUtils';

/**
 * Exibe enquanto o usuário (Supabase) ainda não tem nome completo registrado no backend Java.
 * @param {{ onComplete: () => void, email: string }} props — email: sessão (ex.: authUser.email)
 */
export function CompletarPerfil({ onComplete, email }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefone, setTelefone] = useState('');
  const [error, setError] = useState('');

  const checkPerfil = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(resolveApiUrl('/api/auth/me'), {
        credentials: 'include',
        headers: { ...(await authHeadersForFetch({ needsOrg: false })) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const nome =
        data?.nomeCompleto ??
        data?.nome_completo ??
        data?.user?.nomeCompleto ??
        data?.user?.nome_completo;
      if (nome && String(nome).trim()) {
        if (typeof onComplete === 'function') onComplete();
        return;
      }
    } catch {
      setError('Não foi possível verificar seu cadastro.');
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  useEffect(() => {
    checkPerfil();
  }, [checkPerfil]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nome = nomeCompleto.trim();
    if (!nome) {
      setError('Informe seu nome completo.');
      return;
    }
    const emailStr = String(email || '').trim();
    if (!emailStr) {
      setError('E-mail da sessão indisponível. Entre novamente.');
      return;
    }
    const telDigits = telefone.replace(/\D/g, '');
    /** Backend: sempre as três chaves; telefone opcional → null ou "" */
    const body = {
      nomeCompleto: nome,
      email: emailStr,
      telefone: telDigits || null,
    };
    setSaving(true);
    setError('');
    try {
      const res = await fetch(resolveApiUrl('/api/auth/completar-perfil'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(await authHeadersForFetch({ needsOrg: false })),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errBody.message || errBody.detail || errBody.error || `Erro ${res.status}`);
        return;
      }
      if (typeof onComplete === 'function') onComplete();
    } catch {
      setError('Falha ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
        <Loader2 className="h-10 w-10 animate-spin text-[#00a88e]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-[#e6f7f5] p-4 text-[#00a88e]">
            <User className="h-8 w-8" strokeWidth={2} aria-hidden />
          </div>
        </div>
        <h1 className="mb-1 text-center text-[22px] font-bold text-[#0f172a]">Complete seu perfil</h1>
        <p className="mb-6 text-center text-[13px] font-medium text-[#64748b]">
          Informe seu nome completo para continuar.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nome_completo" className="mb-2 block text-[13px] font-bold text-[#00a88e]">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              id="nome_completo"
              type="text"
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[15px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15"
              placeholder="Seu nome completo"
              disabled={saving}
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="perfil_telefone" className="mb-2 block text-[13px] font-bold text-[#00a88e]">
              Telefone <span className="font-medium text-[#94a3b8]">(opcional)</span>
            </label>
            <input
              id="perfil_telefone"
              type="tel"
              inputMode="numeric"
              value={telefone}
              onChange={(e) => setTelefone(formatBrNationalParentheses(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[15px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15"
              placeholder="(00) 00000-0000"
              disabled={saving}
              autoComplete="tel"
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a88e] py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#00967f] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
}
