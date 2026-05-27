import { Clock } from 'lucide-react';
import { formatHoraSlotLabel } from '../../../utils/agendaNovoV2Helpers.js';
import AvatarInicialColorido from './AvatarInicialColorido.jsx';

export default function SlotHorarioCard({
  hora,
  profissional,
  selected = false,
  onSelecionar,
  disabled = false,
}) {
  const nome = profissional?.nomeProfissional || 'Profissional';
  const esp = profissional?.especialidade;
  const horaLabel = formatHoraSlotLabel(hora);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-agenda-sm transition ${
        selected
          ? 'border-vivid-teal-500 ring-2 ring-vivid-teal-200'
          : 'border-ink-200'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AvatarInicialColorido nome={nome} fotoUrl={profissional?.fotoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Clock className="h-3.5 w-3.5 shrink-0 text-vivid-teal-600" aria-hidden />
            <span>{horaLabel}</span>
          </div>
          <p className="truncate text-sm font-semibold text-ink-900">{nome}</p>
          {esp ? <p className="truncate text-xs text-ink-500">{esp}</p> : null}
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelecionar}
        className="shrink-0 rounded-lg bg-gradient-to-br from-vivid-teal-500 to-vivid-teal-600 px-4 py-2 text-sm font-medium text-white shadow-agenda-sm transition hover:brightness-[1.04] disabled:opacity-50"
      >
        Selecionar
      </button>
    </div>
  );
}
