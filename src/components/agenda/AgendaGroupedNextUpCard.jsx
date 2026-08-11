import { getGroupedRailCardActions } from '../../utils/agendaCardActions.js';
import { getAppointmentStatusBucket } from '../../utils/agendaDayInsights.js';
import { formatCountdown } from '../../utils/agendaRailHelpers.js';
import { AgendaAvatarInitials } from './AgendaAvatarInitials.jsx';
import { GroupedDurationBlock } from './GroupedRailTimeColumn.jsx';
import { AgendaRailCardActions } from './AgendaRailCardActions.jsx';
import { usePapel } from '../../hooks/usePapel.js';

function statusDotClass(appointment) {
  const bucket = getAppointmentStatusBucket(appointment);
  const map = {
    confirmado: 'bg-status-ok',
    pendente: 'bg-status-warn',
    cancelado: 'bg-status-danger',
    noshow: 'bg-status-noshow',
  };
  return map[bucket] || 'bg-ink-300';
}

export function AgendaGroupedNextUpCard({
  group,
  now,
  showProfissional,
  isNivel1,
  compact = false,
  onCheckIn,
  onWhatsApp,
  onEnviarAnamnese,
  onReagendar,
  onCancelar,
  onOpenSlotDetail,
}) {
  const appointments = group?.appointments || [];
  const primary = appointments[0];
  const { canStartAnamnese } = usePapel();
  if (!primary) return null;

  const countdown = formatCountdown(group.horaInicio || primary.horaInicio, now);
  const actions = getGroupedRailCardActions(appointments.map((a) => a.status), canStartAnamnese);

  return (
    <article
      onClick={(e) => {
        if (!e.target.closest('button')) onOpenSlotDetail?.(group);
      }}
      className="relative mb-3 cursor-pointer grid grid-cols-[1fr_auto] gap-3 rounded-2xl border-2 border-vivid-teal-500 bg-white p-4 shadow-agenda-glow"
    >
      <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1.5 rounded-full bg-vivid-teal-600 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
        <span className="h-[5px] w-[5px] animate-agenda-live-pulse rounded-full bg-white" aria-hidden />
        Próximo · {String(group.horaInicio || primary.horaInicio).slice(0, 5)} →{' '}
        {String(group.horaFim || '').slice(0, 5)}
      </span>

      <div className="col-span-2 mt-2 flex gap-3">
        <AgendaAvatarInitials name={group.pacienteNome} size={44} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate font-display text-lg font-bold text-ink-900"
            style={{ fontVariationSettings: '"wdth" 95' }}
          >
            {group.pacienteNome || 'Paciente'}
          </p>
          <ul className="mt-1 space-y-0.5">
            {appointments.map((appt, index) => (
              <li
                key={appt.id}
                className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-600"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(appt)}`}
                  aria-hidden
                />
                <span className="shrink-0 font-mono text-[10px] text-ink-400">{index + 1})</span>
                <span className="truncate">{appt.procedimentoNome || 'Sem procedimento'}</span>
              </li>
            ))}
          </ul>
          {showProfissional && group.profissionalNome ? (
            <p className="mt-0.5 truncate text-[11px] text-ink-500">{group.profissionalNome}</p>
          ) : null}
          <GroupedDurationBlock duracaoTotalMin={group.duracaoTotalMin} className="mt-2" />
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
            appointment={primary}
            actions={actions}
            compact={compact}
            className="flex flex-col gap-1.5"
            secondaryRowClassName="mt-2 flex gap-1.5"
            primaryHeightClass="h-9"
            primaryIconClass="h-4 w-4"
            onPrimaryClick={() => onCheckIn?.(group)}
            onWhatsApp={() => onWhatsApp?.(group)}
            onEnviarAnamnese={() => onEnviarAnamnese?.(group)}
            onReagendar={() => onReagendar?.(group)}
            onCancelar={() => onCancelar?.(group)}
          />
        </div>
      ) : null}
    </article>
  );
}
