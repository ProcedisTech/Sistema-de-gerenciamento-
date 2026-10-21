/** Paleta fixa para marcadores de mapeamento com 12 famílias de cores estritamente distintas (sem duplicidade visual de vermelho ou teal). */
export const MAPEAMENTO_PALETA_CORES = [
  '#ef4444', // Vermelho vivo
  '#f97316', // Laranja
  '#eab308', // Amarelo âmbar
  '#84cc16', // Verde lima
  '#10b981', // Verde esmeralda
  '#06b6d4', // Ciano / Turquesa
  '#3b82f6', // Azul real
  '#6366f1', // Índigo
  '#a855f7', // Roxo / Púrpura
  '#ec4899', // Rosa vibrante
  '#d946ef', // Fúcsia / Magenta
  '#64748b', // Cinza ardósia / Grafite
];

export function hashUuid(str) {
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

/**
 * Retorna a cor preferencial do procedimento se estiver livre, ou a próxima cor
 * verdadeiramente livre da paleta caso a preferencial já esteja ocupada por outro procedimento no mapa.
 */
export function getCorLivreParaProcedimento(catalogoProcedimentoSaudeId, coresOcupadas) {
  const id = String(catalogoProcedimentoSaudeId || '').trim();
  const corPref = corParaProcedimento(id);
  
  const ocupadasSet =
    coresOcupadas instanceof Set
      ? coresOcupadas
      : new Set(
          Array.from(coresOcupadas || [])
            .map((c) => String(c || '').trim().toLowerCase())
            .filter(Boolean)
        );

  if (!ocupadasSet.has(corPref.toLowerCase())) {
    return corPref;
  }

  // Busca a próxima cor livre a partir do hash do procedimento
  const baseIdx = hashUuid(id) % MAPEAMENTO_PALETA_CORES.length;
  for (let i = 1; i < MAPEAMENTO_PALETA_CORES.length; i++) {
    const candidate = MAPEAMENTO_PALETA_CORES[(baseIdx + i) % MAPEAMENTO_PALETA_CORES.length];
    if (!ocupadasSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return corPref;
}
