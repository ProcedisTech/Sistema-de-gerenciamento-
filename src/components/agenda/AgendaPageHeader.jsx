import { formatGreetingLine, formatSubtitleForDay } from '../../utils/agendaDayInsights.js';

export function AgendaPageHeader({
  userDisplayName = '',
  selectedDay,
  todayIso,
  selectedDayCount = 0,
  nextAppointment = null,
  onScrollToNext,
}) {
  const isToday = selectedDay === todayIso;
  const greeting = formatGreetingLine(userDisplayName);
  const subtitle = formatSubtitleForDay({
    selectedDay,
    todayIso,
    appointmentCount: selectedDayCount,
    isToday,
  });

  const nextLabel =
    nextAppointment && isToday
      ? `Próximo: ${String(nextAppointment.horaInicio || '').slice(0, 5)} · ${nextAppointment.pacienteNome || 'Paciente'}`
      : null;

  return (
    <header className="flex shrink-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-xl font-black leading-tight text-[#1A1A2E] sm:text-2xl">
          {greeting}
        </h2>
      </div>
      <p className="text-sm font-medium text-slate-600">{subtitle}</p>
      {nextLabel ? (
        <button
          type="button"
          onClick={onScrollToNext}
          className="w-fit text-left text-sm font-semibold text-brand-primaryDark underline-offset-2 transition-colors duration-150 hover:text-brand-primary hover:underline"
        >
          {nextLabel} ▸
        </button>
      ) : null}
    </header>
  );
}
