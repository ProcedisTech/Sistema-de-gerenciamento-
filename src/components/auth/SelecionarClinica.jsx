import React, { useState, useEffect } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { authHeadersForFetch } from '../../services/api';

/**
 * Lista organizações do usuário e persiste a escolha em OrgContext via setOrgId.
 */
export function SelecionarClinica({ setOrgId, onComplete }) {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(resolveApiUrl('/api/v1/organizacoes/minhas'), {
          credentials: 'include',
          headers: { ...authHeadersForFetch({ needsOrg: true }) },
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(raw.message || raw.detail || `Erro ${res.status}`);
          return;
        }
        const list = Array.isArray(raw) ? raw : raw?.content ?? raw?.organizacoes ?? raw?.data ?? [];
        if (!cancelled) setOrgs(Array.isArray(list) ? list : []);

        if (!cancelled && list.length === 1) {
          const id = list[0]?.id ?? list[0]?.organizacaoSaudeId;
          if (id && typeof setOrgId === 'function') {
            setOrgId(String(id));
            if (typeof onComplete === 'function') onComplete();
          }
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar as clínicas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setOrgId, onComplete]);

  const handleSelect = (org) => {
    const id = org?.id ?? org?.organizacaoSaudeId;
    if (!id) return;
    setSelecting(String(id));
    if (typeof setOrgId === 'function') setOrgId(String(id));
    if (typeof onComplete === 'function') onComplete();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
        <Loader2 className="h-10 w-10 animate-spin text-[#00a88e]" aria-hidden />
        <p className="text-[14px] font-medium text-[#64748b]">Carregando clínicas…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] px-4">
        <p className="max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-[14px] font-medium text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] px-4">
        <p className="text-center text-[14px] font-medium text-[#64748b]">Nenhuma clínica vinculada à sua conta.</p>
      </div>
    );
  }

  if (orgs.length === 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb]">
        <Loader2 className="h-10 w-10 animate-spin text-[#00a88e]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border-[3px] border-[#00a88e]/20 bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-[#e6f7f5] p-4 text-[#00a88e]">
            <Building2 className="h-8 w-8" strokeWidth={2} aria-hidden />
          </div>
        </div>
        <h1 className="mb-1 text-center text-[22px] font-bold text-[#0f172a]">Selecione a clínica</h1>
        <p className="mb-6 text-center text-[13px] font-medium text-[#64748b]">
          Escolha o contexto de trabalho (organização).
        </p>
        <ul className="space-y-2">
          {orgs.map((org) => {
            const id = String(org.id ?? org.organizacaoSaudeId ?? '');
            const nome = org.nome ?? org.nomeFantasia ?? org.razaoSocial ?? 'Clínica';
            const cnpj = org.cnpj ?? org.cnpjFormatado ?? '—';
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={!!selecting}
                  onClick={() => handleSelect(org)}
                  className="flex w-full items-start gap-3 rounded-xl border-2 border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-left transition-colors hover:border-[#00a88e]/50 hover:bg-[#f0fdf9]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-[#0f172a]">{nome}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-[#64748b]">CNPJ: {cnpj}</p>
                  </div>
                  {selecting === id ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#00a88e]" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
