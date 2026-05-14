/**
 * @param {string} str
 * @returns {string}
 */
export function normalizeForSearch(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * @param {{ nome: string }} profissao
 * @param {string} query
 */
export function matchesSearch(profissao, query) {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return normalizeForSearch(profissao.nome).includes(q);
}

/**
 * Agrupa lista plana por categoria, preservando ordem de primeira aparição de cada categoria.
 * @param {Array<{ categoria?: string }>} profissoes
 * @returns {Array<{ categoria: string, items: Array<unknown> }>}
 */
export function groupByCategoria(profissoes) {
  const list = Array.isArray(profissoes) ? profissoes : [];
  const order = [];
  const map = new Map();
  for (const p of list) {
    const cat = String(p?.categoria ?? '').trim() || '—';
    if (!map.has(cat)) {
      order.push(cat);
      map.set(cat, []);
    }
    map.get(cat).push(p);
  }
  return order.map((categoria) => ({ categoria, items: map.get(categoria) ?? [] }));
}
