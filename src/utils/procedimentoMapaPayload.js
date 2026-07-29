import { normalizeTamanho } from '../constants/mapeamentoMarcador.js';
import { normalizeUnidadeMedida, getPassoFallback } from '../constants/quantidadePresets.js';
import { mapApiPontoToLocal } from '../components/hooks/useMapeamentoFacialState.js';

let localIdSeq = 0;
function nextLocalId() {
  localIdSeq += 1;
  return `ep_${Date.now()}_${localIdSeq}`;
}

export function mapLocalPontoToApi(p) {
  const row = {
    posX: p.posX != null ? Number(p.posX) : undefined,
    posY: p.posY != null ? Number(p.posY) : undefined,
    quantidade: Number(p.quantidade),
    tamanho: normalizeTamanho(p.tamanho),
    tipoGeometria: p.tipoGeometria || 'ponto',
    vertices: Array.isArray(p.vertices) ? p.vertices.map((v, idx) => ({ ordem: idx + 1, posX: Number(v.posX ?? v.x), posY: Number(v.posY ?? v.y) })) : []
  };
  if (p.regiaoFacial != null && String(p.regiaoFacial).trim()) {
    row.regiaoFacial = String(p.regiaoFacial).trim();
  }
  return row;
}

export function mapExecucaoApiPontoToLocal(apiPonto, ordem) {
  const base = mapApiPontoToLocal(apiPonto, ordem);
  return {
    ...base,
    localId: apiPonto?.procedimentoPontoId
      ? String(apiPonto.procedimentoPontoId)
      : nextLocalId(),
  };
}

/**
 * true se a resposta do GET de mapa carrega marcações e/ou vínculos de foto por vista.
 * Usado por hydrateFromApi para no-op quando o servidor não tem conteúdo (não destruir estado local).
 */
export function hasMapaHydrateContent(response) {
  if (response == null || typeof response !== 'object') return false;
  const marcacoes = Array.isArray(response.marcacoes) ? response.marcacoes : null;
  const pontos = Array.isArray(response.pontos) ? response.pontos : null;
  if (marcacoes?.length > 0 || pontos?.length > 0) return true;
  const fotos =
    response.fotoGaleriaIdPorVista || response.fotoGaleriaIdPorAngulo || {};
  if (fotos && typeof fotos === 'object' && Object.keys(fotos).length > 0) return true;
  return false;
}

/**
 * Normaliza GET /procedimentos/{id}/pontos para estado local do mapa.
 */
export function hydrateMapaFromGet(response) {
  const raw = response && typeof response === 'object' ? response : {};
  const unidadeMedida = normalizeUnidadeMedida(raw.unidadeMedida);
  const passo = getPassoFallback(unidadeMedida, raw.passo);
  const pontosPorVista = {};
  const fotoGaleriaIdPorVista = { ...(raw.fotoGaleriaIdPorVista || raw.fotoGaleriaIdPorAngulo || {}) };

  const lista = Array.isArray(raw.marcacoes) ? raw.marcacoes : (Array.isArray(raw.pontos) ? raw.pontos : []);

  lista.forEach((m, idx) => {
    const vista = String(m?.anguloFotoCodigo || m?.vista || '').trim();
    if (!vista) return;
    if (!pontosPorVista[vista]) pontosPorVista[vista] = [];

    // Adapter pattern
    let p = { ...m };
    if (m.vertices && m.vertices.length > 0) {
       p.posX = m.vertices[0].posX;
       p.posY = m.vertices[0].posY;
       p.procedimentoPontoId = m.id;
    }

    pontosPorVista[vista].push(mapExecucaoApiPontoToLocal(p, idx + 1));
  });

  Object.keys(fotoGaleriaIdPorVista).forEach((vista) => {
    const fid = fotoGaleriaIdPorVista[vista];
    if (fid && !pontosPorVista[vista]) pontosPorVista[vista] = [];
  });

  return {
    procedimentoFeitoId: raw.origemId || raw.procedimentoFeitoId || null,
    catalogoProcedimentoSaudeId: raw.catalogoProcedimentoSaudeId ?? null,
    unidadeMedida,
    passo,
    quantidadeTotalDerivada: Number(raw.quantidadeTotalDerivada) || 0,
    pontosPorVista,
    fotoGaleriaIdPorVista,
  };
}

export function buildGrupoPontosVista(pontos, catalogoId, nomeProcedimento) {
  const lista = Array.isArray(pontos) ? pontos : [];
  if (!lista.length) return [];
  return [
    {
      catalogoProcedimentoSaudeId: String(catalogoId || ''),
      nomeProcedimento: String(nomeProcedimento || ''),
      pontos: lista,
    },
  ];
}
