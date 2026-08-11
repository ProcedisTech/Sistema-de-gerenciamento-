import { agendasApi } from '../services/api.js';
import { RETORNO_TIPO_CODIGO, CONSULTA_TIPO_CODIGO, resolveTipoProcedimentoIdByCodigo } from './agendaTipoProcedimento.js';
import { getGuaranteedNow, toGuaranteedLocalDateIso } from './serverTime.js';

/** Converte Date para String 'YYYY-MM-DD' local. */
function toLocalISODate(d = getGuaranteedNow()) {
  return toGuaranteedLocalDateIso(d);
}

/** Adiciona minutos a um horário HH:MM. */
function addMinutesToHHMM(hhmm, minutesToAdd) {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number);
  const total = h * 60 + m + minutesToAdd;
  const newH = Math.floor((total % 1440) / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/** Dedução do tipo de atendimento avulso. Hierarquia: Retorno -> Procedimento -> Consulta */
export function deduzirTipoAtendimentoAvulso(journeyState, novosIdsValidos = []) {
  if (journeyState?.tipoAtendimento === 'retorno' || journeyState?.isAgendaRetorno) {
    return {
      codigo: RETORNO_TIPO_CODIGO,
      catalogoSaudeId: null,
      procedimentoFeitoOrigemId: journeyState.procedimentoFeitoOrigemId || null,
    };
  }

  if (Array.isArray(novosIdsValidos) && novosIdsValidos.length > 0) {
    const p1 = journeyState?.procedimentosSessao?.[0] || {};
    const catId = p1.nomeProcedimentoCatalogoId || p1.catalogoProcedimentoSaudeId || null;
    return {
      codigo: CONSULTA_TIPO_CODIGO,
      catalogoSaudeId: catId,
      procedimentoFeitoOrigemId: null,
    };
  }

  return {
    codigo: CONSULTA_TIPO_CODIGO,
    catalogoSaudeId: null,
    procedimentoFeitoOrigemId: null,
  };
}

/**
 * Agenda um retorno futuro na agenda para a data informada (YYYY-MM-DD).
 */
export async function registrarRetornoFuturo({
  paciente,
  roleUserId,
  dataRetornoIso,
  procedimentoOrigemId = null,
}) {
  try {
    const pacienteId = paciente?.id;
    if (!pacienteId || !roleUserId || !dataRetornoIso) return null;

    const tipoProcedimentoId = await resolveTipoProcedimentoIdByCodigo(RETORNO_TIPO_CODIGO);
    if (!tipoProcedimentoId) {
      console.warn(`[registrarRetornoFuturo] Tipo procedimento id não encontrado para retorno`);
      return null;
    }

    const body = {
      dataAgendamento: dataRetornoIso,
      horaInicio: '09:00',
      horaFim: '09:30',
      pacienteId,
      profissionalRoleUserId: roleUserId,
      tipoProcedimentoId,
      statusCodigo: 'confirmado',
      ...(procedimentoOrigemId ? { procedimentoFeitoOrigemId: procedimentoOrigemId } : {}),
      observacao: 'Retorno agendado automaticamente pós-procedimento',
    };

    const created = await agendasApi.create(body, { forcar: true });
    return created;
  } catch (err) {
    console.warn('[registrarRetornoFuturo] Erro ao agendar retorno futuro (não-bloqueante):', err);
    return null;
  }
}

/**
 * Cria retroativamente um slot na agenda para atendimentos avulsos e marca como realizado.
 */
export async function registrarAgendaAvulsa({
  journeyState,
  paciente,
  roleUserId,
  novosIdsValidos = [],
  attendanceStartTimeIso = null,
}) {
  try {
    const pacienteId = paciente?.id;
    if (!pacienteId || !roleUserId) {
      console.warn('[registrarAgendaAvulsa] Abortando: pacienteId ou roleUserId ausente', { pacienteId, roleUserId });
      return null;
    }

    const endNow = getGuaranteedNow();
    const endHh = `${String(endNow.getHours()).padStart(2, '0')}:${String(endNow.getMinutes()).padStart(2, '0')}`;

    let dataAgendamento = toLocalISODate(endNow);
    let startHh = endHh;

    if (attendanceStartTimeIso) {
      try {
        const startDt = new Date(attendanceStartTimeIso);
        dataAgendamento = toLocalISODate(startDt);
        startHh = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`;
      } catch {
        startHh = endHh;
      }
    }

    // Se início == fim (ex: clicou em encerrar no mesmo minuto), define piso de 1 minuto
    let finalEndHh = endHh;
    if (startHh === endHh) {
      if (startHh === '23:59') startHh = '23:58';
      finalEndHh = addMinutesToHHMM(startHh, 1);
    }

    const deduzido = deduzirTipoAtendimentoAvulso(journeyState, novosIdsValidos);
    console.log('[registrarAgendaAvulsa] Tipo deduzido:', deduzido);
    const tipoProcedimentoId = await resolveTipoProcedimentoIdByCodigo(deduzido.codigo);

    if (!tipoProcedimentoId) {
      console.warn(`[registrarAgendaAvulsa] Tipo procedimento id não encontrado para código "${deduzido.codigo}"`);
      return null;
    }

    const body = {
      dataAgendamento,
      horaInicio: startHh,
      horaFim: finalEndHh,
      pacienteId,
      profissionalRoleUserId: roleUserId,
      tipoProcedimentoId,
      statusCodigo: 'realizado',
      ...(deduzido.catalogoSaudeId ? { catalogoProcedimentoSaudeId: deduzido.catalogoSaudeId } : {}),
      ...(deduzido.procedimentoFeitoOrigemId ? { procedimentoFeitoOrigemId: deduzido.procedimentoFeitoOrigemId } : {}),
      observacao: 'Atendimento avulso registrado automaticamente pelo prontuário',
    };

    console.log('[registrarAgendaAvulsa] Enviando payload para API:', body);

    const created = await agendasApi.create(body, { forcar: true });
    console.log('[registrarAgendaAvulsa] Resultado da API create:', created);

    if (created?.id) {
      await agendasApi.atualizarStatus(created.id, 'realizado').catch((e) => {
        console.warn('[registrarAgendaAvulsa] Warn ao atualizar status para realizado:', e);
      });
    }

    return created;
  } catch (err) {
    console.warn('[registrarAgendaAvulsa] Erro ao registrar agenda avulsa (não-bloqueante):', err);
    return null;
  }
}

/**
 * Enriquece um agendamento prévio marcando como REALIZADO e anexando os procedimentos executados.
 */
export async function enriquecerAgendaAgendada({
  agendaId,
  procedimentosSessao = [],
  novosIdsValidos = [],
}) {
  if (!agendaId) return;

  try {
    // 1. Atualiza status para realizado
    await agendasApi.atualizarStatus(agendaId, 'realizado');

    // 2. Se foram salvos procedimentos no prontuário, anexa a lista de nomes na observação da agenda
    if (Array.isArray(novosIdsValidos) && novosIdsValidos.length > 0) {
      const nomes = (procedimentosSessao || [])
        .map((p) => p.nomeProcedimento || p.nome || p.nomeCatalogo)
        .filter(Boolean);

      if (nomes.length > 0) {
        const slotAtual = await agendasApi.get(agendaId).catch(() => null);
        if (slotAtual) {
          const obsAntiga = slotAtual.observacao ? String(slotAtual.observacao).trim() : '';
          const textoExecutado = `Executado: ${nomes.join(', ')}`;
          const novaObs = obsAntiga ? `${obsAntiga} | ${textoExecutado}` : textoExecutado;

          await agendasApi.update(agendaId, {
            ...slotAtual,
            observacao: novaObs,
          }, { forcar: true }).catch((e) => {
            console.warn('[enriquecerAgendaAgendada] Erro ao atualizar observação da agenda:', e);
          });
        }
      }
    }
  } catch (err) {
    console.warn('[enriquecerAgendaAgendada] Erro ao enriquecer agenda agendada (não-bloqueante):', err);
  }
}
