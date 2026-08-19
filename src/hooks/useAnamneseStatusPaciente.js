import { useEffect, useState } from 'react';
import { anamneseApi } from '../services/api';
import {
  resolveAnamneseDesatualizada,
  resolveAnamnesePendente,
} from '../utils/patientAnamneseAlerts.js';

/**
 * Status do card Anamnese no hub: GET da ficha do paciente (mesmo padrão de termos/planos).
 * Não usa só as flags da listagem — o pin de pacienteAtual não atualiza após preencher.
 */
export function useAnamneseStatusPaciente(paciente, { enabled = true } = {}) {
  const pacienteId = paciente?.id != null ? String(paciente.id).trim() : '';
  const canFetch = Boolean(enabled && pacienteId);
  const [fetchedList, setFetchedList] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);

  useEffect(() => {
    if (!canFetch) return undefined;
    let cancelled = false;
    setFetchLoading(true);
    anamneseApi
      .listPaciente(pacienteId)
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        setFetchedList(rows);
      })
      .catch(() => {
        if (!cancelled) setFetchedList([]);
      })
      .finally(() => {
        if (!cancelled) setFetchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canFetch, pacienteId]);

  const list = canFetch ? fetchedList : [];
  const isLoading = canFetch ? fetchLoading : false;

  const pendente = isLoading
    ? paciente?.anamnesePendente === true
    : resolveAnamnesePendente(paciente, list);
  const desatualizada = isLoading
    ? paciente?.anamneseDesatualizada === true
    : resolveAnamneseDesatualizada(paciente, list);

  return { list, isLoading, pendente, desatualizada };
}
