/** Tamanho-base do marcador de mapeamento (diâmetro em px quando tamanho = 1.0). */
export const MARKER_BASE_SIZE_PX = 14;

/** Área clicável (diâmetro em px) — maior que o círculo visível para touch/tablet. */
export const MARKER_HIT_AREA_PX = 36;

export const TAMANHO_MIN = 0.5;
export const TAMANHO_MAX = 2.0;
export const TAMANHO_DEFAULT = 1.0;

/** NULL/undefined/inválido → 1.0; clamp entre TAMANHO_MIN e TAMANHO_MAX. */
export function normalizeTamanho(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return TAMANHO_DEFAULT;
  return Math.min(TAMANHO_MAX, Math.max(TAMANHO_MIN, n));
}

/** Diâmetro visual em px = base × multiplicador normalizado. */
export function markerSizePx(tamanho) {
  return MARKER_BASE_SIZE_PX * normalizeTamanho(tamanho);
}

/** Sufixo de unidade na etiqueta do marcador (catálogo futuro pode substituir). */
export const UNIDADE_PADRAO = 'u';

/** Ex.: 1.5 → "1.5u", 2 → "2u". Sufixo vem só de UNIDADE_PADRAO. */
export function formatQuantidadeEtiqueta(quantidade) {
  const n = Number(quantidade);
  if (!Number.isFinite(n) || n <= 0) return `0${UNIDADE_PADRAO}`;
  const texto = Number.isInteger(n) ? String(n) : String(n);
  return `${texto}${UNIDADE_PADRAO}`;
}
