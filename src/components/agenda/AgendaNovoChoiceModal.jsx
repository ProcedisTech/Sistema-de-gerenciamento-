import { useEffect } from 'react';
import { Calendar, Lock, Plus, X } from 'lucide-react';

export function AgendaNovoChoiceModal({
  open,
  onClose,
  onEscolherAgendamento,
  onEscolherBloqueio,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="novo-choice-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Fechar"
        tabIndex={-1}
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id="novo-choice-title" className="font-display text-lg font-black text-ink-900">
            O que deseja criar?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onEscolherAgendamento}
            className="flex w-full items-center gap-4 rounded-xl border border-ink-200 bg-white p-4 text-left transition-colors hover:border-vivid-teal-300 hover:bg-vivid-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-vivid-teal-500 to-vivid-teal-600 text-white shadow-sm">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink-900">Agendamento</span>
              <span className="mt-0.5 block text-xs text-ink-500">Marcar consulta com paciente</span>
            </span>
            <Calendar className="ml-auto h-4 w-4 shrink-0 text-ink-400" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onEscolherBloqueio}
            className="flex w-full items-center gap-4 rounded-xl border border-ink-200 bg-white p-4 text-left transition-colors hover:border-ink-300 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-ink-50 text-ink-700">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink-900">Bloqueio de horário</span>
              <span className="mt-0.5 block text-xs text-ink-500">Reservar horário sem atendimento</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
