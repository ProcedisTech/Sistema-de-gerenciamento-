import { X } from 'lucide-react';
import { getEntryPrimaryAppointment } from '../../utils/agendaDayInsights.js';
import { AgendaSummaryEntryCard } from './AgendaSummaryEntryCard.jsx';

function normalizeTarget(target) {
  if (!target) return null;
  if (target.kind === 'group' || target.kind === 'single') return target;
  return { kind: 'single', appointment: target };
}

/**
 * Detalhe de um slot na vista Semana — z-[215], abaixo do AgendaFormModal (220) e dos fluxos 230.
 * `target` é entry (group/single) ou linha única; ações usam o grupo resolvido no clique.
 */
export function AgendaWeekSlotDetailModal({
  target,
  onClose,
  onPrimary,
  renderSlotActions,
  isNivel1 = false,
  advanceOfferByAgendaId,
  onAdvanceClick,
}) {
  const entry = normalizeTarget(target);
  const primary = getEntryPrimaryAppointment(entry);
  if (!entry || !primary) return null;

  const isBloqueio = primary.tipo === 'bloqueio' && primary.status !== 'cancelado';
  const motivo =
    (primary.observacao && String(primary.observacao).trim()) ||
    primary.procedimentoNome ||
    'Bloqueio';
  const advanceId = primary?.id ? String(primary.id) : '';
  const advanceOffer = advanceId ? advanceOfferByAgendaId?.get(advanceId) : undefined;

  const headerTime =
    entry.kind === 'group'
      ? `${entry.horaInicio} → ${entry.horaFim}`
      : primary.horaInicio;

  return (
    <div className="fixed inset-0 z-[215] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fechar detalhe do agendamento" />
      <div className="relative max-h-[min(92dvh,720px)] w-full max-w-[720px] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-[1] flex items-start justify-between gap-3 border-b border-[#E8E8E8] bg-white p-4 sm:p-5">
          <div className="min-w-0">
            <h3 className="text-[16px] font-black leading-tight text-[#1A1A2E] sm:text-[18px]">
              {isBloqueio ? 'Horário bloqueado' : 'Agendamento'}
            </h3>
            <p className="mt-1 text-[12px] font-medium text-[#888888]">
              {isBloqueio
                ? `${headerTime} · ${motivo}`
                : `${headerTime} · ${primary.pacienteNome}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 text-[#64748b] hover:bg-[#F5F6FA]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5">
          <AgendaSummaryEntryCard
            entry={entry}
            onPrimary={onPrimary}
            renderSlotActions={renderSlotActions}
            isNivel1={isNivel1}
            advanceOffer={advanceOffer}
            onAdvanceClick={onAdvanceClick}
          />
        </div>
      </div>
    </div>
  );
}
