import { useState, useEffect, useCallback } from 'react';
import { pacientesApi } from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';
import { PATIENT_SEEDS } from '../patients/patientSeeds';

export const usePatientState = () => {
  // Seeds como valor inicial imediato; substituído pelo backend quando disponível.
  const [patients, setPatients] = useState(PATIENT_SEEDS);

  const refreshPatients = useCallback(() => {
    pacientesApi
      .list()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPatients(data.map(mapBackendPatient));
        }
      })
      .catch((err) => {
        console.warn('[usePatientState] Backend indisponível, mantendo seeds locais:', err.message);
      });
  }, []);

  /** Atualiza um paciente na lista pelo id (ex.: após GET ou PUT). */
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

  useEffect(() => { refreshPatients(); }, [refreshPatients]);

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
    mergePatientById,
  };
};

