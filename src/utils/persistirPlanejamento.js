import { normalizeTamanho } from '../constants/mapeamentoMarcador.js';
import { pacientesGaleriaApi, planejamentosApi, mapasApi } from '../services/api.js';
import {
  formatGaleriaLegendaForUpload,
  GALERIA_CATEGORIA,
} from './pacienteGaleria.js';
import { toLocalISODate } from './dateLimits.js';

function toApiPonto(p, fotoGaleriaId) {
  const row = {
    posX: p.posX != null ? Number(p.posX) : undefined,
    posY: p.posY != null ? Number(p.posY) : undefined,
    quantidade: Number(p.quantidade),
    tamanho: normalizeTamanho(p.tamanho),
    tipoGeometria: p.tipoGeometria || 'ponto',
    vertices: Array.isArray(p.vertices) ? p.vertices.map(v => ({ posX: Number(v.posX || v.x), posY: Number(v.posY || v.y) })) : []
  };
  if (p.regiaoFacial != null && String(p.regiaoFacial).trim()) {
    row.regiaoFacial = String(p.regiaoFacial).trim();
  }
  if (fotoGaleriaId) {
    row.fotoGaleriaId = fotoGaleriaId;
  }
  return row;
}

async function uploadCaptureFoto(pacienteId, roleUserId, blob, vistaCodigo) {
  const file =
    blob instanceof File
      ? blob
      : new File([blob], `mapeamento_${vistaCodigo}_${Date.now()}.jpg`, {
          type: blob?.type || 'image/jpeg',
        });
  const dataRef = toLocalISODate(new Date());
  const opts = {
    dataReferencia: dataRef,
    legenda: formatGaleriaLegendaForUpload(GALERIA_CATEGORIA.PLANEJAMENTO, vistaCodigo),
    tipoFotoCodigo: 'PLANEJAMENTO',
  };
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
 * Persiste plano completo: POST plano (nasce ativo) → itens → pontos por vista.
 */

function isPlanoAtivoExistenteError(e) {
  const msg = String(e?.message || '');
  const bodyMsg =
    e?.body && typeof e.body === 'object'
      ? String(e.body.message || e.body.detail || e.body.error || '')
      : '';
  return (
    e?.status === 409 ||
    msg.includes('PLANO_ATIVO_EXISTENTE') ||
    msg.includes('PLANO_ATIVO_CONFLITO') ||
    bodyMsg.includes('PLANO_ATIVO_EXISTENTE') ||
    bodyMsg.includes('PLANO_ATIVO_CONFLITO')
  );
}
export async function persistirPlanejamento({
  pacienteId,
  roleUserId,
  observacao,
  procedimentosComPontos,
  fotosPorVista = {},
}) {
  const errosParciais = [];
  let planejamentoId = null;
  const itemIdByCatalogo = {};

  if (!pacienteId) {
    return { ok: false, planejamentoId: null, errosParciais: ['Paciente sem ID no servidor.'], etapaFalha: 'validacao' };
  }

  const procs = Array.isArray(procedimentosComPontos) ? procedimentosComPontos : [];
  if (!procs.length) {
    return { ok: false, planejamentoId: null, errosParciais: ['Nenhum ponto para salvar.'], etapaFalha: 'validacao' };
  }

  const bodyPlano = { pacienteId: String(pacienteId) };
  if (observacao != null && String(observacao).trim()) {
    bodyPlano.observacao = String(observacao).trim();
  }
  if (roleUserId && /^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
    bodyPlano.roleUserId = String(roleUserId);
  }

  try {
    const created = await planejamentosApi.criar(bodyPlano);
    planejamentoId = created?.planejamentoId ?? created?.id ?? null;
    if (!planejamentoId) {
      throw new Error('Resposta sem planejamentoId.');
    }
  } catch (e) {
    if (isPlanoAtivoExistenteError(e)) {
      return {
        ok: false,
        planejamentoId: null,
        errosParciais: ['PLANO_ATIVO_EXISTENTE'],
        etapaFalha: 'criar_plano',
        conflitoAtivo: true,
        ativado: false,
      };
    }
    return {
      ok: false,
      planejamentoId: null,
      errosParciais: [e?.message || 'Falha ao criar planejamento.'],
      etapaFalha: 'criar_plano',
    };
  }

  const fotoGaleriaIdPorVista = {};
  for (const [vista, foto] of Object.entries(fotosPorVista || {})) {
    if (!foto || typeof foto !== 'object') continue;
    if (foto.fotoGaleriaId) {
      fotoGaleriaIdPorVista[vista] = foto.fotoGaleriaId;
      continue;
    }
    if (foto.source === 'capture' && foto.blob) {
      try {
        const fid = await uploadCaptureFoto(pacienteId, roleUserId, foto.blob, vista);
        if (fid) fotoGaleriaIdPorVista[vista] = String(fid);
      } catch (e) {
        errosParciais.push(`Upload foto vista ${vista}: ${e?.message || 'erro'}`);
      }
    }
  }

  for (const proc of procs) {
    const catId = proc.catalogoProcedimentoSaudeId;
    try {
      const itemBody = {
        catalogoProcedimentoSaudeId: catId,
        tipo: 'manual',
      };
      if (roleUserId && /^[0-9a-f-]{36}$/i.test(String(roleUserId))) {
        itemBody.roleUserId = String(roleUserId);
      }
      const itemRes = await planejamentosApi.adicionarItem(planejamentoId, itemBody);
      const itemId = itemRes?.planejamentoItemId ?? itemRes?.id ?? null;
      if (!itemId) throw new Error('Resposta sem planejamentoItemId.');
      itemIdByCatalogo[catId] = itemId;
    } catch (e) {
      errosParciais.push(`Item ${proc.nomeProcedimento || catId}: ${e?.message || 'erro'}`);
      return {
        ok: false,
        planejamentoId,
        itemIdByCatalogo,
        errosParciais,
        etapaFalha: 'criar_item',
      };
    }
  }

  for (const proc of procs) {
    const itemId = itemIdByCatalogo[proc.catalogoProcedimentoSaudeId];
    if (!itemId) continue;
    const porVista = proc.pontosPorVista || {};
    
    const marcacoes = [];
    for (const [vistaCodigo, pontos] of Object.entries(porVista)) {
      if (!Array.isArray(pontos) || pontos.length === 0) continue;
      const payload = pontos.map((p) => toApiPonto(p, fotoGaleriaIdPorVista[vistaCodigo]));
      for (const pt of payload) {
        marcacoes.push({
          anguloFotoCodigo: vistaCodigo,
          tipoGeometria: pt.tipoGeometria || 'ponto',
          quantidade: pt.quantidade,
          tamanho: pt.tamanho,
          vertices: pt.vertices?.length ? pt.vertices : [{ posX: pt.posX, posY: pt.posY }]
        });
      }
    }

    if (marcacoes.length > 0) {
      try {
        await mapasApi.criar({
          origemTipo: 'planejamento',
          origemId: itemId,
          marcacoes
        });
      } catch (e) {
        errosParciais.push(`Pontos ${proc.nomeProcedimento}: ${e?.message || 'erro'}`);
        return {
          ok: false,
          planejamentoId,
          itemIdByCatalogo,
          errosParciais,
          etapaFalha: 'salvar_pontos',
        };
      }
    }
  }

  return {
    ok: true,
    planejamentoId,
    itemIdByCatalogo,
    errosParciais,
    ativado: true,
    conflitoAtivo: false,
  };
}
