import React from 'react';

export function ConsultaEncerrarConfirmModal({ open, message, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/45 px-4">
      <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-2xl">
        <h4 className="text-[16px] font-bold text-[#0f172a]">Encerrar consulta?</h4>
        <p className="mt-2 text-[14px] text-[#475569]">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 flex-1 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 flex-1 rounded-lg bg-[#00a88e] px-3 text-[13px] font-semibold text-white hover:bg-[#00967f]"
          >
            Sim, encerrar
          </button>
        </div>
      </div>
    </div>
  );
}
