import { isAgendaForaDisponibilidadeError } from '../utils/agendaErrors';

/**
 * Wrapper para chamadas de agenda que podem disparar warning de disponibilidade.
 *
 * Detecta erro 409 com detail "FORA_DA_DISPONIBILIDADE: ..." (RFC7807 ProblemDetail
 * do Spring Boot 3). Pergunta ao usuário se quer forçar e refaz a chamada com
 * forcar=true se confirmado. Se cancelar, retorna null silenciosamente.
 *
 * @param {() => Promise} chamadaApi - chamada original (sem forcar)
 * @param {() => Promise} chamadaApiComForcar - chamada com forcar=true
 * @param {() => Promise<boolean>} abrirConfirmacao - resolve true=confirmou, false=cancelou
 * @returns {Promise<any|null>} resultado da chamada, ou null se usuário cancelou
 */
export async function executarComBypassDisp(chamadaApi, chamadaApiComForcar, abrirConfirmacao) {
  try {
    return await chamadaApi();
  } catch (err) {
    if (!isAgendaForaDisponibilidadeError(err)) throw err;

    const confirmou = await abrirConfirmacao();
    if (!confirmou) return null;

    return await chamadaApiComForcar();
  }
}
