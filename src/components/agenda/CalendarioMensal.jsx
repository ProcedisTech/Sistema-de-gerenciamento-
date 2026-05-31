import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DENSITY_CLASS = {
  livre: 'bg-[#7DD4B0] text-[#04342C] hover:opacity-90',
  parcial: 'bg-[#C9EFE1] text-[#0F6E56] hover:opacity-90',
  cheio: 'bg-white text-ink-400 border-[0.5px] border-ink-200',
  neutral: 'bg-transparent text-ink-400',
};

const LEGEND_ITEMS = [
  { key: 'livre', label: 'Livre', swatch: 'bg-[#7DD4B0] ring-1 ring-[#7DD4B0]/40' },
  { key: 'parcial', label: 'Parcial', swatch: 'bg-[#C9EFE1] ring-1 ring-[#0F6E56]/20' },
  { key: 'cheio', label: 'Cheio', swatch: 'bg-white ring-1 ring-ink-200' },
  { key: 'neutral', label: 'Sem expediente', swatch: 'bg-transparent ring-1 ring-ink-200 opacity-40' },
];

function toLocalDateIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cellButtonClass(cell, diaSelecionado) {
  const base =
    'relative flex h-full min-h-0 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 focus-visible:ring-offset-1';

  if (!cell.inCurrentMonth) {
    return `${base} pointer-events-none invisible`;
  }

  const isSelecionado = Boolean(diaSelecionado && cell.iso === diaSelecionado);
  if (isSelecionado) {
    return `${base} cursor-pointer bg-vivid-teal-500 text-white ring-2 ring-vivid-teal-300 shadow-md`;
  }

  if (cell.isPast || !cell.clickable) {
    return `${base} ${DENSITY_CLASS.neutral} cursor-not-allowed opacity-40`;
  }

  const density = DENSITY_CLASS[cell.density] || DENSITY_CLASS.neutral;
  return `${base} ${density} cursor-pointer`;
}

/**
 * Calendário mensal do modal de agenda — densidade via `heatmap` (buildMonthHeatmap).
 * Não faz fetch próprio; mês e dados vêm do `useAgendaPage`.
 */
export function CalendarioMensal({
  heatmap,
  loading = false,
  error = null,
  onPrevMonth,
  onNextMonth,
  onRetry,
  diaSelecionado,
  onSelecionarDia,
  noProfissional = false,
}) {
  const hoje = useMemo(() => toLocalDateIso(new Date()), []);

  const monthLabel = heatmap?.monthLabel || '';

  function handleDiaClick(cell) {
    if (!cell.inCurrentMonth || !cell.clickable || cell.isPast) return;
    onSelecionarDia?.(cell.iso);
  }

  const showSkeleton = loading && !heatmap;
  const showError = Boolean(error) && !showSkeleton;
  const showGrid = heatmap && !showError;

  return (
    <div className="flex min-h-0 flex-1 flex-col select-none">
      {/* Cabeçalho do mês */}
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          disabled={!onPrevMonth || noProfissional}
          className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 disabled:opacity-40"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="font-display text-lg font-black capitalize text-ink-900 sm:text-xl">
          {monthLabel || '—'}
        </span>

        <button
          type="button"
          onClick={onNextMonth}
          disabled={!onNextMonth || noProfissional}
          className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 disabled:opacity-40"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="mb-1 grid shrink-0 grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="py-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-ink-400 sm:text-[11px]"
          >
            {d}
          </div>
        ))}
      </div>

      {noProfissional ? (
        <div className="flex min-h-[12rem] flex-1 items-center justify-center rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
          Selecione um profissional para ver a disponibilidade do mês
        </div>
      ) : showSkeleton ? (
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="min-h-0 animate-pulse rounded-lg bg-ink-100" />
          ))}
        </div>
      ) : showError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <p className="text-sm text-ink-500">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-vivid-teal-700 hover:bg-vivid-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : showGrid ? (
        <div
          className={`grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1 ${loading ? 'opacity-60' : ''}`}
          role="grid"
          aria-label={`Calendário ${monthLabel}`}
        >
          {heatmap.cells.map((cell) => {
            if (!cell.inCurrentMonth) {
              return <div key={cell.iso} aria-hidden className="min-h-0" />;
            }

            const isToday = cell.iso === hoje;
            const isSelecionado = diaSelecionado === cell.iso;

            return (
              <button
                key={cell.iso}
                type="button"
                role="gridcell"
                disabled={!cell.clickable}
                aria-label={`${cell.day}`}
                aria-pressed={isSelecionado}
                onClick={() => handleDiaClick(cell)}
                className={cellButtonClass(cell, diaSelecionado)}
              >
                <span>{cell.day}</span>
                {isToday && !isSelecionado && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-vivid-teal-500" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-ink-400">
          Carregando calendário…
        </div>
      )}

      {/* Legenda */}
      {!noProfissional && (
        <footer className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium text-ink-500">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-sm ${item.swatch}`} />
              {item.label}
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}
