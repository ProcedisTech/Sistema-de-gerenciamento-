import { planejamentosApi } from '../services/api.js';

function isRealUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val ?? '').trim());
}

/**
 * Garante que os procedimentos selecionados na criação da Agenda estejam presentes
 * no Plano de Tratamento Ativo do paciente.
 * 
 * - Se o paciente já possui plano ativo, anexa os procedimentos que ainda não existem nele.
 * - Se não possui plano ativo, cria um novo plano e insere os itens.
 * - Retorna um mapa de { [catalogoProcedimentoSaudeId]: planejamentoItemId } para vincular na tb_agenda.
 * 
 * @param {object} params
 * @param {string} params.pacienteId UUID do paciente
 * @param {string[]} params.catalogoProcedimentoSaudeIds IDs do catálogo de procedimentos
 * @param {string} [params.roleUserId] UUID do profissional (opcional)
 * @param {string} [params.dataIso] Data planejada (YYYY-MM-DD)
 * @returns {Promise<Record<string, string>>} Mapa de catalogoId -> planejamentoItemId
 */
export async function garantirProcedimentosNoPlano({
  pacienteId,
  catalogoProcedimentoSaudeIds = [],
  roleUserId = null,
  dataIso = null,
}) {
  const pid = String(pacienteId || '').trim();
  if (!isRealUuid(pid)) return {};

  const catIds = (Array.isArray(catalogoProcedimentoSaudeIds) ? catalogoProcedimentoSaudeIds : [])
    .map((id) => String(id || '').trim())
    .filter(isRealUuid);

  if (catIds.length === 0) return {};

  const resultadoMap = {};
  let planoId = null;

  try {
    const rawPlanos = await planejamentosApi.listarPorPaciente(pid);
    const planos = Array.isArray(rawPlanos) ? rawPlanos : rawPlanos?.content || [];

    let planoAtivo = planos.find((p) => {
      const st = String(p.statusCodigo || p.status || '').toLowerCase();
      return st === 'ativo' || st === 'em_andamento' || st === 'aberto' || st === 'rascunho';
    });

    planoId = planoAtivo?.id || planoAtivo?.planejamentoId || null;

    // Se não há plano ativo, cria um novo plano
    if (!planoId) {
      const bodyPlano = {
        pacienteId: pid,
        observacao: 'Plano de Tratamento',
      };
      if (isRealUuid(roleUserId)) {
        bodyPlano.roleUserId = String(roleUserId);
      }

      const planoCreated = await planejamentosApi.criar(bodyPlano);
      planoId = planoCreated?.planejamentoId || planoCreated?.id || null;
    }

    if (!planoId) return {};

    const itensExistentes = Array.isArray(planoAtivo?.itens) ? planoAtivo.itens : [];

    for (const catId of catIds) {
      // 1. Verifica se já existe um item com esse catálogo no plano que ainda não foi concluído
      const itemExistente = itensExistentes.find((it) => {
        const itemCatId = String(it.catalogoProcedimentoSaudeId || it.catalogoId || '').trim();
        const itemStatus = String(it.statusProcedimentoCodigo || it.status || '').toLowerCase();
        return itemCatId === catId && itemStatus !== 'realizado' && itemStatus !== 'finalizado';
      });

      if (itemExistente) {
        const existingItemId = String(itemExistente.planejamentoItemId || itemExistente.id || '').trim();
        if (existingItemId) {
          resultadoMap[catId] = existingItemId;
          continue;
        }
      }

      // 2. Se não existe item aberto para esse procedimento, adiciona novo item ao plano
      try {
        const itemBody = {
          catalogoProcedimentoSaudeId: catId,
          tipo: 'manual',
        };
        if (dataIso) {
          itemBody.dataPlanejada = dataIso;
        }
        if (isRealUuid(roleUserId)) {
          itemBody.roleUserId = String(roleUserId);
        }

        const itemRes = await planejamentosApi.adicionarItem(planoId, itemBody);
        const novoItemId = String(itemRes?.planejamentoItemId || itemRes?.id || '').trim();
        if (novoItemId) {
          resultadoMap[catId] = novoItemId;
        }
      } catch (errItem) {
        console.warn(`[garantirProcedimentosNoPlano] Falha ao adicionar item ${catId} ao plano ${planoId}:`, errItem);
      }
    }
  } catch (err) {
    console.warn('[garantirProcedimentosNoPlano] Erro geral ao sincronizar plano com agendamento:', err);
  }

  if (planoId) {
    resultadoMap.planoId = String(planoId).trim();
  }

  return resultadoMap;
}
