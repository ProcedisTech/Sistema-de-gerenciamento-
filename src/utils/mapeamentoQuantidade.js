/** Σ quantidade de uma lista de pontos (mesma lógica do card PontosResumoPanel). */
export function somaQuantidadeListaPontos(pontos) {
  return (pontos || []).reduce((s, p) => s + (Number(p.quantidade) || 0), 0);
}

/** Σ quantidade total de um procedimento em todas as vistas. */
export function somaQuantidadeProcedimento(pontosPorVista) {
  let total = 0;
  Object.values(pontosPorVista || {}).forEach((lista) => {
    total += somaQuantidadeListaPontos(lista);
  });
  return total;
}

/** Contagem de pontos mapeados de um procedimento (todas as vistas). */
export function contaPontosProcedimento(pontosPorVista) {
  let n = 0;
  Object.values(pontosPorVista || {}).forEach((lista) => {
    n += Array.isArray(lista) ? lista.length : 0;
  });
  return n;
}
