import { buildCalendarCells, formatMonthYearLabel, toLocalDateIso } from './agendaDateUtils.js';
import {
  AGENDA_SLOT_STEP_MIN,
  intervalsOverlap,
  minutesToHhmm,
  parseHhmmToMinutes,
  segmentsForDayIso,
} from './agendaAvailability.js';
import {
  dayBoundsFromWindows,
  formatExpedienteLabel,
  getDayWindowsForIso,
  intervalWithinWindows,
  occupiedMinutesInWindows,
  totalWindowMinutes,
} from './disponibilidadeDayWindows.js';

export const HEATMAP_WEEK_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function densityFromRatio(ratio) {
  if (ratio <= 0.3) return 'livre';
  if (ratio <= 0.7) return 'parcial';
  return 'cheio';
}

export function abbreviatePatientName(nome) {
  const parts = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function segmentAtSlot(segments, slotStart, slotEnd) {
  for (const seg of segments) {
    if (intervalsOverlap(slotStart, slotEnd, seg.startMin, seg.endMin)) return seg;
  }
  return null;
}

function formatDayHeaderTitle(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/**
 * @param {object} params
 * @returns {{ monthLabel: string, weekLabels: string[], cells: Array }}
 */
export function buildMonthHeatmap({
  monthDate,
  disponibilidade,
  dtos,
  todayIso,
  excludeAgendaId,
  profissionalRoleUserId,
  selectedIso,
}) {
  const baseCells = buildCalendarCells(monthDate);
  const today = String(todayIso || toLocalDateIso()).slice(0, 10);
  const segOpts = { profissionalRoleUserId, excludeAgendaId };

  const cells = baseCells.map((cell) => {
    const windows = getDayWindowsForIso(cell.iso, disponibilidade);
    const isPast = cell.iso < today;
    const hasWindows = windows.length > 0;

    let density = 'neutral';
    if (cell.inCurrentMonth && hasWindows && !isPast) {
      const segments = segmentsForDayIso(dtos, cell.iso, segOpts);
      const totalAvail = totalWindowMinutes(windows);
      const occupied = occupiedMinutesInWindows(segments, windows);
      const ratio = totalAvail > 0 ? occupied / totalAvail : 1;
      density = densityFromRatio(ratio);
    }

    const clickable = cell.inCurrentMonth && hasWindows && !isPast;

    return {
      ...cell,
      isPast,
      clickable,
      density,
      isSelected: Boolean(selectedIso && cell.iso === selectedIso),
    };
  });

  return {
    monthLabel: formatMonthYearLabel(monthDate),
    weekLabels: HEATMAP_WEEK_LABELS,
    cells,
  };
}

/**
 * @returns {{ headerTitle: string, expedienteLabel: string, dayStartMin: number, dayEndMin: number, slots: Array }}
 */
export function buildDaySlotList({
  iso,
  disponibilidade,
  dtos,
  duracaoMin,
  excludeAgendaId,
  profissionalRoleUserId,
  selectedFormIso,
  selectedFormHora,
  stepMin = AGENDA_SLOT_STEP_MIN,
}) {
  if (!iso) {
    return {
      headerTitle: '',
      expedienteLabel: '',
      dayStartMin: 0,
      dayEndMin: 0,
      slots: [],
    };
  }

  const windows = getDayWindowsForIso(iso, disponibilidade);
  const { dayStartMin, dayEndMin } = dayBoundsFromWindows(windows);
  const dur = Number(duracaoMin) || 45;
  const step = Math.max(5, Number(stepMin) || AGENDA_SLOT_STEP_MIN);
  const segOpts = { profissionalRoleUserId, excludeAgendaId };
  const segments = segmentsForDayIso(dtos, iso, segOpts);

  const selectedHm = String(selectedFormHora || '').slice(0, 5);
  const selectedMin =
    selectedFormIso === iso && selectedHm ? parseHhmmToMinutes(selectedHm) : null;

  const slots = [];

  for (let t = dayStartMin; t < dayEndMin; t += step) {
    const blockEnd = t + step;
    if (!intervalWithinWindows(t, blockEnd, windows)) continue;

    const proposedEnd = t + dur;
    const canStart =
      t <= dayEndMin - dur &&
      intervalWithinWindows(t, proposedEnd, windows) &&
      !segmentAtSlot(segments, t, proposedEnd);

    const hhmm = minutesToHhmm(t);
    let state = 'livre';
    let label = '';
    let sublabel = '';
    let observacao = '';
    let agendaId;

    if (selectedMin != null && t === selectedMin) {
      state = 'selecionado';
    } else {
      const hit = segmentAtSlot(segments, t, blockEnd);
      if (hit) {
        if (hit.kind === 'bloqueio') {
          state = 'bloqueio';
          observacao =
            (hit.dto?.observacao && String(hit.dto.observacao).trim()) ||
            hit.dto?.catalogoProcedimentoNome ||
            'Bloqueio';
        } else {
          state = 'ocupado';
          label = abbreviatePatientName(hit.dto?.pacienteNome);
          sublabel =
            hit.dto?.catalogoProcedimentoNome?.trim() ||
            (hit.dto?.observacao && String(hit.dto.observacao).trim()) ||
            '';
          agendaId = hit.dto?.id != null ? String(hit.dto.id) : undefined;
        }
      }
    }

    if (
      state === 'livre' &&
      selectedMin != null &&
      t > selectedMin &&
      t < selectedMin + dur
    ) {
      state = 'previewOcupacao';
    }

    const clickable = state === 'selecionado' || (state === 'livre' && canStart);

    slots.push({
      startMin: t,
      endMin: blockEnd,
      hhmm,
      state,
      clickable,
      label,
      sublabel,
      observacao,
      agendaId,
    });
  }

  return {
    headerTitle: formatDayHeaderTitle(iso),
    expedienteLabel: formatExpedienteLabel(windows),
    dayStartMin,
    dayEndMin,
    slots,
  };
}
