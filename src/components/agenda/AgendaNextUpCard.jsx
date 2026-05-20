import { Check, MessageCircle, Calendar, Play, XCircle } from 'lucide-react';
import { getRailCardActions, getRailPrimaryLabel } from '../../utils/agendaCardActions.js';
import { formatCountdown } from '../../utils/agendaRailHelpers.js';
import { AgendaAvatarInitials } from './AgendaAvatarInitials.jsx';

const BTN_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2';

const BTN_SECONDARY = `inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 hover:bg-ink-50 ${BTN_FOCUS}`;

const BTN_CANCEL = `${BTN_SECONDARY} text-status-danger-ink hover:bg-status-danger-bg`;

const BTN_PRIMARY = `inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-vivid-teal-500 to-vivid-teal-600 px-3 text-[13px] font-medium text-white shadow-agenda-glow transition-all duration-150 ease-out motion-reduce:transition-none hover:-translate-y-px hover:brightness-[1.06] ${BTN_FOCUS}`;

function formatHmDisplay(hm) {
  return String(hm || '').slice(0, 5);
}

export function AgendaNextUpCard({
  appointment,
  now,
  showProfissional,
  isNivel1,
  onCheckIn,
  onWhatsApp,
  onReagendar,
  onCancelar,
}) {
  if (!appointment) return null;

  const countdown = formatCountdown(appointment.horaInicio, now);
  const actions = getRailCardActions(appointment.status);
  const primaryLabel = getRailPrimaryLabel(actions.primary);

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
          {actions.primary ? (
            <button type="button" onClick={() => onCheckIn?.(appointment)} className={BTN_PRIMARY}>
              {actions.primary === 'confirmar' ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Play className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {primaryLabel}
            </button>
          ) : null}
          <div className="mt-2 flex gap-1.5">
            {actions.secondary.includes('whatsapp') ? (
              <button type="button" onClick={() => onWhatsApp?.(appointment)} className={BTN_SECONDARY}>
                <MessageCircle className="h-3 w-3 shrink-0" aria-hidden />
                WhatsApp
              </button>
            ) : null}
            {actions.secondary.includes('reagendar') ? (
              <button type="button" onClick={() => onReagendar?.(appointment)} className={BTN_SECONDARY}>
                <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                Reagendar
              </button>
            ) : null}
            {actions.secondary.includes('cancelar') ? (
              <button type="button" onClick={() => onCancelar?.(appointment)} className={BTN_CANCEL}>
                <XCircle className="h-3 w-3 shrink-0" aria-hidden />
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
