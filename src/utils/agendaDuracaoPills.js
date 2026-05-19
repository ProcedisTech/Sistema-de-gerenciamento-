export const DURACOES_PILL = Object.freeze([30, 60, 90, 120]);

/** Mapeia duração legada para a pill mais próxima (D-PR2-2). */
export function snapDuracaoToPill(min) {
  const x = Number(min);
  if (!Number.isFinite(x)) return 60;
  if (x < 45) return 30;
  if (x < 75) return 60;
  if (x < 105) return 90;
  return 120;
}
