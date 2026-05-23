import { memo } from 'react';
import { AGENDA_SELECTED_DAY_CELL } from './agendaSelectionStyles.js';
import {
  countCountableAppointments,
  getAppointmentStatusBucket,
  getDominantStatusForDay,
  getEventDisplayLabel,
  getLoadbarSegments,
  getStatusPillBgClass,
  getStatusSwatchClass,
  sortAppointmentsByTime,
} from '../../utils/agendaDayInsights.js';

const MAX_VISIBLE_EVENTS = 3;

function formatEventTime(horaInicio) {
  const s = String(horaInicio || '00:00').trim();
  const parts = s.split(':');
  const h = String(Number(parts[0]) || 0).padStart(2, '0');
  const m = String(Number(parts[1]) || 0).padStart(2, '0');
  return `${h}:${m}`;
}

function AgendaCalendarDayCellInner({
  cell,
  cellIndex = 0,
  showEntrance = false,
  dayAppointments,
  monthLabel,
  isSelected,
  isToday,
  isOutside,
  isEmptyFilter,
  isHovered,
  showPreview,
  previewNode,
  onSelectDay,
  onMoveSelectedDay,
  onMouseEnter,
  onMouseLeave,
}) {
  const sorted = sortAppointmentsByTime(dayAppointments);
  const visibleEvents = sorted.slice(0, MAX_VISIBLE_EVENTS);
  const moreCount = sorted.length - visibleEvents.length;
  const dominant = getDominantStatusForDay(sorted);
  const countable = countCountableAppointments(sorted);
  const loadbarSegments = getLoadbarSegments(sorted);
  const loadbarTotal = loadbarSegments.reduce((sum, seg) => sum + seg.count, 0);

  if (isOutside) {
    return (
      <div
        role="gridcell"
        aria-hidden="true"
        className={`pointer-events-none flex h-full min-h-0 w-full min-w-0 flex-col rounded-xl p-1.5 opacity-40 sm:p-2 ${showEntrance ? 'animate-agenda-rise-cells' : ''}`}
        style={showEntrance ? { '--cell-index': cellIndex } : undefined}
      >
        <span className="text-sm font-bold leading-none text-ink-500 sm:text-base">{cell.day}</span>
      </div>
    );
  }

  let cellClass =
    'group/cell relative flex h-full min-h-[44px] w-full min-w-0 flex-col overflow-visible rounded-xl border p-1 pt-1.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2 lg:min-h-0 lg:p-2 ';

  if (showEntrance && cell.inCurrentMonth) {
    cellClass += 'animate-agenda-rise-cells ';
  }

  if (isSelected) {
    cellClass += AGENDA_SELECTED_DAY_CELL;
  } else if (isHovered && !isSelected) {
    cellClass += 'z-10 border-ink-200 bg-white text-ink-900 shadow-agenda-sm';
  } else if (isToday) {
    cellClass += 'border-vivid-teal-200 bg-vivid-teal-50 text-vivid-teal-700';
  } else if (isEmptyFilter) {
    cellClass += 'border-transparent bg-ink-50 text-ink-700 opacity-60';
  } else {
    cellClass += 'border-transparent bg-ink-50 text-ink-800 hover:z-[2] hover:border-ink-200 hover:bg-white hover:shadow-agenda-sm';
  }

  const pillClass = isSelected
    ? 'bg-white/20 text-white'
    : `${getStatusPillBgClass(dominant)} text-white`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={`${cell.day} de ${monthLabel}, ${sorted.length} agendamento(s)`}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelectDay(cell.iso)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          onMoveSelectedDay(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onMoveSelectedDay(-1);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          onMoveSelectedDay(7);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          onMoveSelectedDay(-7);
        } else if (event.key === 'Enter') {
          onSelectDay(cell.iso);
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cellClass}
      style={showEntrance ? { '--cell-index': cellIndex } : undefined}
    >
      <div className="flex shrink-0 items-start justify-between gap-1">
        <span className="flex items-center gap-1 text-sm font-bold leading-none sm:text-base">
          {isToday && !isSelected ? (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-vivid-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.8)]"
              aria-hidden
            />
          ) : null}
          {cell.day}
        </span>
        {countable > 0 && !isEmptyFilter ? (
          <span className={`flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold ${pillClass}`}>
            {countable}
          </span>
        ) : isEmptyFilter ? (
          <span className="text-[10px] font-medium text-ink-400" aria-hidden>
            —
          </span>
        ) : null}
      </div>

      <div className="mt-1 hidden min-h-0 flex-1 space-y-0.5 overflow-hidden lg:block">
        {visibleEvents.map((item) => {
          const bucket = item.tipo === 'bloqueio' ? 'bloqueio' : getAppointmentStatusBucket(item);
          return (
            <div key={item.id} className="flex min-w-0 items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? 'bg-white/80' : getStatusSwatchClass(bucket)}`} aria-hidden />
              <span className={`shrink-0 font-mono text-[10.5px] ${isSelected ? 'text-white/80' : 'text-ink-500'}`}>
                {formatEventTime(item.horaInicio)}
              </span>
              <span className={`min-w-0 truncate text-[10.5px] font-medium ${isSelected ? 'text-white' : 'text-ink-700'}`}>
                {getEventDisplayLabel(item)}
              </span>
            </div>
          );
        })}
        {moreCount > 0 ? (
          <p className={`text-[10px] font-medium ${isSelected ? 'text-white/70' : 'text-ink-400'}`}>+ {moreCount} mais</p>
        ) : null}
      </div>

      {loadbarTotal > 0 ? (
        <div className="mt-auto flex h-[3px] w-full shrink-0 overflow-hidden rounded-full bg-ink-100/80" aria-hidden>
          {loadbarSegments.map((seg) => (
            <span
              key={seg.key}
              className={`${isSelected ? 'opacity-90' : ''} ${getStatusSwatchClass(seg.key)}`}
              style={{ flex: seg.count / loadbarTotal }}
            />
          ))}
        </div>
      ) : null}

      {showPreview ? previewNode : null}
    </button>
  );
}

function propsAreEqual(prev, next) {
  return (
    prev.cell.iso === next.cell.iso &&
    prev.cellIndex === next.cellIndex &&
    prev.showEntrance === next.showEntrance &&
    prev.isSelected === next.isSelected &&
    prev.isToday === next.isToday &&
    prev.isOutside === next.isOutside &&
    prev.isEmptyFilter === next.isEmptyFilter &&
    prev.isHovered === next.isHovered &&
    prev.showPreview === next.showPreview &&
    prev.dayAppointments === next.dayAppointments &&
    prev.previewNode === next.previewNode
  );
}

export const AgendaCalendarDayCell = memo(AgendaCalendarDayCellInner, propsAreEqual);
