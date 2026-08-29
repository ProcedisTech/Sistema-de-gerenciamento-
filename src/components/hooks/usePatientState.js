import { useState, useEffect, useCallback, useRef } from 'react';
import { applyPatientQuickFilter } from '../patients/patientListFilters.js';
import {
  pacientesApi,
  patientListSortToApiParam,
} from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';
import {
  patientUltimaVisitaDayFromDto,
} from '../../utils/patientProfileDerivedDates.js';

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

function normalizePatientDetailTab(value) {
  const tab = String(value ?? '').trim();
  if (tab === 'atendimento' || tab === 'timeline' || tab === 'cadastro') return 'planos';
  return tab || 'planos';
}

function readSelectedPatientCpf() {
  const current = readSessionValue(ACTIVE_PATIENT_CPF_KEY, null);
  if (current != null && current !== '') return current;
  return readSessionValue(ACTIVE_PATIENT_CPF_LEGACY_KEY, null);
}

export const PATIENT_LIST_PAGE_SIZE = 20;

function buildProfileNavSnapshot(cpf, items, quickFilter, meta, page) {
  const filtered = applyPatientQuickFilter(items, quickFilter);
  const indexInList = filtered.findIndex((p) => p.cpf === cpf);
  const totalElements =
    typeof meta.totalElements === 'number' && meta.totalElements >= 0
      ? meta.totalElements
      : filtered.length;
  const safeIndex = indexInList >= 0 ? indexInList : 0;
  const globalIndex = page * PATIENT_LIST_PAGE_SIZE + safeIndex + 1;
  return {
    cpfs: filtered.map((p) => p.cpf).filter(Boolean),
    indexInList: safeIndex,
    page,
    totalElements,
    quickFilter,
    globalIndex,
  };
}

/** Termo para GET /pacientes/search — só dígitos quando parece CPF/telefone mascarado. */
function queryForPacientesSearch(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 11 && /\D/.test(t)) return digits;
  return t;
}

function ultimaVisitaSortMs(p) {
  if (p?.ultimaVinda) {
    const ms = new Date(p.ultimaVinda).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  const day = patientUltimaVisitaDayFromDto(p);
  if (!day || day === '-' || day === '—') return 0;
  const parts = String(day).trim().split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map((n) => parseInt(n, 10));
    if (y && m && d) return new Date(y, m - 1, d).getTime();
  }
  return 0;
}

