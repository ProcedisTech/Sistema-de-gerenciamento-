import { useState, useEffect, useCallback } from 'react';
import {
  pacientesApi,
  patientListSortToApiParam,
} from '../../services/api';
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
 * Lista paginada (`pacientesApi.list`) alimenta `patientListItems`.
 * Catálogo para agenda/jornada (`patients`) via `pacientesApi.search`.
 *
 * @param {{ authEnabled?: boolean }} [opts]
 */
export const usePatientState = (opts = {}) => {
  const { authEnabled = false } = opts;
  const [patients, setPatients] = useState([]);
  const [patientListItems, setPatientListItems] = useState([]);
  const [patientListPage, setPatientListPage] = useState(0);
  const [patientListLoading, setPatientListLoading] = useState(false);
  const [patientListBump, setPatientListBump] = useState(0);
  const [patientListMeta, setPatientListMeta] = useState({
    first: true,
    last: true,
    totalPages: 0,
    number: 0,
  });
  const [patientListTipoBusca, setPatientListTipoBusca] = useState('nome');
  /** Mesmos valores que o select da lista (`nome-asc`, `birthday-asc`, …). */
  const [patientListSortBy, setPatientListSortBy] = useState('nome-asc');

  const [selectedPatientCpf, _setSelectedPatientCpf] = useState(readSelectedPatientCpf);
  const [patientView, setPatientView] = useState(() =>
    readSessionValue(PATIENT_VIEW_KEY, 'list'),
  );
  const [patientDetailTab, setPatientDetailTab] = useState(() =>
    readSessionValue(PATIENT_DETAIL_TAB_KEY, 'atendimento'),
  );
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  const refreshPatients = useCallback(async () => {
    if (!authEnabled) return;
    try {
      const data = await pacientesApi.search('');
      setPatients(Array.isArray(data) ? data.map(mapBackendPatient).filter(Boolean) : []);
    } catch (err) {
      if (err.status === 401) {
        console.warn('[usePatientState] Sessão ausente ou expirada; lista de pacientes não carregada.');
      } else {
        console.warn('[usePatientState] Falha ao buscar pacientes (search):', err.message);
      }
    }
  }, [authEnabled]);

  const bumpPatientList = useCallback(() => {
    setPatientListBump((x) => x + 1);
  }, []);

  const mergePatientById = useCallback((id, updater) => {
    if (!id) return;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const patch = typeof updater === 'function' ? updater(p) : updater;
        return { ...p, ...patch };
      }),
    );
    setPatientListItems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const patch = typeof updater === 'function' ? updater(p) : updater;
        return { ...p, ...patch };
      }),
    );
  }, []);

  /* Voltar à primeira página ao mudar filtro ou ordenação */
  useEffect(() => {
    setPatientListPage(0);
  }, [patientSearchQuery, patientListTipoBusca, patientListSortBy]);

  useEffect(() => {
    if (!authEnabled) {
      setPatientListItems([]);
      setPatientListMeta({
        first: true,
        last: true,
        totalPages: 0,
        number: 0,
      });
      setPatientListLoading(false);
      return;
    }

    let cancelled = false;
    setPatientListLoading(true);

    const q = patientSearchQuery.trim();
    const isBirthday = patientListSortBy === 'birthday-asc';

    pacientesApi
      .list({
        page: patientListPage,
        size: 20,
        order: isBirthday ? 'birthday_asc' : undefined,
        sort: isBirthday ? undefined : patientListSortToApiParam(patientListSortBy),
        q: q || undefined,
        tipo: patientListTipoBusca,
      })
      .then((pageData) => {
        if (cancelled) return;
        const mapped = (pageData.content || [])
          .map(mapBackendPatient)
          .filter(Boolean);
        setPatientListItems(mapped);
        setPatientListMeta({
          first: Boolean(pageData.first),
          last: Boolean(pageData.last),
          totalPages:
            typeof pageData.totalPages === 'number' ? pageData.totalPages : 0,
          number: typeof pageData.number === 'number' ? pageData.number : 0,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setPatientListItems([]);
        setPatientListMeta({
          first: true,
          last: true,
          totalPages: 0,
          number: 0,
        });
        if (err.status === 401) {
          console.warn('[usePatientState] Sessão ausente ou expirada; página de pacientes não carregada.');
        } else {
          console.warn('[usePatientState] Falha ao listar pacientes:', err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setPatientListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    authEnabled,
    patientListPage,
    patientSearchQuery,
    patientListTipoBusca,
    patientListSortBy,
    patientListBump,
  ]);

  useEffect(() => {
    if (!authEnabled) {
      setPatients([]);
      return;
    }
    refreshPatients();
  }, [authEnabled, refreshPatients]);

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

  /** Compat: ordenação “aniversário” espelhada para código que ainda lê `patientsListOrder`. */
  const patientsListOrder = patientListSortBy === 'birthday-asc' ? 'birthday_asc' : null;
  const setPatientsListOrder = useCallback((ord) => {
    if (ord === 'birthday_asc') setPatientListSortBy('birthday-asc');
    else setPatientListSortBy('nome-asc');
  }, []);

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
    patientListItems,
    patientListPage,
    setPatientListPage,
    patientListLoading,
    patientListMeta,
    patientListTipoBusca,
    setPatientListTipoBusca,
    patientListSortBy,
    setPatientListSortBy,
    bumpPatientList,
  };
};
