import { useCallback, useEffect, useState } from 'react';
import { agendaDisponibilidadeApi } from '../../services/api.js';
import { normalizeApiList } from '../../utils/agendaDashboardMapping.js';

/**
 * @param {{ ano?: number, mes?: number, roleUserId?: string, especialidadeId?: string, enabled?: boolean }} opts
 */
export function useDiasComDisponibilidade({ ano, mes, roleUserId, especialidadeId, enabled = true }) {
  const [dias, setDias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    if (!ano || !mes || !enabled) return;
    setLoading(true);
    setError(null);
    agendaDisponibilidadeApi
      .diasDoMes({ ano, mes, roleUserId, especialidadeId })
      .then((raw) => setDias(normalizeApiList(raw)))
      .catch((e) => {
        setError(e);
        setDias([]);
      })
      .finally(() => setLoading(false));
  }, [ano, mes, roleUserId, especialidadeId, enabled]);

  useEffect(() => {
    if (!ano || !mes || !enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    agendaDisponibilidadeApi
      .diasDoMes({ ano, mes, roleUserId, especialidadeId })
      .then((raw) => {
        if (!cancelled) setDias(normalizeApiList(raw));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e);
          setDias([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ano, mes, roleUserId, especialidadeId, enabled]);

  return { dias, loading, error, reload };
}
