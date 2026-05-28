import { ChevronLeft, ChevronRight, Target, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDayEmptyByFilter } from '../../utils/agendaDayInsights.js';
import { agendaEnterClass } from './agendaEnterClasses.js';
import { AgendaCalendarDayCell } from './AgendaCalendarDayCell.jsx';
import { AgendaCalendarDayPreview } from './AgendaCalendarDayPreview.jsx';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKEND_INDEX = new Set([0, 6]);
const PREVIEW_DELAY_MS = 300;
const PREVIEW_FLIP_THRESHOLD = 200;

function computePreviewOffsetX(rect) {
  const centerX = rect.left + rect.width / 2;
  const half = 140;
  const margin = 12;
  const vw = window.innerWidth;
  if (centerX - half < margin) return margin - (centerX - half);
  if (centerX + half > vw - margin) return vw - margin - (centerX + half);
  return 0;
}

function useCanHover() {
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return canHover;
}

export function AgendaCalendarGrid({ agenda, showEntrance = false, onSelectDay }) {
  const selectDay = onSelectDay ?? agenda.selectDay;
  const canHover = useCanHover();
  const gridRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const [hoveredIso, setHoveredIso] = useState(null);
  const [preview, setPreview] = useState(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const clearPreview = useCallback(() => {
    clearHoverTimer();
    setHoveredIso(null);
    setPreview(null);
  }, [clearHoverTimer]);

  const handleCellMouseEnter = useCallback(
    (cell, event) => {
      if (!canHover || !cell.inCurrentMonth) return;
      setHoveredIso(cell.iso);
      clearHoverTimer();
      const rect = event.currentTarget.getBoundingClientRect();
      hoverTimerRef.current = setTimeout(() => {
        setPreview({
          iso: cell.iso,
          rect,
          flipBelow: rect.top < PREVIEW_FLIP_THRESHOLD,
          offsetX: computePreviewOffsetX(rect),
        });
      }, PREVIEW_DELAY_MS);
    },
    [canHover, clearHoverTimer],
  );

  const handleCellMouseLeave = useCallback(() => {
    clearPreview();
  }, [clearPreview]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    const onScroll = () => clearPreview();
    grid.addEventListener('scroll', onScroll, { passive: true });
    return () => grid.removeEventListener('scroll', onScroll);
  }, [clearPreview]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col rounded-2xl border border-ink-200 bg-white p-2 shadow-agenda-sm lg:p-3 ${agendaEnterClass(showEntrance, 'agenda-delay-200')}`}>
      <header className="cal-head flex shrink-0 flex-wrap items-center justify-between gap-3 pb-2">
        <div className="month-nav flex items-center gap-2">
          <button
            type="button"
            onClick={agenda.goPrevMonth}
            aria-label="Mês anterior"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2
            className="font-display text-[22px] font-bold leading-tight text-ink-900"
            style={{ fontVariationSettings: '"wdth" 90' }}
          >
            {agenda.monthLabel}
          </h2>
          <button
            type="button"
            onClick={agenda.goNextMonth}
            aria-label="Próximo mês"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={agenda.goToToday}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2"
          >
            <Target className="h-3.5 w-3.5 text-vivid-teal-600" aria-hidden />
            Hoje
          </button>
        </div>
        <div className="stat-pro flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700">
          <Users className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
          <span>{agenda.monthVisibleCount ?? 0} visíveis</span>
        </div>
      </header>

      <div role="row" className="grid shrink-0 grid-cols-7 px-1 pt-3 pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {WEEK_DAYS.map((day, index) => (
          <div
            key={day}
            role="columnheader"
            className={WEEKEND_INDEX.has(index) ? 'text-ink-400' : ''}
          >
            {day}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Calendário de ${agenda.monthLabel}`}
        className="cal-grid grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1 overflow-visible lg:gap-1.5"
      >
        {agenda.calendarCells.map((cell, cellIndex) => {
          const isOutside = !cell.inCurrentMonth;
          const dayAppointments = agenda.appointmentsByDate[cell.iso] || [];
          const isSelected = cell.iso === agenda.selectedDay;
          const isToday = cell.iso === agenda.todayIso;
          const isEmptyFilter =
            cell.inCurrentMonth &&
            isDayEmptyByFilter(cell.iso, agenda.appointmentsByDate, agenda.appointmentsByDateRaw);
          const isHovered = hoveredIso === cell.iso;
          const showPreview = preview?.iso === cell.iso;

          const previewNode =
            showPreview && dayAppointments.length > 0 ? (
              <AgendaCalendarDayPreview
                iso={cell.iso}
                appointments={dayAppointments}
                flipBelow={preview.flipBelow}
                style={{
                  transform: preview.flipBelow
                    ? `translate(calc(-50% + ${preview.offsetX}px), 4px)`
                    : `translate(calc(-50% + ${preview.offsetX}px), -4px)`,
                }}
              />
            ) : null;

          return (
            <AgendaCalendarDayCell
              key={cell.iso}
              cell={cell}
              cellIndex={cellIndex}
              showEntrance={showEntrance}
              dayAppointments={dayAppointments}
              monthLabel={agenda.monthLabel}
              isSelected={isSelected}
              isToday={isToday}
              isOutside={isOutside}
              isEmptyFilter={isEmptyFilter}
              isHovered={isHovered}
              showPreview={showPreview}
              previewNode={previewNode}
              onSelectDay={selectDay}
              onMoveSelectedDay={agenda.moveSelectedDay}
              onMouseEnter={(event) => handleCellMouseEnter(cell, event)}
              onMouseLeave={handleCellMouseLeave}
            />
          );
        })}
      </div>
    </div>
  );
}
