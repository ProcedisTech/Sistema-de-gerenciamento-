import { formatWeekdayLong } from '../../utils/agendaDayInsights.js';
import {
  formatHeroMonth,
  formatHeroWeekLine,
  getHeroIndicator,
  getHeroStats,
} from '../../utils/agendaRailHelpers.js';

const HERO_BG_STYLE = {
  backgroundImage: [
    'linear-gradient(165deg, oklch(0.14 0.04 185) 0%, oklch(0.30 0.09 176) 100%)',
    'radial-gradient(120% 90% at 110% -20%, oklch(0.72 0.16 172 / 0.55), transparent 55%)',
    'radial-gradient(80% 60% at -10% 120%, oklch(0.46 0.13 172 / 0.35), transparent 60%)',
  ].join(', '),
};

const GRAIN_STYLE = {
  backgroundImage: [
    'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.06) 0.5px, transparent 0.6px)',
    'radial-gradient(circle at 70% 60%, rgba(255,255,255,0.05) 0.5px, transparent 0.6px)',
    'radial-gradient(circle at 40% 80%, rgba(255,255,255,0.04) 0.5px, transparent 0.6px)',
  ].join(', '),
  opacity: 0.8,
};

export function AgendaDayRailHero({ selectedDay, todayIso, appointments, compact = false, dense = false }) {
  const isToday = selectedDay === todayIso;
  const weekday = formatWeekdayLong(selectedDay);
  const dayNum = selectedDay?.slice(8, 10) || '';
  const indicator = getHeroIndicator(appointments);
  const stats = getHeroStats(appointments);
  const useDense = dense && !compact;

  const daySizeClass = compact ? 'text-[64px]' : useDense ? 'text-[72px]' : 'text-[96px]';
  const glowSizeClass = compact ? 'h-[140px] w-[140px]' : useDense ? 'h-[180px] w-[180px]' : 'h-[220px] w-[220px]';
  const paddingClass = compact ? 'px-4 pb-4 pt-4' : useDense ? 'px-5 pb-4 pt-5' : 'px-6 pb-5 pt-[22px]';
  const indicatorClass = useDense ? 'text-[10px] px-2 py-1' : 'text-[11px] px-2.5 py-1.5';

  return (
    <header className="relative shrink-0 overflow-hidden text-white">
      <div className="absolute inset-0" style={HERO_BG_STYLE} aria-hidden />
      <div className="pointer-events-none absolute inset-0" style={GRAIN_STYLE} aria-hidden />
      <div
        className={`pointer-events-none absolute -right-8 -top-10 rounded-full opacity-90 blur-[2px] ${glowSizeClass}`}
        style={{
          background: 'radial-gradient(closest-side, oklch(0.80 0.14 172 / 0.55), transparent)',
        }}
        aria-hidden
      />

      <div className={`relative z-[1] ${paddingClass}`}>
        <div className="flex items-center gap-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/70">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full bg-vivid-teal-300 ${isToday ? 'animate-agenda-live-pulse' : ''}`}
            aria-hidden
          />
          <span>
            {weekday}
            {isToday ? ' · ao vivo' : ''}
          </span>
        </div>

        <div className="mt-3 flex items-end gap-3.5">
          <span
            className={`font-display font-extrabold leading-[0.86] text-white ${daySizeClass}`}
            style={{ fontVariationSettings: '"wdth" 90' }}
          >
            {Number(dayNum) || dayNum}
          </span>
          <div className="mb-1 flex min-w-0 flex-col">
            <span
              className={`font-display font-bold leading-tight ${useDense ? 'text-[20px]' : 'text-[22px]'}`}
              style={{ fontVariationSettings: '"wdth" 80' }}
            >
              {formatHeroMonth(selectedDay)}
            </span>
            <span className={`font-mono text-white/60 ${useDense ? 'text-[12px]' : 'text-[13px]'}`}>
              {formatHeroWeekLine(selectedDay)}
            </span>
          </div>
          <span
            className={`mb-2 ml-auto shrink-0 rounded-full border border-white/18 bg-white/12 font-mono text-white ${indicatorClass}`}
          >
            {indicator}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/14 pt-2.5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">Agendados</p>
            <p
              className="font-display text-[22px] font-bold text-white"
              style={{ fontVariationSettings: '"wdth" 88' }}
            >
              {stats.agendados}
              <small className="ml-1 font-sans text-[13px] font-normal text-white/62">
                sess{stats.agendados === 1 ? 'ão' : 'ões'}
              </small>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">Cancelados</p>
            <p
              className="font-display text-[22px] font-bold text-white"
              style={{ fontVariationSettings: '"wdth" 88' }}
            >
              {stats.cancelados}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
