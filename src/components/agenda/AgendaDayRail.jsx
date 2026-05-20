import { useEffect, useRef, useState } from 'react';
import { useTickInterval } from './hooks/useTickInterval.js';
import { AgendaDayRailBody } from './AgendaDayRailBody.jsx';
import { AgendaDayRailFooter } from './AgendaDayRailFooter.jsx';
import { AgendaDayRailHero } from './AgendaDayRailHero.jsx';
import { AgendaDayRailTimelineStrip } from './AgendaDayRailTimelineStrip.jsx';

const HIGHLIGHT_MS = 1600;

export function AgendaDayRail({
  selectedDay,
  appointments,
  todayIso,
  showProfissional = false,
  isNivel1 = false,
  compact = false,
  listRef,
  cardRefs,
  advanceOfferByAgendaId,
  onAdvanceClick,
  onBloquear,
  onNovoAgendamento,
  onCheckIn,
  onConfirmar,
  onIniciarAtendimento,
  onWhatsApp,
  onReagendar,
  onCancelar,
  onEdit,
  onRemoverBloqueio,
  submittingRemoverBloqueioId,
}) {
  const now = useTickInterval(60_000);
  const [highlight, setHighlight] = useState({ day: null, id: null });
  const highlightTimerRef = useRef(null);

  const highlightedId = highlight.day === selectedDay ? highlight.id : null;

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    [],
  );

  function highlightCard(id) {
    if (!id) return;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    const sid = String(id);
    setHighlight({ day: selectedDay, id: sid });
    const el = cardRefs?.current?.[sid];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlight((prev) => (prev.id === sid && prev.day === selectedDay ? { day: null, id: null } : prev));
      highlightTimerRef.current = null;
    }, HIGHLIGHT_MS);
  }

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden bg-white ${
        compact
          ? 'h-full rounded-none border-0 shadow-none'
          : 'h-full rounded-2xl border border-ink-200 shadow-agenda-md'
      }`}
    >
      <AgendaDayRailHero
        selectedDay={selectedDay}
        todayIso={todayIso}
        appointments={appointments}
        compact={compact}
      />

      <AgendaDayRailTimelineStrip
        appointments={appointments}
        selectedDay={selectedDay}
        todayIso={todayIso}
        now={now}
        onBlockClick={highlightCard}
        compact={compact}
      />

      <AgendaDayRailBody
        listRef={listRef}
        cardRefs={cardRefs}
        selectedDay={selectedDay}
        todayIso={todayIso}
        appointments={appointments}
        now={now}
        highlightedId={highlightedId}
        showProfissional={showProfissional}
        isNivel1={isNivel1}
        advanceOfferByAgendaId={advanceOfferByAgendaId}
        onAdvanceClick={onAdvanceClick}
        onCheckIn={onCheckIn}
        onConfirmar={onConfirmar}
        onIniciarAtendimento={onIniciarAtendimento}
        onWhatsApp={onWhatsApp}
        onReagendar={onReagendar}
        onCancelar={onCancelar}
        onEdit={onEdit}
        onRemoverBloqueio={onRemoverBloqueio}
        onNovoAgendamento={onNovoAgendamento}
        submittingRemoverBloqueioId={submittingRemoverBloqueioId}
      />

      <AgendaDayRailFooter
        isNivel1={isNivel1}
        compact={compact}
        onBloquear={onBloquear}
        onNovoAgendamento={onNovoAgendamento}
      />
    </div>
  );
}
