import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Modal único: early | late | conflict (tolerância ao iniciar atendimento pela agenda).
 * z-[230] alinhado a ConfirmacaoForaDispModal.
 */
export function IniciarAtendimentoToleranciaModal({
  variant,
  scheduledTimeLabel,
  nowTimeLabel,
  antecedenciaTexto,
  atrasoTexto,
  detailMessage,
  adiantarSubmitting = false,
  onCancel,
  onKeepSchedule,
  onAdvanceNow,
  onStartAnyway,
  onBack,
}) {
  const titleId =
    variant === 'early'
      ? 'ini-tol-early-title'
      : variant === 'late'
        ? 'ini-tol-late-title'
        : 'ini-tol-conflict-title';

  const title =
    variant === 'early'
      ? 'Adiantar atendimento'
      : variant === 'late'
        ? '⚠️ Fora do horário previsto'
        : 'Não é possível adiantar';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-900/45 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && variant !== 'conflict') onCancel?.();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              variant === 'late' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {variant === 'conflict' ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{detailMessage || ''}</p>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Agendamento previsto:</span>{' '}
                  {scheduledTimeLabel}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Agora:</span> {nowTimeLabel}
                  {variant === 'early' && antecedenciaTexto ? (
                    <span className="text-slate-600"> ({antecedenciaTexto})</span>
                  ) : null}
                  {variant === 'late' && atrasoTexto ? (
                    <span className="text-slate-600"> ({atrasoTexto})</span>
                  ) : null}
                </p>
                {variant === 'late' ? (
                  <p className="pt-1 font-medium text-slate-800">Iniciar mesmo assim?</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {variant === 'early' ? (
            <>
              <button
                type="button"
                onClick={() => onCancel?.()}
                disabled={adiantarSubmitting}
                className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onKeepSchedule?.()}
                disabled={adiantarSubmitting}
                className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Manter horário
              </button>
              <button
                type="button"
                onClick={() => onAdvanceNow?.()}
                disabled={adiantarSubmitting}
                className="h-10 rounded-lg bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-primaryDark disabled:opacity-50"
              >
                {adiantarSubmitting ? 'Aguarde…' : 'Adiantar para agora'}
              </button>
            </>
          ) : null}
          {variant === 'late' ? (
            <>
              <button
                type="button"
                onClick={() => onCancel?.()}
                className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onStartAnyway?.()}
                className="h-10 rounded-lg bg-amber-500 px-4 text-[13px] font-semibold text-white hover:bg-amber-600"
              >
                Iniciar atendimento
              </button>
            </>
          ) : null}
          {variant === 'conflict' ? (
            <button
              type="button"
              onClick={() => onBack?.()}
              className="h-10 rounded-lg bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-primaryDark"
            >
              Voltar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
