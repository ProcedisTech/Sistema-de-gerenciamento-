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
 * Retorna a hora atual garantida no formato "HH:mm" (24h).
 * @returns {string}
 */
export function getGuaranteedHHMM() {
  const d = getGuaranteedNow();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Retorna o timestamp ISO contendo o desvio embutido.
 * @returns {string}
 */
export function getGuaranteedIso() {
  return getGuaranteedNow().toISOString();
}

/**
 * Retorna a data no formato "YYYY-MM-DD" no fuso horário local ajustado.
 * @param {Date} [dt]
 * @returns {string}
 */
export function toGuaranteedLocalDateIso(dt = getGuaranteedNow()) {
  const d = dt instanceof Date ? dt : new Date(dt);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
