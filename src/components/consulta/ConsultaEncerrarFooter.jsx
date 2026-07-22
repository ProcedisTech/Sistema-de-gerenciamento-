import React from 'react';

export function ConsultaEncerrarFooter({ onEncerrarConsulta, isFinishing = false }) {
  if (typeof onEncerrarConsulta !== 'function') return null;

  return (
    <div className="mt-8 flex justify-end border-t border-app-border pt-6">
      <button
        type="button"
        onClick={onEncerrarConsulta}
        disabled={isFinishing}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-5 py-2.5 text-[13px] font-semibold text-[#64748b] shadow-sm transition-colors hover:bg-app-nav-hover active:bg-app-nav-active disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isFinishing && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#64748b] border-t-transparent" />
        )}
        {isFinishing ? 'Encerrando...' : 'Encerrar consulta'}
      </button>
    </div>
  );
}
