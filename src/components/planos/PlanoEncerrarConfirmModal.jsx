import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

function PlanoEncerrarConfirmModalInner({ onCancel, onConfirm }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-md motion-reduce:backdrop-blur-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plano-encerrar-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 rounded-xl border border-ink-200 bg-white shadow-agenda-lg motion-reduce:animate-none sm:slide-in-from-bottom-0">
        <div className="flex items-start gap-3 border-b border-ink-150 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-danger-bg text-status-danger">
            <AlertTriangle className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="plano-encerrar-title"
              className="font-display text-[17px] font-extrabold leading-snug text-ink-900"
            >
              Encerrar plano?
            </h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
              O plano deixará de estar ativo e o tratamento será interrompido. Esta ação não pode
              ser desfeita.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-ink-150 p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-ink-200 bg-white px-4 text-[13px] font-semibold text-ink-600 hover:bg-ink-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm?.()}
            className="h-10 rounded-xl border border-status-danger/30 bg-white px-4 text-[13px] font-semibold text-status-danger-ink transition-colors hover:bg-status-danger-bg"
          >
            Encerrar plano
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlanoEncerrarConfirmModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return <PlanoEncerrarConfirmModalInner onCancel={onCancel} onConfirm={onConfirm} />;
}
