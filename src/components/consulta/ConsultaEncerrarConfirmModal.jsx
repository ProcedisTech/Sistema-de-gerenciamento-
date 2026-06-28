import React from 'react';

export function ConsultaEncerrarConfirmModal({ open, message, onCancel, onConfirm, finishingMode }) {
  if (!open) return null;
  const isBusy = finishingMode != null;

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/45 px-4">
      <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-2xl">
        <h4 className="text-[16px] font-bold text-[#0f172a]">Encerrar ou Sair da consulta?</h4>
        <p className="mt-2 text-[14px] text-[#475569]">{message}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirm('finalizar')}
            className="h-11 w-full rounded-lg bg-[#00a88e] px-4 text-[14px] font-semibold text-white hover:bg-[#00967f] disabled:opacity-50 flex items-center justify-center"
          >
            {finishingMode === 'finalizar' ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Finalizando...
              </span>
            ) : (
              'Finalizar Atendimento'
            )}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirm('sair')}
            className="h-11 w-full rounded-lg bg-[#f1f5f9] px-4 text-[14px] font-semibold text-[#475569] hover:bg-[#e2e8f0] disabled:opacity-50 flex items-center justify-center"
          >
            {finishingMode === 'sair' ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#475569] border-t-transparent" />
                Salvando rascunho...
              </span>
            ) : (
              'Apenas Sair (Manter em andamento)'
            )}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-white px-4 text-[14px] font-semibold text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
