import { Clock3, UserRound } from 'lucide-react';
import { getGroupedRailCardActions } from '../../utils/agendaCardActions.js';
import { getAppointmentStatusBucket } from '../../utils/agendaDayInsights.js';
import { isValidAdvanceOffer } from '../../utils/agendaAdvanceOffer.js';
import { getGroupedStatusBadgePresentation } from '../../utils/agendaRailHelpers.js';

const BTN_ACTION =
  'inline-flex max-w-[min(100%,14rem)] shrink-0 justify-center whitespace-normal text-center leading-tight';

const STATUS_STYLES = {
  confirmado: {
    primary: 'bg-brand-primary hover:bg-brand-primaryDark text-white',
  },
  pendente: {
    primary: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  cancelado: {
    primary: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
  },
};

function statusDotClass(appointment) {
  const bucket = getAppointmentStatusBucket(appointment);
  const map = {
    confirmado: 'bg-brand-primary',
    pendente: 'bg-amber-500',
    cancelado: 'bg-red-500',
    noshow: 'bg-orange-500',
  };
  return map[bucket] || 'bg-slate-300';
}

function showPrimaryActionButton(statuses) {
  return statuses.some((s) => !['realizado', 'reagendado'].includes(s));
}

function panelActionLabel(statuses) {
  const actions = getGroupedRailCardActions(statuses);
  if (actions.primary === 'confirmar') return 'Confirmar';
  if (actions.primary === 'iniciar') return 'Iniciar';
  return 'Reagendar';
}

function initials(name) {
  const parts = String(name || 'Paciente').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const AVATAR_GRADIENTS = [
  { from: '#7F77DD', to: '#5B53C4' },
  { from: '#1D9E75', to: '#127A57' },
  { from: '#D4537E', to: '#A93C61' },
  { from: '#378ADD', to: '#2566B0' },
  { from: '#D85A30', to: '#A93D1B' },
];

function hashGradient(name) {
  const value = String(name || 'Paciente');
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash + value.charCodeAt(i) * (i + 1)) % 997;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function AgendaGroupedSummaryCard({
  group,
  onPrimary,
  onEdit,
  renderSlotActions,
  isNivel1 = false,
  advanceOffer,
  onAdvanceClick,
}) {
  const appointments = group?.appointments || [];
  const primary = appointments[0];
  if (!primary) return null;

  const statuses = appointments.map((a) => a.status);
  const badge = getGroupedStatusBadgePresentation(appointments);
  const actions = getGroupedRailCardActions(statuses);
  const styles = STATUS_STYLES[actions.primary === 'confirmar' ? 'pendente' : 'confirmado'] || STATUS_STYLES.pendente;
  const grad = hashGradient(group.pacienteNome);
  const avatarStyle = { background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` };

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm transition-all hover:border-teal-300 hover:shadow-lg">
      <div className="h-1.5 bg-brand-primary" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-white"
              style={avatarStyle}
            >
              {initials(group.pacienteNome)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-[#1A1A2E]">{group.pacienteNome}</div>
              <ul className="mt-1 space-y-0.5">
                {appointments.map((appt, index) => (
                  <li key={appt.id} className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#555]">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(appt)}`} aria-hidden />
                    <span className="shrink-0 font-mono text-[10px] text-[#94a3b8]">{index + 1})</span>
                    <span className="truncate">{appt.procedimentoNome || 'Sem procedimento'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge.pillClass}`}>
            {badge.label}
          </span>
        </div>

        {isValidAdvanceOffer(primary, advanceOffer) && typeof onAdvanceClick === 'function' && !isNivel1 ? (
          <button
            type="button"
            onClick={() => onAdvanceClick(primary, advanceOffer)}
            className="mt-2 text-left text-[11px] font-semibold text-teal-700 underline-offset-2 hover:underline"
          >
            Adiantar para {String(advanceOffer.targetHoraInicio).slice(0, 5)}
          </button>
        ) : null}

        <div className="mt-3 space-y-1.5 text-[11px] font-medium text-[#555]">
          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 text-[#888888]" />
            <span>
              {group.horaInicio} → {group.horaFim} ({group.duracaoTotalMin} min)
            </span>
          </div>
          {group.profissionalNome ? (
            <div className="flex items-center gap-2">
              <UserRound className="h-3.5 w-3.5 text-[#888888]" />
              <span>{group.profissionalNome}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-stretch justify-end gap-2">
          {isNivel1 ? (
            <div className="flex w-full items-center justify-center rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-center text-[11px] font-bold text-rose-600">
              Nível 1: Apenas visualização
            </div>
          ) : (
            <>
              {showPrimaryActionButton(statuses) && actions.primary ? (
                <button
                  type="button"
                  onClick={() => onPrimary?.(group)}
                  className={`${BTN_ACTION} rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${styles.primary}`}
                >
                  {panelActionLabel(statuses)}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onEdit?.(primary)}
                className={`${BTN_ACTION} rounded-lg border border-[#E8E8E8] bg-white px-3 py-2 text-[11px] font-bold text-[#64748b] transition-colors hover:bg-[#F5F6FA]`}
              >
                Editar
              </button>
            </>
          )}
        </div>
        {typeof renderSlotActions === 'function' ? (
          <div className="mt-2 border-t border-[#f1f5f9] pt-2">{renderSlotActions(group)}</div>
        ) : null}
      </div>
    </div>
  );
}
