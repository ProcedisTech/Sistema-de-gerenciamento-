import { formatWeekdayLong } from '../../utils/agendaDayInsights.js';

export function AgendaWeekStrip({ weekDayIsos, selectedDay, todayIso, appointmentsByDate, onSelectDay }) {
  if (!weekDayIsos?.length) return null;

  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-1 lg:hidden">
      {weekDayIsos.map((iso) => {
        const date = new Date(
          Number(iso.slice(0, 4)),
          Number(iso.slice(5, 7)) - 1,
          Number(iso.slice(8, 10)),
        );
        const dayNum = date.getDate();
        const weekday = formatWeekdayLong(iso).slice(0, 3);
        const isSelected = iso === selectedDay;
        const isToday = iso === todayIso;
        const count = (appointmentsByDate[iso] || []).length;

        return (
          <button
            key={iso}
            type="button"
            onClick={() => onSelectDay(iso)}
            className={`flex min-h-11 min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-all duration-150 ${
              isSelected
                ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                : isToday
                  ? 'border-brand-primaryDark/50 bg-brand-primaryGhost text-brand-primaryDark'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="text-[10px] font-bold uppercase opacity-80">{weekday}</span>
            <span className="text-base font-black leading-none">{dayNum}</span>
            {count > 0 ? (
              <span
                className={`mt-0.5 text-[9px] font-bold ${isSelected ? 'text-white/90' : 'text-brand-primaryDark'}`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
