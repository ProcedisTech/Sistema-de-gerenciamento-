import {
  TIPO_ATENDIMENTO_CONSULTA,
  TIPO_ATENDIMENTO_PROCEDIMENTO,
  TIPO_ATENDIMENTO_RETORNO,
} from './agendaTipoProcedimento.js';

export function resolveAgendaCreateModalPatch(opts = {}, { catIds = [], baseData = '' } = {}) {
  const isModoRetorno = Boolean(opts.modoRetorno);
  const isConsultaClinica = opts.tipoAtendimento === TIPO_ATENDIMENTO_CONSULTA;
  const semDataInicial = Boolean(opts.semDataInicial);
  return {
    catalogoProcedimentoSaudeIds: isConsultaClinica ? [] : catIds,
    data: semDataInicial ? '' : baseData,
    tipoAtendimento: isModoRetorno
      ? TIPO_ATENDIMENTO_RETORNO
      : isConsultaClinica
        ? TIPO_ATENDIMENTO_CONSULTA
        : TIPO_ATENDIMENTO_PROCEDIMENTO,
    tipoAtendimentoLocked: isModoRetorno || isConsultaClinica,
    agendamentoTipoRetorno: isModoRetorno,
  };
}
