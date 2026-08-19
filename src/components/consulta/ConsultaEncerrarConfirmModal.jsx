import React from 'react';

export const COPY_ENCERRAR_SEM_TERMO =
  'Há um procedimento selecionado que ainda não tem termo assinado. Se encerrar agora, ele não será registrado como realizado no prontuário.';

export function ConsultaEncerrarConfirmModal({
  open,
  message,
  onCancel,
  onConfirm,
  finishingMode,
  procedimentoSemTermo = false,
}) {
  if (!open) return null;
  const isBusy = finishingMode != null;

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="encerrar-consulta-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-2xl">
        <h4 id="encerrar-consulta-title" className="text-[16px] font-bold text-[#0f172a]">
          Encerrar ou Sair da consulta?
        </h4>
        <p className="mt-2 text-[14px] text-[#475569]">{message}</p>
        {procedimentoSemTermo ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-900">
            {COPY_ENCERRAR_SEM_TERMO}
          </p>
        ) : null}
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
