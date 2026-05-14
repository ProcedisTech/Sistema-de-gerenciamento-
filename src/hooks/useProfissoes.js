import { useState, useEffect, useCallback } from 'react';
import { dimensoesApi } from '../services/api.js';

/**
 * @typedef {{ id: string, nome: string, categoria: string }} ProfissaoRow
 */

/** @type {ProfissaoRow[] | null} */
let cache = null;

/** @type {Promise<ProfissaoRow[]> | null} */
let pendingFetch = null;

function normalizeProfissoes(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const id = String(row.id ?? '').trim();
      const nome = String(row.nome ?? '').trim();
      const categoria = String(row.categoria ?? '').trim();
      if (!id || !nome) return null;
      return { id, nome, categoria };
    })
    .filter(Boolean);
}

function fetchProfissoesDeduped() {
  if (pendingFetch) return pendingFetch;
  pendingFetch = dimensoesApi
    .profissoes()
    .then(normalizeProfissoes)
    .finally(() => {
      pendingFetch = null;
    });
  return pendingFetch;
}

/**
 * Lista de profissões (dimensões) com cache em memória — uma carga por sessão.
 * @returns {{ profissoes: ProfissaoRow[], loading: boolean, error: Error | null, reload: () => void }}
 */
export function useProfissoes() {
  const [profissoes, setProfissoes] = useState(() => cache ?? []);
  const [loading, setLoading] = useState(() => cache == null);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    cache = null;
    setLoading(true);
    setError(null);
    dimensoesApi
      .profissoes()
      .then(normalizeProfissoes)
      .then((data) => {
        cache = data;
        setProfissoes(data);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e : new Error(String(e?.message ?? e)));
        setProfissoes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (cache != null) {
      return;
    }

    fetchProfissoesDeduped()
      .then((data) => {
        cache = data;
        setProfissoes(data);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e : new Error(String(e?.message ?? e)));
        setProfissoes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { profissoes, loading, error, reload };
}
