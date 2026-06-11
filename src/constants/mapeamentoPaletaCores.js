/** Paleta fixa para marcadores de mapeamento (backend não persiste cor). */
export const MAPEAMENTO_PALETA_CORES = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#0f766e',
  '#dc2626',
];

function hashUuid(str) {
  const s = String(str || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function corParaProcedimento(catalogoProcedimentoSaudeId) {
  const id = String(catalogoProcedimentoSaudeId || '').trim();
  if (!id) return MAPEAMENTO_PALETA_CORES[0];
  const idx = hashUuid(id) % MAPEAMENTO_PALETA_CORES.length;
  return MAPEAMENTO_PALETA_CORES[idx];
}
