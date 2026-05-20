import { useState, useEffect, useCallback } from 'react';
import { dimensoesApi } from '../services/api.js';

/**
 * Alguns gateways envolvem a lista (`content`, `data`, …) — garantir array.
 */
function unwrapDimensionRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const nested =
    raw.content ??
    raw.data ??
    raw.items ??
    raw.list ??
    raw.resultados ??
    raw._embedded ??
    [];
  if (Array.isArray(nested)) return nested;
  return [];
}

/**
 * @typedef {{ id: string, nome: string }} EstadoCivilRow
 */

/** Lista já aplicada aos consumidores (pode ser vazia após primeira carga bem-sucedida). */
/** @type {EstadoCivilRow[]} */
let cacheRows = [];
/** `false` = ainda não houve resposta válida da API nesta sessão (não confundir com array vazio). */
let cacheLoaded = false;

/** @type {Promise<EstadoCivilRow[]> | null} */
let pendingFetch = null;

function normalizeEstadosCivis(raw) {
  const arr = unwrapDimensionRows(raw);
  return arr
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      if (Object.prototype.hasOwnProperty.call(row, 'ativo') && row.ativo === false)
        return null;
      const id = String(row.id ?? '').trim();
      const nome = String(row.nome ?? '').trim();
      if (!id || !nome) return null;
      return { id, nome };
    })
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }));
}

function fetchEstadosCivisDeduped() {
  if (pendingFetch) return pendingFetch;
  // eslint-disable-next-line no-console -- confirmar disparo da dimensões no DevTools
  console.log('chamando estados-civis api');
  pendingFetch = dimensoesApi
    .estadosCivis()
    .then(normalizeEstadosCivis)
    .finally(() => {
      pendingFetch = null;
    });
  return pendingFetch;
}

/**
 * Lista de estados civis (`GET /api/v1/dimensoes/estados-civis`), cache por sessão.
 * @returns {{ estadosCivis: EstadoCivilRow[], loading: boolean, error: Error | null, reload: () => void }}
 */
export function useEstadosCivis() {
  const [estadosCivis, setEstadosCivis] = useState(() => (cacheLoaded ? cacheRows : []));
  const [loading, setLoading] = useState(() => !cacheLoaded);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    cacheLoaded = false;
    cacheRows = [];
    pendingFetch = null;
    setLoading(true);
    setError(null);
    fetchEstadosCivisDeduped()
      .then((data) => {
        cacheRows = data;
        cacheLoaded = true;
        setEstadosCivis(data);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e : new Error(String(e?.message ?? e)));
        setEstadosCivis([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (cacheLoaded) {
      return undefined;
    }

    fetchEstadosCivisDeduped()
      .then((data) => {
        cacheRows = data;
        cacheLoaded = true;
        setEstadosCivis(data);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e : new Error(String(e?.message ?? e)));
        setEstadosCivis([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { estadosCivis, loading, error, reload };
}
