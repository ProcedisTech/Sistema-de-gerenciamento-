import { instanteMs } from './datasClinica.js';

/**
 * Mais recente primeiro; sem ultimaVinda no fim.
 * Lote limitado no caller (size 50) — ranking global exige sort no backend.
 */
export function sortSemPlanoByUltimaVinda(patients) {
  const list = Array.isArray(patients) ? [...patients] : [];
  return list.sort((a, b) => {
    const ta = instanteMs(a?.ultimaVinda);
    const tb = instanteMs(b?.ultimaVinda);
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (aOk && bOk) return tb - ta;
    if (aOk) return -1;
    if (bOk) return 1;
    return 0;
  });
}
