/**
 * Utilitário para resolução e agrupamento de fotos entre Planos de Tratamento,
 * suas respectivas Visitas e a Pasta de Atendimentos Avulsos.
 */

import { parseGaleriaLegenda, itemDataReferenciaISO } from './pacienteGaleria.js';

/**
 * Mapeia as fotos da galeria do paciente e os procedimentos executados para seus respectivos planos,
 * e isola TODOS os procedimentos e fotos avulsas (sem plano).
 *
 * @param {Array} planos - Lista de planos normalizados do paciente
 * @param {Array} fotosBrutas - Lista de fotos da API de galeria
 * @param {Array} procedimentosFeitos - Lista de todos os procedimentos realizados do paciente
 * @returns {Object} { fotosPorPlanoId, fotosPorPlanejamentoItemId, fotosAvulsas, atendimentosAvulsos }
 */
export function resolverFotosEPlanos(planos = [], fotosBrutas = [], procedimentosFeitos = []) {
  // Normalizar lista de fotos com fallback inteligente de categoria (legenda e tipoFotoCodigo)
  const fotos = (Array.isArray(fotosBrutas) ? fotosBrutas : []).map((f) => {
    const legInfo = parseGaleriaLegenda(f.legenda || f.descricaoLegenda);
    let cat = f.categoria || legInfo.categoria;
    if (!cat || cat === 'outro') {
      const code = String(f.tipoFotoCodigo || f.tipo_foto_codigo || '').toUpperCase();
      if (code === 'ANTES') cat = 'antes';
      else if (code === 'DEPOIS' || code === 'POS_IMEDIATO') cat = 'depois';
      else if (code === 'MAPA') cat = 'mapa';
      else if (code === 'AVALIACAO') cat = 'avaliacao';
      else if (code === 'PLANEJAMENTO') cat = 'planejamento';
      else if (code === 'MODELO') cat = 'modelo';
      else cat = 'outro';
    }

    return {
      ...f,
      id: f.id || f.fotoId,
      fotoId: f.fotoId || f.id,
      categoria: cat,
      descricaoLegenda: f.descricaoLegenda || legInfo.descricao,
      dataISO: itemDataReferenciaISO(f) || (f.createdAt ? String(f.createdAt).slice(0, 10) : 'sem-data'),
    };
  });

  // Mapear itens de planos e agendamentos por ID para busca O(1)
  const itemToPlanoMap = new Map(); // itemId -> { planoId, item }
  const agendaIdToPlanoItemMap = new Map(); // agendaId -> { planoId, itemId }
  const procedimentoFeitoToPlanoItemMap = new Map(); // procedimentoFeitoId -> { planoId, itemId }

  (planos || []).forEach((plano) => {
    const pId = String(plano.id || '').trim();
    (plano.itens || []).forEach((item) => {
      const itemId = String(item.id || item.planejamentoItemId || item.tempId || '').trim();
      if (itemId) {
        itemToPlanoMap.set(itemId, { planoId: pId, item });

        // Mapear sessões da agenda do item para contingência
        const sessAtivaAgId = item.sessaoAtiva?.agendaId ? String(item.sessaoAtiva.agendaId).trim() : null;
        const sessRealAgId = item.sessaoRealizada?.agendaId ? String(item.sessaoRealizada.agendaId).trim() : null;
        const sessRetAgId = item.sessaoRetornoAtiva?.agendaId ? String(item.sessaoRetornoAtiva.agendaId).trim() : null;
        if (sessAtivaAgId) agendaIdToPlanoItemMap.set(sessAtivaAgId, { planoId: pId, itemId });
        if (sessRealAgId) agendaIdToPlanoItemMap.set(sessRealAgId, { planoId: pId, itemId });
        if (sessRetAgId) agendaIdToPlanoItemMap.set(sessRetAgId, { planoId: pId, itemId });

        if (Array.isArray(item.sessoes)) {
          item.sessoes.forEach((s) => {
            const agId = s.agendaId ? String(s.agendaId).trim() : null;
            if (agId) agendaIdToPlanoItemMap.set(agId, { planoId: pId, itemId });
          });
        }

        // Se o item já tiver procedimentoFeitoId diretamente gravado
        if (item.sessaoAtiva?.procedimentoFeitoId) {
          procedimentoFeitoToPlanoItemMap.set(
            String(item.sessaoAtiva.procedimentoFeitoId).trim(),
            { planoId: pId, itemId }
          );
        }
        if (item.procedimentoFeitoId) {
          procedimentoFeitoToPlanoItemMap.set(
            String(item.procedimentoFeitoId).trim(),
            { planoId: pId, itemId }
          );
        }
      }
    });
  });

  // Cruzar procedimentosFeitos contra o mapa de itens do plano
  (procedimentosFeitos || []).forEach((proc) => {
    const pfId = String(proc.id || proc.procedimentoFeitoId || '').trim();
    const pItemId = proc.planejamentoItemId ? String(proc.planejamentoItemId).trim() : null;
    const agId = proc.agendaId ? String(proc.agendaId).trim() : null;

    if (!pfId) return;

    // A. Match direto por planejamentoItemId
    if (pItemId && itemToPlanoMap.has(pItemId)) {
      const match = itemToPlanoMap.get(pItemId);
      procedimentoFeitoToPlanoItemMap.set(pfId, {
        planoId: match.planoId,
        itemId: pItemId,
      });
      return;
    }

    // B. Match de contingência por agendaId
    if (agId && agendaIdToPlanoItemMap.has(agId)) {
      const match = agendaIdToPlanoItemMap.get(agId);
      procedimentoFeitoToPlanoItemMap.set(pfId, match);
      return;
    }
  });

  // C. Herança para retornos vinculados ao procedimento pai
  (procedimentosFeitos || []).forEach((proc) => {
    const pfId = String(proc.id || proc.procedimentoFeitoId || '').trim();
    const paiId = proc.procedimentoFeitoOrigemId ? String(proc.procedimentoFeitoOrigemId).trim() : null;
    if (pfId && paiId && !procedimentoFeitoToPlanoItemMap.has(pfId) && procedimentoFeitoToPlanoItemMap.has(paiId)) {
      const paiMatch = procedimentoFeitoToPlanoItemMap.get(paiId);
      procedimentoFeitoToPlanoItemMap.set(pfId, paiMatch);
    }
  });

  const fotosPorPlanoId = {}; // planoId -> Array<foto>
  const fotosPorPlanejamentoItemId = {}; // itemId -> Array<foto>
  const fotosAvulsas = [];

  fotos.forEach((foto) => {
    let matchedPlanoId = null;
    let matchedItemId = null;

    // 1. Tentar match direto por planejamentoItemId
    if (foto.planejamentoItemId) {
      const pItemId = String(foto.planejamentoItemId).trim();
      if (itemToPlanoMap.has(pItemId)) {
        matchedPlanoId = itemToPlanoMap.get(pItemId).planoId;
        matchedItemId = pItemId;
      }
    }

    // 2. Tentar match por procedimentoFeitoId cruzado
    if (!matchedPlanoId && foto.procedimentoFeitoId) {
      const pfId = String(foto.procedimentoFeitoId).trim();
      if (procedimentoFeitoToPlanoItemMap.has(pfId)) {
        const match = procedimentoFeitoToPlanoItemMap.get(pfId);
        matchedPlanoId = match.planoId;
        matchedItemId = match.itemId;
      }
    }

    // 3. Distribuir a foto
    if (matchedPlanoId) {
      if (!fotosPorPlanoId[matchedPlanoId]) {
        fotosPorPlanoId[matchedPlanoId] = [];
      }
      fotosPorPlanoId[matchedPlanoId].push(foto);

      if (matchedItemId) {
        if (!fotosPorPlanejamentoItemId[matchedItemId]) {
          fotosPorPlanejamentoItemId[matchedItemId] = [];
        }
        fotosPorPlanejamentoItemId[matchedItemId].push(foto);
      }
    } else {
      fotosAvulsas.push(foto);
    }
  });

  // Mapear atendimentos avulsos a partir de procedimentosFeitos (que NÃO pertencem a nenhum plano)
  const atendimentosAvulsosMap = new Map();

  (procedimentosFeitos || []).forEach((proc) => {
    const pfId = String(proc.id || '').trim();
    const pItemId = proc.planejamentoItemId ? String(proc.planejamentoItemId).trim() : null;

    // Se o procedimento não estiver vinculado a nenhum item de plano e nem mapeado no procedimentoFeitoToPlanoItemMap
    if (pfId && (!pItemId || !itemToPlanoMap.has(pItemId)) && !procedimentoFeitoToPlanoItemMap.has(pfId)) {
      const dataISO = proc.criadoEm ? String(proc.criadoEm).slice(0, 10) : 'sem-data';
      const chave = `pf_${pfId}`;

      atendimentosAvulsosMap.set(chave, {
        chave,
        id: pfId,
        procedimentoFeitoId: pfId,
        nomeProcedimento: proc.procedimentoNome || proc.nome || 'Procedimento Avulso',
        profissionalNome: proc.profissionalNome || '—',
        statusNome: proc.statusNome || 'FINALIZADO',
        observacao: proc.observacao || null,
        dataISO,
        retornos: Array.isArray(proc.retornos) ? proc.retornos : [],
        retornosCount: Array.isArray(proc.retornos) ? proc.retornos.length : 0,
        fotos: [],
      });
    }
  });

  // Agrupar fotos avulsas vinculando-as ao atendimento avulso correspondente ou criando entrada avulsa
  fotosAvulsas.forEach((foto) => {
    const pfId = foto.procedimentoFeitoId ? String(foto.procedimentoFeitoId).trim() : null;
    const chave = pfId ? `pf_${pfId}` : `data_${foto.dataISO}`;

    if (!atendimentosAvulsosMap.has(chave)) {
      atendimentosAvulsosMap.set(chave, {
        chave,
        id: pfId || chave,
        procedimentoFeitoId: pfId,
        nomeProcedimento: foto.nomeProcedimento || foto.descricaoLegenda || 'Atendimento / Registro Avulso',
        profissionalNome: '—',
        statusNome: 'REGISTRADO',
        observacao: null,
        dataISO: foto.dataISO,
        retornos: [],
        retornosCount: 0,
        fotos: [],
      });
    }
    atendimentosAvulsosMap.get(chave).fotos.push(foto);
  });

  const atendimentosAvulsos = Array.from(atendimentosAvulsosMap.values()).sort(
    (a, b) => (b.dataISO || '').localeCompare(a.dataISO || '')
  );

  return {
    fotosPorPlanoId,
    fotosPorPlanejamentoItemId,
    fotosAvulsas,
    atendimentosAvulsos,
  };
}

