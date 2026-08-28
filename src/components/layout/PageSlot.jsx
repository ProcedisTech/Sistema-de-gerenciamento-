import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Componente reutilizável para renderização do slot de contexto/página no GlobalHeader.
 *
 * @param {{
 *   icon?: React.ElementType,
 *   title: React.ReactNode,
 *   breadcrumb?: React.ReactNode,
 *   className?: string,
 * }} props
 */
export function PageSlot({
  icon: Icon,
  title,
  breadcrumb,
  className = '',
}) {
  if (!title) return null;

  return (
    <div
      className={`inline-flex min-w-0 items-center gap-2 text-ink-800 select-none ${className}`}
      data-testid="global-header-page-slot"
    >
      {Icon ? (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-50 text-[#00a88e]">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
        </div>
      ) : null}

      <div className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-slate-800">
        <span className="truncate">{title}</span>
        {breadcrumb ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden="true" />
            <span className="truncate font-medium text-slate-500">{breadcrumb}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
