import { Lock, Plus } from 'lucide-react';

export function AgendaDayRailFooter({ isNivel1, onBloquear, onNovoAgendamento, compact = false }) {
  if (isNivel1) return null;

  const btnHeight = compact ? 'min-h-11' : 'h-10';

  return (
    <footer className="grid shrink-0 grid-cols-[1fr_auto] gap-2 border-t border-ink-150 bg-white px-4 py-3">
      <button
        type="button"
        onClick={onNovoAgendamento}
        className={`inline-flex ${btnHeight} items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-vivid-teal-500 to-vivid-teal-600 px-4 text-sm font-semibold text-white shadow-agenda-glow transition-all duration-150 ease-out motion-reduce:transition-none hover:-translate-y-px hover:brightness-[1.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2`}
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        Novo agendamento
      </button>
      <button
        type="button"
        onClick={onBloquear}
        title="Bloquear horário"
        aria-label="Bloquear horário"
        className={`inline-flex ${compact ? 'h-11 w-11' : 'h-10 w-10'} items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2`}
      >
        <Lock className="h-4 w-4" aria-hidden />
      </button>
    </footer>
  );
}
