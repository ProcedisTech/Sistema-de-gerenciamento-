import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { HEATMAP_WEEK_LABELS } from '../../utils/agendaDisponibilidadeBuilder.js';

const DIAS_SEMANA_CURTOS = HEATMAP_WEEK_LABELS;
const DIAS_SEMANA_LONGOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Tons próximos ao original — cheio neutro (não satura o AgendaBloqueioModal). */
const DENSITY_CLASS = {
  livre: 'bg-[#7DD4B0] text-[#04342C] hover:opacity-90',
  parcial: 'bg-[#C9EFE1] text-[#0F6E56] hover:opacity-90',
  cheio: 'bg-white text-ink-400 border-[0.5px] border-ink-200',
  neutral: 'bg-transparent text-ink-400',
};

const LEGEND_BASE = [
  { key: 'livre', label: 'Livre', swatch: 'bg-[#7DD4B0] ring-1 ring-[#7DD4B0]/40' },
  { key: 'parcial', label: 'Parcial', swatch: 'bg-[#C9EFE1] ring-1 ring-[#0F6E56]/20' },
  { key: 'cheio', label: 'Cheio', swatch: 'bg-white ring-1 ring-ink-200' },
  { key: 'neutral', label: 'Sem expediente', swatch: 'bg-transparent ring-1 ring-ink-200 opacity-40' },
];

