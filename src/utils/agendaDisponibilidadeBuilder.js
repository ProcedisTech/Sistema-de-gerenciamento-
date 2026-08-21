import { buildCalendarCells, formatMonthYearLabel, toLocalDateIso } from './agendaDateUtils.js';
import {
  AGENDA_SLOT_STEP_MIN,
  getBrasiliaNow,
  intervalsOverlap,
  minutesToHhmm,
  parseHhmmToMinutes,
  segmentsForDayIso,
} from './agendaAvailability.js';
import {
  commercialWindowsForIso,
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

/**
 * Subtrai segmentos ocupados das janelas de expediente → intervalos livres.
 * @returns {Array<{startMin: number, endMin: number}>}
 */
export function freeWindowsFromOccupied(windows, segments) {
  let free = (windows || [])
    .filter((w) => w && w.endMin > w.startMin)
    .map((w) => ({ startMin: w.startMin, endMin: w.endMin }));

  for (const seg of segments || []) {
    if (!seg || seg.endMin <= seg.startMin) continue;
    const next = [];
    for (const w of free) {
      if (seg.endMin <= w.startMin || seg.startMin >= w.endMin) {
        next.push(w);
        continue;
      }
      if (seg.startMin > w.startMin) {
        next.push({ startMin: w.startMin, endMin: Math.min(seg.startMin, w.endMin) });
      }
      if (seg.endMin < w.endMin) {
        next.push({ startMin: Math.max(seg.endMin, w.startMin), endMin: w.endMin });
      }
    }
    free = next.filter((w) => w.endMin > w.startMin);
  }
  return free;
}

/**
 * Conta inícios (passo 30) que comportam `duracaoMin` e a maior janela livre.
 * @returns {{ vagas: number, maiorJanelaLivreMinutos: number }}
 */
export function countFitsInFreeWindows(freeWindows, duracaoMin, stepMin = AGENDA_SLOT_STEP_MIN) {
  const dur = Math.max(1, Number(duracaoMin) || stepMin);
  const step = Math.max(1, Number(stepMin) || AGENDA_SLOT_STEP_MIN);
  let vagas = 0;
  let maiorJanelaLivreMinutos = 0;
  for (const w of freeWindows || []) {
    const len = w.endMin - w.startMin;
    if (len > maiorJanelaLivreMinutos) maiorJanelaLivreMinutos = len;
    for (let t = w.startMin; t + dur <= w.endMin; t += step) {
      vagas += 1;
    }
  }
  return { vagas, maiorJanelaLivreMinutos };
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
  duracaoPretendida,
}) {
  const baseCells = buildCalendarCells(monthDate);
  const today = String(todayIso || toLocalDateIso()).slice(0, 10);
  const segOpts = { profissionalRoleUserId, excludeAgendaId };
  const fitDur =
    duracaoPretendida != null && Number(duracaoPretendida) > 0
      ? Number(duracaoPretendida)
      : null;

  const cells = baseCells.map((cell) => {
    const windows = getDayWindowsForIso(cell.iso, disponibilidade);
    const isPast = cell.iso < today;
    const hasWindows = windows.length > 0;
    const fechado = cell.inCurrentMonth && !hasWindows && !isPast;

    let density = 'neutral';
    let vagas = null;
    let maiorJanelaLivreMinutos = null;

    if (cell.inCurrentMonth && hasWindows && !isPast) {
      const segments = segmentsForDayIso(dtos, cell.iso, segOpts);
      const totalAvail = totalWindowMinutes(windows);
      const occupied = occupiedMinutesInWindows(segments, windows);
      const ratio = totalAvail > 0 ? occupied / totalAvail : 1;
      density = densityFromRatio(ratio);

      if (fitDur != null) {
        const free = freeWindowsFromOccupied(windows, segments);
        const fit = countFitsInFreeWindows(free, fitDur);
        vagas = fit.vagas;
        maiorJanelaLivreMinutos = fit.maiorJanelaLivreMinutos;
      }
    }

    // fitDur definido ⇒ vagas é número (0+); null só quando não há filtro de duração
    const fitsDuration = fitDur == null || (typeof vagas === 'number' && vagas > 0);
    const clickable =
      cell.inCurrentMonth && hasWindows && !isPast && fitsDuration;

    return {
      ...cell,
      isPast,
      clickable,
      density,
      fechado,
      vagas,
      maiorJanelaLivreMinutos,
      duracaoPretendida: fitDur,
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
 * Grade mensal neutra (sem densidade) — modo "qualquer profissional".
 * Mesmo shape de saída que buildMonthHeatmap para CalendarioMensal.
 * @param {object} params
 * @returns {{ monthLabel: string, weekLabels: string[], cells: Array }}
 */
export function buildNeutralMonthHeatmap({ monthDate, todayIso, selectedIso }) {
  const today = String(todayIso || toLocalDateIso()).slice(0, 10);
  const cells = buildCalendarCells(monthDate).map((cell) => {
    const isPast = cell.iso < today;
    return {
      ...cell,
      isPast,
      density: 'neutral',
      fechado: false,
      vagas: null,
      maiorJanelaLivreMinutos: null,
      duracaoPretendida: null,
      clickable: cell.inCurrentMonth && !isPast,
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
 * @returns {{ headerTitle: string, expedienteLabel: string, dayStartMin: number, dayEndMin: number, isFallback: boolean, windows: Array, slots: Array }}
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
  selectedRangeFimSlot,
  stepMin = AGENDA_SLOT_STEP_MIN,
  todayIso: customTodayIso,
  currentBrasiliaMinutes: customCurrentMin,
}) {
  if (!iso) {
    return {
      headerTitle: '',
      expedienteLabel: '',
      dayStartMin: 0,
      dayEndMin: 0,
      isFallback: false,
      windows: [],
      slots: [],
    };
  }

  const real = getDayWindowsForIso(iso, disponibilidade);
  let isFallback = false;
  let windows = real;
  if (real.length === 0) {
    windows = commercialWindowsForIso(iso);
    isFallback = Boolean(profissionalRoleUserId);
  }
  const { dayStartMin, dayEndMin } = dayBoundsFromWindows(windows);
  const dur = Number(duracaoMin) || AGENDA_SLOT_STEP_MIN;
  const step = Math.max(5, Number(stepMin) || AGENDA_SLOT_STEP_MIN);
  const segOpts = { profissionalRoleUserId, excludeAgendaId };
  const segments = segmentsForDayIso(dtos, iso, segOpts);

  const brasiliaNow = getBrasiliaNow();
  const todayIso = customTodayIso || brasiliaNow.todayIso;
  const currentBrasiliaMinutes = customCurrentMin != null ? customCurrentMin : brasiliaNow.currentMinutes;

  const selectedHm = String(selectedFormHora || '').slice(0, 5);
  const selectedMin =
    selectedFormIso === iso && selectedHm ? parseHhmmToMinutes(selectedHm) : null;
  const selectedFimHm = String(selectedRangeFimSlot || '').slice(0, 5);
  const selectedFimMin =
    selectedFormIso === iso && selectedFimHm ? parseHhmmToMinutes(selectedFimHm) : null;

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

    const isPast = iso < todayIso || (iso === todayIso && t < currentBrasiliaMinutes);

    if (isPast) {
      state = 'passado';
      observacao = 'horário já passou';
    } else if (
      selectedMin != null &&
      selectedFimMin != null &&
      t < selectedFimMin &&
      t + step >= selectedMin
    ) {
      state = 'selecionado';
    } else if (selectedMin != null && selectedFimMin == null && t === selectedMin) {
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
    isFallback,
    windows,
    slots,
  };
}
