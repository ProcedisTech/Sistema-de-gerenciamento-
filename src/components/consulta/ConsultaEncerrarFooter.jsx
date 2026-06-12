import React from 'react';

export function ConsultaEncerrarFooter({ onEncerrarConsulta }) {
  if (typeof onEncerrarConsulta !== 'function') return null;

  return (
    <div className="mt-8 flex justify-end border-t border-app-border pt-6">
      <button
        type="button"
        onClick={onEncerrarConsulta}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-app-border bg-white px-5 py-2.5 text-[13px] font-semibold text-[#64748b] shadow-sm transition-colors hover:bg-app-nav-hover active:bg-app-nav-active"
      >
        Encerrar consulta
      </button>
    </div>
  );
}
