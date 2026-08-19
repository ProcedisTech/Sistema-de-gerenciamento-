import React, { useEffect } from 'react';
import { PartyPopper, X } from 'lucide-react';

function PlanoConcluidoClinicaModalInner({
  pacienteNome,
  onRecusar,
  onAceitar,
}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onRecusar?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onRecusar]);

  const nome = String(pacienteNome ?? '').trim() || 'Paciente';

  return (
    <div
      className="fixed inset-0 z-[260] flex items-end justify-center bg-slate-900/70 p-4 backdrop-blur-md motion-reduce:backdrop-blur-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plano-concluido-clinica-title"
    >
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-ink-200 bg-white shadow-agenda-lg motion-reduce:animate-none sm:slide-in-from-bottom-0">
        <div className="flex items-start gap-3 border-b border-ink-150 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primaryGhost text-brand-primary">
            <PartyPopper className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="plano-concluido-clinica-title"
              className="font-display text-[20px] font-extrabold leading-snug text-ink-900"
            >
              Plano concluído com êxito
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-600">
              O plano de tratamento de <span className="font-semibold text-ink-900">{nome}</span> foi
              concluído. Quer marcar o retorno à clínica?
            </p>
          </div>
          <button
            type="button"
            onClick={onRecusar}
            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5 text-[13px] leading-relaxed text-ink-600">
          <p>
            Esse retorno é uma consulta de acompanhamento da clínica — não é retorno do
            procedimento. O paciente fica liberado por uns meses e volta para continuar o tratamento.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-ink-150 p-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onRecusar}
            className="h-11 rounded-xl border border-ink-200 bg-white px-4 text-[14px] font-semibold text-ink-600 hover:bg-ink-50"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={onAceitar}
            className="h-11 rounded-xl bg-brand-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
          >
            Marcar retorno à clínica
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlanoConcluidoClinicaModal({
  open,
  pacienteNome,
  onRecusar,
  onAceitar,
}) {
  if (!open) return null;
  return (
    <PlanoConcluidoClinicaModalInner
      pacienteNome={pacienteNome}
      onRecusar={onRecusar}
      onAceitar={onAceitar}
    />
  );
}
