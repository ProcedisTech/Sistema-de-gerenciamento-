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
        if (fid) {
          fotoGaleriaId = String(fid);
          fotoGaleriaIdPorVista[vistaCodigo] = fotoGaleriaId;
        }
      } catch (e) {
        erros.push(`Upload foto ${vistaCodigo}: ${mapApiErrorMessage(e)}`);
        continue;
      }
    }

    const pontosRaw = Array.isArray(pontosPorVista[vistaCodigo]) ? pontosPorVista[vistaCodigo] : [];
    const pontos = pontosRaw.map((p) => mapLocalPontoToApi(p));

    // TODO: A fotoGaleriaId deveria ser enviada na marcacao, mas o backend vincula a foto do ângulo de outra forma
    // ou na verdade a fotoGaleriaId não está sendo salva no novo banco tb_mapa. 
    // Como a migration de fotosGaleriaId ainda não existe no tb_mapa, 
    // a gente pode salvar a foto no antigo por retrocompatibilidade se necessário, ou só fazer upload.
    // O backend cria o Mapa. Por enquanto o upload é feito e salvo no pacienteGaleria.

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
