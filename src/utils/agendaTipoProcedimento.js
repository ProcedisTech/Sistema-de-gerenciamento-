import { dimensoesApi } from '../services/api.js';
import { normalizeApiList } from './agendaDashboardMapping.js';

export const BLOQUEIO_TIPO_CODIGO = 'bloqueio';
export const RETORNO_TIPO_CODIGO = 'retorno';

let tiposCache = null;
let tiposFetchPromise = null;

/**
 * Lista tipos de procedimento com cache em módulo (dedupe in-flight).
 * @returns {Promise<Array<{ tipoProcedimentoId: string, codigo: string, nome: string }>>}
 */
export async function fetchTiposProcedimentoCached() {
  if (tiposCache) return tiposCache;
  if (!tiposFetchPromise) {
    tiposFetchPromise = dimensoesApi
      .tiposProcedimento()
      .then((list) => {
        const arr = normalizeApiList(list).filter((t) => t && t.tipoProcedimentoId != null);
        tiposCache = arr;
        return arr;
      })
      .catch((e) => {
        tiposFetchPromise = null;
        throw e;
      });
  }
  return tiposFetchPromise;
}

/** Invalida cache (ex.: após deploy de novos tipos). */
export function invalidateTiposProcedimentoCache() {
  tiposCache = null;
  tiposFetchPromise = null;
}

/**
 * @param {string} codigo
 * @returns {Promise<string|null>} tipoProcedimentoId ou null
 */
export async function resolveTipoProcedimentoIdByCodigo(codigo) {
  const target = String(codigo || '').trim().toLowerCase();
  if (!target) return null;
  const tipos = await fetchTiposProcedimentoCached();
  const found = tipos.find((t) => String(t.codigo || '').trim().toLowerCase() === target);
  return found?.tipoProcedimentoId != null ? String(found.tipoProcedimentoId) : null;
}
