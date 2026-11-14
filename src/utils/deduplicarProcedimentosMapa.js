import { corParaProcedimento } from '../constants/mapeamentoPaletaCores.js';

/**
 * Extrai o ID de catálogo normalizado de um procedimento de sessão/mapa, se houver.
 * @param {object | null | undefined} p
 * @returns {string | null}
 */
export function extrairCatalogoIdProcedimento(p) {
  if (!p || typeof p !== 'object') return null;
  const raw =
    p.catalogoProcedimentoSaudeId ||
    p.nomeProcedimentoCatalogoId ||
    p.catalogoId ||
    null;
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

function temItemServidor(p) {
  const raw = p?.itemId ?? (p?.procedimentoFeitoId || null);
  return raw != null && String(raw).trim() !== '';
}

function nomeUtil(p) {
  const n = String(
    p?.nomeProcedimento || p?.procedimentoNome || p?.catalogoNome || p?.nome || '',
  ).trim();
  if (!n || /^procedimento(\s*\d+)?$/i.test(n)) return '';
  return n;
}

/**
 * Deduplica procedimentos estritamente 1:1 por catalogoProcedimentoSaudeId (ou id quando sem catálogo),
 * priorizando o registro que já possui itemId do servidor e mesclando metadados ausentes.
 * Garante unicidade de reactKey e índice sequencial no espaço mapeável (0..N-1).
 *
 * @template T
 * @param {T[]} lista
 * @returns {Array<T & { index: number, reactKey: string }>}
 */
export function deduplicarProcedimentosPorCatalogo(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return [];

  const agrupado = new Map();
  const resultado = [];

  for (let i = 0; i < lista.length; i += 1) {
    const item = lista[i];
    if (!item || typeof item !== 'object') continue;

    const catId = extrairCatalogoIdProcedimento(item);
    const idDireto = item.id != null ? String(item.id).trim() : '';
    const chave = catId || idDireto;

    if (!chave) {
      resultado.push(item);
      continue;
    }

    if (!agrupado.has(chave)) {
      const idx = resultado.length;
      agrupado.set(chave, idx);
      resultado.push(item);
      continue;
    }

    const pos = agrupado.get(chave);
    const atual = resultado[pos];
    const candidatoMelhor = temItemServidor(item) && !temItemServidor(atual);
    const base = candidatoMelhor ? item : atual;
    const outro = candidatoMelhor ? atual : item;

    resultado[pos] = {
      ...outro,
      ...base,
      nome: nomeUtil(base) || nomeUtil(outro) || base.nome || outro.nome,
      nomeProcedimento:
        nomeUtil(base) || nomeUtil(outro) || base.nomeProcedimento || outro.nomeProcedimento,
      catalogoNome: nomeUtil(base) || nomeUtil(outro) || base.catalogoNome || outro.catalogoNome,
      planejamentoItemId: base.planejamentoItemId || outro.planejamentoItemId || null,
      agendaId: base.agendaId || outro.agendaId || null,
      corHex: base.corHex || outro.corHex || (catId ? corParaProcedimento(catId) : null),
      unidadeMedida: base.unidadeMedida || outro.unidadeMedida || 'un',
    };
  }

  const keysUsadas = new Set();
  return resultado.map((proc, idx) => {
    const catId = extrairCatalogoIdProcedimento(proc);
    const baseKey = String(
      catId || proc.id || proc.itemId || proc._uid || proc.planejamentoItemId || `idx_${idx}`,
    ).trim();
    let reactKey = baseKey;
    if (keysUsadas.has(reactKey)) {
      const sufixo = proc.itemId || proc._uid || idx;
      reactKey = `${baseKey}__${sufixo}`;
      while (keysUsadas.has(reactKey)) {
        reactKey = `${reactKey}_${idx}`;
      }
    }
    keysUsadas.add(reactKey);

    return {
      ...proc,
      index: idx,
      reactKey,
    };
  });
}

/**
 * Gera chave React garantidamente única para renderização de listas de procedimentos,
 * mesmo caso existam itens sem catálogo ainda não consolidados.
 *
 * @param {object | null | undefined} proc
 * @param {number} [idx=0]
 * @returns {string}
 */
export function chaveReactProcedimento(proc, idx = 0) {
  if (!proc || typeof proc !== 'object') return `proc_${idx}`;
  if (proc.reactKey) return String(proc.reactKey);
  const id = proc.id || extrairCatalogoIdProcedimento(proc);
  const itemUid = proc.itemId || proc._uid || proc.planejamentoItemId;
  if (id && itemUid && String(itemUid) !== String(id)) {
    return `${String(id)}_${String(itemUid)}`;
  }
  return String(id || itemUid || `proc_${idx}`);
}

