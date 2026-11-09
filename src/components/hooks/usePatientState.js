import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useRotaAtual } from '../../rotas/useRotaAtual';
import { caminhos, lerQueryPacientes } from '../../rotas/caminhos';
import { applyPatientQuickFilter } from '../patients/patientListFilters.js';
import {
  pacientesApi,
  patientListSortToApiParam,
} from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';
import {
  patientUltimaVisitaDayFromDto,
} from '../../utils/patientProfileDerivedDates.js';
import { hojeDaClinica, instanteMs, parseDataCalendario, proximoAniversario } from '../../utils/datasClinica.js';
import { useFusoClinica } from './useFusoClinica.js';
import { useAviso } from '../../contexts/useAviso.js';
import { PREFIXO_AVISO } from '../../services/avisos/tiposAviso.js';

/** Espera do aviso PACIENTE: avisos juntos dentro dela viram uma rebusca só. */
const DEBOUNCE_AVISO_PACIENTE_MS = 400;

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
    ids: filtered.map((p) => p.id).filter((x) => x != null),
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

function ultimaVisitaSortMs(p, fuso) {
  const ms = instanteMs(p?.ultimaVinda);
  if (!Number.isNaN(ms)) return ms;
  const dia = parseDataCalendario(patientUltimaVisitaDayFromDto(p, fuso));
  return dia ? Date.UTC(dia.ano, dia.mes - 1, dia.dia) : 0;
}

function daysUntilNextBirthday(dataNascimento, hojeIso) {
  const info = dataNascimento && hojeIso ? proximoAniversario(dataNascimento, hojeIso) : null;
  return info ? info.dias : Number.MAX_SAFE_INTEGER;
}