const LEGEND_FECHADO = {
  key: 'fechado',
  label: 'Fechado',
  swatch:
    'bg-[repeating-linear-gradient(-45deg,#e5e7eb,#e5e7eb_2px,#f9fafb_2px,#f9fafb_6px)] ring-1 ring-ink-200',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

const FECHADO_HATCH =
  'bg-[repeating-linear-gradient(-45deg,#e5e7eb,#e5e7eb_2px,#f3f4f6_2px,#f3f4f6_6px)] text-ink-400';

function toLocalDateIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDataPorExtenso(iso) {
  if (!iso) return '';
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatMinutosLabel(min) {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function cellAriaLabel(cell, labelExtenso, isSelecionado, selectedTimeLabel) {
  const partes = [labelExtenso];
  if (cell.fechado) {
    partes.push('fechado');
  } else if (cell.isPast) {
    partes.push('passado');
  } else if (!cell.clickable && cell.vagas === 0 && cell.duracaoPretendida) {
    partes.push(`não comporta ${cell.duracaoPretendida} minutos`);
  } else if (cell.density === 'cheio') {
    partes.push('cheio');
  } else if (cell.density === 'parcial') {
    partes.push('parcialmente ocupado');
  } else if (cell.density === 'livre') {
    partes.push('livre');
  }
  if (typeof cell.vagas === 'number' && cell.vagas > 0) {
    partes.push(`${cell.vagas} vaga${cell.vagas !== 1 ? 's' : ''}`);
  }
  if (isSelecionado && selectedTimeLabel) {
    partes.push(`selecionado ${selectedTimeLabel}`);
  } else if (isSelecionado) {
    partes.push('selecionado');
  }
  return partes.join(', ');
}

function cellTitle(cell) {
  if (!cell.inCurrentMonth) return undefined;
  const partes = [];
  if (cell.fechado) {
    partes.push('Fechado — sem expediente');
  } else if (typeof cell.maiorJanelaLivreMinutos === 'number' && cell.maiorJanelaLivreMinutos > 0) {
    partes.push(`Maior janela livre: ${formatMinutosLabel(cell.maiorJanelaLivreMinutos)}`);
  }
  if (typeof cell.vagas === 'number') {
    if (cell.vagas > 0) {
      partes.push(`${cell.vagas} encaixe${cell.vagas !== 1 ? 's' : ''}`);
    } else if (cell.duracaoPretendida) {
      partes.push(`Não comporta ${cell.duracaoPretendida} min`);
    }
  }
  return partes.length ? partes.join(' · ') : undefined;
}

function cellButtonClass(cell, diaSelecionado) {
  // flex-col ok no FormModal (altura definida + linhasAutomaticas). No bloqueio o
  // colapso vinha de minmax(0,1fr) sem altura de linha mínima — ver gridStyle.
  const base = `relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-semibold transition-all ${FOCUS_RING}`;

  if (!cell.inCurrentMonth) {
    return `${base} pointer-events-none invisible`;
  }

  const isSelecionado = Boolean(diaSelecionado && cell.iso === diaSelecionado);

  // Precedência: fechado / !clickable / passado ANTES de selecionado
  if (cell.fechado) {
    return `${base} ${FECHADO_HATCH} cursor-not-allowed opacity-70`;
  }

  if (cell.isPast || !cell.clickable) {
    return `${base} ${DENSITY_CLASS.neutral} cursor-not-allowed opacity-40`;
  }

  if (isSelecionado) {
    return `${base} cursor-pointer bg-[#0f766e] text-white ring-2 ring-[#14B8A6] shadow-md`;
  }

  if (cell.density === 'neutral') {
    return `${base} text-ink-700 hover:bg-vivid-teal-50 hover:text-vivid-teal-700 cursor-pointer`;
  }

  const density = DENSITY_CLASS[cell.density] || DENSITY_CLASS.neutral;
  return `${base} ${density} cursor-pointer`;
}

function countWeeksInHeatmap(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return 6;
  const inMonth = cells.filter((c) => c?.inCurrentMonth);
  if (inMonth.length === 0) return 6;
  const rows = Math.ceil(cells.length / 7) || 6;
  let used = 0;
  for (let r = 0; r < rows; r += 1) {
    const slice = cells.slice(r * 7, r * 7 + 7);
    if (slice.some((c) => c?.inCurrentMonth)) used += 1;
  }
  return Math.min(6, Math.max(4, used || 6));
}

/**
 * Calendário mensal do modal de agenda — densidade via `heatmap` (buildMonthHeatmap).
 *
 * @param {boolean} [linhasAutomaticas=false] — se true, usa N semanas reais (só AgendaFormModal).
 * @param {boolean} [showFechadoLegend=false] — inclui item "Fechado" na legenda (só FormModal).
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
  showDensityLegend = true,
  linhasAutomaticas = false,
  selectedTimeLabel = null,
  showVagasCount = false,
  compactChrome = false,
  showFechadoLegend = false,
}) {
  const hoje = useMemo(() => toLocalDateIso(new Date()), []);

  const monthLabel = heatmap?.monthLabel || '';

  const weekRows =
    linhasAutomaticas && heatmap?.cells
      ? countWeeksInHeatmap(heatmap.cells)
      : 6;

  const diasSemana = compactChrome ? DIAS_SEMANA_CURTOS : DIAS_SEMANA_LONGOS;

  const legendItems = showFechadoLegend
    ? [LEGEND_BASE[0], LEGEND_BASE[1], LEGEND_BASE[2], LEGEND_FECHADO, LEGEND_BASE[3]]
    : LEGEND_BASE;

  function handleDiaClick(cell) {
    if (!cell.inCurrentMonth || !cell.clickable || cell.isPast || cell.fechado) return;
    onSelecionarDia?.(cell.iso);
  }

  const showSkeleton = showDensityLegend && loading && !heatmap;
  const showError = showDensityLegend && Boolean(error) && !showSkeleton;
  const showGrid = heatmap && !showError;

  // Com altura indefinida (ex.: bloqueio min-h-[280px] sem flex), minmax(0,1fr)
  // colapsa para o min do conteúdo (~14px com leading-none). Exigir min de linha.
  const gridStyle = linhasAutomaticas
    ? { gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }
    : { gridTemplateRows: 'repeat(6, minmax(2.75rem, 1fr))' };

  const navBtnClass = compactChrome
    ? `inline-flex h-6 w-6 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-0 text-ink-500 hover:bg-ink-100 hover:text-ink-800 ${FOCUS_RING} disabled:opacity-40`
    : `inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800 ${FOCUS_RING} disabled:opacity-40`;

  const chevronClass = compactChrome ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col select-none">
      {compactChrome ? (
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <span className="font-display text-base font-black capitalize text-ink-900">
            {monthLabel || '—'}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onPrevMonth}
              disabled={!onPrevMonth}
              className={navBtnClass}
              aria-label="Mês anterior"
            >
              <ChevronLeft className={chevronClass} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              disabled={!onNextMonth}
              className={navBtnClass}
              aria-label="Próximo mês"
            >
              <ChevronRight className={chevronClass} aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={!onPrevMonth}
            className={navBtnClass}
            aria-label="Mês anterior"
          >
            <ChevronLeft className={chevronClass} aria-hidden />
          </button>

          <span className="font-display text-lg font-black capitalize text-ink-900 sm:text-xl">
            {monthLabel || '—'}
          </span>

          <button
            type="button"
            onClick={onNextMonth}
            disabled={!onNextMonth}
            className={navBtnClass}
            aria-label="Próximo mês"
          >
            <ChevronRight className={chevronClass} aria-hidden />
          </button>
        </div>
      )}

      <div className="mb-1 grid shrink-0 grid-cols-7 gap-1">
        {diasSemana.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className={`py-0.5 text-center font-bold uppercase tracking-wider text-[#6b7280] ${
              compactChrome ? 'text-[12px]' : 'text-[10px] sm:text-[11px]'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {showSkeleton ? (
        <div
          className="grid min-h-0 flex-1 grid-cols-7 gap-1"
          style={gridStyle}
        >
          {Array.from({ length: weekRows * 7 }).map((_, i) => (
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
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-vivid-teal-700 hover:bg-vivid-teal-50 ${FOCUS_RING}`}
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : showGrid ? (
        <div
          className={`grid min-h-0 flex-1 grid-cols-7 gap-1 ${loading ? 'opacity-60' : ''}`}
          style={gridStyle}
          role="grid"
          aria-label={`Calendário ${monthLabel}`}
        >
          {(linhasAutomaticas
            ? heatmap.cells.slice(0, weekRows * 7)
            : heatmap.cells
          ).map((cell) => {
            if (!cell.inCurrentMonth) {
              return <div key={cell.iso} aria-hidden className="min-h-0" />;
            }

            const isToday = cell.iso === hoje;
            const isSelecionado = diaSelecionado === cell.iso;
            const labelExtenso = formatDataPorExtenso(cell.iso);
            const showTimeOnSelected = isSelecionado && selectedTimeLabel && cell.clickable;
            const showVagas =
              showVagasCount &&
              !isSelecionado &&
              !cell.fechado &&
              !cell.isPast &&
              typeof cell.vagas === 'number' &&
              cell.vagas > 0;

            return (
              <button
                key={cell.iso}
                type="button"
                role="gridcell"
                disabled={!cell.clickable}
                title={cellTitle(cell)}
                aria-label={cellAriaLabel(cell, labelExtenso, isSelecionado, selectedTimeLabel)}
                aria-selected={isSelecionado}
                onClick={() => handleDiaClick(cell)}
                className={cellButtonClass(cell, diaSelecionado)}
              >
                {cell.fechado ? (
                  <>
                    <span className="text-[11px] leading-none">{cell.day}</span>
                    <span className="text-[8px] font-medium uppercase leading-none tracking-wide opacity-80">
                      fechado
                    </span>
                  </>
                ) : showTimeOnSelected ? (
                  <>
                    <span className="text-[11px] leading-none opacity-90">{cell.day}</span>
                    <span className="text-[10px] font-bold leading-none">{selectedTimeLabel}</span>
                  </>
                ) : (
                  <>
                    <span className="leading-none">{cell.day}</span>
                    {showVagas ? (
                      <span className="text-[8px] font-medium leading-none opacity-80">
                        {cell.vagas} vaga{cell.vagas !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </>
                )}
                {isToday && !isSelecionado && !cell.fechado ? (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#14B8A6]" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-[#6b7280]">
          Carregando calendário…
        </div>
      )}

      {showDensityLegend && (
        <footer className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium text-[#6b7280]">
          {legendItems.map((item) => (
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
