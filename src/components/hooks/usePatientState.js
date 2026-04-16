import { useState, useEffect, useCallback } from 'react';
import { pacientesApi } from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';

const ACTIVE_PATIENT_CPF_KEY = 'selectedPatientCpf';
const ACTIVE_PATIENT_CPF_LEGACY_KEY = 'activePatientCpf';
const PATIENT_VIEW_KEY = 'patientView';
const PATIENT_DETAIL_TAB_KEY = 'patientDetailTab';

function readSessionValue(key, fallback) {
  try {
    const value = sessionStorage.getItem(key);
    if (value == null || value === '') return fallback;
    return value;
  } catch {
    return fallback;
  }
}

function readSelectedPatientCpf() {
  const current = readSessionValue(ACTIVE_PATIENT_CPF_KEY, null);
  if (current != null && current !== '') return current;
  return readSessionValue(ACTIVE_PATIENT_CPF_LEGACY_KEY, null);
}

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

  const [selectedPatientCpf, _setSelectedPatientCpf] = useState(readSelectedPatientCpf);
  const [patientView, setPatientView] = useState(() =>
    readSessionValue(PATIENT_VIEW_KEY, 'list')
  );
  const [patientDetailTab, setPatientDetailTab] = useState(() =>
    readSessionValue(PATIENT_DETAIL_TAB_KEY, 'atendimento')
  );
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  const setSelectedPatientCpf = useCallback((nextCpf) => {
    _setSelectedPatientCpf((prev) => {
      const resolved = typeof nextCpf === 'function' ? nextCpf(prev) : nextCpf;
      const normalized = resolved != null && String(resolved).trim() !== '' ? String(resolved) : null;
      try {
        if (normalized) {
          sessionStorage.setItem(ACTIVE_PATIENT_CPF_KEY, normalized);
          sessionStorage.removeItem(ACTIVE_PATIENT_CPF_LEGACY_KEY);
        } else {
          sessionStorage.removeItem(ACTIVE_PATIENT_CPF_KEY);
          sessionStorage.removeItem(ACTIVE_PATIENT_CPF_LEGACY_KEY);
        }
      } catch {
        // ignore
      }
      return normalized;
    });
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(PATIENT_VIEW_KEY, patientView || 'list');
    } catch {
      // ignore
    }
  }, [patientView]);

  useEffect(() => {
    try {
      sessionStorage.setItem(PATIENT_DETAIL_TAB_KEY, patientDetailTab || 'atendimento');
    } catch {
      // ignore
    }
  }, [patientDetailTab]);

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
