import { normalizeTamanho } from '../constants/mapeamentoMarcador.js';
import { pacientesGaleriaApi, planejamentosApi } from '../services/api.js';
import {
  formatGaleriaLegendaForUpload,
  GALERIA_CATEGORIA,
} from './pacienteGaleria.js';

function toApiPonto(p, fotoGaleriaId) {
  const row = {
    posX: Number(p.posX),
    posY: Number(p.posY),
    quantidade: Number(p.quantidade),
    tamanho: normalizeTamanho(p.tamanho),
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
  const dataRef = new Date().toISOString().slice(0, 10);
  const opts = {
    dataReferencia: dataRef,
    legenda: formatGaleriaLegendaForUpload(GALERIA_CATEGORIA.PLANEJAMENTO, vistaCodigo),
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
 * Persiste plano completo: POST plano → itens → pontos por vista → ativar.
 */
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
    for (const [vistaCodigo, pontos] of Object.entries(porVista)) {
      if (!Array.isArray(pontos) || pontos.length === 0) continue;
      const fotoId = fotoGaleriaIdPorVista[vistaCodigo] || null;
      const payload = pontos.map((p) => toApiPonto(p, fotoId));
      try {
        await planejamentosApi.salvarPontosVista(itemId, vistaCodigo, payload);
      } catch (e) {
        errosParciais.push(`Pontos ${proc.nomeProcedimento} / ${vistaCodigo}: ${e?.message || 'erro'}`);
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

  let ativado = true;
  let conflitoAtivo = false;
  try {
    await planejamentosApi.ativar(planejamentoId);
  } catch (e) {
    ativado = false;
    if (e?.status === 409 || String(e?.message || '').includes('PLANO_ATIVO_CONFLITO')) {
      conflitoAtivo = true;
      errosParciais.push('PLANO_ATIVO_CONFLITO');
    } else {
      errosParciais.push(`Ativar plano: ${e?.message || 'erro'}`);
      return {
        ok: false,
        planejamentoId,
        itemIdByCatalogo,
        errosParciais,
        etapaFalha: 'ativar',
        conflitoAtivo,
      };
    }
  }

  return {
    ok: true,
    planejamentoId,
    itemIdByCatalogo,
    errosParciais,
    ativado,
    conflitoAtivo,
  };
}
