/** Converte marcacoes do DTO da API (mapaOverlay / MapaResponse) em lista plana para o overlay. */
export function marcacoesApiToOverlayPontos(marcacoes) {
  if (!Array.isArray(marcacoes)) return [];
  return marcacoes.map((m, idx) => {
    const vertices = Array.isArray(m.vertices)
      ? m.vertices.map((v) => ({
          posX: Number(v.posX ?? v.x),
          posY: Number(v.posY ?? v.y),
          ordem: v.ordem,
        }))
      : [];
    const first = vertices[0];
    return {
      localId: m.id != null ? String(m.id) : `api_${idx}`,
      id: m.id != null ? String(m.id) : `api_${idx}`,
      tipoGeometria: m.tipoGeometria || 'ponto',
      quantidade: m.quantidade,
      tamanho: m.tamanho,
      vertices,
      posX: first?.posX,
      posY: first?.posY,
      catalogoId: m.catalogoId || m.catalogoProcedimentoSaudeId || null,
      nomeProcedimento: m.nomeProcedimento || '',
    };
  });
}
