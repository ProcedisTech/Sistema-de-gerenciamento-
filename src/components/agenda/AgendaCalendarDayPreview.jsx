import {
  formatCalendarPreviewHeader,
  getAppointmentStatusBucket,
  getEventDisplayLabel,
  getStatusSwatchClass,
  sortAppointmentsByTime,
} from '../../utils/agendaDayInsights.js';

const PREVIEW_MAX = 6;

function formatEventTime(horaInicio) {
  const s = String(horaInicio || '00:00').trim();
  const parts = s.split(':');
  const h = String(Number(parts[0]) || 0).padStart(2, '0');
  const m = String(Number(parts[1]) || 0).padStart(2, '0');
  return `${h}:${m}`;
}

export function AgendaCalendarDayPreview({ iso, appointments, flipBelow, style, className = '' }) {
  const sorted = sortAppointmentsByTime(appointments);
  const visible = sorted.slice(0, PREVIEW_MAX);
  const remaining = sorted.length - visible.length;

  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute left-1/2 z-50 w-[280px] -translate-x-1/2 rounded-xl border border-ink-800 bg-ink-900 px-3 py-2.5 text-white shadow-agenda-md transition-[opacity,transform] duration-150 motion-reduce:transition-none ${flipBelow ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]'} after:absolute after:left-1/2 after:h-0 after:w-0 after:-translate-x-1/2 after:border-x-[6px] after:border-x-transparent after:content-[''] ${flipBelow ? 'after:top-0 after:-translate-y-full after:border-b-[6px] after:border-b-ink-900 after:border-t-0' : 'after:bottom-0 after:translate-y-full after:border-t-[6px] after:border-t-ink-900'} ${className}`}
      style={style}
    >
      <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-ink-300">
        {formatCalendarPreviewHeader(iso)}
      </p>
      <ul className="space-y-1.5">
        {visible.map((item) => {
          const bucket = item.tipo === 'bloqueio' ? 'bloqueio' : getAppointmentStatusBucket(item);
          return (
            <li key={item.id} className="flex items-center gap-2 text-[12px] leading-tight">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getStatusSwatchClass(bucket)}`} aria-hidden />
              <span className="font-mono text-[10.5px] text-ink-400">{formatEventTime(item.horaInicio)}</span>
              <span className="min-w-0 truncate text-ink-50">{getEventDisplayLabel(item)}</span>
            </li>
          );
        })}
      </ul>
      {remaining > 0 ? (
        <p className="mt-2 text-[11px] font-medium text-ink-400">+ {remaining} mais</p>
      ) : null}
    </div>
  );
}
