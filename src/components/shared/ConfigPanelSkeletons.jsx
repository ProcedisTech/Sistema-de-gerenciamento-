import React from 'react';

export function ConfigTableRowsSkeleton({ rows = 6, colSpan = 6, rowClassName = '' }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`sk-row-${i}`} className={rowClassName}>
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[#f1f5f9]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-2/5 max-w-[12rem] animate-pulse rounded bg-[#f1f5f9]" />
                <div className="h-3 w-3/5 max-w-[16rem] animate-pulse rounded bg-[#f1f5f9]" />
              </div>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function ConfigCardStackSkeleton({ count = 4, className = 'h-16' }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={`sk-card-${i}`} className={`animate-pulse rounded-xl bg-[#f1f5f9] ${className}`} />
      ))}
    </div>
  );
}

export function ConfigFormSectionsSkeleton({
  sections = 3,
  withAvatar = false,
  avatarCentered = false,
  cardRounded = 'xl',
}) {
  const cardRoundClass = cardRounded === '2xl' ? 'rounded-2xl' : 'rounded-xl';
  const cardPadClass = cardRounded === '2xl' ? 'p-6' : 'p-4';

  return (
    <div className="space-y-6">
      {withAvatar ? (
        avatarCentered ? (
          <div className="flex justify-center mb-2">
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-[#f1f5f9]" />
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-[#f1f5f9]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-[#f1f5f9]" />
              <div className="h-3 w-28 animate-pulse rounded bg-[#f1f5f9]" />
            </div>
          </div>
        )
      ) : null}
      {Array.from({ length: sections }).map((_, i) => (
        <div
          key={`sk-section-${i}`}
          className={`${cardRoundClass} border border-[#e2e8f0] bg-white ${cardPadClass}`}
        >
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-[#f1f5f9]" />
          <div className="space-y-3">
            <div className="h-10 w-full animate-pulse rounded-lg bg-[#f1f5f9]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-[#f1f5f9]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfigTableSkeleton({ rows = 6, mobileCards = false, className = '' }) {
  return (
    <div className={className}>
      {mobileCards ? (
        <div className="space-y-3 md:hidden">
          {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
            <div key={`sk-m-${i}`} className="h-24 animate-pulse rounded-xl border border-[#e2e8f0] bg-[#f1f5f9]" />
          ))}
        </div>
      ) : null}
      <div className={`rounded-xl border border-[#e2e8f0] bg-white ${mobileCards ? 'hidden md:block' : ''}`}>
        <div className="border-b border-[#e2e8f0] px-4 py-3">
          <div className="h-4 w-48 animate-pulse rounded bg-[#f1f5f9]" />
        </div>
        <div className="divide-y divide-[#e2e8f0]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={`sk-trow-${i}`} className="flex items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[#f1f5f9]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-2/5 max-w-[12rem] animate-pulse rounded bg-[#f1f5f9]" />
                <div className="h-3 w-3/5 max-w-[16rem] animate-pulse rounded bg-[#f1f5f9]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
