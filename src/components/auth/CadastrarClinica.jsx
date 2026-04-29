import React, { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch } from '../../services/api';
import { formatCnpjInput, isValidCnpj } from '../../utils/cnpj';
import { formatBrNationalParentheses } from '../../utils/phoneUtils';

/**
 * Cadastro de organização pós-onboarding. POST /api/v1/organizacoes
 * @param {{ onComplete: (organizacaoId: string) => void }} props
 */
export function CadastrarClinica({ onComplete }) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCnpjChange = (e) => {
    setCnpj(formatCnpjInput(e.target.value));
  };

  const handleTelChange = (e) => {
    setTelefone(formatBrNationalParentheses(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = nome.trim();
    if (!n) {
      setError('Informe o nome da clínica.');
      return;
    }
    const cnpjDigits = cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      setError('Informe o CNPJ com 14 dígitos.');
      return;
    }
    if (!isValidCnpj(cnpjDigits)) {
      setError('CNPJ inválido.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { supabase } = await import('../../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[DevLog] Token atual do Supabase:', session?.access_token ? 'Presente' : 'Ausente', session?.user?.id);
      
      const telDigits = telefone.replace(/\D/g, '');
      const res = await fetch(resolveApiUrl('/api/v1/organizacoes'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...authHeadersForFetch({ needsOrg: false }),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: n,
          cnpj: cnpjDigits,
          ...(telDigits ? { telefone: telDigits } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message || body.detail || body.error || `Erro ${res.status}`);
        return;
      }
      const id =
        body?.id != null
          ? String(body.id)
          : body?.organizacaoSaudeId != null
            ? String(body.organizacaoSaudeId)
            : body?.organizacaoId != null
              ? String(body.organizacaoId)
              : body?.data?.id != null
                ? String(body.data.id)
                : '';
      if (id && typeof onComplete === 'function') {
        onComplete(id);
      } else {
        setError('Resposta do servidor sem identificador da clínica.');
      }
    } catch {
      setError('Falha ao cadastrar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-[#e6f7f5] p-4 text-[#00a88e]">
            <Building2 className="h-8 w-8" strokeWidth={2} aria-hidden />
          </div>
        </div>
        <h1 className="mb-1 text-center text-[22px] font-bold text-[#0f172a]">Cadastre sua clínica</h1>
        <p className="mb-6 text-center text-[13px] font-medium text-[#64748b]">
          Informe os dados da organização para continuar.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="clin_nome" className="mb-2 block text-[13px] font-bold text-[#00a88e]">
              Nome da clínica <span className="text-red-500">*</span>
            </label>
            <input
              id="clin_nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[15px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15"
              placeholder="Razão social ou nome fantasia"
              disabled={saving}
              autoComplete="organization"
            />
          </div>
          <div>
            <label htmlFor="clin_cnpj" className="mb-2 block text-[13px] font-bold text-[#00a88e]">
              CNPJ <span className="text-red-500">*</span>
            </label>
            <input
              id="clin_cnpj"
              type="text"
              inputMode="numeric"
              value={cnpj}
              onChange={handleCnpjChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[15px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/15"
              placeholder="00.000.000/0000-00"
              disabled={saving}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="clin_tel" className="mb-2 block text-[13px] font-bold text-[#00a88e]">
              Telefone <span className="font-medium text-[#94a3b8]">(opcional)</span>
            </label>
            <input
              id="clin_tel"
              type="tel"
              inputMode="numeric"
              value={telefone}
              onChange={handleTelChange}
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
