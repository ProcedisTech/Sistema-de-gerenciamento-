import { pacientesGaleriaApi, procedimentosApi } from '../services/api.js';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from './pacienteGaleria.js';
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
  const dataRef = new Date().toISOString().slice(0, 10);
  const opts = {
    dataReferencia: dataRef,
    legenda: formatGaleriaLegendaForUpload(
      GALERIA_CATEGORIA.MODELO,
      getVistaLabel(vistaCodigo) || vistaCodigo,
    ),
    procedimentoFeitoId: String(procedimentoFeitoId),
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
 */
export async function persistirMapaAplicacao({
  pacienteId,
  roleUserId,
  procedimentoFeitoId,
  catalogoProcedimentoSaudeId,
  snapshot,
  dirtyVistasOnly = true,
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

  let vistas = Array.isArray(raw.dirtyVistas) ? [...raw.dirtyVistas] : [];
  if (!dirtyVistasOnly || vistas.length === 0) {
    const set = new Set(vistas);
    Object.keys(fotosPorVista).forEach((v) => set.add(v));
    Object.keys(pontosPorVista).forEach((v) => set.add(v));
    Object.keys(fotoGaleriaIdPorVista).forEach((v) => set.add(v));
    vistas = Array.from(set);
  }

  if (!vistas.length) {
    return { ok: true, erros: [] };
  }

  for (const vista of vistas) {
    const vistaCodigo = String(vista || '').trim();
    if (!vistaCodigo) continue;

    const foto = fotosPorVista[vistaCodigo];
    let fotoGaleriaId = fotoGaleriaIdPorVista[vistaCodigo] || foto?.fotoGaleriaId || null;

    if (!fotoGaleriaId && foto?.blob) {
      try {
        const fid = await uploadModeloFoto({
          pacienteId,
          roleUserId,
          blob: foto.blob,
          vistaCodigo,
          procedimentoFeitoId,
          catalogoProcedimentoSaudeId,
        });
        if (fid) fotoGaleriaId = String(fid);
      } catch (e) {
        erros.push(`Upload foto ${vistaCodigo}: ${mapApiErrorMessage(e)}`);
        continue;
      }
    }

    const pontosRaw = Array.isArray(pontosPorVista[vistaCodigo]) ? pontosPorVista[vistaCodigo] : [];
    const pontos = pontosRaw.map((p) => mapLocalPontoToApi(p));

    if (!fotoGaleriaId && pontos.length === 0) continue;

    try {
      await procedimentosApi.salvarPontos(procedimentoFeitoId, vistaCodigo, {
        fotoGaleriaId: fotoGaleriaId || null,
        pontos,
      });
    } catch (e) {
      erros.push(`${getVistaLabel(vistaCodigo) || vistaCodigo}: ${mapApiErrorMessage(e)}`);
    }
  }

  return { ok: erros.length === 0, erros };
}
