import { procedureOccurredInstantIso } from '../../utils/patientProfileDerivedDates.js';

/** DD/MM/AAAA (label pt-BR) → ms UTC local; ignora linhas inválidas. */
export function ddMmYyyyLabelToMs(s) {
  if (!s || s === '-') return 0;
  const parts = String(s).trim().split('/');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts.map((n) => parseInt(n, 10));
  if (!y || !m || !d) return 0;
  const t = new Date(y, m - 1, d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Ordem para timeline: mais recente primeiro (API usa `criadoEm`/`procedureOccurredInstantIso`;
 * previews legadas podem só ter campo `data` DD/MM).
 */
export function procedureSortInstantMs(proc) {
  if (!proc || typeof proc !== 'object') return 0;
  const iso = procedureOccurredInstantIso(proc);
  if (iso) {
    const ms = new Date(iso).getTime();
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

/** Lista achatada: raiz (depth 0) seguida dos retornos (depth 1). */
export function flattenNestedTimelineRoots(forest) {
  const out = [];
  for (const root of forest || []) {
    out.push({ proc: root, depth: 0 });
    for (const child of root.retornos || []) {
      out.push({ proc: child, depth: 1 });
    }
  }
  return out;
}
