import { parseHhmmToMinutes } from './agendaAvailability.js';

function parseIsoLocal(iso) {
  const s = String(iso || '').slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Janelas de expediente do dia (minutos desde meia-noite).
 * @param {string} iso YYYY-MM-DD
 * @param {Array<{diaSemana: number, horaInicio: string, horaFim: string, ativo?: boolean}>} disponibilidade
 * @returns {Array<{startMin: number, endMin: number}>}
 */
export function getDayWindowsForIso(iso, disponibilidade) {
  if (!iso || !Array.isArray(disponibilidade)) return [];
  const date = parseIsoLocal(iso);
  if (Number.isNaN(date.getTime())) return [];
  const diaSemana = date.getDay();
  const slotsDia = disponibilidade.filter(
    (d) => Number(d?.diaSemana) === diaSemana && d?.ativo !== false
  );
  const windows = [];
  for (const s of slotsDia) {
    const inicio = String(s?.horaInicio || '').slice(0, 5);
    const fim = String(s?.horaFim || '').slice(0, 5);
    if (!inicio || !fim) continue;
    const startMin = parseHhmmToMinutes(inicio);
    const endMin = parseHhmmToMinutes(fim);
    if (endMin > startMin) windows.push({ startMin, endMin });
  }
  return mergeMinuteWindows(windows);
}

/** Seg–Sex: 07:00–18:00 (visual apenas, profissional zerado). */
export const COMMERCIAL_WEEKDAY_WINDOW = Object.freeze({ startMin: 7 * 60, endMin: 18 * 60 });

/** Sábado: 08:00–14:00 (visual apenas). */
export const COMMERCIAL_SATURDAY_WINDOW = Object.freeze({ startMin: 8 * 60, endMin: 14 * 60 });

export function commercialWindowsForIso(iso) {
  const date = parseIsoLocal(iso);
  if (Number.isNaN(date.getTime())) return [];
  const dow = date.getDay();
  if (dow === 0) return [];
  if (dow === 6) return [{ ...COMMERCIAL_SATURDAY_WINDOW }];
  return [{ ...COMMERCIAL_WEEKDAY_WINDOW }];
}

/**
 * Janelas do dia para renderização de slots.
 * Se há disponibilidade real → retorna getDayWindowsForIso.
 * Se zerado → janelas comerciais visuais (sem persistir).
 *
 * @param {string} iso YYYY-MM-DD
 * @param {Array<{diaSemana: number, horaInicio: string, horaFim: string, ativo?: boolean}>} disponibilidade
 * @returns {{ windows: Array<{startMin: number, endMin: number}>, isFallback: boolean }}
 */
export function getDayWindowsWithFallback(iso, disponibilidade) {
  const real = getDayWindowsForIso(iso, disponibilidade);
  if (real.length > 0) {
    return { windows: real, isFallback: false };
  }
  return { windows: commercialWindowsForIso(iso), isFallback: true };
}

/** Une intervalos sobrepostos ou adjacentes. */
export function mergeMinuteWindows(windows) {
  const list = (Array.isArray(windows) ? windows : [])
    .filter((w) => w && w.endMin > w.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  if (list.length === 0) return [];
  const merged = [{ ...list[0] }];
  for (let i = 1; i < list.length; i += 1) {
    const cur = list[i];
    const last = merged[merged.length - 1];
    if (cur.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, cur.endMin);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function totalWindowMinutes(windows) {
  return (windows || []).reduce((sum, w) => sum + (w.endMin - w.startMin), 0);
}

export function dayBoundsFromWindows(windows) {
  if (!windows?.length) return { dayStartMin: 0, dayEndMin: 0 };
  return {
    dayStartMin: Math.min(...windows.map((w) => w.startMin)),
    dayEndMin: Math.max(...windows.map((w) => w.endMin)),
  };
}

/** Comprimento da interseção de [aStart,aEnd) com união de windows. */
export function intersectLengthWithWindows(aStart, aEnd, windows) {
  let total = 0;
  for (const w of windows || []) {
    const s = Math.max(aStart, w.startMin);
    const e = Math.min(aEnd, w.endMin);
    if (e > s) total += e - s;
  }
  return total;
}

/** Soma de interseções de vários segmentos com as janelas (sem dupla contagem por segmento). */
export function occupiedMinutesInWindows(segments, windows) {
  let total = 0;
  for (const seg of segments || []) {
    total += intersectLengthWithWindows(seg.startMin, seg.endMin, windows);
  }
  return total;
}

export function intervalWithinWindows(startMin, endMin, windows) {
  const len = endMin - startMin;
  if (len <= 0) return false;
  let covered = 0;
  for (const w of windows || []) {
    const s = Math.max(startMin, w.startMin);
    const e = Math.min(endMin, w.endMin);
    if (e > s) covered += e - s;
    if (covered >= len) return true;
  }
  return false;
}

export function formatExpedienteLabel(windows) {
  const merged = mergeMinuteWindows(windows);
  if (!merged.length) return '';
  const { dayStartMin, dayEndMin } = dayBoundsFromWindows(merged);
  const pad = (n) => {
    const h = Math.floor(n / 60);
    const m = n % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return `Expediente ${pad(dayStartMin)} às ${pad(dayEndMin)}`;
}
