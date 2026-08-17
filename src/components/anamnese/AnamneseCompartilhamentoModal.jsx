import React from 'react';
import { AlertTriangle, Copy, Globe } from 'lucide-react';

/**
 * Modal de aviso quando pergunta compartilhada é editada em múltiplas fichas.
 */
export function AnamneseCompartilhamentoModal({
  open,
  perguntaDescricao = '',
  outrasFichasCount = 0,
  onAlterarTodas,
  onUsarSoNesta,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compartilhamento-title"
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 id="compartilhamento-title" className="text-[16px] font-bold text-[#0f172a]">
              Pergunta compartilhada
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[#64748b]">
              &ldquo;{perguntaDescricao}&rdquo; também aparece em{' '}
              <strong>{outrasFichasCount}</strong> outra{outrasFichasCount !== 1 ? 's' : ''} ficha
              {outrasFichasCount !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>

        <div className="space-y-2 px-6 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={onAlterarTodas}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#00a88e]/30 hover:bg-[#f0fdfa] disabled:opacity-60"
          >
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2} />
            <div>
              <p className="text-[13px] font-bold text-[#0f172a]">Alterar em todas as fichas</p>
              <p className="text-[12px] text-[#64748b]">A pergunta original será atualizada no banco.</p>
            </div>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onUsarSoNesta}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50 disabled:opacity-60"
          >
            <Copy className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" strokeWidth={2} />
            <div>
              <p className="text-[13px] font-bold text-[#0f172a]">Usar só nesta ficha</p>
              <p className="text-[12px] text-[#64748b]">Cria uma cópia exclusiva desta ficha.</p>
            </div>
          </button>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-[#64748b] hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
