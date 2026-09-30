import { anamneseApi } from '../../services/api';
import {
  historicoTimestamp,
  isPreenchimentoEmBrancoDoPaciente,
  resolveStatusCodigo,
} from './step2Vigente.js';

export async function carregarEnvioAtivoDocumento(pacienteId, preenchimentoId) {
  if (!pacienteId || !preenchimentoId) return null;
  try {
    const doc = await anamneseApi.getDocumento(pacienteId, preenchimentoId);
    return doc?.envioAtivo ?? null;
  } catch {
    return null;
  }
}

/** Ficha em branco do paciente ainda aguardando resposta (a mais recente), ou null. */
export function escolherFichaEmBrancoPendente(lista) {
  if (!Array.isArray(lista)) return null;
  const candidatas = lista.filter(
    (h) => isPreenchimentoEmBrancoDoPaciente(h)
      && resolveStatusCodigo(h).toLowerCase() === 'aguardando_paciente',
  );
  if (candidatas.length === 0) return null;
  return [...candidatas].sort((a, b) => historicoTimestamp(b) - historicoTimestamp(a))[0];
}

export function montarPedidoPendente(ficha, envioAtivo) {
  if (!ficha || envioAtivo?.status !== 'PENDENTE' || !envioAtivo?.id) return null;
  return {
    envioId: envioAtivo.id,
    preenchimentoId: ficha.id ?? null,
    enviadoEm: ficha.dataHora ?? null,
    expiraEm: envioAtivo.expiraEm ?? null,
  };
}

export function pedidoVencido(pedido, agoraMs = Date.now()) {
  if (!pedido?.expiraEm) return false;
  const t = new Date(pedido.expiraEm).getTime();
  return Number.isFinite(t) && t <= agoraMs;
}
