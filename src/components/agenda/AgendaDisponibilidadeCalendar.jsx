import React from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';

const DENSITY_CLASS = {
  livre: 'bg-teal-50 text-gray-900 hover:bg-teal-100/80',
  parcial: 'bg-amber-100 text-gray-900 hover:bg-amber-200/70',
  cheio: 'bg-gray-200 text-gray-700',
  bloqueado: 'bg-red-100 text-gray-700',
  neutral: 'bg-transparent text-gray-400',
};

function cellButtonClass(cell) {
  const base =
    'relative flex h-8 w-full min-w-0 items-center justify-center rounded-lg text-[12px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/40 sm:h-9';
  if (!cell.inCurrentMonth) {
    return `${base} cursor-default bg-transparent text-transparent`;
  }
  if (cell.isPast || !cell.clickable) {
    return `${base} ${DENSITY_CLASS.neutral} cursor-not-allowed opacity-40`;
  }
  const density = DENSITY_CLASS[cell.density] || DENSITY_CLASS.neutral;
  const selected = cell.isSelected ? 'ring-2 ring-teal-600 ring-offset-1' : 'border border-transparent';
  return `${base} ${density} ${selected} cursor-pointer`;
}

export function AgendaDisponibilidadeCalendar({
  heatmap,
  loading,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onNextFree,
}) {
  if (!heatmap) return null;

  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[14px] font-bold text-gray-900">{heatmap.monthLabel}</h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-medium text-gray-500">Disponibilidade do mês</p>

      <div
        role="row"
        className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold text-gray-500"
      >
        {heatmap.weekLabels.map((label, i) => (
          <div key={`${label}-${i}`} role="columnheader" className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label={`Calendário ${heatmap.monthLabel}`}
        className={`grid grid-cols-7 gap-1 ${loading ? 'opacity-60' : ''}`}
      >
        {heatmap.cells.map((cell) => {
          if (!cell.inCurrentMonth) {
            return <div key={cell.iso} aria-hidden className="h-8 w-full sm:h-9" />;
          }
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              disabled={!cell.clickable}
              aria-label={`${cell.day}`}
              aria-selected={cell.isSelected}
              onClick={() => cell.clickable && onSelectDay(cell.iso)}
              className={cellButtonClass(cell)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNextFree}
        disabled={loading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[12px] font-bold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
      >
        <Zap className="h-3.5 w-3.5" aria-hidden />
        Próximo horário livre
      </button>

      <footer className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] font-medium text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-50 ring-1 ring-teal-200" /> Livre
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-100" /> Parcial
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-gray-200" /> Cheio
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-100" /> Bloq.
        </span>
      </footer>
    </section>
  );
}
