import { Calendar } from 'lucide-react';
import { useMemo } from 'react';
import {
  getAppointmentsFromEntry,
  getEntryAppointmentIds,
  getNextAppointmentEntry,
  groupConsecutiveAppointments,
} from '../../utils/agendaDayInsights.js';
import {
  getEntryDomId,
  getPeriodSuffix,
  groupEntriesByPeriod,
  PERIOD_LABELS,
  PERIOD_ORDER,
} from '../../utils/agendaRailHelpers.js';
import { AgendaEntryCard } from './AgendaEntryCard.jsx';

function SectionTitle({ label, count, suffix }) {
  const fullLabel = suffix ? `${label} · ${suffix}` : label;
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-500">
        {fullLabel}
      </span>
      <span className="h-px flex-1 bg-ink-200" aria-hidden />
      <span className="rounded-full bg-ink-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-700">
        {count}
      </span>
    </div>
  );
}

export function AgendaDayRailBody({
  listRef,
  cardRefs,
  selectedDay,
  todayIso,
  appointments,
  now,
  highlightedId,
  showProfissional,
  isNivel1,
  compact = false,
  advanceOfferByAgendaId,
  onAdvanceClick,
  onCheckIn,
  onConfirmar,
  onIniciarAtendimento,
  onWhatsApp,
  onEnviarAnamnese,
  onReagendar,
  onCancelar,
  onEdit,
  onRemoverBloqueio,
  onNovoAgendamento,
  submittingRemoverBloqueioId,
}) {
  const isToday = selectedDay === todayIso;

  const entries = useMemo(
    () => groupConsecutiveAppointments(appointments),
    [appointments],
  );

  const nextUpEntry = isToday
    ? getNextAppointmentEntry(entries, { now, todayIso: selectedDay })
    : null;
  const nextUpIds = useMemo(
    () => new Set(getEntryAppointmentIds(nextUpEntry)),
    [nextUpEntry],
  );

  const grouped = groupEntriesByPeriod(entries);
  const hasAny = PERIOD_ORDER.some((p) => grouped[p].length > 0);

  function entryAdvanceOffer(entry) {
    const items = getAppointmentsFromEntry(entry);
    for (const appt of items) {
      const offer = advanceOfferByAgendaId?.get(String(appt.id));
      if (offer) return offer;
    }
    return undefined;
  }

  function isEntryHiddenByNextUp(entry) {
    const ids = getEntryAppointmentIds(entry);
    return ids.some((id) => nextUpIds.has(id));
  }

  return (
    <div
      ref={listRef}
      key={selectedDay}
      className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-ink-50 px-4 pb-2 pt-4"
    >
      {isToday && nextUpEntry ? (
        <AgendaEntryCard
          entry={nextUpEntry}
          variant="nextUp"
          now={now}
          showProfissional={showProfissional}
          isNivel1={isNivel1}
          compact={compact}
          onCheckIn={onCheckIn}
          onWhatsApp={onWhatsApp}
          onEnviarAnamnese={onEnviarAnamnese}
          onReagendar={onReagendar}
          onCancelar={onCancelar}
        />
      ) : null}

      {!hasAny ? (
        <div className="empty-day flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-white px-4 py-10 text-center">
          <Calendar className="mb-3 h-10 w-10 text-vivid-teal-500" strokeWidth={1.5} aria-hidden />
          <p className="font-display text-lg font-bold text-ink-900">Dia livre</p>
          <p className="mt-1 max-w-[240px] text-sm text-ink-500">
            Nenhum agendamento corresponde aos filtros ativos.
          </p>
          {!isNivel1 ? (
            <button
              type="button"
              onClick={onNovoAgendamento}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              Novo Agendamento
            </button>
          ) : null}
        </div>
      ) : (
        PERIOD_ORDER.map((period) => {
          const periodEntries = grouped[period];
          if (periodEntries.length === 0) return null;
          const suffix = getPeriodSuffix(period, { selectedDay, todayIso, now });

          return (
            <section key={period} className="mb-4">
              <SectionTitle label={PERIOD_LABELS[period]} count={periodEntries.length} suffix={suffix} />
              <div className="space-y-2">
                {periodEntries.map((entry) => {
                  if (isEntryHiddenByNextUp(entry)) return null;
                  const domId = getEntryDomId(entry);
                  return (
                    <div
                      key={domId}
                      ref={(el) => {
                        if (cardRefs && domId) cardRefs.current[domId] = el;
                      }}
                    >
                      <AgendaEntryCard
                        entry={entry}
                        highlighted={highlightedId === domId}
                        showProfissional={showProfissional}
                        isNivel1={isNivel1}
                        compact={compact}
                        advanceOffer={entryAdvanceOffer(entry)}
                        onAdvanceClick={onAdvanceClick}
                        onConfirmar={onConfirmar}
                        onIniciarAtendimento={onIniciarAtendimento}
                        onWhatsApp={onWhatsApp}
                        onEnviarAnamnese={onEnviarAnamnese}
                        onReagendar={onReagendar}
                        onCancelar={onCancelar}
                        onEdit={onEdit}
                        onRemoverBloqueio={onRemoverBloqueio}
                        submittingRemoverBloqueioId={submittingRemoverBloqueioId}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
