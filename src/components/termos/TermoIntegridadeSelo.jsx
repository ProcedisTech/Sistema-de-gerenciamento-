import React, { useState } from 'react';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { termoAssinaturaApi } from '../../services/api';

/**
 * Selo SHA-256 do snapshot gravado (não do template atual).
 */
export function TermoIntegridadeSelo({ assinaturaId, conteudoHash }) {
  const [integridade, setIntegridade] = useState(null);
  const [verificando, setVerificando] = useState(false);

  if (!assinaturaId) return null;

  const handleVerificar = async () => {
    setVerificando(true);
    try {
      const r = await termoAssinaturaApi.verificarGravada(assinaturaId);
      setIntegridade(r);
    } catch {
      setIntegridade({ valido: false });
    } finally {
      setVerificando(false);
    }
  };

  const hashOk = integridade?.valido === true;
  const hashBad = integridade?.valido === false;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ShieldCheck className={`h-5 w-5 shrink-0 ${hashOk ? 'text-emerald-600' : hashBad ? 'text-red-500' : 'text-[#00a88e]'}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-[#0f172a]">
            {integridade
              ? integridade.valido
                ? 'Documento íntegro — nada foi alterado desde a assinatura'
                : 'Hash divergente — o conteúdo não confere com a assinatura'
              : 'SHA-256 do conteúdo gravado'}
          </p>
          {conteudoHash ? (
            <code className="mt-0.5 block break-all font-mono text-[10px] text-[#64748b]">
              SHA-256 · {conteudoHash}
            </code>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleVerificar}
          disabled={verificando}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00a88e] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#00967f] disabled:opacity-60"
        >
          {verificando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Conferir
        </button>
      </div>
      {hashBad ? (
        <div className="flex items-center gap-2 text-[12px] font-bold text-red-600">
          <ShieldX className="h-4 w-4" />
          Hash divergente
        </div>
      ) : null}
    </div>
  );
}
