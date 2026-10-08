import { corParaProcedimento, MAPEAMENTO_PALETA_CORES } from '../../../constants/mapeamentoPaletaCores.js';

/** Converte marcacoes do DTO da API (mapaOverlay / MapaResponse) em lista plana para o overlay. */
export function marcacoesApiToOverlayPontos(marcacoes) {
  if (!Array.isArray(marcacoes)) return [];
  const procIdToIndex = new Map();
  return marcacoes.map((m, idx) => {
    const vertices = Array.isArray(m.vertices)
      ? m.vertices.map((v) => ({
          posX: Number(v.posX ?? v.x),
          posY: Number(v.posY ?? v.y),
          ordem: v.ordem,
        }))
      : [];
    const first = vertices[0];
    const catId = m.catalogoId || m.catalogoProcedimentoSaudeId || null;
    let cor = m.corHex || m.cor || (catId ? corParaProcedimento(catId) : null);
    if (!cor && m.mapaProcedimentoId) {
      const pid = String(m.mapaProcedimentoId);
      if (!procIdToIndex.has(pid)) {
        procIdToIndex.set(pid, procIdToIndex.size);
      }
      cor = MAPEAMENTO_PALETA_CORES[procIdToIndex.get(pid) % MAPEAMENTO_PALETA_CORES.length];
    }
    const finalCor = cor || MAPEAMENTO_PALETA_CORES[0];
    return {
      localId: m.id != null ? String(m.id) : `api_${idx}`,
      id: m.id != null ? String(m.id) : `api_${idx}`,
      tipoGeometria: m.tipoGeometria || 'ponto',
      quantidade: m.quantidade,
      tamanho: m.tamanho,
      cor: finalCor,
      vertices,
      posX: first?.posX,
      posY: first?.posY,
      catalogoId: catId,
      nomeProcedimento: m.nomeProcedimento || '',
    };
  });
}
