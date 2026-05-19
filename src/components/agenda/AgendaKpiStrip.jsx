import { CalendarDays, CheckCircle2, Clock3 } from 'lucide-react';

function KpiCell({ label, value, tone = 'default', icon: Icon, onClick, interactive = false }) {
  const isToday = tone === 'today';
  const iconClass =
    tone === 'success'
      ? 'text-stats-confirmedIcon'
      : tone === 'warning'
        ? 'text-stats-pendingIcon'
        : tone === 'purple'
          ? 'text-stats-totalIcon'
          : 'text-brand-primaryDark';

  const className = `flex min-h-[52px] flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 shadow-sm transition-all duration-150 ${
    isToday
      ? 'border-transparent bg-gradient-to-br from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700'
      : 'border-calendar-border bg-white hover:border-gray-300 hover:shadow-md'
  }${interactive ? ' cursor-pointer hover:ring-2 hover:ring-brand-primary/25 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 active:scale-[0.99] motion-reduce:active:scale-100' : ''}`;

  const content = (
    <>
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className={`text-2xl font-bold leading-none ${
            isToday ? 'text-white' : tone === 'success' ? 'text-brand-primary' : tone === 'warning' ? 'text-stats-pendingIcon' : 'text-[#1A1A2E]'
          }`}
        >
          {value}
        </span>
        <span className={`truncate text-[11px] font-semibold ${isToday ? 'text-white/90' : 'text-[#888888]'}`}>{label}</span>
      </div>
      {Icon ? (
        <Icon
          className={`h-4 w-4 shrink-0 ${isToday ? 'text-white/90' : iconClass}`}
          strokeWidth={2.4}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (interactive && typeof onClick === 'function') {
    return (
      <button type="button" onClick={onClick} className={className} aria-label={`Ver ${label}`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export function AgendaKpiStrip({ stats, onDrilldownConfirmados, onDrilldownPendentes }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
      <KpiCell label="Total do mês" value={stats.totalMes} tone="purple" icon={CalendarDays} />
      <KpiCell
        label="Confirmados"
        value={stats.confirmados}
        tone="success"
        icon={CheckCircle2}
        interactive
        onClick={onDrilldownConfirmados}
      />
      <KpiCell
        label="Pendentes"
        value={stats.pendentes}
        tone="warning"
        icon={Clock3}
        interactive
        onClick={onDrilldownPendentes}
      />
      <KpiCell label="Hoje" value={stats.hoje} tone="today" icon={Clock3} />
    </div>
  );
}
