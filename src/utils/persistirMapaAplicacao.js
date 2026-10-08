import { pacientesGaleriaApi, mapasApi } from '../services/api.js';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from './pacienteGaleria.js';
import { toLocalISODate } from './dateLimits.js';
import { mapLocalPontoToApi } from './procedimentoMapaPayload.js';
import { getVistaLabel } from '../constants/vistasMapaAplicacao.js';
import { corParaProcedimento, MAPEAMENTO_PALETA_CORES } from '../constants/mapeamentoPaletaCores.js';

function mapApiErrorMessage(e) {
  const msg = String(e?.message || '');
  const bodyMsg =
    e?.body && typeof e.body === 'object'
      ? String(e.body.message || e.body.detail || e.body.error || e.body.codigo || '')
      : '';
  const combined = `${msg} ${bodyMsg}`.trim();
  if (combined.includes('ANGULO_NAO_ENCONTRADO')) {
    return 'Vista inválida para o mapa de aplicação.';
  }
  if (e?.status === 422) {
    return bodyMsg || 'Dados inválidos (foto, quantidade ou posição).';
  }
  return msg || bodyMsg || 'Falha ao salvar mapa de aplicação.';
}

async function resolveCleanBlob(foto) {
  if (foto?.blob instanceof Blob) return foto.blob;
  if (!foto?.displayUrl) return null;
  try {
    const resp = await fetch(foto.displayUrl);
    if (!resp.ok) return null;
    return await resp.blob();
  } catch {
    return null;
  }
}

async function uploadModeloFoto({
  pacienteId,
  roleUserId,
  blob,
  vistaCodigo,
  procedimentoFeitoId,
  catalogoProcedimentoSaudeId,
}) {
  const file =
    blob instanceof File
      ? blob
      : new File([blob], `modelo_${vistaCodigo}_${Date.now()}.jpg`, {
        type: blob?.type || 'image/jpeg',
      });
  const dataRef = toLocalISODate(new Date());
  const opts = {
    dataReferencia: dataRef,
    legenda: formatGaleriaLegendaForUpload(
      GALERIA_CATEGORIA.MAPA,
      getVistaLabel(vistaCodigo) || vistaCodigo,
    ),
    procedimentoFeitoId: String(procedimentoFeitoId),
    tipoFotoCodigo: 'MAPA',
  };
  if (catalogoProcedimentoSaudeId) {
    opts.catalogoProcedimentoSaudeId = String(catalogoProcedimentoSaudeId);
  }
  if (roleUserId && /^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
    opts.roleUserId = String(roleUserId);
  }
  const res = await pacientesGaleriaApi.upload(pacienteId, file, opts);
  return (
    res?.id ??
    res?.pacienteGaleriaFotoId ??
    res?.fotoId ??
    res?.fotoGaleriaId ??
    null
  );
}

/**
 * Persiste mapa de aplicação por vista (PUT /procedimentos/{id}/pontos).
 * A galeria recebe sempre a foto LIMPA; marcações ficam só no DTO do mapa.
 */
