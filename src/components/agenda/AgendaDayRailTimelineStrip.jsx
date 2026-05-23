import { memo } from 'react';
import {
  getNowLineLeftPercent,
  getTimelineBlocks,
  TIMELINE_START_MIN,
  TIMELINE_SPAN_MIN,
} from '../../utils/agendaRailHelpers.js';

const HOUR_LABELS = [8, 10, 12, 14, 16, 18, 20];

function AgendaDayRailTimelineStripInner({
  appointments,
  selectedDay,
  todayIso,
  now,
  onBlockClick,
  compact = false,
  dense = false,
}) {
  const blocks = getTimelineBlocks(appointments);
  const nowLeft = getNowLineLeftPercent(now, selectedDay, todayIso);
  const useDense = dense && !compact;
  const labelSizeClass = compact ? 'text-[9px]' : useDense ? 'text-[9px]' : 'text-[10px]';
  const blockSizeClass = compact ? 'min-h-[28px] text-[9px]' : useDense ? 'text-[9px]' : 'text-[9.5px]';

  return (
    <section className={`shrink-0 border-b border-ink-150 bg-white pb-3.5 pt-4 ${compact ? 'px-4' : useDense ? 'px-4' : 'px-5'}`}>
      <div className={`relative mb-1.5 ${compact ? 'h-3' : 'h-3.5'}`}>
        {HOUR_LABELS.map((h) => {
          const left = ((h * 60 - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;
          return (
            <span
              key={h}
              className={`absolute top-0 -translate-x-1/2 font-mono text-ink-500 ${labelSizeClass}`}
              style={{ left: `${left}%` }}
            >
              {String(h).padStart(2, '0')}h
            </span>
          );
        })}
      </div>

      <div className={`relative overflow-hidden rounded-lg border border-ink-150 bg-ink-50 ${compact ? 'h-7' : 'h-9'}`}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, transparent, transparent calc(100% / 12 - 1px), oklch(0.92 0.01 250 / 0.6) calc(100% / 12 - 1px), oklch(0.92 0.01 250 / 0.6) calc(100% / 12))',
          }}
          aria-hidden
        />

        {blocks.map((block) => (
          <button
            key={block.id}
            type="button"
            title={block.initials}
            onClick={() => onBlockClick?.(block.id)}
            className={`absolute top-1 bottom-1 z-[1] flex items-center justify-center rounded font-mono font-semibold text-white transition-[transform,filter] duration-150 hover:z-[2] hover:scale-105 hover:brightness-110 motion-reduce:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2 ${blockSizeClass} ${block.colorClass} ${block.faded ? 'opacity-75' : ''}`}
            style={{
              left: `${block.leftPercent}%`,
              width: `${block.widthPercent}%`,
            }}
          >
            {block.initials}
          </button>
        ))}

        {nowLeft != null ? (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-[3] w-0.5 bg-vivid-teal-700 before:absolute before:left-1/2 before:top-0 before:h-2 before:w-2 before:-translate-x-1/2 before:rounded-full before:bg-vivid-teal-600 before:shadow-[0_0_0_3px_white,0_0_12px_oklch(0.46_0.13_172)]"
            style={{ left: `${nowLeft}%` }}
            aria-hidden
          />
        ) : null}
      </div>
    </section>
  );
}

export const AgendaDayRailTimelineStrip = memo(AgendaDayRailTimelineStripInner);