function comparePatientsClient(a, b, sortBy, fuso, hojeIso) {
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
      return ultimaVisitaSortMs(b, fuso) - ultimaVisitaSortMs(a, fuso);
    case 'visita-asc':
      return ultimaVisitaSortMs(a, fuso) - ultimaVisitaSortMs(b, fuso);
    case 'birthday-asc':
      return daysUntilNextBirthday(a.dataNascimento, hojeIso) - daysUntilNextBirthday(b.dataNascimento, hojeIso);
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
  const { fuso } = useFusoClinica();
  const rota = useRotaAtual();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [patientListItems, setPatientListItems] = useState([]);
  const [patientListLoading, setPatientListLoading] = useState(false);
  const [patientListBump, setPatientListBump] = useState(0);
  /** Bump da rebusca por aviso PACIENTE (separado do `patientListBump`, que liga o loading da lista, do KPI e do perfil). */
  const [patientListAvisoBump, setPatientListAvisoBump] = useState(0);
  /** `true` quando a próxima busca da lista vem de um aviso: sem loading e, em erro, mantém a tela. */
  const rebuscaSilenciosaRef = useRef(false);
  const [patientListMeta, setPatientListMeta] = useState({
    first: true,
    last: true,
    totalPages: 0,
    number: 0,
    totalElements: 0,
  });
  const [profileNavSnapshot, setProfileNavSnapshot] = useState(null);
  // Página, ordem e filtros server-side vêm do endereço (/pacientes?...). Fora de /pacientes (perfil) vale o último lido.
  const queryRef = useRef(lerQueryPacientes(''));
  const naListaRef = useRef(true);
  naListaRef.current = rota.rotaId === 'pacientes';
  const pacienteRotaRef = useRef(null);
  pacienteRotaRef.current = rota.pacienteId ?? null;
  if (naListaRef.current) queryRef.current = rota.query;
  const q = queryRef.current;
  const [, setTick] = useState(0);

  const escreverQuery = useCallback((nova, { navegar = true } = {}) => {
    queryRef.current = nova;
    if (navegar) navigate(caminhos.pacientes(nova), { replace: true });
    else setTick((t) => t + 1);
  }, [navigate]);

  const igual = (x) => x;
  const patientQuickFilter = q.quickFilter ?? 'todos';
  const patientListSortBy = q.ordem;
  const statusPlanoFilter = q.statusPlano ?? '';
  const anamneseDesatualizadaFilter = q.anamneseDesatualizada;
  const semRetornoFilter = q.semRetorno;
  const semAgendamentoFuturoFilter = q.semAgendamentoFuturo;
  const ehNovoFilter = q.ehNovo;
  const ehAniversarianteFilter = q.ehAniversariante;

  // Setters estáveis, com a assinatura de useState (valor ou função) sobre um campo da query; trocar filtro/ordem volta à página 0.
  const {
    setPatientListPage, setPatientQuickFilter, setPatientListSortBy, setStatusPlanoFilter,
    setAnamneseDesatualizadaFilter, setSemRetornoFilter, setSemAgendamentoFuturoFilter,
    setEhNovoFilter, setEhAniversarianteFilter,
  } = useMemo(() => {
    const campo = (nome, paraQuery, doQuery, extra) => (v) => {
      const atual = queryRef.current;
      const anterior = doQuery(atual[nome]);
      const novo = typeof v === 'function' ? v(anterior) : v;
      if (novo === anterior) return;
      escreverQuery({ ...atual, [nome]: paraQuery(novo), ...(extra ? extra(novo) : null), pagina: 0 });
    };
    return {
      // fora de /pacientes (perfil cruzando página) não navega: escreverQuery só guarda no ref (a frente 2B-3 trata o resto)
      setPatientListPage: (v) => {
        const atual = queryRef.current;
        const pagina = Math.max(0, typeof v === 'function' ? v(atual.pagina) : v);
        if (pagina !== atual.pagina) escreverQuery({ ...atual, pagina }, { navegar: naListaRef.current });
      },
      setPatientQuickFilter: campo('quickFilter', (x) => (x === 'todos' ? null : x), (x) => x ?? 'todos'),
      // birthday-asc ignora semRetorno/semAgendamentoFuturo no backend: trocar para esse sort limpa os dois
      setPatientListSortBy: campo('ordem', igual, igual, (o) =>
        (o === 'birthday-asc' ? { semRetorno: false, semAgendamentoFuturo: false } : null)),
      setStatusPlanoFilter: campo('statusPlano', (x) => x || null, (x) => x ?? ''), // '' | 'sem_plano' | 'plano_ativo'
      setAnamneseDesatualizadaFilter: campo('anamneseDesatualizada', Boolean, igual),
      setSemRetornoFilter: campo('semRetorno', Boolean, igual),
      setSemAgendamentoFuturoFilter: campo('semAgendamentoFuturo', Boolean, igual),
      setEhNovoFilter: campo('ehNovo', Boolean, igual),
      setEhAniversarianteFilter: campo('ehAniversariante', Boolean, igual),
    };
  }, [escreverQuery]);

  const [selectedPatientCpf, _setSelectedPatientCpf] = useState(null);
  const [patientSearchQuery, setPatientSearchQueryRaw] = useState('');
  // Busca de texto com menos páginas que a do endereço: a página exibida é derivada aqui, sem escrever no endereço.
  const [limitePagina, setLimitePagina] = useState(null);
  const patientListPage =
    limitePagina && limitePagina.de === q.pagina && limitePagina.busca === patientSearchQuery.trim()
      ? Math.min(q.pagina, limitePagina.ultima)
      : q.pagina;
  // trocar a busca de texto volta à página 0 (a busca nunca vai no endereço)
  const setPatientSearchQuery = useCallback((v) => {
    setPatientSearchQueryRaw(v);
    if (queryRef.current.pagina > 0) escreverQuery({ ...queryRef.current, pagina: 0 }, { navegar: naListaRef.current });
  }, [escreverQuery]);

  const refreshPatients = useCallback(async () => {
    if (!authEnabled) return;
    try {
      const pageData = await pacientesApi.search('');
      const lista = pageData.content || [];
      const mapOpts = { fuso, hojeIso: hojeDaClinica(fuso) };
      const nova = lista.map((dto) => mapBackendPatient(dto, mapOpts)).filter(Boolean);
      // Paciente da rota fora da 1ª página: o salvamento já pôs a cópia nova em `patients`; mantê-la evita rebusca e a lista piscando.
      setPatients((prev) => {
        const id = pacienteRotaRef.current;
        const fica = id != null ? prev.find((p) => String(p?.id) === String(id)) : null;
        return fica && !nova.some((p) => String(p.id) === String(id)) ? [...nova, fica] : nova;
      });
    } catch (err) {
      if (err.status === 401) {
        console.warn('[usePatientState] Sessão ausente ou expirada; lista de pacientes não carregada.');
      } else {
        console.warn('[usePatientState] Falha ao buscar pacientes (search):', err.message);
      }
    }
  }, [authEnabled, fuso]);

  const bumpPatientList = useCallback(() => {
    setPatientListBump((x) => x + 1);
  }, []);

  /**
   * Aviso PACIENTE (criado/editado em outra aba ou aparelho): rebusca a página atual da lista, com os mesmos
   * filtros, ordenação e busca de texto, sem ligar o loading e sem limpar a tela. Não usa `bumpPatientList`.
   */
  const rebuscarListaPorAviso = useCallback(() => {
    if (!authEnabled) return;
    rebuscaSilenciosaRef.current = true;
    setPatientListAvisoBump((x) => x + 1);
  }, [authEnabled]);
  useAviso(PREFIXO_AVISO.PACIENTE, rebuscarListaPorAviso, { debounceMs: DEBOUNCE_AVISO_PACIENTE_MS });

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
      rebuscaSilenciosaRef.current = false;
      return undefined;
    }

    let cancelled = false;
    const silencioso = rebuscaSilenciosaRef.current;
    rebuscaSilenciosaRef.current = false;
    if (!silencioso) setPatientListLoading(true);

    const qTrim = patientSearchQuery.trim();
    const qApi = queryForPacientesSearch(patientSearchQuery);
    const isBirthday = patientListSortBy === 'birthday-asc';
    const mapOpts = { fuso, hojeIso: hojeDaClinica(fuso) };

    const failList = (err) => {
      if (cancelled) return;
      if (silencioso) {
        // rebusca por aviso que falhou: a página que já está na tela continua
        console.warn('[usePatientState] Falha ao rebuscar a lista de pacientes (aviso):', err?.message);
        return;
      }
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
            .map((dto) => mapBackendPatient(dto, mapOpts))
            .filter(Boolean);
          setPatientListItems(mapped);
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
          .map((dto) => mapBackendPatient(dto, mapOpts))
          .filter(Boolean);
        mapped.sort((a, b) => comparePatientsClient(a, b, patientListSortBy, mapOpts.fuso, mapOpts.hojeIso));
        const total = mapped.length;
        const totalPages = Math.max(1, Math.ceil(total / PATIENT_LIST_PAGE_SIZE));
        const pageIdx = Math.min(patientListPage, Math.max(0, totalPages - 1));
        if (pageIdx !== patientListPage) {
          // a busca seguinte (página ajustada) herda o modo silencioso da rebusca por aviso
          if (silencioso) rebuscaSilenciosaRef.current = true;
          setLimitePagina({ de: patientListPage, busca: qTrim, ultima: pageIdx });
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
    patientListAvisoBump,
    mergePatientById,
    statusPlanoFilter,
    anamneseDesatualizadaFilter,
    semRetornoFilter,
    semAgendamentoFuturoFilter,
    ehNovoFilter,
    ehAniversarianteFilter,
    fuso,
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
      return resolved != null && String(resolved).trim() !== '' ? String(resolved) : null;
    });
  }, []);

  /** Compat: ordenação “aniversário” espelhada para código que ainda lê `patientsListOrder`. */
  const patientsListOrder = patientListSortBy === 'birthday-asc' ? 'birthday_asc' : null;
  const setPatientsListOrder = useCallback((ord) => {
    if (ord === 'birthday_asc') setPatientListSortBy('birthday-asc');
    else setPatientListSortBy('nome-asc');
  }, [setPatientListSortBy]);

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

  // Mesma chamada e mesmos filtros da lista (efeito acima), para uma página qualquer; devolve { items, meta }.
  const buscarPagina = useCallback(async (pagina) => {
    const mapOpts = { fuso, hojeIso: hojeDaClinica(fuso) };
    const mapear = (pageData) => (pageData.content || []).map((dto) => mapBackendPatient(dto, mapOpts)).filter(Boolean);
    const qTrim = patientSearchQuery.trim();
    const isBirthday = patientListSortBy === 'birthday-asc';
    if (!qTrim) {
      const pageData = await pacientesApi.list({
        page: pagina,
        size: PATIENT_LIST_PAGE_SIZE,
        order: isBirthday ? 'birthday_asc' : undefined,
        sort: isBirthday ? undefined : patientListSortToApiParam(patientListSortBy),
        statusPlano: statusPlanoFilter || undefined,
        anamneseDesatualizada: anamneseDesatualizadaFilter || undefined,
        semRetorno: !isBirthday && semRetornoFilter ? true : undefined,
        semAgendamentoFuturo: !isBirthday && semAgendamentoFuturoFilter ? true : undefined,
        ehNovo: ehNovoFilter || undefined,
        ehAniversarianteMes: ehAniversarianteFilter || undefined,
      });
      const items = mapear(pageData);
      return {
        items,
        meta: {
          first: Boolean(pageData.first),
          last: Boolean(pageData.last),
          totalPages: typeof pageData.totalPages === 'number' ? pageData.totalPages : 0,
          number: typeof pageData.number === 'number' ? pageData.number : 0,
          totalElements: typeof pageData.totalElements === 'number' ? pageData.totalElements : items.length,
        },
      };
    }
    const todos = mapear(await pacientesApi.search(queryForPacientesSearch(patientSearchQuery)));
    todos.sort((a, b) => comparePatientsClient(a, b, patientListSortBy, mapOpts.fuso, mapOpts.hojeIso));
    const totalPages = Math.max(1, Math.ceil(todos.length / PATIENT_LIST_PAGE_SIZE));
    const start = pagina * PATIENT_LIST_PAGE_SIZE;
    return {
      items: todos.slice(start, start + PATIENT_LIST_PAGE_SIZE),
      meta: { first: pagina === 0, last: pagina >= totalPages - 1, totalPages, number: pagina, totalElements: todos.length },
    };
  }, [
    fuso, patientSearchQuery, patientListSortBy, statusPlanoFilter, anamneseDesatualizadaFilter,
    semRetornoFilter, semAgendamentoFuturoFilter, ehNovoFilter, ehAniversarianteFilter,
  ]);

  // Setas do perfil: cada troca de pessoa EMPILHA no histórico, mantendo a aba só quando o endereço já está numa aba.
  const navigateProfilePatient = useCallback(
    async (delta) => {
      if (!profileNavSnapshot?.ids?.length) return;
      const { ids, indexInList, page } = profileNavSnapshot;
      const aba = rota.rotaId === 'pacienteAba' ? rota.patientDetailTab : undefined;
      const newIndex = indexInList + delta;
      if (newIndex >= 0 && newIndex < ids.length) {
        setProfileNavSnapshot((prev) =>
          prev ? { ...prev, indexInList: newIndex, globalIndex: prev.page * PATIENT_LIST_PAGE_SIZE + newIndex + 1 } : prev);
        navigate(caminhos.paciente(ids[newIndex], aba));
        return;
      }
      if (delta < 0 ? patientListMeta.first : patientListMeta.last) return;
      const novaPagina = Math.max(0, page + (delta < 0 ? -1 : 1));
      try {
        const { items, meta } = await buscarPagina(novaPagina);
        const filtrados = applyPatientQuickFilter(items, patientQuickFilter);
        const alvo = delta < 0 ? filtrados[filtrados.length - 1] : filtrados[0];
        if (alvo?.id == null) return;
        setPatientListPage(novaPagina); // fora de /pacientes só guarda no ref (a lista rebusca igual)
        setProfileNavSnapshot(buildProfileNavSnapshot(alvo.cpf, items, patientQuickFilter, meta, novaPagina));
        navigate(caminhos.paciente(alvo.id, aba));
      } catch (err) {
        console.warn('[usePatientState] Falha ao buscar a página vizinha do perfil:', err?.message);
      }
    },
    [profileNavSnapshot, rota, navigate, patientListMeta.first, patientListMeta.last, buscarPagina, patientQuickFilter, setPatientListPage],
  );

  const profileNav = profileNavSnapshot
    ? {
        globalIndex: profileNavSnapshot.globalIndex,
        totalElements: profileNavSnapshot.totalElements,
        hasPrev:
          profileNavSnapshot.indexInList > 0 || !patientListMeta.first,
        hasNext:
          profileNavSnapshot.indexInList < profileNavSnapshot.ids.length - 1 ||
          !patientListMeta.last,
      }
    : null;

  return {
    patients,
    setPatients,
    selectedPatientCpf,
    setSelectedPatientCpf,
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
