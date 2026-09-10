const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * Normaliza capitalização de nome completo de paciente (pt-BR).
 * Trim, colapsa espaços, title-case com partículas minúsculas (exceto se primeira palavra).
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizePatientName(value) {
  if (value == null) return null;
  const trimmed = String(value).trim().replace(/\s+/g, ' ');
  if (trimmed === '') return '';

  const words = trimmed.toLocaleLowerCase('pt-BR').split(' ');
  return words
    .map((word, index) => {
      if (index > 0 && PARTICLES.has(word)) return word;
      if (!word) return word;
      const first = word.charAt(0).toLocaleUpperCase('pt-BR');
      const rest = word.slice(1);
      return first + rest;
    })
    .join(' ');
}
