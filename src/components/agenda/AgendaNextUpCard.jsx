import { getRailCardActions } from '../../utils/agendaCardActions.js';
import { formatCountdown } from '../../utils/agendaRailHelpers.js';
import { AgendaAvatarInitials } from './AgendaAvatarInitials.jsx';
import { AgendaRailCardActions } from './AgendaRailCardActions.jsx';
import { usePapel } from '../../hooks/usePapel.js';

function formatHmDisplay(hm) {
  return String(hm || '').slice(0, 5);
}

export function AgendaNextUpCard({
  appointment,
  now,
  showProfissional,
  isNivel1,
  compact = false,
  onCheckIn,
  onWhatsApp,
  onEnviarAnamnese,
  onReagendar,
  onCancelar,
}) {
  if (!appointment) return null;

  const { canStartAnamnese } = usePapel();
  const countdown = formatCountdown(appointment.horaInicio, now);
  const actions = getRailCardActions(appointment.status, canStartAnamnese);

  return (
    <article className="relative mb-3 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border-2 border-vivid-teal-500 bg-white p-4 shadow-agenda-glow">
      <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1.5 rounded-full bg-vivid-teal-600 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
        <span className="h-[5px] w-[5px] animate-agenda-live-pulse rounded-full bg-white" aria-hidden />
        Próximo · {formatHmDisplay(appointment.horaInicio)}
      </span>

      <div className="col-span-2 mt-2 flex gap-3">
        <AgendaAvatarInitials name={appointment.pacienteNome} size={44} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-display text-lg font-bold text-ink-900"
            style={{ fontVariationSettings: '"wdth" 95' }}
          >
            {appointment.pacienteNome || 'Paciente'}
          </p>
          <p className="truncate text-[12.5px] text-ink-600">
            {appointment.procedimentoNome || 'Sem procedimento'}
            {showProfissional && appointment.profissionalNome ? (
              <span className="text-ink-500"> · {appointment.profissionalNome}</span>
            ) : null}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[10px] font-medium uppercase text-ink-500">Em</p>
          <p
            className="font-display text-[26px] font-extrabold leading-none text-vivid-teal-700"
            style={{ fontVariationSettings: '"wdth" 88' }}
          >
            {countdown}
          </p>
        </div>
      </div>

      {!isNivel1 ? (
        <div className="col-span-2 border-t border-ink-150 pt-3">
          <AgendaRailCardActions
            appointment={appointment}
            actions={actions}
            compact={compact}
            className="flex flex-col gap-1.5"
            secondaryRowClassName="mt-2 flex gap-1.5"
            primaryHeightClass="h-9"
            primaryIconClass="h-4 w-4"
            onPrimaryClick={onCheckIn}
            onWhatsApp={onWhatsApp}
            onEnviarAnamnese={onEnviarAnamnese}
            onReagendar={onReagendar}
            onCancelar={onCancelar}
          />
        </div>
      ) : null}
    </article>
  );
}
