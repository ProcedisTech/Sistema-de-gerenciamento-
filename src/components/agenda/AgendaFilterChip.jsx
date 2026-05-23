import React from 'react';
import { AGENDA_SELECTED_SURFACE } from './agendaSelectionStyles.js';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2';

/**
 * Chip de filtro do control strip (Todos ou status).
 */
export const AgendaFilterChip = React.forwardRef(function AgendaFilterChip(
  {
    label,
    count,
    active = false,
    onClick,
    swatchClassName = '',
    activeClassName = '',
    variant = 'status',
    compactMobile = false,
    icon = null,
    showTooltip = false,
    tooltipLabel = '',
  },
  ref,
) {
  const isAll = variant === 'all';
  const isCompactStatus = compactMobile && !isAll;

  const base = compactMobile
    ? `inline-flex shrink-0 items-center rounded-full border font-medium transition-colors duration-150 ease-out motion-reduce:transition-none ${FOCUS_RING} ${
        isAll ? 'h-8 gap-1.5 px-3 text-[12.5px]' : 'h-7 gap-1 px-2 text-xs'
      }`
    : `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150 ease-out motion-reduce:transition-none ${FOCUS_RING}`;

  const idleClass =
    'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50';

  const activeDefault = isAll
    ? AGENDA_SELECTED_SURFACE
    : activeClassName || 'border-ink-900 bg-ink-900 text-white';

  const countClass = active
    ? 'rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white'
    : 'rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700';

  const button = (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={isCompactStatus ? label : undefined}
      className={`${base} ${active ? activeDefault : idleClass}`}
    >
      {compactMobile ? (
        isAll ? (
          <>
            <span>{label}</span>
            {count != null ? <span className={countClass}>{count}</span> : null}
          </>
        ) : (
          <>
            {icon}
            {count != null ? <span className={countClass}>{count}</span> : null}
          </>
        )
      ) : (
        <>
          {swatchClassName ? (
            <span className={`h-2 w-2 shrink-0 rounded-full ${swatchClassName}`} aria-hidden />
          ) : null}
          <span>{label}</span>
          {count != null ? <span className={countClass}>{count}</span> : null}
        </>
      )}
    </button>
  );

  if (!compactMobile || isAll) {
    return button;
  }

  return (
    <div className="relative inline-flex shrink-0">
      {button}
      {showTooltip ? (
        <div
          role="tooltip"
          aria-hidden
          className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-[60] -translate-x-1/2 translate-y-0 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white opacity-100 transition-[opacity,transform] duration-150 motion-reduce:transition-none after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-x-4 after:border-x-transparent after:border-t-4 after:border-t-ink-900"
        >
          {tooltipLabel || label}
        </div>
      ) : null}
    </div>
  );
});
