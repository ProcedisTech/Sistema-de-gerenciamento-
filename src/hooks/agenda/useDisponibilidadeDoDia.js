import { useCallback, useEffect, useState } from 'react';
import { useDisponibilidadeRevision } from '../../contexts/useDisponibilidadeRevision.js';
import { agendaDisponibilidadeApi } from '../../services/api.js';
import { normalizeApiList } from '../../utils/agendaDashboardMapping.js';

/**
 * @param {{ data?: string, roleUserId?: string, especialidadeId?: string, enabled?: boolean }} opts
 */
export function useDisponibilidadeDoDia({ data, roleUserId, especialidadeId, enabled = true }) {
  const { revision } = useDisponibilidadeRevision();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    if (!data || !enabled) return;
    setLoading(true);
    setError(null);
    agendaDisponibilidadeApi
      .slotsDoDia({ data, roleUserId, especialidadeId, duracaoMinutos: 30 })
      .then((raw) => setSlots(normalizeApiList(raw)))
      .catch((e) => {
        setError(e);
        setSlots([]);
      })
      .finally(() => setLoading(false));
  }, [data, roleUserId, especialidadeId, enabled]);

  useEffect(() => {
    if (!data || !enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    agendaDisponibilidadeApi
      .slotsDoDia({ data, roleUserId, especialidadeId, duracaoMinutos: 30 })
      .then((raw) => {
        if (!cancelled) setSlots(normalizeApiList(raw));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e);
          setSlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, roleUserId, especialidadeId, enabled, revision]);

  return { slots, loading, error, reload };
}
