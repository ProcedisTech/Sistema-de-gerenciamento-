import React, { useEffect } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { formatValorBrl } from '../../utils/planejamentoDraftUtils.js';

function formatProgressoPct(progresso) {
  if (progresso == null || !Number.isFinite(Number(progresso))) return '—';
  return `${Math.round(Math.min(1, Math.max(0, Number(progresso))) * 100)}%`;
}

function PlanoConcluirRetornoConfirmModalInner({
  plano,
  pacienteNome,
  totalItens,
  valorTotal,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const nomePaciente = String(pacienteNome ?? '').trim() || 'Paciente';
  const nItens = Number.isFinite(totalItens) ? totalItens : 0;
  const valorLabel = formatValorBrl(valorTotal);
  const pctLabel = formatProgressoPct(plano.progresso);

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-md motion-reduce:backdrop-blur-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plano-concluir-retorno-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 rounded-xl border border-ink-200 bg-white shadow-agenda-lg motion-reduce:animate-none sm:slide-in-from-bottom-0">
        <div className="flex items-start gap-3 border-b border-ink-150 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primaryGhost text-brand-primary">
            <CalendarClock className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="plano-concluir-retorno-title"
              className="font-display text-[17px] font-extrabold leading-snug text-ink-900"
            >
              Concluir tratamento com retorno
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-500">
              O plano será encerrado e um retorno será agendado para nova fase do tratamento.
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

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-ink-200 bg-ink-50/80 px-3 py-2.5">
            <p className="text-[13px] font-semibold text-ink-900">{nomePaciente}</p>
            <p className="mt-0.5 text-[12px] tabular-nums text-ink-600">
              {nItens} procedimento{nItens !== 1 ? 's' : ''} · {valorLabel} · {pctLabel} concluído
            </p>
          </div>

          <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5 text-[12px] leading-relaxed text-ink-600">
            O plano será marcado como concluído e os procedimentos não realizados serão
            arquivados. Em seguida, você agendará o retorno na agenda.
          </div>
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
            className="h-10 rounded-xl bg-brand-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
          >
            Concluir e agendar retorno
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlanoConcluirRetornoConfirmModal({
  open,
  plano,
  pacienteNome,
  totalItens,
  valorTotal,
  onCancel,
  onConfirm,
}) {
  if (!open || !plano) return null;

  return (
    <PlanoConcluirRetornoConfirmModalInner
      key={plano.id}
      plano={plano}
      pacienteNome={pacienteNome}
      totalItens={totalItens}
      valorTotal={valorTotal}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
