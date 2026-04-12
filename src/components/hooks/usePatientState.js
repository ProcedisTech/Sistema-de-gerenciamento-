import { useState, useEffect, useCallback } from 'react';
import { pacientesApi } from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';

/**
 * Lista de pacientes só é carregada do backend quando `authEnabled` (sessão válida + cookie).
 * Sem auth: lista vazia — sem seeds locais misturados com gravações reais.
 *
 * @param {{ authEnabled?: boolean }} [opts]
 */
export const usePatientState = (opts = {}) => {
  const { authEnabled = false } = opts;
  const [patients, setPatients] = useState([]);
  /** `null` = ordem default da API; `birthday_asc` = próximo aniversário primeiro. */
  const [patientsListOrder, setPatientsListOrder] = useState(null);

  const refreshPatients = useCallback(() => {
    if (!authEnabled) return;
    const listOpts = patientsListOrder === 'birthday_asc' ? { order: 'birthday_asc' } : {};
    pacientesApi
      .list(listOpts)
      .then((data) => {
        setPatients(Array.isArray(data) ? data.map(mapBackendPatient) : []);
      })
      .catch((err) => {
        if (err.status === 401) {
          console.warn('[usePatientState] Sessão ausente ou expirada; lista de pacientes não carregada.');
        } else {
          console.warn('[usePatientState] Falha ao listar pacientes:', err.message);
        }
      });
  }, [authEnabled, patientsListOrder]);

  const mergePatientById = useCallback((id, updater) => {
    if (!id) return;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const patch = typeof updater === 'function' ? updater(p) : updater;
        return { ...p, ...patch };
      })
    );
  }, []);

  useEffect(() => {
    if (!authEnabled) {
      setPatients([]);
      return;
    }
    refreshPatients();
  }, [authEnabled, refreshPatients]);

  const [selectedPatientCpf, setSelectedPatientCpf] = useState(null);
  const [patientView, setPatientView] = useState('list');
  const [patientDetailTab, setPatientDetailTab] = useState('timeline');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  return {
    patients,
    setPatients,
    selectedPatientCpf,
    setSelectedPatientCpf,
    patientView,
    setPatientView,
    patientDetailTab,
    setPatientDetailTab,
    patientSearchQuery,
    setPatientSearchQuery,
    refreshPatients,
    patientsListOrder,
    setPatientsListOrder,
    mergePatientById,
  };
};
