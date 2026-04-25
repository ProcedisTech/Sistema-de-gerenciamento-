/**
 * Distância de Levenshtein (strings curtas; catálogo de procedimentos).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  const s = String(a ?? '');
  const t = String(b ?? '');
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = row[j];
      const cost = s.charCodeAt(i - 1) === t.charCodeAt(j - 1) ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

/**
 * Score 0–100: 100 = substring (target contém query); senão 50–99 por Levenshtein normalizado.
 * @param {string} query
 * @param {string} target
 * @returns {number}
 */
export function fuzzyMatch(query, target) {
  const q = String(query ?? '').trim().toLowerCase();
  const t = String(target ?? '').trim().toLowerCase();
  if (!q || !t) return 0;
  if (t.includes(q)) return 100;
  const dist = levenshtein(q, t);
  const maxLen = Math.max(q.length, t.length, 1);
  const raw = 100 - Math.round((50 * dist) / maxLen);
  return Math.min(99, Math.max(50, raw));
}

/**
 * @param {string} query
 * @param {{ id: string, nomeProcedimento: string }[]} catalogos
 * @param {number} [minScore=50]
 * @param {number} [limit=8]
 * @returns {{ id: string, nomeProcedimento: string, score: number }[]}
 */
export function filterCatalogos(query, catalogos, minScore = 50, limit = 8) {
  const list = Array.isArray(catalogos) ? catalogos : [];
  const q = String(query ?? '').trim();

  if (!q) {
    return list
      .map((c) => {
        const nomeProcedimento = String(c.nomeProcedimento ?? '').trim();
        if (!nomeProcedimento) return null;
        return { id: String(c.id ?? ''), nomeProcedimento, score: 100 };
      })
      .filter(Boolean)
      .sort((a, b) => a.nomeProcedimento.localeCompare(b.nomeProcedimento, 'pt-BR'));
  }

  const scored = list
    .map((c) => {
      const nomeProcedimento = String(c.nomeProcedimento ?? '').trim();
      if (!nomeProcedimento) return null;
      const score = fuzzyMatch(q, nomeProcedimento);
      return { id: String(c.id ?? ''), nomeProcedimento, score };
    })
    .filter(Boolean)
    .filter((x) => x.score >= minScore);
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.nomeProcedimento.localeCompare(b.nomeProcedimento, 'pt-BR');
  });
  return scored.slice(0, limit);
}
