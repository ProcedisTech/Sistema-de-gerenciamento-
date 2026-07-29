import { pacientesGaleriaApi, mapasApi } from '../services/api.js';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from './pacienteGaleria.js';
import { toLocalISODate } from './dateLimits.js';
import { mapLocalPontoToApi } from './procedimentoMapaPayload.js';
import { getVistaLabel } from '../constants/vistasMapaAplicacao.js';

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
  catalogoProcedimentoSaudeId,
  snapshot,
}) {
  const erros = [];
  if (!procedimentoFeitoId) {
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
            procedimentoFeitoId,
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
      marcacoes.push({
        anguloFotoCodigo: vistaCodigo,
        tipoGeometria: pt.tipoGeometria || 'ponto',
        quantidade: pt.quantidade,
        tamanho: pt.tamanho,
        vertices: pt.vertices?.length ? pt.vertices : [{ ordem: 1, posX: pt.posX, posY: pt.posY }]
      });
    }
  }

  if (marcacoes.length > 0) {
    try {
      await mapasApi.salvar({
        origemTipo: 'procedimento',
        origemId: procedimentoFeitoId,
        fotoGaleriaIdPorVista,
        marcacoes
      });
    } catch (e) {
      erros.push(`Erro ao salvar mapa: ${mapApiErrorMessage(e)}`);
    }
  }

  return { ok: erros.length === 0, erros };
}