function daysUntilNextBirthdayMs(dataNascimento) {
  if (!dataNascimento) return Number.MAX_SAFE_INTEGER;
  const birth = new Date(dataNascimento);
  if (Number.isNaN(birth.getTime())) return Number.MAX_SAFE_INTEGER;
  const now = new Date();
  let next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (next.getTime() < now.getTime()) {
    next = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return next.getTime() - now.getTime();
}

function comparePatientsClient(a, b, sortBy) {
  switch (sortBy) {
    case 'nome-desc':
      return b.nome.localeCompare(a.nome, 'pt', { sensitivity: 'base' });
    case 'idade-asc': {
      const ia = a.idade != null ? Number(a.idade) : null;
      const ib = b.idade != null ? Number(b.idade) : null;
      return (ia ?? Number.MAX_SAFE_INTEGER) - (ib ?? Number.MAX_SAFE_INTEGER);
    }
    case 'idade-desc': {
      const ia = a.idade != null ? Number(a.idade) : null;
      const ib = b.idade != null ? Number(b.idade) : null;
      return (ib ?? -1) - (ia ?? -1);
    }
    case 'visita-desc':
      return ultimaVisitaSortMs(b) - ultimaVisitaSortMs(a);
    case 'visita-asc':
      return ultimaVisitaSortMs(a) - ultimaVisitaSortMs(b);
    case 'birthday-asc':
      return daysUntilNextBirthdayMs(a.dataNascimento) - daysUntilNextBirthdayMs(b.dataNascimento);
    case 'nome-asc':
    default:
      return a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' });
  }
}

/**
 * Lista paginada (`pacientesApi.list`) quando não há texto de busca;
 * com texto, `pacientesApi.search` + paginação/ordenação no cliente.
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
    totalElements: 0,
  });
  const [patientQuickFilter, setPatientQuickFilter] = useState('todos');
  const [profileNavSnapshot, setProfileNavSnapshot] = useState(null);
  const pendingProfileNavRef = useRef(null);
  /** Mesmos valores que o select da lista (`nome-asc`, `birthday-asc`, …). */
  const [patientListSortBy, setPatientListSortBy] = useState('nome-asc');

  // Filtros server-side v1 (só aplicados na rota /pacientes, não em /search)
  const [statusPlanoFilter, setStatusPlanoFilter] = useState(''); // '' | 'sem_plano' | 'plano_ativo'
  const [anamneseDesatualizadaFilter, setAnamneseDesatualizadaFilter] = useState(false);
  const [semRetornoFilter, setSemRetornoFilter] = useState(false);
  const [semAgendamentoFuturoFilter, setSemAgendamentoFuturoFilter] = useState(false);
  const [ehNovoFilter, setEhNovoFilter] = useState(false);
  const [ehAniversarianteFilter, setEhAniversarianteFilter] = useState(false);

  const [selectedPatientCpf, _setSelectedPatientCpf] = useState(readSelectedPatientCpf);
  const [patientView, setPatientView] = useState(() =>
    readSessionValue(PATIENT_VIEW_KEY, 'list'),
  );
  const [patientDetailTab, setPatientDetailTab] = useState(() =>
    normalizePatientDetailTab(readSessionValue(PATIENT_DETAIL_TAB_KEY, 'planos')),
  );
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  const refreshPatients = useCallback(() => {
    if (!authEnabled) return;
    setPatientListBump((x) => x + 1);
  }, [authEnabled]);

  const bumpPatientList = useCallback(() => {
    setPatientListBump((x) => x + 1);
  }, []);

  const mergePatientById = useCallback((id, updater) => {
    if (!id) return;
    const idStr = String(id);
    setPatients((prev) =>
      prev.map((p) => {
        if (String(p.id) !== idStr) return p;
        const patch = typeof updater === 'function' ? updater(p) : updater;
        return { ...p, ...patch };
      }),
    );
    setPatientListItems((prev) =>
      prev.map((p) => {
        if (String(p.id) !== idStr) return p;
        const patch = typeof updater === 'function' ? updater(p) : updater;
        return { ...p, ...patch };
      }),
    );
  }, []);

  /* Voltar à primeira página ao mudar filtro ou ordenação */
  useEffect(() => {
    setPatientListPage(0);
  }, [patientSearchQuery, patientListSortBy, statusPlanoFilter, anamneseDesatualizadaFilter, semRetornoFilter, semAgendamentoFuturoFilter, ehNovoFilter, ehAniversarianteFilter]);

  /* birthday-asc ignora semRetorno/semAgendamentoFuturo no backend — limpar filtro ao trocar para esse sort */
  useEffect(() => {
    if (patientListSortBy === 'birthday-asc' && semRetornoFilter) {
      setSemRetornoFilter(false);
    }
    if (patientListSortBy === 'birthday-asc' && semAgendamentoFuturoFilter) {
      setSemAgendamentoFuturoFilter(false);
    }
  }, [patientListSortBy, semRetornoFilter, semAgendamentoFuturoFilter]);

  useEffect(() => {
    if (!authEnabled) {
      setPatientListItems([]);
      setPatientListMeta({
        first: true,
        last: true,
        totalPages: 0,
        number: 0,
        totalElements: 0,
      });
      setPatientListLoading(false);
      return undefined;
    }

    let cancelled = false;
    setPatientListLoading(true);

    const qTrim = patientSearchQuery.trim();
    const qApi = queryForPacientesSearch(patientSearchQuery);
    const isBirthday = patientListSortBy === 'birthday-asc';

    const failList = (err) => {
      if (cancelled) return;
      setPatientListItems([]);
      setPatientListMeta({
        first: true,
        last: true,
        totalPages: 0,
        number: 0,
        totalElements: 0,
      });
      if (err.status === 401) {
        console.warn('[usePatientState] Sessão ausente ou expirada; página de pacientes não carregada.');
      } else {
        console.warn('[usePatientState] Falha ao carregar lista de pacientes:', err.message);
      }
    };

    if (!qTrim) {
      pacientesApi
        .list({
          page: patientListPage,
          size: PATIENT_LIST_PAGE_SIZE,
          order: isBirthday ? 'birthday_asc' : undefined,
          sort: isBirthday ? undefined : patientListSortToApiParam(patientListSortBy),
          statusPlano: statusPlanoFilter || undefined,
          anamneseDesatualizada: anamneseDesatualizadaFilter || undefined,
          semRetorno: !isBirthday && semRetornoFilter ? true : undefined,
          semAgendamentoFuturo: !isBirthday && semAgendamentoFuturoFilter ? true : undefined,
          ehNovo: ehNovoFilter || undefined,
          ehAniversarianteMes: ehAniversarianteFilter || undefined,
        })
        .then((pageData) => {
          if (cancelled) return;
          const mapped = (pageData.content || [])
            .map(mapBackendPatient)
            .filter(Boolean);
          setPatientListItems(mapped);
          setPatients(mapped);
          setPatientListMeta({
            first: Boolean(pageData.first),
            last: Boolean(pageData.last),
            totalPages:
              typeof pageData.totalPages === 'number' ? pageData.totalPages : 0,
            number: typeof pageData.number === 'number' ? pageData.number : 0,
            totalElements:
              typeof pageData.totalElements === 'number' ? pageData.totalElements : mapped.length,
          });
        })
        .catch(failList)
        .finally(() => {
          if (!cancelled) setPatientListLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    pacientesApi
      .search(qApi)
      .then((pageData) => {
        if (cancelled) return;
        const mapped = (pageData.content || [])
          .map(mapBackendPatient)
          .filter(Boolean);
        mapped.sort((a, b) => comparePatientsClient(a, b, patientListSortBy));
        const total = mapped.length;
        const totalPages = Math.max(1, Math.ceil(total / PATIENT_LIST_PAGE_SIZE));
        const pageIdx = Math.min(patientListPage, Math.max(0, totalPages - 1));
        if (pageIdx !== patientListPage) {
          setPatientListPage(pageIdx);
          return;
        }
        const start = pageIdx * PATIENT_LIST_PAGE_SIZE;
        const slice = mapped.slice(start, start + PATIENT_LIST_PAGE_SIZE);
        setPatientListItems(slice);
        setPatientListMeta({
          first: pageIdx === 0,
          last: pageIdx >= totalPages - 1,
          totalPages,
          number: pageIdx,
          totalElements: total,
        });
      })
      .catch(failList)
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
    patientListSortBy,
    patientListBump,
    mergePatientById,
    statusPlanoFilter,
    anamneseDesatualizadaFilter,
    semRetornoFilter,
    semAgendamentoFuturoFilter,
    ehNovoFilter,
    ehAniversarianteFilter,
  ]);

  useEffect(() => {
    if (!authEnabled) {
      setPatients([]);
      setPatientListItems([]);
    }
  }, [authEnabled]);

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
      sessionStorage.setItem(PATIENT_DETAIL_TAB_KEY, patientDetailTab || 'planos');
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

  const captureProfileNavSnapshot = useCallback(
    (cpf) => {
      if (!cpf) {
        setProfileNavSnapshot(null);
        return;
      }
      setProfileNavSnapshot(
        buildProfileNavSnapshot(
          cpf,
          patientListItems,
          patientQuickFilter,
          patientListMeta,
          patientListPage,
        ),
      );
    },
    [patientListItems, patientQuickFilter, patientListMeta, patientListPage],
  );

  /* Seleção após troca de página na nav do perfil */
  useEffect(() => {
    const pending = pendingProfileNavRef.current;
    if (!pending || !patientListItems.length) return;
    const filtered = applyPatientQuickFilter(patientListItems, patientQuickFilter);
    if (!filtered.length) {
      pendingProfileNavRef.current = null;
      return;
    }
    const target =
      pending === 'first' ? filtered[0] : filtered[filtered.length - 1];
    if (target?.cpf) {
      _setSelectedPatientCpf(target.cpf);
      try {
        sessionStorage.setItem(ACTIVE_PATIENT_CPF_KEY, target.cpf);
      } catch {
        // ignore
      }
      setProfileNavSnapshot(
        buildProfileNavSnapshot(
          target.cpf,
          patientListItems,
          patientQuickFilter,
          patientListMeta,
          patientListPage,
        ),
      );
    }
    pendingProfileNavRef.current = null;
  }, [patientListItems, patientQuickFilter, patientListMeta, patientListPage]);

  const navigateProfilePatient = useCallback(
    (delta) => {
      if (!profileNavSnapshot?.cpfs?.length) return;
      const { cpfs, indexInList } = profileNavSnapshot;
      const newIndex = indexInList + delta;
      if (newIndex >= 0 && newIndex < cpfs.length) {
        setSelectedPatientCpf(cpfs[newIndex]);
        setProfileNavSnapshot((prev) =>
          prev
            ? {
                ...prev,
                indexInList: newIndex,
                globalIndex: prev.page * PATIENT_LIST_PAGE_SIZE + newIndex + 1,
              }
            : prev,
        );
        return;
      }
      if (delta < 0 && newIndex < 0 && !patientListMeta.first) {
        pendingProfileNavRef.current = 'last';
        setPatientListPage((p) => Math.max(0, p - 1));
        return;
      }
      if (delta > 0 && newIndex >= cpfs.length && !patientListMeta.last) {
        pendingProfileNavRef.current = 'first';
        setPatientListPage((p) => p + 1);
      }
    },
    [profileNavSnapshot, patientListMeta.first, patientListMeta.last, setSelectedPatientCpf],
  );

  const profileNav = profileNavSnapshot
    ? {
        globalIndex: profileNavSnapshot.globalIndex,
        totalElements: profileNavSnapshot.totalElements,
        hasPrev:
          profileNavSnapshot.indexInList > 0 || !patientListMeta.first,
        hasNext:
          profileNavSnapshot.indexInList < profileNavSnapshot.cpfs.length - 1 ||
          !patientListMeta.last,
      }
    : null;

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
    patientListSortBy,
    setPatientListSortBy,
    bumpPatientList,
    patientListBump,
    statusPlanoFilter,
    setStatusPlanoFilter,
    anamneseDesatualizadaFilter,
    setAnamneseDesatualizadaFilter,
    semRetornoFilter,
    setSemRetornoFilter,
    semAgendamentoFuturoFilter,
    setSemAgendamentoFuturoFilter,
    ehNovoFilter,
    setEhNovoFilter,
    ehAniversarianteFilter,
    setEhAniversarianteFilter,
    patientQuickFilter,
    setPatientQuickFilter,
    profileNavSnapshot,
    captureProfileNavSnapshot,
    navigateProfilePatient,
    profileNav,
    clearProfileNavSnapshot: () => setProfileNavSnapshot(null),
  };
};
