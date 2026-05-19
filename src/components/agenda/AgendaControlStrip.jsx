import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3, UserX, XCircle, Zap } from 'lucide-react';
import { ALL_STATUS_FILTERS } from '../../utils/agendaDayInsights.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { AgendaFilterChip } from './AgendaFilterChip.jsx';

const STATUS_CHIPS = [
  {
    key: 'confirmado',
    label: 'Confirmado',
    swatch: 'bg-status-ok',
    active: 'border-status-ok bg-status-ok text-white',
    iconType: 'dot',
  },
  {
    key: 'pendente',
    label: 'Pendente',
    swatch: 'bg-status-warn',
    active: 'border-status-warn bg-status-warn text-white',
    Icon: Clock3,
    iconIdleClass: 'text-status-warn-ink',
  },
  {
    key: 'cancelado',
    label: 'Cancelado',
    swatch: 'bg-status-danger',
    active: 'border-status-danger bg-status-danger text-white',
    Icon: XCircle,
    iconIdleClass: 'text-status-danger-ink',
  },
  {
    key: 'noshow',
    label: 'No-show',
    swatch: 'bg-status-noshow',
    active: 'border-status-noshow bg-status-noshow text-white',
    Icon: UserX,
    iconIdleClass: 'text-status-noshow-ink',
  },
];

function formatNextValue(nextAppointment) {
  if (!nextAppointment) return '—';
  const time = String(nextAppointment.horaInicio || '').slice(0, 5);
  const name = nextAppointment.pacienteNome || 'Paciente';
  return time ? `${time} · ${name}` : name;
}

function renderStatusIcon(chip, active) {
  if (chip.iconType === 'dot') {
    return (
      <span
        className={`h-3.5 w-3.5 shrink-0 rounded-full ${active ? 'bg-white' : chip.swatch}`}
        aria-hidden
      />
    );
  }

  const Icon = chip.Icon;
  return (
    <Icon
      className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : chip.iconIdleClass}`}
      strokeWidth={2.2}
      aria-hidden
    />
  );
}

export function AgendaControlStrip({
  statusFilters,
  onToggleStatus,
  onToggleAll,
  statusCounts,
  nextAppointment = null,
  firstFilterRef,
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [tooltipChipKey, setTooltipChipKey] = useState(null);
  const tooltipTimerRef = useRef(null);
  const allActive = statusFilters.size === ALL_STATUS_FILTERS.size;

  const handleStatusChipTap = useCallback(
    (key) => {
      onToggleStatus(key);
      if (!isMobile) return;
      clearTimeout(tooltipTimerRef.current);
      setTooltipChipKey(key);
      tooltipTimerRef.current = setTimeout(() => setTooltipChipKey(null), 1500);
    },
    [isMobile, onToggleStatus],
  );

  useEffect(() => () => clearTimeout(tooltipTimerRef.current), []);

  return (
    <section
      className="grid shrink-0 grid-cols-1 gap-3 rounded-2xl border border-ink-200 bg-white p-2.5 shadow-agenda-sm max-lg:grid-cols-1 lg:grid-cols-[1fr_auto] lg:items-center lg:px-3.5 lg:py-2.5"
      aria-label="Filtros e próximo atendimento"
    >
      <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
        <AgendaFilterChip
          ref={firstFilterRef}
          variant="all"
          label="Todos"
          count={statusCounts?.all ?? 0}
          active={allActive}
          onClick={onToggleAll}
          compactMobile={isMobile}
        />
        <span className="hidden h-5 w-px shrink-0 bg-ink-200 lg:block" aria-hidden />
        {STATUS_CHIPS.map((chip) => {
          const { key, label, swatch, active } = chip;
          const isActive = statusFilters.has(key);
          return (
            <AgendaFilterChip
              key={key}
              label={label}
              count={statusCounts?.[key] ?? 0}
              active={isActive}
              onClick={() => handleStatusChipTap(key)}
              swatchClassName={swatch}
              activeClassName={active}
              compactMobile={isMobile}
              icon={isMobile ? renderStatusIcon(chip, isActive) : null}
              showTooltip={isMobile && tooltipChipKey === key}
              tooltipLabel={label}
            />
          );
        })}
      </div>

      <div className="hidden items-center gap-3 border-t-0 pt-0 lg:flex lg:pl-4">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-status-ok-bg text-vivid-teal-700"
          aria-hidden
        >
          <Zap className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Próximo
          </p>
          <p
            className="truncate font-display text-base font-bold leading-tight text-ink-900"
            style={{ fontVariationSettings: '"wdth" 90' }}
          >
            {formatNextValue(nextAppointment)}
          </p>
        </div>
      </div>
    </section>
  );
}
