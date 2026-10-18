/**
 * Utilitário para resolução e agrupamento de fotos entre Planos de Tratamento,
 * suas respectivas Visitas e a Pasta de Atendimentos Avulsos.
 */

import { parseGaleriaLegenda, itemDataReferenciaISO } from './pacienteGaleria.js';
import { diaDoInstante } from './datasClinica.js';

/**
 * Mapeia as fotos da galeria do paciente e os procedimentos executados para seus respectivos planos,
 * e isola TODOS os procedimentos e fotos avulsas (sem plano).
 *
 * @param {Array} planos - Lista de planos normalizados do paciente
 * @param {Array} fotosBrutas - Lista de fotos da API de galeria
 * @param {Array} procedimentosFeitos - Lista de todos os procedimentos realizados do paciente
 * @param {string} [fuso] - IANA da clínica; dia das fotos/atendimentos sem data de calendário (ausente → fuso padrão)
 * @returns {Object} { fotosPorPlanoId, fotosPorPlanejamentoItemId, fotosAvulsas, atendimentosAvulsos }
 */
export function resolverFotosEPlanos(planos = [], fotosBrutas = [], procedimentosFeitos = [], fuso) {
  // Normalizar lista de fotos com fallback inteligente de categoria (legenda e tipoFotoCodigo)
  const fotos = (Array.isArray(fotosBrutas) ? fotosBrutas : []).map((f) => {
    const legInfo = parseGaleriaLegenda(f.legenda || f.descricaoLegenda);
    let cat = f.categoria || legInfo.categoria;
    const isAvulso = Boolean(f.isAvulso || legInfo.isAvulso || /\[avulso\]/i.test(f.legenda || ''));
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
      agendaId: f.agendaId ? String(f.agendaId).trim() : null,
      registradoEm: f.registradoEm || f.createdAt || null,
      categoria: cat,
      isAvulso,
      descricaoLegenda: f.descricaoLegenda || legInfo.descricao,
      dataISO: itemDataReferenciaISO(f, fuso) || 'sem-data',
    };
  });

  // Mapear itens de planos e agendamentos por ID para busca O(1)
  const itemToPlanoMap = new Map(); // itemId -> { planoId, item }
  const agendaIdToPlanoItemMap = new Map(); // agendaId -> { planoId, itemId, isRetorno }
  const procedimentoFeitoToPlanoItemMap = new Map(); // procedimentoFeitoId -> { planoId, itemId, isRetorno }

  (planos || []).forEach((plano) => {
    const pId = String(plano.id || '').trim();
    (plano.itens || []).forEach((item) => {
      const rawItemId = item.planejamentoItemId || item.id || item.tempId || '';
      const baseItemId = String(rawItemId).replace(/_retorno$/, '').trim();
      if (baseItemId) {
        itemToPlanoMap.set(baseItemId, { planoId: pId, item });
        if (rawItemId !== baseItemId) {
          itemToPlanoMap.set(String(rawItemId).trim(), { planoId: pId, item });
        }

        // Mapear sessões da agenda do item para contingência com distinção estrita de retorno
        const sessAtivaAgId = item.sessaoAtiva?.agendaId ? String(item.sessaoAtiva.agendaId).trim() : null;
        const sessRealAgId = item.sessaoRealizada?.agendaId ? String(item.sessaoRealizada.agendaId).trim() : null;
        const sessRetAgId = item.sessaoRetornoAtiva?.agendaId ? String(item.sessaoRetornoAtiva.agendaId).trim() : null;
        const sessRetRealAgId = item.sessaoRetornoRealizada?.agendaId ? String(item.sessaoRetornoRealizada.agendaId).trim() : null;

        if (sessAtivaAgId) {
          agendaIdToPlanoItemMap.set(sessAtivaAgId, { planoId: pId, itemId: baseItemId, isRetorno: false });
        }
        if (sessRealAgId) {
          agendaIdToPlanoItemMap.set(sessRealAgId, { planoId: pId, itemId: baseItemId, isRetorno: false });
        }
        if (sessRetAgId) {
          agendaIdToPlanoItemMap.set(sessRetAgId, { planoId: pId, itemId: `${baseItemId}_retorno`, isRetorno: true });
        }
        if (sessRetRealAgId) {
          agendaIdToPlanoItemMap.set(sessRetRealAgId, { planoId: pId, itemId: `${baseItemId}_retorno`, isRetorno: true });
        }

        if (Array.isArray(item.sessoes)) {
          item.sessoes.forEach((s) => {
            const agId = s.agendaId ? String(s.agendaId).trim() : null;
            if (agId) {
              const isRet = String(s.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno';
              agendaIdToPlanoItemMap.set(agId, {
                planoId: pId,
                itemId: isRet ? `${baseItemId}_retorno` : baseItemId,
                isRetorno: isRet,
              });
            }
          });
        }

        // Se o item já tiver procedimentoFeitoId diretamente gravado
        if (item.sessaoAtiva?.procedimentoFeitoId) {
          procedimentoFeitoToPlanoItemMap.set(
            String(item.sessaoAtiva.procedimentoFeitoId).trim(),
            { planoId: pId, itemId: baseItemId, isRetorno: false }
          );
        }
        if (item.sessaoRealizada?.procedimentoFeitoId) {
          procedimentoFeitoToPlanoItemMap.set(
            String(item.sessaoRealizada.procedimentoFeitoId).trim(),
            { planoId: pId, itemId: baseItemId, isRetorno: false }
          );
        }
        if (item.sessaoRetornoAtiva?.procedimentoFeitoId) {
          procedimentoFeitoToPlanoItemMap.set(
            String(item.sessaoRetornoAtiva.procedimentoFeitoId).trim(),
            { planoId: pId, itemId: `${baseItemId}_retorno`, isRetorno: true }
          );
        }
        if (item.sessaoRetornoRealizada?.procedimentoFeitoId) {
          procedimentoFeitoToPlanoItemMap.set(
            String(item.sessaoRetornoRealizada.procedimentoFeitoId).trim(),
            { planoId: pId, itemId: `${baseItemId}_retorno`, isRetorno: true }
          );
        }
        if (item.procedimentoFeitoId) {
          procedimentoFeitoToPlanoItemMap.set(
            String(item.procedimentoFeitoId).trim(),
            { planoId: pId, itemId: baseItemId, isRetorno: false }
          );
        }
      }
    });
  });

  // Cruzar procedimentosFeitos contra o mapa de itens do plano
  (procedimentosFeitos || []).forEach((proc) => {
    const pfId = String(proc.id || proc.procedimentoFeitoId || '').trim();
    const pItemId = proc.planejamentoItemId ? String(proc.planejamentoItemId).trim() : null;
    const agId = proc.agendaId || proc.agenda?.id ? String(proc.agendaId || proc.agenda?.id).trim() : null;

    if (!pfId) return;

    const isRetorno = Boolean(
      proc.isRetoque ||
      proc.procedimentoFeitoOrigemId ||
      String(proc.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno'
    );

    // A. Match direto por planejamentoItemId (com suporte a sufixo _retorno ou ID limpo)
    const cleanPItemId = pItemId ? String(pItemId).replace(/_retorno$/, '').trim() : null;
    if (cleanPItemId && itemToPlanoMap.has(cleanPItemId)) {
      const match = itemToPlanoMap.get(cleanPItemId);
      const targetItemId = isRetorno ? `${cleanPItemId}_retorno` : cleanPItemId;
      procedimentoFeitoToPlanoItemMap.set(pfId, {
        planoId: match.planoId,
        itemId: targetItemId,
        isRetorno,
      });
      if (agId && !agendaIdToPlanoItemMap.has(agId)) {
        agendaIdToPlanoItemMap.set(agId, {
          planoId: match.planoId,
          itemId: targetItemId,
          isRetorno,
        });
      }
      return;
    }

    // B. Match de contingência por agendaId
    if (agId && agendaIdToPlanoItemMap.has(agId)) {
      const match = agendaIdToPlanoItemMap.get(agId);
      procedimentoFeitoToPlanoItemMap.set(pfId, {
        planoId: match.planoId,
        itemId: match.itemId,
        isRetorno: match.isRetorno ?? isRetorno,
      });
      return;
    }
  });

  // C. Herança para retornos vinculados ao procedimento pai via procedimentoFeitoOrigemId
  (procedimentosFeitos || []).forEach((proc) => {
    const pfId = String(proc.id || proc.procedimentoFeitoId || '').trim();
    const paiId = proc.procedimentoFeitoOrigemId ? String(proc.procedimentoFeitoOrigemId).trim() : null;
    if (pfId && paiId && !procedimentoFeitoToPlanoItemMap.has(pfId) && procedimentoFeitoToPlanoItemMap.has(paiId)) {
      const paiMatch = procedimentoFeitoToPlanoItemMap.get(paiId);
      const baseItemId = String(paiMatch.itemId).replace(/_retorno$/, '').trim();
      procedimentoFeitoToPlanoItemMap.set(pfId, {
        planoId: paiMatch.planoId,
        itemId: `${baseItemId}_retorno`,
        isRetorno: true,
      });
    }
  });

  const fotosPorPlanoId = {}; // planoId -> Array<foto>
  const fotosPorPlanejamentoItemId = {}; // itemId -> Array<foto>
  const fotosAvulsas = [];

  fotos.forEach((foto) => {
    // 0. BLINDAGEM ESTREITA: Se for explicitamente avulsa, NUNCA vincula a nenhum plano!
    if (foto.isAvulso) {
      fotosAvulsas.push({
        ...foto,
        matchedItemId: null,
        matchedPlanoId: null,
        isRetorno: false,
      });
      return;
    }

    let matchedPlanoId = null;
    let matchedItemId = null;
    let isRetornoFoto = false;

    // 1. Tentar match por procedimentoFeitoId cruzado (mais específico: distingue pai vs retorno)
    if (foto.procedimentoFeitoId) {
      const pfId = String(foto.procedimentoFeitoId).trim();
      if (procedimentoFeitoToPlanoItemMap.has(pfId)) {
        const match = procedimentoFeitoToPlanoItemMap.get(pfId);
        matchedPlanoId = match.planoId;
        matchedItemId = match.itemId;
        isRetornoFoto = Boolean(match.isRetorno);
      }
    }

    // 2. Tentar match direto por planejamentoItemId (fallback se foto não tem procedimentoFeitoId)
    if (!matchedPlanoId && foto.planejamentoItemId) {
      const rawPItemId = String(foto.planejamentoItemId).trim();
      const cleanPItemId = rawPItemId.replace(/_retorno$/, '').trim();
      if (itemToPlanoMap.has(cleanPItemId)) {
        matchedPlanoId = itemToPlanoMap.get(cleanPItemId).planoId;
        const fotoIsRetorno = Boolean(
          foto.isRetorno ||
          rawPItemId.endsWith('_retorno') ||
          String(foto.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno'
        );
        matchedItemId = fotoIsRetorno ? `${cleanPItemId}_retorno` : cleanPItemId;
        isRetornoFoto = fotoIsRetorno;
      }
    }

    // 3. Match de contingência por agendaId (ex.: foto de avaliação diagnóstica sem procedimentoFeitoId)
    // Vincula ao plano no nível do plano, mantendo matchedItemId null para não virar foto de execução
    if (!matchedPlanoId && foto.agendaId) {
      const fAgId = String(foto.agendaId).trim();
      if (agendaIdToPlanoItemMap.has(fAgId)) {
        const match = agendaIdToPlanoItemMap.get(fAgId);
        matchedPlanoId = match.planoId;
      } else {
        // Se a agenda não foi pré-mapeada, verifica se algum procedimento realizado do plano compartilha esta mesma agenda
        const pfMesmaAgenda = (procedimentosFeitos || []).find((pf) => {
          const agId = pf.agendaId || pf.agenda?.id;
          return agId && String(agId).trim() === fAgId;
        });
        if (pfMesmaAgenda) {
          const pfId = String(pfMesmaAgenda.id || pfMesmaAgenda.procedimentoFeitoId || '').trim();
          if (procedimentoFeitoToPlanoItemMap.has(pfId)) {
            matchedPlanoId = procedimentoFeitoToPlanoItemMap.get(pfId).planoId;
          }
        }
      }
    }

    // 4. Match direto por planejamentoId ou por mapaOverlay vinculados ao plano
    if (!matchedPlanoId && (foto.planejamentoId || foto.mapaOverlay?.planejamentoId)) {
      const pIdStr = String(foto.planejamentoId || foto.mapaOverlay?.planejamentoId).trim();
      if (planos.some((p) => String(p.id) === pIdStr)) {
        matchedPlanoId = pIdStr;
      }
    }

    if (!matchedPlanoId && foto.mapaOverlay?.planejamentoItemId) {
      const rawPItemId = String(foto.mapaOverlay.planejamentoItemId).replace(/_retorno$/, '').trim();
      if (itemToPlanoMap.has(rawPItemId)) {
        matchedPlanoId = itemToPlanoMap.get(rawPItemId).planoId;
      }
    }

    if (!matchedPlanoId && foto.mapaOverlay?.procedimentos && Array.isArray(foto.mapaOverlay.procedimentos)) {
      for (const proc of foto.mapaOverlay.procedimentos) {
        const pItemId = proc.planejamentoItemId ? String(proc.planejamentoItemId).replace(/_retorno$/, '').trim() : null;
        if (pItemId && itemToPlanoMap.has(pItemId)) {
          matchedPlanoId = itemToPlanoMap.get(pItemId).planoId;
          break;
        }
      }
    }



    const enrichedFoto = {
      ...foto,
      matchedItemId: matchedItemId || null,
      matchedPlanoId: matchedPlanoId || null,
      isRetorno: isRetornoFoto,
    };

    // 3. Distribuir a foto
    if (matchedPlanoId) {
      if (!fotosPorPlanoId[matchedPlanoId]) {
        fotosPorPlanoId[matchedPlanoId] = [];
      }
      fotosPorPlanoId[matchedPlanoId].push(enrichedFoto);

      if (matchedItemId) {
        if (!fotosPorPlanejamentoItemId[matchedItemId]) {
          fotosPorPlanejamentoItemId[matchedItemId] = [];
        }
        fotosPorPlanejamentoItemId[matchedItemId].push(enrichedFoto);
      }
    } else {
      fotosAvulsas.push(enrichedFoto);
    }
  });

  // Mapear atendimentos avulsos a partir de procedimentosFeitos (que NÃO pertencem a nenhum plano)
  const atendimentosAvulsosMap = new Map();

  (procedimentosFeitos || []).forEach((proc) => {
    const pfId = String(proc.id || '').trim();
    const pItemId = proc.planejamentoItemId ? String(proc.planejamentoItemId).trim() : null;
    const agId = proc.agendaId || proc.agenda?.id ? String(proc.agendaId || proc.agenda?.id).trim() : null;

    // Se o procedimento não estiver vinculado a nenhum item de plano e nem mapeado no procedimentoFeitoToPlanoItemMap
    if (pfId && (!pItemId || !itemToPlanoMap.has(pItemId)) && !procedimentoFeitoToPlanoItemMap.has(pfId)) {
      const dataISO = diaDoInstante(proc.criadoEm, fuso) || (proc.criadoEm ? String(proc.criadoEm).slice(0, 10) : 'sem-data');
      const horaInicio = proc.criadoEm ? String(proc.criadoEm).slice(11, 16) : (proc.horaInicio ? String(proc.horaInicio).slice(11, 16) : null);
      const atId = proc.atendimentoId || proc.atendimento?.id || null;
      const sessaoChave = atId ? `at_${atId}` : (horaInicio ? `sessao_${dataISO}_${horaInicio}` : null);
      const chave = agId ? `ag_${agId}` : (sessaoChave || `pf_${pfId}`);
      const nomeAtual = proc.procedimentoNome || proc.nome || 'Procedimento Avulso';

      if (atendimentosAvulsosMap.has(chave)) {
        const existente = atendimentosAvulsosMap.get(chave);
        if (!existente.procedimentosFeitosIds.includes(pfId)) {
          existente.procedimentosFeitosIds.push(pfId);
          existente.nomesProcedimentos.push(nomeAtual);
          if (!Array.isArray(existente.procedimentosItens)) {
            existente.procedimentosItens = [];
          }
          existente.procedimentosItens.push({
            id: pfId,
            nome: nomeAtual,
            corHex: proc.corHex || proc.cor || null,
          });
          existente.nomeProcedimento = existente.nomesProcedimentos.join(' + ');
        }
        if (!existente.procedimentoFeitoId) {
          existente.procedimentoFeitoId = pfId;
        }
      } else {
        atendimentosAvulsosMap.set(chave, {
          chave,
          id: agId || pfId || chave,
          agendaId: agId,
          procedimentoFeitoId: pfId,
          procedimentosFeitosIds: [pfId],
          nomesProcedimentos: [nomeAtual],
          procedimentosItens: [
            {
              id: pfId,
              nome: nomeAtual,
              corHex: proc.corHex || proc.cor || null,
            },
          ],
          nomeProcedimento: nomeAtual,
          profissionalNome: proc.profissionalNome || '—',
          statusNome: proc.statusNome || 'FINALIZADO',
          observacao: proc.observacao || null,
          dataISO,
          horaInicio,
          retornos: Array.isArray(proc.retornos) ? proc.retornos : [],
          retornosCount: Array.isArray(proc.retornos) ? proc.retornos.length : 0,
          fotos: [],
        });
      }
    }
  });

  // Agrupar fotos avulsas vinculando-as ao atendimento avulso correspondente ou criando entrada avulsa
  fotosAvulsas.forEach((foto) => {
    const pfId = foto.procedimentoFeitoId ? String(foto.procedimentoFeitoId).trim() : null;
    const agId = foto.agendaId ? String(foto.agendaId).trim() : null;

    let chave = null;
    const atFotoId = foto.atendimentoId ? String(foto.atendimentoId).trim() : null;
    if (agId && atendimentosAvulsosMap.has(`ag_${agId}`)) {
      chave = `ag_${agId}`;
    } else if (atFotoId && atendimentosAvulsosMap.has(`at_${atFotoId}`)) {
      chave = `at_${atFotoId}`;
    } else if (pfId) {
      if (atendimentosAvulsosMap.has(`pf_${pfId}`)) {
        chave = `pf_${pfId}`;
      } else {
        for (const [k, at] of atendimentosAvulsosMap.entries()) {
          if (at.procedimentosFeitosIds?.includes(pfId) || at.procedimentoFeitoId === pfId) {
            chave = k;
            break;
          }
        }
      }
    }
    if (!chave) {
      if (agId) {
        chave = `ag_${agId}`;
      } else if (pfId) {
        chave = `pf_${pfId}`;
      } else {
        chave = `reg_${foto.id || foto.fotoId || foto.dataISO}`;
      }
    }

    if (!atendimentosAvulsosMap.has(chave)) {
      const horaInicio = foto.registradoEm ? String(foto.registradoEm).slice(11, 16) : null;
      atendimentosAvulsosMap.set(chave, {
        chave,
        id: agId || pfId || chave,
        agendaId: agId,
        procedimentoFeitoId: pfId,
        procedimentosFeitosIds: pfId ? [pfId] : [],
        nomesProcedimentos: [],
        nomeProcedimento: foto.nomeProcedimento || foto.descricaoLegenda || 'Consulta / Avaliação Clínica',
        profissionalNome: foto.profissionalNome || '—',
        statusNome: 'REALIZADO',
        observacao: null,
        dataISO: foto.dataISO,
        horaInicio,
        isAvaliacao: true,
        retornos: [],
        retornosCount: 0,
        fotos: [],
      });
    }

    const entry = atendimentosAvulsosMap.get(chave);
    if (!entry.horaInicio && foto.registradoEm) {
      entry.horaInicio = String(foto.registradoEm).slice(11, 16);
    }
    entry.fotos.push(foto);
  });

  const atendimentosAvulsos = Array.from(atendimentosAvulsosMap.values()).sort((a, b) => {
    const cmpData = (b.dataISO || '').localeCompare(a.dataISO || '');
    if (cmpData !== 0) return cmpData;
    return (b.horaInicio || '').localeCompare(a.horaInicio || '');
  });

  return {
    fotosPorPlanoId,
    fotosPorPlanejamentoItemId,
    fotosAvulsas,
    atendimentosAvulsos,
  };
}

