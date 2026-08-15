import { Clock3, Lock, Stethoscope, X } from 'lucide-react';
import { isValidAdvanceOffer } from '../../utils/agendaAdvanceOffer.js';
import { getRailCardActions } from '../../utils/agendaCardActions.js';
import {
  formatAgendaShortId,
  getRailStripeClass,
  getStatusBadgePresentation,
} from '../../utils/agendaRailHelpers.js';
import { getTimingBadge, getExecutionSummary } from '../../utils/agendaTimingBadges.js';
import { AgendaAvatarInitials } from './AgendaAvatarInitials.jsx';
import { usePapel } from '../../hooks/usePapel.js';
import { AgendaRailCardActions } from './AgendaRailCardActions.jsx';
import {
  BLOQUEIO_HATCH_BG,
  bloqueioHoraFimLabel,
  bloqueioMotivoLabel,
} from './agendaBloqueioStyles.js';

const BTN_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2';

function formatHm(hm) {
  return String(hm || '').slice(0, 5);
}

export function AgendaAppointmentCardRich({
  appointment,
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
  onEnviarAnamnese,
  onRemoverBloqueio,
  onOpenSlotDetail,
  submittingRemoverBloqueioId,
}) {
  const { canStartAnamnese } = usePapel();
  const isBloqueio = appointment?.tipo === 'bloqueio' && appointment.status !== 'cancelado';

  if (isBloqueio) {
    const motivo = bloqueioMotivoLabel(appointment);
    const hf = bloqueioHoraFimLabel(appointment);
    const removing = submittingRemoverBloqueioId === appointment.id;

    return (
      <article
        onClick={(e) => {
          if (!e.target.closest('button')) onOpenSlotDetail?.(appointment);
        }}
        className={`relative min-w-0 cursor-pointer overflow-hidden rounded-xl border border-ink-200 transition-all duration-150 ${
          highlighted ? 'border-vivid-teal-500 shadow-[0_0_0_3px_oklch(0.66_0.165_172_/_0.15)]' : ''
        }`}
        style={BLOQUEIO_HATCH_BG}
      >
        <div className="absolute bottom-3.5 left-0 top-3.5 w-[3px] rounded-r bg-ink-400" aria-hidden />
        <div className="grid grid-cols-[56px_1fr_auto] items-start gap-2.5 p-3 pr-3.5">
          <div className="pt-0.5">
            <p
              className="font-display text-base font-bold text-ink-900"
              style={{ fontVariationSettings: '"wdth" 90' }}
            >
              {formatHm(appointment.horaInicio)}
            </p>
            <p className="font-mono text-[11px] text-ink-500">{Number(appointment.duracaoMin) || 0} min</p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-200 text-ink-600">
                <Lock className="h-3.5 w-3.5" aria-hidden />
              </div>
              <p className="truncate text-[13.5px] font-semibold text-ink-900">{motivo}</p>
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-ink-700">
              {formatHm(appointment.horaInicio)}–{hf}
              {showProfissional && appointment.profissionalNome ? (
                <span className="text-ink-500"> · {appointment.profissionalNome}</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-ink-600">
              Bloqueio
            </span>
            {!isNivel1 ? (
              <button
                type="button"
                onClick={() => onRemoverBloqueio?.(appointment)}
                disabled={removing}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-white disabled:opacity-50 ${BTN_FOCUS}`}
                aria-label="Remover bloqueio"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  const rawBadge = getStatusBadgePresentation(appointment);
  const isRealizado = appointment.status === 'realizado';
  
  // Status neutro para realizado
  const badge = isRealizado
    ? { label: 'Concluída', pillClass: 'bg-ink-100 text-ink-600', dotClass: 'bg-ink-400' }
    : rawBadge;

  const stripe = getRailStripeClass(appointment);
  const actions = getRailCardActions(appointment.status, canStartAnamnese);
  const execSummary = getExecutionSummary(appointment);
  const timingBadge = execSummary?.badge || getTimingBadge(appointment);

  return (
    <article
      onClick={(e) => {
        if (!e.target.closest('button')) onOpenSlotDetail?.(appointment);
      }}
      className={`relative grid min-w-0 cursor-pointer grid-cols-[56px_1fr_auto] gap-2.5 overflow-hidden rounded-xl border border-ink-200 bg-white p-3 pr-3.5 transition-all duration-150 hover:-translate-y-px hover:border-ink-300 hover:shadow-agenda-sm ${
        highlighted ? 'border-vivid-teal-500 shadow-[0_0_0_3px_oklch(0.66_0.165_172_/_0.15)]' : ''
      }`}
    >
      <div className={`absolute bottom-3.5 left-0 top-3.5 w-[3px] rounded-r ${stripe}`} aria-hidden />

      <div className="pt-0.5">
        <p
          className="font-display text-base font-bold text-ink-900"
          style={{ fontVariationSettings: '"wdth" 90' }}
        >
          {formatHm(appointment.horaInicio)}
        </p>
        {!isRealizado ? (
          <p className="font-mono text-[11px] text-ink-500">{Number(appointment.duracaoMin) || 0} min</p>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <AgendaAvatarInitials name={appointment.pacienteNome} size={28} className="!text-[10px]" />
          <div className="min-w-0">
            <span className="block text-[9.5px] font-medium uppercase tracking-wider text-ink-400 leading-none mb-0.5">
              paciente
            </span>
            <p className="truncate text-[13.5px] font-bold text-ink-900 leading-tight">
              {appointment.pacienteNome || 'Paciente'}
            </p>
          </div>
        </div>
        <p
          className="mt-1 line-clamp-2 text-[12.5px] font-medium leading-snug text-ink-700 [overflow-wrap:anywhere]"
          title={appointment.procedimentoNome || 'Sem procedimento'}
        >
          {appointment.procedimentoNome || 'Sem procedimento'}
        </p>
        {appointment.profissionalNome ? (
          <div className="mt-0.5 flex items-center gap-1 text-[11.5px] font-normal text-ink-500" title={appointment.profissionalNome}>
            <Stethoscope className="h-3.5 w-3.5 text-ink-400 shrink-0" />
            <span className="truncate">{appointment.profissionalNome}</span>
          </div>
        ) : null}
        {!isNivel1 ? (
          <AgendaRailCardActions
            appointment={appointment}
            actions={actions}
            compact={compact}
            onConfirmar={onConfirmar}
            onIniciarAtendimento={onIniciarAtendimento}
            onWhatsApp={onWhatsApp}
            onReagendar={onReagendar}
            onCancelar={onCancelar}
            onEnviarAnamnese={onEnviarAnamnese}
          />
        ) : null}
        {isValidAdvanceOffer(appointment, advanceOffer) && typeof onAdvanceClick === 'function' && !isNivel1 ? (
          <button
            type="button"
            onClick={() => onAdvanceClick(appointment, advanceOffer)}
            className={`mt-1 text-left text-[10px] font-semibold text-vivid-teal-700 underline-offset-2 hover:underline ${BTN_FOCUS}`}
          >
            Adiantar para {String(advanceOffer.targetHoraInicio).slice(0, 5)}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide ${badge.pillClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} aria-hidden />
          {badge.label}
        </span>
        <span className="font-mono text-[10.5px] text-ink-400">
          {formatAgendaShortId(appointment.agendaId || appointment.id)}
        </span>
      </div>

      {(isRealizado || execSummary?.hasExecution) ? (
        <div className="col-span-full mt-2.5 border-t border-ink-200 pt-2.5 flex items-center justify-between gap-2 text-[11.5px] text-ink-700">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock3 className="h-3.5 w-3.5 text-ink-400 shrink-0" />
            <span>{execSummary.fullText || `${execSummary.rangeText} (${execSummary.duracaoText})`}</span>
          </div>
          {timingBadge ? (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${timingBadge.badgeClass}`}>
              {timingBadge.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
