/**
 * Utilitário Global para Arquitetura de Horário Garantido do Servidor.
 *
 * Sincroniza o relógio do cliente (browser) com o horário oficial do servidor (America/Sao_Paulo),
 * aplicando compensação automática em tempo real para evitar desvios causados por relógios
 * desajustados na máquina do usuário.
 */

let serverTimeOffsetMs = 0;
let lastSyncTimestamp = 0;

/**
 * Atualiza o desvio (offset) em milissegundos usando a data informada pelo servidor no header HTTP Date.
 * @param {string|Date|number} serverDateInput Header 'Date' da resposta HTTP do servidor
 */
export function updateServerTimeOffset(serverDateInput) {
  if (!serverDateInput) return;
  try {
    const serverTime = new Date(serverDateInput).getTime();
    if (Number.isNaN(serverTime)) return;
    const clientTime = Date.now();
    serverTimeOffsetMs = serverTime - clientTime;
    lastSyncTimestamp = clientTime;
  } catch (err) {
    console.warn('[serverTime] Falha ao atualizar offset do servidor:', err?.message);
  }
}

/**
 * Retorna um objeto Date ajustado com a hora garantida do servidor.
 * @returns {Date}
 */
export function getGuaranteedNow() {
  return new Date(Date.now() + serverTimeOffsetMs);
}

/**
 * Retorna o timestamp ISO contendo o desvio embutido.
 * @returns {string}
 */
export function getGuaranteedIso() {
  return getGuaranteedNow().toISOString();
}

/**
 * Retorna estatísticas de sincronização (para diagnósticos ou suporte).
 */
export function getServerTimeStats() {
  return {
    offsetMs: serverTimeOffsetMs,
    offsetMinutes: Math.round(serverTimeOffsetMs / 60000 * 10) / 10,
    lastSyncAt: lastSyncTimestamp ? new Date(lastSyncTimestamp).toISOString() : null,
  };
}