export async function persistirMapaAplicacao({
  pacienteId,
  roleUserId,
  procedimentoFeitoId,
  procedimentoFeitoIds,
  catalogoProcedimentoSaudeId,
  snapshot,
  tipoMapaCodigo,
  procedimentosSessao = [],
}) {
  const erros = [];
  const listaProcedimentoIds = Array.isArray(procedimentoFeitoIds) && procedimentoFeitoIds.length > 0
    ? procedimentoFeitoIds.map(String)
    : (procedimentoFeitoId ? [String(procedimentoFeitoId)] : []);
  const mainPfId = listaProcedimentoIds[0] || procedimentoFeitoId;

  if (!mainPfId) {
    return { ok: false, erros: ['Procedimento ainda não registrado.'] };
  }
  if (!pacienteId) {
    return { ok: false, erros: ['Paciente sem ID no servidor.'] };
  }

  const raw = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const fotosPorVista = raw.fotosPorVista || {};
  const pontosPorVista = raw.pontosPorVista || {};
  const fotoGaleriaIdPorVista = { ...(raw.fotoGaleriaIdPorVista || {}) };

  const marcacoes = [];

  for (const vista of Object.keys(pontosPorVista)) {
    const vistaCodigo = String(vista || '').trim();
    if (!vistaCodigo) continue;

    const foto = fotosPorVista[vistaCodigo];
    let fotoGaleriaId = fotoGaleriaIdPorVista[vistaCodigo] || foto?.fotoGaleriaId || null;
    const pontosRaw = Array.isArray(pontosPorVista[vistaCodigo]) ? pontosPorVista[vistaCodigo] : [];

    const jaTemFotoDoMapa = Boolean(fotoGaleriaIdPorVista[vistaCodigo]);

    if (!jaTemFotoDoMapa && !fotoGaleriaId) {
      try {
        const cleanBlob = await resolveCleanBlob(foto);
        if (cleanBlob) {
          const fid = await uploadModeloFoto({
            pacienteId,
            roleUserId,
            blob: cleanBlob,
            vistaCodigo,
            procedimentoFeitoId: mainPfId,
            catalogoProcedimentoSaudeId,
          });
          if (fid) {
            fotoGaleriaId = String(fid);
            fotoGaleriaIdPorVista[vistaCodigo] = fotoGaleriaId;
          }
        }
      } catch (e) {
        erros.push(`Upload foto ${vistaCodigo}: ${mapApiErrorMessage(e)}`);
        continue;
      }
    }

    const pontos = pontosRaw.map((p) => mapLocalPontoToApi(p));

    for (const pt of pontos) {
      let pIdx = pt.procedimentoIndex;
      if (pIdx == null) {
        // Tenta associar por procedimentoId / procedimentoFeitoId na lista enviada
        if (pt.procedimentoFeitoId || pt.procedimentoId) {
          const targetId = String(pt.procedimentoFeitoId || pt.procedimentoId);
          const matchedIdx = listaProcedimentoIds.findIndex((id) => String(id) === targetId);
          if (matchedIdx >= 0) pIdx = matchedIdx;
        }
        // Se ainda não achou, tenta pelo catálogo contra a lista de procedimentos
        if (pIdx == null && (pt.catalogoProcedimentoSaudeId || pt.catalogoId) && Array.isArray(procedimentosSessao)) {
          const ptCat = String(pt.catalogoProcedimentoSaudeId || pt.catalogoId);
          const foundProc = procedimentosSessao.find((p) => {
            const cid = p.catalogoProcedimentoSaudeId || p.catalogoId || p.nomeProcedimentoCatalogoId || p.id;
            return cid && String(cid) === ptCat;
          });
          if (foundProc) {
            const procId = String(foundProc.id || foundProc.procedimentoFeitoId);
            const matchedIdx = listaProcedimentoIds.findIndex((id) => String(id) === procId);
            if (matchedIdx >= 0) {
              pIdx = matchedIdx;
            } else {
              const directIdx = procedimentosSessao.indexOf(foundProc);
              if (directIdx >= 0 && directIdx < listaProcedimentoIds.length) {
                pIdx = directIdx;
              }
            }
          }
        }
      }

      // Se a sessão só tem 1 procedimento, associa com 0 por padrão
      if (pIdx == null && listaProcedimentoIds.length === 1) {
        pIdx = 0;
      }

      if (pIdx != null && (pIdx < 0 || pIdx >= listaProcedimentoIds.length)) {
        erros.push(`Marcação com índice de procedimento fora de faixa: ${pIdx}`);
        continue;
      }

      if (pIdx == null && listaProcedimentoIds.length > 1) {
        erros.push('Marcação sem procedimento associado na sessão com múltiplos procedimentos.');
        continue;
      }

      const procDoPonto = Array.isArray(procedimentosSessao) ? procedimentosSessao[pIdx] : null;
      const catDoPonto = pt.catalogoProcedimentoSaudeId || pt.catalogoId || procDoPonto?.catalogoProcedimentoSaudeId || procDoPonto?.catalogoId || (pIdx === 0 ? catalogoProcedimentoSaudeId : undefined);
      const corDoPonto = pt.cor || pt.corHex || procDoPonto?.corHex || (catDoPonto ? corParaProcedimento(catDoPonto) : undefined) || MAPEAMENTO_PALETA_CORES[pIdx % MAPEAMENTO_PALETA_CORES.length];

      marcacoes.push({
        anguloFotoCodigo: vistaCodigo,
        tipoGeometria: pt.tipoGeometria || 'ponto',
        quantidade: pt.quantidade,
        tamanho: pt.tamanho,
        procedimentoIndex: pIdx,
        corHex: corDoPonto || undefined,
        catalogoProcedimentoSaudeId: catDoPonto || undefined,
        vertices: pt.vertices?.length ? pt.vertices : [{ ordem: 1, posX: pt.posX, posY: pt.posY }]
      });
    }
  }

  if (marcacoes.length > 0) {
    try {
      const payloadSalvar = {
        origemTipo: 'procedimento',
        origemId: mainPfId,
        procedimentos: listaProcedimentoIds.map((id, idx) => {
          const proc = (Array.isArray(procedimentosSessao)
            ? (procedimentosSessao.find((p) => String(p.id || p.procedimentoFeitoId) === String(id)) || procedimentosSessao[idx])
            : null);
          const catId = proc?.catalogoProcedimentoSaudeId || proc?.catalogoId || proc?.nomeProcedimentoCatalogoId || (idx === 0 ? catalogoProcedimentoSaudeId : null);
          const cor = proc?.corHex || (catId ? corParaProcedimento(catId) : null) || MAPEAMENTO_PALETA_CORES[idx % MAPEAMENTO_PALETA_CORES.length];
          return {
            procedimentoFeitoId: id,
            procedimentoIndex: idx,
            ordem: idx + 1,
            ...(catId ? { catalogoProcedimentoSaudeId: catId } : {}),
            corHex: cor,
            ...(proc?.planejamentoItemId ? { planejamentoItemId: proc.planejamentoItemId } : {}),
          };
        }),
        fotoGaleriaIdPorVista,
        marcacoes,
      };
      if (tipoMapaCodigo) {
        payloadSalvar.tipoMapaCodigo = tipoMapaCodigo;
      }
      await mapasApi.salvar(payloadSalvar);
    } catch (e) {
      erros.push(`Erro ao salvar mapa: ${mapApiErrorMessage(e)}`);
    }
  }

  return { ok: erros.length === 0, erros };
}
