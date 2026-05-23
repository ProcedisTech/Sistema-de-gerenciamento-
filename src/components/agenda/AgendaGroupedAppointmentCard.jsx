import { getGroupedRailCardActions } from '../../utils/agendaCardActions.js';
import { getAppointmentStatusBucket } from '../../utils/agendaDayInsights.js';
import { isValidAdvanceOffer } from '../../utils/agendaAdvanceOffer.js';
import {
  formatAgendaShortId,
  getGroupedRailStripeClass,
  getGroupedStatusBadgePresentation,
} from '../../utils/agendaRailHelpers.js';
import { AgendaAvatarInitials } from './AgendaAvatarInitials.jsx';
import { GroupedRailTimeColumn } from './GroupedRailTimeColumn.jsx';
import { AgendaRailCardActions } from './AgendaRailCardActions.jsx';

const BTN_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2';

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

export function AgendaGroupedAppointmentCard({
  group,
  highlighted = false,
  showProfissional = false,
  isNivel1 = false,
  compact = false,
  advanceOffer,
  onAdvanceClick,
  onConfirmar,
  onIniciarAtendimento,
  onWhatsApp,
  onReagendar,
  onCancelar,
  onEdit,
}) {
  const appointments = group?.appointments || [];
  const primary = appointments[0];
  if (!primary) return null;

  const badge = getGroupedStatusBadgePresentation(appointments);
  const stripe = getGroupedRailStripeClass(appointments);
  const actions = getGroupedRailCardActions(appointments.map((a) => a.status));
  const idsLabel = appointments
    .map((a) => formatAgendaShortId(a.agendaId || a.id))
    .join(' ');

  return (
    <article
      className={`relative grid min-w-0 grid-cols-[minmax(84px,max-content)_minmax(0,1fr)_auto] gap-2.5 overflow-hidden rounded-xl border border-ink-200 bg-white p-3 pr-3.5 transition-all duration-150 hover:-translate-y-px hover:border-ink-300 hover:shadow-agenda-sm ${
        highlighted ? 'border-vivid-teal-500 shadow-[0_0_0_3px_oklch(0.66_0.165_172_/_0.15)]' : ''
      }`}
    >
      <div className={`absolute bottom-3.5 left-0 top-3.5 w-[3px] rounded-r ${stripe}`} aria-hidden />

      <GroupedRailTimeColumn
        horaInicio={group.horaInicio}
        horaFim={group.horaFim}
        duracaoTotalMin={group.duracaoTotalMin}
      />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <AgendaAvatarInitials name={group.pacienteNome} size={28} className="!text-[10px]" />
          <p className="min-w-0 truncate text-[13.5px] font-semibold text-ink-900">
            {group.pacienteNome || 'Paciente'}
          </p>
        </div>

        <ul className="mt-1.5 space-y-0.5">
          {appointments.map((appt, index) => (
            <li
              key={appt.id}
              className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-700"
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

        {!isNivel1 ? (
          <AgendaRailCardActions
            appointment={primary}
            actions={actions}
            compact={compact}
            onConfirmar={() => onConfirmar?.(group)}
            onIniciarAtendimento={() => onIniciarAtendimento?.(group)}
            onWhatsApp={() => onWhatsApp?.(group)}
            onReagendar={() => onReagendar?.(group)}
            onCancelar={() => onCancelar?.(group)}
          />
        ) : null}

        {isValidAdvanceOffer(primary, advanceOffer) && typeof onAdvanceClick === 'function' && !isNivel1 ? (
          <button
            type="button"
            onClick={() => onAdvanceClick(primary, advanceOffer)}
            className={`mt-1 text-left text-[10px] font-semibold text-vivid-teal-700 underline-offset-2 hover:underline ${BTN_FOCUS}`}
          >
            Adiantar para {String(advanceOffer.targetHoraInicio).slice(0, 5)}
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide ${badge.pillClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} aria-hidden />
          {badge.label}
        </span>
        <button
          type="button"
          onClick={() => onEdit?.(primary)}
          className={`max-w-[72px] truncate text-right font-mono text-[10px] text-ink-400 hover:text-ink-600 ${BTN_FOCUS}`}
          title="Editar procedimento principal"
        >
          {idsLabel}
        </button>
      </div>
    </article>
  );
}
