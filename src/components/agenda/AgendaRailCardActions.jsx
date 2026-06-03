import { Calendar, Check, MessageCircle, Play, XCircle } from 'lucide-react';
import { getRailPrimaryLabel } from '../../utils/agendaCardActions.js';

const BTN_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2';

const BTN_SECONDARY =
  `inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 hover:bg-ink-50 ${BTN_FOCUS}`;

const BTN_SECONDARY_COMPACT =
  `inline-flex h-7 min-w-0 flex-1 items-center justify-center rounded-md border border-ink-200 bg-white p-0 text-ink-700 hover:bg-ink-50 ${BTN_FOCUS}`;

const BTN_CANCEL = `${BTN_SECONDARY} text-status-danger-ink hover:bg-status-danger-bg`;

const BTN_CANCEL_COMPACT = `${BTN_SECONDARY_COMPACT} text-status-danger-ink hover:bg-status-danger-bg`;

function primaryButtonClass(heightClass) {
  return `inline-flex ${heightClass} w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-vivid-teal-500 to-vivid-teal-600 px-3 text-[13px] font-medium text-white shadow-agenda-glow transition-all duration-150 ease-out motion-reduce:transition-none hover:-translate-y-px hover:brightness-[1.06] ${BTN_FOCUS}`;
}

/**
 * Botões do rail. Em compromisso multi-procedimento, o pai deve passar callbacks que
 * recebem o entry/group (ex.: onConfirmar={() => onConfirmar(group)}), não confiar
 * no prop `appointment` sozinho.
 */
export function AgendaRailCardActions({
  appointment,
  actions,
  compact = false,
  className = 'mt-2 flex flex-col gap-1.5',
  secondaryRowClassName = 'flex gap-1.5',
  primaryHeightClass = 'h-8',
  primaryIconClass = 'h-3.5 w-3.5',
  onPrimaryClick,
  onConfirmar,
  onIniciarAtendimento,
  onWhatsApp,
  onReagendar,
  onCancelar,
}) {
  const { primary, secondary } = actions;
  const primaryLabel = getRailPrimaryLabel(primary);

  function handlePrimary() {
    if (typeof onPrimaryClick === 'function') {
      onPrimaryClick(appointment);
      return;
    }
    if (primary === 'confirmar') onConfirmar?.(appointment);
    else onIniciarAtendimento?.(appointment);
  }

  return (
    <div className={className}>
      {primary ? (
        <button type="button" onClick={handlePrimary} className={primaryButtonClass(primaryHeightClass)}>
          {primary === 'confirmar' ? (
            <Check className={`${primaryIconClass} shrink-0`} aria-hidden />
          ) : (
            <Play className={`${primaryIconClass} shrink-0`} aria-hidden />
          )}
          {primaryLabel}
        </button>
      ) : null}
      {secondary.length > 0 ? (
        <div className={secondaryRowClassName}>
          {secondary.includes('whatsapp') ? (
            <button
              type="button"
              onClick={() => onWhatsApp?.(appointment)}
              className={compact ? BTN_SECONDARY_COMPACT : BTN_SECONDARY}
              title="WhatsApp"
              aria-label="Enviar confirmação via WhatsApp"
            >
              <MessageCircle className="h-3 w-3 shrink-0" aria-hidden />
              {compact ? null : 'WhatsApp'}
            </button>
          ) : null}
          {secondary.includes('reagendar') ? (
            <button
              type="button"
              onClick={() => onReagendar?.(appointment)}
              className={compact ? BTN_SECONDARY_COMPACT : BTN_SECONDARY}
              title="Reagendar"
              aria-label="Reagendar"
            >
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              {compact ? null : 'Reagendar'}
            </button>
          ) : null}
          {secondary.includes('cancelar') ? (
            <button
              type="button"
              onClick={() => onCancelar?.(appointment)}
              className={compact ? BTN_CANCEL_COMPACT : BTN_CANCEL}
              title="Cancelar agendamento"
              aria-label="Cancelar agendamento"
            >
              <XCircle className="h-3 w-3 shrink-0" aria-hidden />
              {compact ? null : 'Cancelar'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
