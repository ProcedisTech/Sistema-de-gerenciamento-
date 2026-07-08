import React from 'react';
import { MapPin } from 'lucide-react';
import { AGENDA_SELECTED_SURFACE } from './agendaSelectionStyles.js';
import { useNowClock } from './hooks/useNowClock.js';

const VIEW_OPTIONS = [
  { mode: 'grid', label: 'Mês' },
  { mode: 'semana', label: 'Semana' },
  { mode: 'list', label: 'Lista' },
];

function ViewToggle({ viewMode, onChangeViewMode, onSyncWeekFromSelection }) {
  return (
    <div
      className="inline-flex shrink-0 rounded-xl border border-ink-200 bg-white p-1"
      role="group"
      aria-label="Modo de visualização"
    >
      {VIEW_OPTIONS.map(({ mode, label }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (mode === 'semana' && typeof onSyncWeekFromSelection === 'function') {
                onSyncWeekFromSelection();
              }
              onChangeViewMode(mode);
            }}
            className={`h-9 min-w-[4.5rem] rounded-lg px-3 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2 ${
              active
                ? `${AGENDA_SELECTED_SURFACE} shadow-agenda-sm`
                : 'text-ink-700 hover:bg-ink-50'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function NowPill() {
  const clockLabel = useNowClock();

  return (
    <div
      className="hidden lg:inline-flex w-fit items-center gap-2 rounded-full bg-ink-900 py-[5px] pl-2 pr-2.5 text-sm text-white lg:py-1"
      aria-live="polite"
      aria-label={`Horário atual ${clockLabel}`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-vivid-teal-400 animate-agenda-live-pulse"
        aria-hidden
      />
      <span className="font-mono text-[13px] font-medium tabular-nums">{clockLabel}</span>
    </div>
  );
}

export function AgendaTopbar({
  clinicaNome = 'Procedi',
  profissionalNome = '',
  viewMode,
  onChangeViewMode,
  onSyncWeekFromSelection,
}) {
  const crumbClinica = String(clinicaNome || 'Procedi').trim() || 'Procedi';
  const crumbProf = String(profissionalNome || '').trim();
  const crumbText = crumbProf ? `${crumbClinica} · ${crumbProf}` : crumbClinica;

  return (
    <header className="flex shrink-0 flex-col gap-3 px-[22px] pt-[22px] lg:grid lg:grid-cols-[1fr_auto] lg:items-start lg:gap-4 lg:pt-3">
      <div className="flex min-w-0 flex-col gap-1 lg:gap-0.5">
        <h1
          className="font-display text-[28px] font-bold leading-tight text-ink-900 lg:text-[34px]"
          style={{ fontVariationSettings: '"wdth" 90' }}
        >
          Agenda
        </h1>
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-ink-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">{crumbText}</span>
        </p>
        <NowPill />
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end lg:pt-0">
        <ViewToggle
          viewMode={viewMode}
          onChangeViewMode={onChangeViewMode}
          onSyncWeekFromSelection={onSyncWeekFromSelection}
        />
      </div>
    </header>
  );
}
