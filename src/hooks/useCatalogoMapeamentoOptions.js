import { useCallback, useEffect, useState } from 'react';
import { catalogosApi } from '../services/api.js';

function normalizeCatalogoMapeamentoOptions(data) {
  const arr = Array.isArray(data) ? data : data?.content || [];
  return arr
    .filter((c) => c?.ativo !== false)
    .map((c) => ({
      id: String(c.id || '').trim(),
      nome: String(c.nomeProcedimento || '').trim(),
      duracaoMin: Number(c.duracaoEstimadaMinutos) || 60,
    }))
    .filter((o) => o.id && o.nome);
}

/** Opções de procedimento para mapeamento (catalogoProcedimentoSaudeId = CatalogoDTO.id). */
export function useCatalogoMapeamentoOptions({ enabled = true } = {}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(enabled));
  const [fetchToken, setFetchToken] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    catalogosApi
      .list(false)
      .then((data) => {
        if (cancelled) return;
        setOptions(normalizeCatalogoMapeamentoOptions(data));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchToken]);

  const refetch = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setFetchToken((t) => t + 1);
  }, [enabled]);

  return {
    options: enabled ? options : [],
    loading: enabled ? loading : false,
    refetch,
  };
}
