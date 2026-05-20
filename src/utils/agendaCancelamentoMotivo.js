import { motivosCancelamentoApi } from '../services/api.js';
import { normalizeApiList } from './agendaDashboardMapping.js';

export const NO_SHOW_MOTIVO_CODIGO = 'paciente_nao_compareceu';
export const NO_SHOW_OBS_PREFIX = '[Não compareceu]';

let motivosCache = null;
let motivosFetchPromise = null;

/**
 * Lista motivos de cancelamento com cache em módulo (dedupe in-flight).
 * @returns {Promise<Array<{ motivoCancelamentoId: string, codigo: string, nome: string }>>}
 */
export async function fetchMotivosCancelamentoCached() {
  if (motivosCache) return motivosCache;
  if (!motivosFetchPromise) {
    motivosFetchPromise = motivosCancelamentoApi
      .listar()
      .then((list) => {
        const arr = normalizeApiList(list).filter((m) => m && m.ativo !== false);
        motivosCache = arr;
        return arr;
      })
      .catch((e) => {
        motivosFetchPromise = null;
        throw e;
      });
  }
  return motivosFetchPromise;
}

/** Invalida cache (ex.: após deploy de novos motivos). */
export function invalidateMotivosCancelamentoCache() {
  motivosCache = null;
  motivosFetchPromise = null;
}

/**
 * @param {string} codigo
 * @returns {Promise<string|null>} motivoCancelamentoId ou null
 */
export async function resolveMotivoCancelamentoIdByCodigo(codigo) {
  const target = String(codigo || '').trim().toLowerCase();
  if (!target) return null;
  const motivos = await fetchMotivosCancelamentoCached();
  const found = motivos.find((m) => String(m.codigo || '').trim().toLowerCase() === target);
  return found?.motivoCancelamentoId != null ? String(found.motivoCancelamentoId) : null;
}

/**
 * Resolve motivo de cancelamento exibido na UI a partir da linha do dashboard (Onda 4).
 */
export function resolveMotivoCancelamentoFromRow(row) {
  const raw = row?.rawSlot || row?.rawAgendamento || {};
  const nome =
    row?.motivoCancelamentoNome ??
    raw.motivoCancelamentoNome ??
    raw.motivo_cancelamento_nome ??
    '';
  const codigo =
    row?.motivoCancelamentoCodigo ??
    raw.motivoCancelamentoCodigo ??
    raw.motivo_cancelamento_codigo ??
    null;
  const id =
    row?.motivoCancelamentoId != null
      ? String(row.motivoCancelamentoId)
      : raw.motivoCancelamentoId != null
        ? String(raw.motivoCancelamentoId)
        : '';

  const nomeTrim = nome != null && String(nome).trim() ? String(nome).trim() : '';
  return { id, codigo: codigo != null && String(codigo).trim() !== '' ? String(codigo).trim() : null, nome: nomeTrim };
}

/** Cancelamento por no-show (motivo ou prefixo na observação). */
export function isAgendaNoShow(row) {
  const { codigo } = resolveMotivoCancelamentoFromRow(row);
  if (codigo && String(codigo).trim().toLowerCase() === NO_SHOW_MOTIVO_CODIGO) return true;
  const obs = row?.observacao ?? row?.rawSlot?.observacao ?? row?.rawAgendamento?.observacao ?? '';
  return String(obs).trim().startsWith(NO_SHOW_OBS_PREFIX);
}

/** Fallback mínimo quando o backend não envia nome (legado). */
export function labelMotivoCancelamentoFallback(codigo) {
  if (codigo == null || codigo === '') return '';
  return String(codigo).trim();
}
