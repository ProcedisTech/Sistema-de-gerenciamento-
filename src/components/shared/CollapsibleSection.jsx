import React, { useCallback, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const STORAGE_KEY = 'procedi.pulseSidebar.sectionsCollapsed';

function readCollapsedMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCollapsedMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Seção retrátil (aberto por padrão). Persistência localStorage:
 * `procedi.pulseSidebar.sectionsCollapsed` — só chaves fechadas (`true`).
 */
export function CollapsibleSection({
  id,
  icon,
  title,
  count,
  defaultOpen = true,
  iconBg = 'bg-[#e6f7f5]',
  iconColor = 'text-[#00a88e]',
  headerExtra = null,
  children,
}) {
  const reactId = useId();
  const panelId = `collapsible-${id || reactId}`;
  const Icon = icon;

  const [open, setOpen] = useState(() => {
    if (!id) return defaultOpen;
    const map = readCollapsedMap();
    if (map[id] === true) return false;
    return defaultOpen;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (id) {
        const map = readCollapsedMap();
        if (next) delete map[id];
        else map[id] = true;
        writeCollapsedMap(map);
      }
      return next;
    });
  }, [id]);

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-1 px-1 pb-2">
        <button
          type="button"
          id={`${panelId}-header`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a88e]/40"
        >
          {Icon ? (
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-3.5 w-3.5 ${iconColor}`} strokeWidth={2.2} aria-hidden />
            </span>
          ) : null}
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[#0f172a]">{title}</span>
          {count != null && count > 0 ? (
            <span className="rounded-full bg-[#e6f7f5] px-2 py-0.5 text-[11px] font-semibold text-[#00a88e]">
              {count}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#94a3b8] transition-transform motion-reduce:transition-none ${
              open ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
        {headerExtra}
      </div>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={`${panelId}-header`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
