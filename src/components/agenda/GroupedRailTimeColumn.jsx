import { formatDurationLabel, formatHmDisplay } from '../../utils/agendaRailHelpers.js';

export function GroupedDurationBlock({ duracaoTotalMin, className = '' }) {
  return (
    <div className={className}>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">Duração</p>
      <p className="font-mono text-[13px] font-semibold text-ink-700">
        {formatDurationLabel(duracaoTotalMin)}
      </p>
    </div>
  );
}

export function GroupedRailTimeColumn({ horaInicio, horaFim, duracaoTotalMin, className = '' }) {
  const start = formatHmDisplay(horaInicio);
  const end = formatHmDisplay(horaFim);

  return (
    <div className={`shrink-0 pt-0.5 ${className}`}>
      <p
        className="whitespace-nowrap font-display text-base font-bold leading-tight text-ink-900"
        style={{ fontVariationSettings: '"wdth" 90' }}
      >
        {start}
        <span className="mx-0.5">→</span>
        {end}
      </p>
      <GroupedDurationBlock duracaoTotalMin={duracaoTotalMin} className="mt-1.5" />
    </div>
  );
}
