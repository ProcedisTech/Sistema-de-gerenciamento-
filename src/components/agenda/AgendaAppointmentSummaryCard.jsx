import { Clock3, UserRound } from 'lucide-react';
import { getStatusColors } from '../../utils/agendaStatusColors.js';
import { isValidAdvanceOffer } from '../../utils/agendaAdvanceOffer.js';

const STATUS_STYLES = {
  confirmado: {
    border: 'border-l-brand-primary',
    dot: 'bg-brand-primary',
    badge: 'bg-brand-primarySubtle text-brand-primaryDark',
    primary: 'bg-brand-primary hover:bg-brand-primaryDark text-white',
  },
  pendente: {
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-800',
    primary: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  cancelado: {
    border: 'border-l-red-500',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
    primary: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
  },
  reagendado: {
    border: 'border-purple-300',
    dot: 'bg-purple-400',
    badge: 'bg-purple-100 text-purple-800',
    primary: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  },
};

const AVATAR_GRADIENTS = [
  { from: '#7F77DD', to: '#5B53C4' },
  { from: '#1D9E75', to: '#127A57' },
  { from: '#D4537E', to: '#A93C61' },
  { from: '#378ADD', to: '#2566B0' },
  { from: '#D85A30', to: '#A93D1B' },
];

const STATUS_BADGE_CLASSES = {
  confirmado: 'text-green-600 bg-green-100',
  pendente: 'text-amber-600 bg-amber-100',
  realizado: 'text-slate-600 bg-slate-100',
  cancelado: 'text-red-600 bg-red-100',
  falta: 'text-red-700 bg-red-50',
  aguardando_confirmacao: 'text-amber-700 bg-amber-50',
  reagendado: 'bg-purple-100 text-purple-800',
};

function initials(name) {
  const parts = String(name || 'Paciente').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function hashGradient(name) {
  const value = String(name || 'Paciente');
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash + value.charCodeAt(i) * (i + 1)) % 997;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function actionLabel(status) {
  if (status === 'pendente' || status === 'aguardando_confirmacao') return 'Confirmar';
  if (status === 'cancelado') return 'Reagendar';
  return 'Iniciar Atendimento';
}

function showPrimaryActionButton(status) {
  if (status === 'falta' || status === 'realizado' || status === 'reagendado') return false;
  return true;
}

/** Evita botões esticando em larguras intermediárias (cards / lista / modal). */
const BTN_ACTION =
  'inline-flex max-w-[min(100%,14rem)] shrink-0 justify-center whitespace-normal text-center leading-tight';

/**
 * Card de resumo de um slot (painel do dia, resumo de lista, detalhe modo Semana).
 */
export function AgendaAppointmentSummaryCard({
  appointment,
  onPrimary,
  onEdit,
  renderSlotActions,
  isNivel1 = false,
  advanceOffer,
  onAdvanceClick,
}) {
  const isReagendado = appointment.status === 'reagendado';
  const styles = STATUS_STYLES[appointment.status] || STATUS_STYLES.pendente;
  const statusTone = getStatusColors(appointment.status);
  const grad = hashGradient(appointment.pacienteNome);
  const avatarStyle = { background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` };
  const badgeClass = STATUS_BADGE_CLASSES[appointment.status] || STATUS_BADGE_CLASSES.pendente;

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white shadow-sm transition-all overflow-hidden hover:border-teal-300 hover:shadow-lg">
      <div className="h-1.5" style={{ backgroundColor: appointment.corHex || '#14B8A6' }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-white"
              style={avatarStyle}
            >
              {initials(appointment.pacienteNome)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-[#1A1A2E]">{appointment.pacienteNome}</div>
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: appointment.corHex || '#14B8A6' }}
                  aria-hidden
                />
                <div
                  className={`truncate text-[11px] font-medium ${appointment.procedimentoNome ? 'text-[#888888]' : 'text-amber-700'}`}
                >
                  {appointment.procedimentoNome || 'Sem procedimento informado'}
                </div>
              </div>
            </div>
          </div>
          <span
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
              isReagendado ? 'bg-purple-100 text-purple-800' : badgeClass
            }`}
          >
            {isReagendado ? 'Reagendado' : statusTone.label || appointment.status}
          </span>
        </div>

        {isValidAdvanceOffer(appointment, advanceOffer) && typeof onAdvanceClick === 'function' && !isNivel1 ? (
          <button
            type="button"
            onClick={() => onAdvanceClick(appointment, advanceOffer)}
            className="mt-2 text-left text-[11px] font-semibold text-teal-700 underline-offset-2 hover:underline"
          >
            Adiantar para {String(advanceOffer.targetHoraInicio).slice(0, 5)}
          </button>
        ) : null}

        <div className="mt-3 space-y-1.5 text-[11px] font-medium text-[#555]">
          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 text-[#888888]" />
            <span>
              {appointment.horaInicio} ({appointment.duracaoMin} min)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 text-[#888888]" />
            <span>{appointment.profissionalNome}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-stretch justify-end gap-2">
          {isNivel1 ? (
            <div className="flex w-full items-center justify-center rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-center text-[11px] font-bold text-rose-600">
              Nível 1: Apenas visualização
            </div>
          ) : (
            <>
              {showPrimaryActionButton(appointment.status) ? (
                <button
                  type="button"
                  onClick={() => onPrimary(appointment)}
                  className={`${BTN_ACTION} rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${styles.primary}`}
                >
                  {actionLabel(appointment.status)}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onEdit(appointment)}
                className={`${BTN_ACTION} rounded-lg border border-[#E8E8E8] bg-white px-3 py-2 text-[11px] font-bold text-[#64748b] transition-colors hover:bg-[#F5F6FA]`}
              >
                Editar
              </button>
            </>
          )}
        </div>
        {typeof renderSlotActions === 'function' ? (
          <div className="mt-2 border-t border-[#f1f5f9] pt-2">{renderSlotActions(appointment)}</div>
        ) : null}
      </div>
    </div>
  );
}
