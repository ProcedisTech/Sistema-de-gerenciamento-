import { corParaProcedimento, MAPEAMENTO_PALETA_CORES } from '../../../constants/mapeamentoPaletaCores.js';

/** Converte marcacoes do DTO da API (mapaOverlay / MapaResponse) em lista plana para o overlay. */
export function marcacoesApiToOverlayPontos(marcacoes, procedimentos = []) {
  if (!Array.isArray(marcacoes)) return [];
  const procIdToIndex = new Map();
  const procMap = new Map();
  if (Array.isArray(procedimentos)) {
    for (const p of procedimentos) {
      if (p?.id != null) {
        procMap.set(String(p.id), p);
      }
      if (p?.catalogoProcedimentoSaudeId != null) {
        procMap.set(String(p.catalogoProcedimentoSaudeId), p);
      }
      if (p?.procedimentoId != null) {
        procMap.set(String(p.procedimentoId), p);
      }
    }
  }

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
    const mapaProcId = m.mapaProcedimentoId != null ? String(m.mapaProcedimentoId) : null;
    const proc = (mapaProcId ? procMap.get(mapaProcId) : null) || (catId ? procMap.get(String(catId)) : null);

    let cor = m.corHex || m.cor || proc?.corHex || (catId ? corParaProcedimento(catId) : null);
    if (!cor && mapaProcId) {
      if (!procIdToIndex.has(mapaProcId)) {
        procIdToIndex.set(mapaProcId, procIdToIndex.size);
      }
      cor = MAPEAMENTO_PALETA_CORES[procIdToIndex.get(mapaProcId) % MAPEAMENTO_PALETA_CORES.length];
    }
    const COR_PADRAO_AVALIACAO = '#3b82f6';
    const finalCor = cor || COR_PADRAO_AVALIACAO;
    const nomeProcedimento = m.nomeProcedimento || proc?.catalogoNome || proc?.nome || proc?.nomeProcedimento || 'Avaliação';

    const resolvedPosX =
      first?.posX ??
      (m.posX != null ? Number(m.posX) : (m.x != null ? Number(m.x) : null));
    const resolvedPosY =
      first?.posY ??
      (m.posY != null ? Number(m.posY) : (m.y != null ? Number(m.y) : null));

    return {
      localId: m.localId != null ? String(m.localId) : (m.id != null ? String(m.id) : `api_${idx}`),
      id: m.id != null ? String(m.id) : `api_${idx}`,
      tipoGeometria: m.tipoGeometria || (vertices.length > 1 ? 'traco' : 'ponto'),
      quantidade: m.quantidade,
      tamanho: m.tamanho,
      cor: finalCor,
      vertices,
      posX: resolvedPosX,
      posY: resolvedPosY,
      catalogoId: catId,
      mapaProcedimentoId: mapaProcId,
      nomeProcedimento,
      ordemPonto: m.ordemPonto || idx + 1,
      unidadeMedida: proc?.unidade || m.unidadeMedida || 'u',
    };
  });
}
