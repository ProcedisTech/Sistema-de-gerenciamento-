import { useEffect, useState } from 'react';
import { termosApi } from '../services/api';
import { idsFilaExigida } from '../utils/termoResolucao';

/**
 * Pendência do hub = faltantes da resolução (mesmo critério do gate).
 * INSTITUCIONAL na fila da aba Termos não entra aqui.
 */
export function useTermosPendentes(
  pacienteId,
  { catalogoIds = [], exigirFilaVinculo = true } = {}
) {
  const [pendentes, setPendentes] = useState([]);
  const [resolucao, setResolucao] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const catalogoKey = (catalogoIds || []).map(String).join(',');

  useEffect(() => {
    if (!pacienteId) {
      setPendentes([]);
      setResolucao(null);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const resolucaoRaw = await termosApi.resolver({ pacienteId, catalogoIds });
        if (cancelled) return;
        const resolucaoDto = resolucaoRaw && typeof resolucaoRaw === 'object' ? resolucaoRaw : {};
        setResolucao(resolucaoDto);
        if (!exigirFilaVinculo) {
          setPendentes([]);
          return;
        }
        const result = idsFilaExigida(resolucaoDto).map((id) => {
          const item = (resolucaoDto.faltantes || []).find((f) => String(f.termoId) === id);
          return { id, titulo: item?.titulo || 'Termo' };
        });
        setPendentes(result);
      } catch {
        if (!cancelled) {
          setPendentes([]);
          setResolucao(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pacienteId, catalogoKey, exigirFilaVinculo]);

  return { pendentes, count: pendentes.length, isLoading, resolucao };
}
