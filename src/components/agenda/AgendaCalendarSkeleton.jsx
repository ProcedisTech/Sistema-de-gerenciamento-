export function AgendaCalendarSkeleton({ variant = 'f3' }) {
  if (variant === 'legacy') {
    return (
      <div className="flex h-full min-h-0 animate-pulse flex-col gap-2">
        <div className="grid shrink-0 grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`h-${i}`} className="mx-auto h-3 w-8 rounded bg-slate-200" />
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-2">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={`c-${i}`} className="rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 animate-pulse flex-col rounded-2xl border border-ink-200 bg-white p-3 shadow-agenda-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-[34px] w-[34px] rounded-[10px] bg-ink-100" />
          <div className="h-7 w-36 rounded-lg bg-ink-100" />
          <div className="h-[34px] w-[34px] rounded-[10px] bg-ink-100" />
          <div className="h-8 w-16 rounded-full bg-ink-100" />
        </div>
        <div className="h-8 w-28 rounded-full bg-ink-100" />
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-1.5 px-1 pt-3 pb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`wd-${i}`} className="mx-auto h-3 w-6 rounded bg-ink-100" />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1.5">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={`c-${i}`} className="rounded-xl bg-ink-100" />
        ))}
      </div>
    </div>
  );
}

export function AgendaKpiSkeleton() {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[52px] animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}
