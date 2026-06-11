/**
 * Extrai mapa { planejamentoItemId → sessão } a partir do GET /planejamentos/{id}.
 * Usa a primeira sessão de cada item (1 sessão por item nesta fatia).
 */
export function sessoesMapFromDetalhe(detalhe) {
  const map = {};
  for (const item of detalhe?.itens ?? []) {
    const itemId = item.planejamentoItemId ?? item.id;
    const sessoes = item.sessoes ?? [];
    if (itemId && sessoes.length > 0) {
      map[String(itemId)] = sessoes[0];
    }
  }
  return map;
}
