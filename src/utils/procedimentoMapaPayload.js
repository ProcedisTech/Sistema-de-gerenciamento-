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
    posX: Number(p.posX),
    posY: Number(p.posY),
    quantidade: Number(p.quantidade),
    tamanho: normalizeTamanho(p.tamanho),
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
 * Normaliza GET /procedimentos/{id}/pontos para estado local do mapa.
 */
export function hydrateMapaFromGet(response) {
  const raw = response && typeof response === 'object' ? response : {};
  const unidadeMedida = normalizeUnidadeMedida(raw.unidadeMedida);
  const passo = getPassoFallback(unidadeMedida, raw.passo);
  const pontosPorVista = {};
  const fotoGaleriaIdPorVista = { ...(raw.fotoGaleriaIdPorAngulo || {}) };

  const lista = Array.isArray(raw.pontos) ? raw.pontos : [];
  lista.forEach((p, idx) => {
    const vista = String(p?.anguloFotoCodigo || p?.vista || '').trim();
    if (!vista) return;
    if (!pontosPorVista[vista]) pontosPorVista[vista] = [];
    pontosPorVista[vista].push(mapExecucaoApiPontoToLocal(p, idx + 1));
  });

  Object.keys(fotoGaleriaIdPorVista).forEach((vista) => {
    const fid = fotoGaleriaIdPorVista[vista];
    if (fid && !pontosPorVista[vista]) pontosPorVista[vista] = [];
  });

  return {
    procedimentoFeitoId: raw.procedimentoFeitoId ?? null,
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
