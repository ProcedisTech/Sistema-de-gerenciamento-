import { procedureOccurredInstantIso } from '../../utils/patientProfileDerivedDates.js';
import { instanteMs, parseDataCalendario } from '../../utils/datasClinica.js';

/** DD/MM/AAAA (label pt-BR) → ms do dia de calendário (meia-noite UTC), só para ordenar; inválido → 0. */
export function ddMmYyyyLabelToMs(s) {
  if (!s || s === '-') return 0;
  const p = parseDataCalendario(String(s).trim());
  if (!p) return 0;
  return Date.UTC(p.ano, p.mes - 1, p.dia);
}

/**
 * Ordem para timeline: mais recente primeiro (API usa `criadoEm`/`procedureOccurredInstantIso`;
 * previews legadas podem só ter campo `data` DD/MM).
 */
export function procedureSortInstantMs(proc) {
  if (!proc || typeof proc !== 'object') return 0;
  const iso = procedureOccurredInstantIso(proc);
  if (iso) {
    const ms = instanteMs(iso);
    if (!Number.isNaN(ms)) return ms;
  }
  const rawData = proc.data != null ? String(proc.data).trim() : '';
  if (rawData && rawData !== '—' && rawData !== '-') {
    return ddMmYyyyLabelToMs(rawData);
  }
  return 0;
}

export function sortProcedimentosPorCriadoEmDesc(items) {
  const arr = Array.isArray(items) ? [...items] : [];
  arr.sort((a, b) => procedureSortInstantMs(b) - procedureSortInstantMs(a));
  return arr;
}

/** Raízes (sem origem) com filhos retorno aninhados, ordenadas desc. */
export function nestProcedimentosTimeline(items) {
  const arr = Array.isArray(items) ? items : [];
  const byId = new Map(arr.map((p) => [String(p.id), { ...p, retornos: [] }]));
  const roots = [];

  for (const p of arr) {
    const node = byId.get(String(p.id));
    if (!node) continue;
    const origemId = p.procedimentoFeitoOrigemId ?? p.procedimento_feito_origem_id;
    if (origemId != null && String(origemId).trim() !== '') {
      const parent = byId.get(String(origemId));
      if (parent) parent.retornos.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (n) => {
    n.retornos.sort((a, b) => procedureSortInstantMs(b) - procedureSortInstantMs(a));
    n.retornos.forEach(sortChildren);
  };

  roots.sort((a, b) => procedureSortInstantMs(b) - procedureSortInstantMs(a));
  roots.forEach(sortChildren);
  return roots;
}

/** Lista achatada: raiz (depth 0) seguida recursivamente de cada retorno aninhado. */
export function flattenNestedTimelineRoots(forest) {
  const out = [];
  const walk = (node, depth) => {
    out.push({ proc: node, depth });
    for (const child of node.retornos || []) {
      walk(child, depth + 1);
    }
  };
  for (const root of forest || []) {
    walk(root, 0);
  }
  return out;
}
