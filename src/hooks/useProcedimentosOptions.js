import { useState, useEffect, useCallback } from 'react';
import { clinicaProcedimentoApi } from '../services/api';

/**
 * Carrega os procedimentos vinculados à clínica ("Meus Procedimentos") e os
 * normaliza para o formato esperado por ProcedimentoAutocomplete e selects.
 *
 * Retorna:
 *   options  — { id: string (catalogoProcedimentoSaudeId), nomeProcedimento: string }[]
 *   loading  — boolean
 *   refetch  — () => void
 */
export function useProcedimentosOptions({ enabled = true } = {}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchOptions = useCallback(() => {
    if (!enabled) {
      setOptions([]);
      return () => {};
    }

    let cancelled = false;
    setLoading(true);

    clinicaProcedimentoApi
      .listar()
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        const normalized = arr
          .map((v) => ({
            /** ID do catálogo (GET /catalogos/{id}) — não confundir com id do vínculo clínica. */
            id: String(
              v.catalogoProcedimentoSaudeId ??
                v.procedimento?.catalogoProcedimentoSaudeId ??
                v.procedimento?.id ??
                v.id ??
                '',
            ).trim(),
            nomeProcedimento: String(
              v.procedimento?.nomeProcedimento ||
              v.procedimento?.nome ||
              v.nomeProcedimento ||
              v.nome ||
              ''
            ).trim(),
            tipoCodigo: String(
              v.procedimento?.tipoCodigo ||
              v.procedimento?.tipoProcedimentoCodigo ||
              v.tipoCodigo ||
              ''
            ).trim().toLowerCase(),
            duracaoMin: Number(
              v.procedimento?.duracaoEstimadaMinutos ||
              v.duracaoEstimadaMinutos ||
              v.duracaoMin ||
              0
            ) || 60,
          }))
          .filter((o) => o.id && o.nomeProcedimento);
        setOptions(normalized);
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
  }, [enabled]);

  useEffect(() => {
    return fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    const handler = () => fetchOptions();
    window.addEventListener('catalogo:changed', handler);
    return () => window.removeEventListener('catalogo:changed', handler);
  }, [fetchOptions]);

  return { options, loading, refetch: fetchOptions };
}
