import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { useToast } from '../../contexts/useToast.js';
import { usePapel } from '../../hooks/usePapel';
import {
  agendasApi,
  anamneseApi,
  catalogosApi,
  confirmacaoApi,
  disponibilidadeApi,
  equipeApi,
  pacientesApi,
  procedimentosApi,
} from '../../services/api';
import { mapBackendPatient } from '../../utils/patientMapping';
import { resolveAnamneseDesatualizada } from '../../utils/patientAnamneseAlerts.js';
import { useProcedimentosOptions } from '../../hooks/useProcedimentosOptions';
import { abrirWhatsApp } from '../../utils/whatsapp.js';
import { formatAgendamentoApiError, isAgendaSlotOverlapError } from '../../utils/agendaErrors';
import { monthRangeIso, toDateKey } from '../../utils/agendaDateUtils';
import {
  fetchKpiDrilldownRows,
  filterKpiCountableAppointments,
  isKpiCountableAgendaDto,
} from '../../utils/agendaKpiDrilldown';
import {
  buildAgendaBloqueioCreateBody,
  buildAgendaCreateBody,
  buildAgendaUpdateBody,
  fetchDashboardAppointmentsForRange,
  normalizeApiList,
} from '../../utils/agendaDashboardMapping';
import {
  buildDaySlotList,
  buildMonthHeatmap,
  buildNeutralMonthHeatmap,
} from '../../utils/agendaDisponibilidadeBuilder.js';
import {
  findFirstConflictHhmm,
  findNextFreeSlotAcrossDays,
  minutesToHhmm,
  occupiedIntervalsFromAgendaDtos,
  proposalOverlapsOccupied,
} from '../../utils/agendaAvailability';
import {
  dayBoundsFromWindows,
  getDayWindowsForIso,
} from '../../utils/disponibilidadeDayWindows.js';
import { useConfirmacaoForaDisp } from './ConfirmacaoForaDispModal';
import { executarComBypassDisp } from '../../services/agendasHelpers';
import { addMinutesToTime } from '../../utils/agendaMapping';
import {
  NO_SHOW_MOTIVO_CODIGO,
  NO_SHOW_OBS_PREFIX,
  resolveMotivoCancelamentoIdByCodigo,
} from '../../utils/agendaCancelamentoMotivo.js';
import { isRoleAgendaPreselect } from './agendaRoleConstants.js';
import { DURACOES_PILL, snapDuracaoToPill } from '../../utils/agendaDuracaoPills.js';
import {
  BLOQUEIO_TIPO_CODIGO,
  resolveTipoProcedimentoIdByCodigo,
} from '../../utils/agendaTipoProcedimento.js';
import {
  ALL_STATUS_FILTERS,
  countAppointmentsByStatusBucket,
  filterAppointmentsByStatusFilters,
} from '../../utils/agendaDayInsights.js';

const BLOQUEIO_REMOVER_MOTIVO_TEXTO = 'Bloqueio removido';
const CANCEL_MOTIVO_OUTRO_CODIGO = 'outro';

const STATUS_LABELS = {
  confirmado: 'confirmado',
  pendente: 'pendente',
  cancelado: 'cancelado',
};

const DUR_MIN = 15;
const DUR_MAX = 150;
const DUR_STEP = 5;

/** Opções de duração (min) para o select da agenda: 15–150, passo 5. */
export const AGENDA_DURACAO_MINUTOS_OPCOES = Object.freeze(
  Array.from({ length: (DUR_MAX - DUR_MIN) / DUR_STEP + 1 }, (_, i) => DUR_MIN + i * DUR_STEP)
);

/** Encaixa um valor vindo da API na grade 15–150 (múltiplos de 5). */
export function snapAgendaDuracaoMin(value) {
  const x = Number(value);
  if (!Number.isFinite(x)) return 60;
  const k = Math.round((x - DUR_MIN) / DUR_STEP);
  const snapped = DUR_MIN + k * DUR_STEP;
  return Math.min(DUR_MAX, Math.max(DUR_MIN, snapped));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function toLocalDateIso(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeEquipeList(raw) {
  const rows = Array.isArray(raw) ? raw : raw?.content && Array.isArray(raw.content) ? raw.content : [];
  return rows
    .map((p) => {
      const roleUserId = String(p?.roleUserId || p?.role_user_id || p?.id || '').trim();
      const nome = p?.nomeCompleto || p?.nome || p?.name || p?.username || 'Profissional';
      return roleUserId
        ? {
            roleUserId,
            nome: String(nome).trim() || 'Profissional',
            roleNome: p?.roleNome || p?.role_nome || p?.papel || p?.role || '',
            fotoUrl: p?.fotoUrl || p?.foto_url || p?.urlFoto || '',
            especialidade: p?.especialidade || p?.specialty || '',
          }
        : null;
    })
    .filter(Boolean);
}

function normalizePatientOption(patient) {
  const id = patient?.id || patient?.cpf || patient?.nome || patient?.nomeCompleto;
  const nome = patient?.nome || patient?.nomeCompleto || patient?.name || 'Paciente';
  const telefone =
    patient?.telefone ||
    patient?.phone ||
    patient?.telefoneNumero ||
    patient?.telefonePrincipal ||
    '';
  return { id: String(id || nome), nome, telefone, raw: patient };
}

function defaultBloqueioForm(selectedDay) {
  return {
    data: selectedDay || toLocalDateIso(),
    horaInicio: '09:00',
    horaFim: '10:00',
    duracaoMin: 60,
    diaInteiro: false,
    motivo: '',
  };
}

function bloqueioBoundsFromDisponibilidade(iso, disponibilidade) {
  const windows = getDayWindowsForIso(iso, disponibilidade);
  if (!windows.length) {
    return { ok: false, error: 'Profissional não atende neste dia.' };
  }
  const { dayStartMin, dayEndMin } = dayBoundsFromWindows(windows);
  return {
    ok: true,
    horaInicio: minutesToHhmm(dayStartMin),
    horaFim: minutesToHhmm(dayEndMin),
  };
}

function bloqueioTimeToMinutes(t) {
  if (t == null || t === '') return 0;
  const parts = String(t).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function defaultForm(selectedDay, _patientOptions, firstProcedimentoOption) {
  const proc = firstProcedimentoOption || {};
  return {
    pacienteId: '',
    pacienteNome: '',
    telefone: '',
    procedimentoNome: '',
    catalogoProcedimentoSaudeIds: proc.id ? [String(proc.id)] : [],
    data: selectedDay || toLocalDateIso(),
    horaInicio: '',
    duracaoMin: 60,
    observacao: '',
  };
}

function buildCalendarCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toLocalDateIso(date);
    return {
      iso,
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: iso === toLocalDateIso(),
    };
  });
}

function groupByDate(rows) {
  return rows.reduce((acc, row) => {
    const key = toDateKey(row.data);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

export function formatLongDate(iso, options = {}) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    ...options,
  }).format(date);
}

function parseIsoLocal(iso) {
  const k = toDateKey(iso) || String(iso || '');
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Domingo da semana que contém a data `iso` (YYYY-MM-DD). */
export function startOfWeekSundayIso(iso) {
  const date = parseIsoLocal(iso);
  date.setDate(date.getDate() - date.getDay());
  return toLocalDateIso(date);
}

export function addDaysIso(iso, delta) {
  const date = parseIsoLocal(iso);
  date.setDate(date.getDate() + delta);
  return toLocalDateIso(date);
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatWeekRangeLabel(startIso, endIso) {
  const s = toDateKey(startIso);
  const e = toDateKey(endIso);
  if (!s || !e) return '';
  const [y1, m1, d1] = s.split('-').map(Number);
  const [y2, m2, d2] = e.split('-').map(Number);
  const left = `${d1} de ${MONTH_ABBR[m1 - 1]}`;
  const right = `${d2} de ${MONTH_ABBR[m2 - 1]}`;
  if (y1 !== y2) return `${left} de ${y1} – ${right} de ${y2}`;
  return `${left} – ${right} de ${y2}`;
}

export function useAgendaPage({ patients = [], authEnabled = false } = {}) {
  const { roleUserId, roleNome } = useOrg();
  const { isNivel1 } = usePapel();
  const { success: toastSuccess, error: toastError } = useToast();
  const todayIso = toLocalDateIso();
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [viewMode, setViewMode] = useState('grid');
  const [statusFilters, setStatusFilters] = useState(() => new Set(ALL_STATUS_FILTERS));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const { options: procedimentosClinica } = useProcedimentosOptions({ enabled: authEnabled });
  const [form, setForm] = useState(() => defaultForm(todayIso, [], null));
  const [formErrors, setFormErrors] = useState({});
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [hojeCount, setHojeCount] = useState(0);
  const [weekStartIso, setWeekStartIso] = useState(() => startOfWeekSundayIso(toLocalDateIso()));
  const [weekGridAppointments, setWeekGridAppointments] = useState([]);
  const [disponibilidades, setDisponibilidades] = useState({});
  const [slotsOcupados, setSlotsOcupados] = useState([]);
  const [slotsOcupadosLoading, setSlotsOcupadosLoading] = useState(false);
  const [submittingReagendar, setSubmittingReagendar] = useState(false);
  const [bloqueioModalOpen, setBloqueioModalOpen] = useState(false);
  const [bloqueioForm, setBloqueioForm] = useState(() => defaultBloqueioForm(todayIso));
  const [bloqueioFormErrors, setBloqueioFormErrors] = useState({});
  const [submittingBloqueio, setSubmittingBloqueio] = useState(false);
  const [submittingRemoverBloqueioId, setSubmittingRemoverBloqueioId] = useState('');
  /** Create modal aberto pelo perfil: paciente não pode ser trocado. */
  const [patientSelectLocked, setPatientSelectLocked] = useState(false);
  const [pacienteContext, setPacienteContext] = useState(null);
  const [pacienteContextLoading, setPacienteContextLoading] = useState(false);
  /** Profissional do modal (create = sessão; edit = do agendamento). */
  const [roleUserIdAgenda, setRoleUserIdAgenda] = useState('');
  /** Mapa {catalogoProcedimentoSaudeId → agendaId original} para reagendamento em grupo. */
  const [grupoReagendarMap, setGrupoReagendarMap] = useState({});
  /** Mapa {catalogoProcedimentoSaudeId → duracaoMin real} extraído de horaFim−horaInicio do DTO original. */
  const [grupoReagendarDuracoes, setGrupoReagendarDuracoes] = useState({});
  const [equipeList, setEquipeList] = useState([]);
  const [equipeLoading, setEquipeLoading] = useState(false);
  const [equipeError, setEquipeError] = useState('');
  const equipeFetchedRef = useRef(false);
  const dispMonthCacheRef = useRef({});
  /** Evita double-fetch quando saveAppointment já chamou loadMonth com mês explícito. */
  const skipNextAutoLoadRef = useRef(false);
  const disponibilidadesRef = useRef(disponibilidades);
  disponibilidadesRef.current = disponibilidades;

  const [dispMonthDate, setDispMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dispCalendarioDia, setDispCalendarioDia] = useState('');
  const [dispMonthDtos, setDispMonthDtos] = useState([]);
  const [dispMonthLoading, setDispMonthLoading] = useState(false);
  const [dispMonthError, setDispMonthError] = useState('');

  const { modal: foraDispModal, abrirConfirmacao: abrirConfirmacaoForaDisp } =
    useConfirmacaoForaDisp();

  const procedimentoOptions = useMemo(
    () =>
      (Array.isArray(procedimentosClinica) ? procedimentosClinica : [])
        .map((c) => ({
          id: c.id,
          nome: c.nomeProcedimento,
          tipoCodigo: c.tipoCodigo || '',
          duracaoMin: c.duracaoMin || 60,
        }))
        .filter((o) => o.id && o.nome),
    [procedimentosClinica]
  );

  const patientOptions = useMemo(
    () => (Array.isArray(patients) ? patients : []).map(normalizePatientOption),
    [patients]
  );

  useEffect(() => {
    if (modalMode) return;
    setRoleUserIdAgenda(String(roleUserId || '').trim());
  }, [roleUserId, modalMode]);

  useEffect(() => {
    if (!authEnabled) return;
    if (equipeFetchedRef.current) return;
    let cancelled = false;
    equipeFetchedRef.current = true;
    setEquipeLoading(true);
    setEquipeError('');
    equipeApi
      .list()
      .then((raw) => {
        if (cancelled) return;
        setEquipeList(normalizeEquipeList(raw));
      })
      .catch((e) => {
        if (cancelled) return;
        setEquipeList([]);
        setEquipeError(e?.message || 'Não foi possível carregar a equipe.');
      })
      .finally(() => {
        if (!cancelled) setEquipeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authEnabled]);

  const ensureEquipeLoaded = useCallback(async () => {
    if (!authEnabled) return;
    if (equipeFetchedRef.current) return;
    equipeFetchedRef.current = true;
    setEquipeLoading(true);
    setEquipeError('');
    try {
      const raw = await equipeApi.list();
      setEquipeList(normalizeEquipeList(raw));
    } catch (e) {
      setEquipeList([]);
      setEquipeError(e?.message || 'Não foi possível carregar a equipe.');
    } finally {
      setEquipeLoading(false);
    }
  }, [authEnabled]);

  const currentYm = useMemo(() => monthKey(monthDate), [monthDate]);

  const loadKpiDrilldownRows = useCallback(
    async ({ period, status, profissionalRoleUserId }) => {
      if (!authEnabled) return [];
      return fetchKpiDrilldownRows({
        period,
        status,
        profissionalRoleUserId,
        todayIso,
        monthDate,
        monthLoadedAppointments: filterAppointmentsByStatusFilters(appointments, statusFilters),
        currentYm,
      });
    },
    [authEnabled, todayIso, monthDate, appointments, statusFilters, currentYm],
  );

  useEffect(() => {
    if (!Array.isArray(appointments) || appointments.length === 0) return;
    const idsUnicos = [...new Set(appointments.map((a) => a.roleUserId).filter(Boolean))];
    const idsNovos = idsUnicos.filter((id) => !disponibilidades[id]);
    if (idsNovos.length === 0) return;

    let alive = true;
    Promise.all(
      idsNovos.map((id) =>
        disponibilidadeApi
          .buscar(id)
          .then((d) => [id, d])
          .catch(() => [id, null])
      )
    ).then((pares) => {
      if (!alive) return;
      setDisponibilidades((prev) => {
        const novo = { ...prev };
        for (const [id, d] of pares) {
          if (d) novo[id] = d;
        }
        return novo;
      });
    });
    return () => {
      alive = false;
    };
  }, [appointments, disponibilidades]);

  const loadMonth = useCallback(async (overrideMonthDate) => {
    if (!authEnabled) {
      setAppointments([]);
      setHojeCount(0);
      setLoading(false);
      setError('');
      return;
    }
    const targetMonth = overrideMonthDate ?? monthDate;
    setLoading(true);
    setError('');
    try {
      const { start, end } = monthRangeIso(targetMonth);
      const rows = await fetchDashboardAppointmentsForRange(start, end);
      setAppointments(rows);

      const hoje = toLocalDateIso();
      try {
        const rawSlots = await agendasApi.byRange(hoje, hoje);
        const dtos = normalizeApiList(rawSlots).filter(isKpiCountableAgendaDto);
        setHojeCount(dtos.length);
      } catch {
        setHojeCount(0);
      }
    } catch (e) {
      setError(e?.message || 'Não foi possível carregar a agenda.');
      setAppointments([]);
      setHojeCount(0);
    } finally {
      setLoading(false);
    }
  }, [authEnabled, monthDate]);

  useEffect(() => {
    if (skipNextAutoLoadRef.current) {
      skipNextAutoLoadRef.current = false;
      return;
    }
    loadMonth();
  }, [loadMonth]);

  const dispCacheKey = useCallback((roleId, md) => {
    return `${String(roleId || '').trim()}:${monthKey(md)}`;
  }, []);

  const ensureDispMonthLoaded = useCallback(
    async (monthDateTarget) => {
      const role = String(roleUserIdAgenda || '').trim();
      if (!role || !authEnabled) {
        setDispMonthDtos([]);
        return [];
      }
      const key = dispCacheKey(role, monthDateTarget);
      const hit = dispMonthCacheRef.current[key];
      if (hit?.dtos) {
        setDispMonthDtos(hit.dtos);
        return hit.dtos;
      }

      setDispMonthLoading(true);
      setDispMonthError('');
      try {
        const { start, end } = monthRangeIso(monthDateTarget);
        const dispCached = disponibilidadesRef.current[role];
        const [raw, dispRaw] = await Promise.all([
          agendasApi.byRange(start, end, { profissionalRoleUserId: role }),
          dispCached ? Promise.resolve(dispCached) : disponibilidadeApi.buscar(role),
        ]);
        const dtos = normalizeApiList(raw);
        dispMonthCacheRef.current[key] = { dtos };
        if (!dispCached && Array.isArray(dispRaw)) {
          setDisponibilidades((prev) => ({ ...prev, [role]: dispRaw }));
        }
        setDispMonthDtos(dtos);
        return dtos;
      } catch (e) {
        setDispMonthError(e?.message || 'Não foi possível carregar a disponibilidade.');
        setDispMonthDtos([]);
        return [];
      } finally {
        setDispMonthLoading(false);
      }
    },
    [authEnabled, dispCacheKey, roleUserIdAgenda]
  );

  useEffect(() => {
    if (!modalMode) return undefined;
    const iso = toDateKey(form.data) || todayIso;
    setDispCalendarioDia(iso);
    const [y, m] = iso.split('-').map(Number);
    setDispMonthDate(new Date(y, m - 1, 1));
    return undefined;
    // Só ao abrir/fechar modal — não seguir form.data (coluna esquerda).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form.data intencionalmente omitido
  }, [modalMode, todayIso]);

  useEffect(() => {
    if (!authEnabled || !modalMode || !String(roleUserIdAgenda || '').trim()) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await ensureDispMonthLoaded(dispMonthDate);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [authEnabled, modalMode, roleUserIdAgenda, dispMonthDate, ensureDispMonthLoaded]);

  useEffect(() => {
    if (!bloqueioModalOpen) return undefined;
    const iso = toDateKey(bloqueioForm.data) || todayIso;
    setDispCalendarioDia(iso);
    const [y, m] = iso.split('-').map(Number);
    setDispMonthDate(new Date(y, m - 1, 1));
    return undefined;
    // Só ao abrir/fechar modal de bloqueio — não seguir bloqueioForm.data a cada clique.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bloqueioForm.data intencionalmente omitido
  }, [bloqueioModalOpen, todayIso]);

  useEffect(() => {
    if (!authEnabled || !bloqueioModalOpen || !String(roleUserIdAgenda || '').trim()) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await ensureDispMonthLoaded(dispMonthDate);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [authEnabled, bloqueioModalOpen, roleUserIdAgenda, dispMonthDate, ensureDispMonthLoaded]);

  useEffect(() => {
    if (!authEnabled || !modalMode || !form.data) {
      setSlotsOcupados([]);
      setSlotsOcupadosLoading(false);
      return undefined;
    }
    const role = String(roleUserIdAgenda || '').trim();
    const skipId = editingAppointment?.agendaId;
    const formDay = toDateKey(form.data);
    const cacheKey = dispCacheKey(role, dispMonthDate);
    const cached = dispMonthCacheRef.current[cacheKey];
    const ym = monthKey(dispMonthDate);
    if (cached?.dtos && formDay.startsWith(ym)) {
      const dayDtos = cached.dtos.filter(
        (d) => d?.dataAgendamento && String(d.dataAgendamento).slice(0, 10) === formDay
      );
      const intervals = occupiedIntervalsFromAgendaDtos(dayDtos, {
        activeOnly: true,
        profissionalRoleUserId: role || undefined,
        excludeAgendaId: skipId,
      });
      setSlotsOcupados(intervals);
      setSlotsOcupadosLoading(false);
      return undefined;
    }

    let cancelled = false;
    setSlotsOcupadosLoading(true);
    agendasApi
      .byRange(formDay, formDay, role ? { profissionalRoleUserId: role } : {})
      .then((raw) => {
        if (cancelled) return;
        const dtos = normalizeApiList(raw);
        const intervals = occupiedIntervalsFromAgendaDtos(dtos, {
          activeOnly: true,
          profissionalRoleUserId: role || undefined,
          excludeAgendaId: skipId,
        });
        setSlotsOcupados(intervals);
      })
      .catch(() => {
        if (!cancelled) setSlotsOcupados([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsOcupadosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    authEnabled,
    modalMode,
    form.data,
    roleUserIdAgenda,
    editingAppointment?.agendaId,
    dispMonthDate,
    dispCacheKey,
  ]);

  const horarioConflita = useMemo(
    () => (modalMode ? proposalOverlapsOccupied(form.horaInicio, form.duracaoMin, slotsOcupados) : false),
    [modalMode, form.horaInicio, form.duracaoMin, slotsOcupados]
  );

  const horarioConflitoCom = useMemo(
    () =>
      modalMode && horarioConflita
        ? findFirstConflictHhmm(form.horaInicio, form.duracaoMin, slotsOcupados)
        : null,
    [modalMode, horarioConflita, form.horaInicio, form.duracaoMin, slotsOcupados]
  );

  const selectPaciente = useCallback((pacienteId, paciente) => {
    const id = String(pacienteId || '').trim();
    const nome = paciente?.nome || paciente?.nomeCompleto || paciente?.name || '';
    const telefone =
      paciente?.telefone ||
      paciente?.phone ||
      paciente?.telefoneNumero ||
      paciente?.telefonePrincipal ||
      '';
    setForm((prev) => ({
      ...prev,
      pacienteId: id,
      pacienteNome: nome,
      telefone,
    }));
    setFormErrors((prev) => ({ ...prev, pacienteId: undefined }));
  }, []);

  const clearPacienteSelection = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      pacienteId: '',
      pacienteNome: '',
      telefone: '',
    }));
    setPacienteContext(null);
    setPacienteContextLoading(false);
    setFormErrors((prev) => ({ ...prev, pacienteId: undefined }));
  }, []);

  useEffect(() => {
    const id = String(form.pacienteId || '').trim();
    if (!modalMode || !id) {
      setPacienteContext(null);
      setPacienteContextLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPacienteContextLoading(true);
    (async () => {
      try {
        const [dto, procs, anamList] = await Promise.all([
          pacientesApi.get(id),
          procedimentosApi.byPaciente(id).catch(() => []),
          anamneseApi.listPaciente(id).catch(() => []),
        ]);
        if (cancelled) return;
        const base = mapBackendPatient(dto);
        const procedures = Array.isArray(procs) ? procs : [];
        const anamneseList = Array.isArray(anamList) ? anamList : [];
        setPacienteContext({
          ...base,
          procedures,
          anamneseList,
          anamneseDesatualizada: resolveAnamneseDesatualizada(base, anamneseList),
        });
      } catch {
        if (!cancelled) setPacienteContext(null);
      } finally {
        if (!cancelled) setPacienteContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalMode, form.pacienteId]);

  const dispProfissionalDisponibilidade = useMemo(() => {
    const role = String(roleUserIdAgenda || '').trim();
    if (!role) return [];
    return Array.isArray(disponibilidades[role]) ? disponibilidades[role] : [];
  }, [disponibilidades, roleUserIdAgenda]);

  const dispHeatmap = useMemo(() => {
    if (!modalMode) return null;
    const role = String(roleUserIdAgenda || '').trim();
    if (!role) return null;
    return buildMonthHeatmap({
      monthDate: dispMonthDate,
      disponibilidade: dispProfissionalDisponibilidade,
      dtos: dispMonthDtos,
      todayIso,
      excludeAgendaId: editingAppointment?.agendaId,
      profissionalRoleUserId: role,
      selectedIso: toDateKey(form.data) || dispCalendarioDia,
    });
  }, [
    modalMode,
    dispMonthDate,
    dispProfissionalDisponibilidade,
    dispMonthDtos,
    todayIso,
    editingAppointment?.agendaId,
    roleUserIdAgenda,
    dispCalendarioDia,
    form.data,
  ]);

  const dispNeutralHeatmap = useMemo(() => {
    if (!modalMode) return null;
    const role = String(roleUserIdAgenda || '').trim();
    if (role) return null;
    return buildNeutralMonthHeatmap({
      monthDate: dispMonthDate,
      todayIso,
      selectedIso: toDateKey(form.data) || dispCalendarioDia,
    });
  }, [modalMode, roleUserIdAgenda, dispMonthDate, todayIso, form.data, dispCalendarioDia]);

  const dispCalendarioHeatmap = dispHeatmap ?? dispNeutralHeatmap;

  const bloqueioCalendarioHeatmap = useMemo(() => {
    if (!bloqueioModalOpen) return null;
    const role = String(roleUserIdAgenda || '').trim();
    if (!role) return null;
    return buildMonthHeatmap({
      monthDate: dispMonthDate,
      disponibilidade: dispProfissionalDisponibilidade,
      dtos: dispMonthDtos,
      todayIso,
      profissionalRoleUserId: role,
      selectedIso: toDateKey(bloqueioForm.data) || dispCalendarioDia,
    });
  }, [
    bloqueioModalOpen,
    dispMonthDate,
    dispProfissionalDisponibilidade,
    dispMonthDtos,
    todayIso,
    roleUserIdAgenda,
    dispCalendarioDia,
    bloqueioForm.data,
  ]);

  const retryDispMonth = useCallback(() => {
    if (!authEnabled || !modalMode) return;
    const role = String(roleUserIdAgenda || '').trim();
    if (!role) return;
    ensureDispMonthLoaded(dispMonthDate);
  }, [authEnabled, modalMode, roleUserIdAgenda, dispMonthDate, ensureDispMonthLoaded]);

  const retryBloqueioDispMonth = useCallback(() => {
    if (!authEnabled || !bloqueioModalOpen) return;
    const role = String(roleUserIdAgenda || '').trim();
    if (!role) return;
    ensureDispMonthLoaded(dispMonthDate);
  }, [authEnabled, bloqueioModalOpen, roleUserIdAgenda, dispMonthDate, ensureDispMonthLoaded]);

  const dispDaySlots = useMemo(() => {
    if (!modalMode) return null;
    const role = String(roleUserIdAgenda || '').trim();
    return buildDaySlotList({
      iso: dispCalendarioDia,
      disponibilidade: dispProfissionalDisponibilidade,
      dtos: dispMonthDtos,
      duracaoMin: form.duracaoMin,
      excludeAgendaId: editingAppointment?.agendaId,
      profissionalRoleUserId: role,
      selectedFormIso: form.data,
      selectedFormHora: form.horaInicio,
    });
  }, [
    modalMode,
    dispCalendarioDia,
    dispProfissionalDisponibilidade,
    dispMonthDtos,
    form.duracaoMin,
    form.data,
    form.horaInicio,
    editingAppointment?.agendaId,
    roleUserIdAgenda,
  ]);

  const selectDispCalendarioDia = useCallback((iso) => {
    setDispCalendarioDia(toDateKey(iso) || '');
  }, []);

  const selectDispSlot = useCallback((iso, hhmm) => {
    const day = toDateKey(iso) || '';
    const hi = String(hhmm || '').slice(0, 5);
    setDispCalendarioDia(day);
    setForm((prev) => ({ ...prev, data: day, horaInicio: hi }));
    setFormErrors((prev) => ({ ...prev, data: undefined, horaInicio: undefined }));
  }, []);

  const goDispPrevMonth = useCallback(() => {
    setDispMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goDispNextMonth = useCallback(() => {
    setDispMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleProximoHorarioLivre = useCallback(async () => {
    const role = String(roleUserIdAgenda || '').trim();
    if (!role) return;

    let monthCursor = dispMonthDate;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const dtos = await ensureDispMonthLoaded(monthCursor);
      const disp =
        disponibilidadesRef.current[role] ||
        dispProfissionalDisponibilidade ||
        [];

      const result = findNextFreeSlotAcrossDays({
        startIso: dispCalendarioDia || form.data || todayIso,
        startHora: form.horaInicio,
        duracaoMin: form.duracaoMin,
        dtos,
        disponibilidade: disp,
        todayIso,
        excludeAgendaId: editingAppointment?.agendaId,
        profissionalRoleUserId: role,
        monthDates: [monthCursor],
      });

      if (result) {
        setDispCalendarioDia(result.iso);
        setDispMonthDate(
          new Date(
            Number(result.iso.slice(0, 4)),
            Number(result.iso.slice(5, 7)) - 1,
            1
          )
        );
        setForm((prev) => ({
          ...prev,
          data: result.iso,
          horaInicio: result.hhmm,
        }));
        setFormErrors((prev) => ({ ...prev, data: undefined, horaInicio: undefined }));
        return;
      }

      monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
      setDispMonthDate(monthCursor);
    }
  }, [
    dispMonthDate,
    dispCalendarioDia,
    form.data,
    form.horaInicio,
    form.duracaoMin,
    todayIso,
    editingAppointment?.agendaId,
    roleUserIdAgenda,
    ensureDispMonthLoaded,
    dispProfissionalDisponibilidade,
  ]);

  const isHorarioOcupado = useCallback(
    (horaInicio, duracaoMin) => proposalOverlapsOccupied(horaInicio, duracaoMin, slotsOcupados),
    [slotsOcupados]
  );

  const weekEndIso = useMemo(() => addDaysIso(weekStartIso, 6), [weekStartIso]);

  const weekDayIsos = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStartIso, i)),
    [weekStartIso]
  );

  const weekRangeLabel = useMemo(
    () => formatWeekRangeLabel(weekStartIso, weekEndIso),
    [weekStartIso, weekEndIso]
  );

  useEffect(() => {
    if (!authEnabled || viewMode !== 'semana') {
      if (!authEnabled) setWeekGridAppointments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchDashboardAppointmentsForRange(weekStartIso, weekEndIso);
        if (!cancelled) setWeekGridAppointments(rows);
      } catch {
        if (!cancelled) setWeekGridAppointments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authEnabled, viewMode, weekStartIso, weekEndIso]);

  const refreshWeekGrid = useCallback(async () => {
    if (!authEnabled || viewMode !== 'semana') return;
    try {
      const rows = await fetchDashboardAppointmentsForRange(weekStartIso, weekEndIso);
      setWeekGridAppointments(rows);
    } catch {
      setWeekGridAppointments([]);
    }
  }, [authEnabled, viewMode, weekStartIso, weekEndIso]);

  /** Recarrega lista do mês e grade semanal (no-op na semana se viewMode !== 'semana'). */
  const refreshDashboard = useCallback(async () => {
    await loadMonth();
    await refreshWeekGrid();
  }, [loadMonth, refreshWeekGrid]);

  const handleCancelar = useCallback(
    async (agendaId, payload, opts = {}) => {
      if (isNivel1) return false;
      if (!agendaId || !payload) return false;
      try {
        await agendasApi.cancelar(agendaId, payload);
        if (opts.successToast !== false) {
          toastSuccess(opts.successToast || 'Agendamento cancelado');
        }
        if (!opts.skipDashboardRefresh) {
          await loadMonth();
          await refreshWeekGrid();
        }
        setError('');
        return true;
      } catch (e) {
        const msg = formatAgendamentoApiError(e);
        toastError(e?.body?.message || msg || 'Erro ao cancelar');
        setError(msg);
        return false;
      }
    },
    [isNivel1, loadMonth, refreshWeekGrid, toastSuccess, toastError]
  );

  const handleMarcarNaoCompareceu = useCallback(
    async (agendaId, opts = {}) => {
      if (isNivel1) return false;
      if (!agendaId) return false;
      try {
        const motivoId = await resolveMotivoCancelamentoIdByCodigo(NO_SHOW_MOTIVO_CODIGO);
        if (!motivoId) {
          toastError(
            'Motivo "paciente não compareceu" não encontrado. Verifique se o backend está atualizado.',
          );
          return false;
        }
        return handleCancelar(
          agendaId,
          {
            motivoCancelamentoId: motivoId,
            motivoCancelamentoTexto: NO_SHOW_OBS_PREFIX,
          },
          {
            successToast:
              opts.successToast !== undefined ? opts.successToast : 'Paciente marcado como não compareceu',
            skipDashboardRefresh: opts.skipDashboardRefresh,
          },
        );
      } catch (e) {
        toastError(e?.body?.message || formatAgendamentoApiError(e) || 'Erro ao marcar não compareceu');
        return false;
      }
    },
    [isNivel1, handleCancelar, toastError],
  );

  const closeBloqueioModal = useCallback(() => {
    setBloqueioModalOpen(false);
    setBloqueioFormErrors({});
  }, []);

  const openBloqueioModal = useCallback(
    (date = selectedDay, horaHm = '') => {
      if (isNivel1) return;
      const d = toDateKey(date) || date || selectedDay || todayIso;
      const hi = String(horaHm || '').trim().slice(0, 5) || '09:00';
      setBloqueioForm({
        ...defaultBloqueioForm(d),
        horaInicio: hi,
        horaFim: addMinutesToTime(hi, 60),
      });
      setBloqueioFormErrors({});
      const sessionRole = String(roleUserId || '').trim();
      if (isRoleAgendaPreselect(roleNome) && sessionRole) {
        setRoleUserIdAgenda(sessionRole);
      } else {
        setRoleUserIdAgenda('');
      }
      setBloqueioModalOpen(true);
    },
    [isNivel1, selectedDay, todayIso, roleUserId, roleNome]
  );

  const selectBloqueioDia = useCallback(
    (iso) => {
      const prof = String(roleUserIdAgenda || '').trim();
      setBloqueioForm((prev) => {
        const next = { ...prev, data: iso };
        if (!prev.diaInteiro) {
          setBloqueioFormErrors((e) => ({ ...e, data: undefined }));
          return next;
        }
        if (!prof) return next;
        const disp = disponibilidades[prof];
        const bounds = bloqueioBoundsFromDisponibilidade(iso, disp);
        if (!bounds.ok) {
          setBloqueioFormErrors((e) => ({
            ...e,
            data: bounds.error,
            horaInicio: undefined,
            horaFim: undefined,
          }));
          return next;
        }
        setBloqueioFormErrors((e) => ({
          ...e,
          data: undefined,
          horaInicio: undefined,
          horaFim: undefined,
        }));
        return {
          ...next,
          horaInicio: bounds.horaInicio,
          horaFim: bounds.horaFim,
        };
      });
    },
    [roleUserIdAgenda, disponibilidades]
  );

  const updateBloqueioForm = useCallback(
    (field, value) => {
      if (field === 'diaInteiro') {
        const checked = Boolean(value);
        const prof = String(roleUserIdAgenda || '').trim();
        setBloqueioForm((prev) => {
          if (!checked) {
            const hi = String(prev.horaInicio || '09:00').slice(0, 5);
            const dur = Number(prev.duracaoMin) || 60;
            return {
              ...prev,
              diaInteiro: false,
              horaInicio: hi,
              duracaoMin: DURACOES_PILL.includes(dur) ? dur : 60,
              horaFim: addMinutesToTime(hi, DURACOES_PILL.includes(dur) ? dur : 60),
            };
          }
          if (prev.data && prof) {
            const disp = disponibilidades[prof];
            const bounds = bloqueioBoundsFromDisponibilidade(prev.data, disp);
            if (!bounds.ok) {
              setBloqueioFormErrors((e) => ({ ...e, data: bounds.error }));
              return { ...prev, diaInteiro: true };
            }
            setBloqueioFormErrors((e) => ({
              ...e,
              data: undefined,
              horaInicio: undefined,
              horaFim: undefined,
              duracaoMin: undefined,
            }));
            return {
              ...prev,
              diaInteiro: true,
              horaInicio: bounds.horaInicio,
              horaFim: bounds.horaFim,
            };
          }
          return { ...prev, diaInteiro: true };
        });
        return;
      }
      setBloqueioForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'horaInicio' && !prev.diaInteiro) {
          next.horaFim = addMinutesToTime(String(value || '').slice(0, 5), Number(prev.duracaoMin) || 60);
        }
        if (field === 'duracaoMin' && !prev.diaInteiro) {
          const hi = String(prev.horaInicio || '09:00').slice(0, 5);
          next.horaFim = addMinutesToTime(hi, Number(value) || 60);
        }
        return next;
      });
      setBloqueioFormErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [roleUserIdAgenda, disponibilidades]
  );

  const validateBloqueioForm = useCallback(() => {
    const nextErrors = {};
    const prof = String(roleUserIdAgenda || '').trim();
    if (!prof) nextErrors.profissional = 'Selecione um profissional.';
    if (!bloqueioForm.data) nextErrors.data = 'Selecione a data.';
    else if (bloqueioForm.data < todayIso) {
      nextErrors.data = 'Não é possível bloquear no passado.';
    }

    if (bloqueioForm.diaInteiro) {
      const disp = disponibilidades[prof];
      const bounds = bloqueioForm.data
        ? bloqueioBoundsFromDisponibilidade(bloqueioForm.data, disp)
        : { ok: false, error: 'Selecione a data.' };
      if (!bounds.ok) {
        nextErrors.data = bounds.error || 'Profissional não atende neste dia.';
      }
      const hi = String(bloqueioForm.horaInicio || '').trim().slice(0, 5);
      const hf = String(bloqueioForm.horaFim || '').trim().slice(0, 5);
      if (!hi || !hf) {
        nextErrors.data = nextErrors.data || 'Não foi possível calcular o expediente do dia.';
      } else if (bloqueioTimeToMinutes(hf) <= bloqueioTimeToMinutes(hi)) {
        nextErrors.data = 'Expediente inválido para este dia.';
      }
    } else {
      const hi = String(bloqueioForm.horaInicio || '').trim().slice(0, 5);
      if (!hi) nextErrors.horaInicio = 'Informe o horário de início.';
      const d = Number(bloqueioForm.duracaoMin);
      if (!DURACOES_PILL.includes(d)) nextErrors.duracaoMin = 'Selecione a duração.';
      const hfMin = bloqueioTimeToMinutes(hi) + (Number(bloqueioForm.duracaoMin) || 60);
      const hiMin = bloqueioTimeToMinutes(hi);
      if (hi && hfMin <= hiMin) {
        nextErrors.horaFim = 'O horário de fim deve ser após o início.';
      }
    }

    if (!String(bloqueioForm.motivo || '').trim()) {
      nextErrors.motivo = 'Descreva o motivo do bloqueio.';
    }
    setBloqueioFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [bloqueioForm, roleUserIdAgenda, todayIso, disponibilidades]);

  const saveBloqueio = useCallback(async () => {
    if (isNivel1) return false;
    if (!validateBloqueioForm()) return false;
    const prof = String(roleUserIdAgenda || '').trim();
    if (!prof) return false;

    setSubmittingBloqueio(true);
    try {
      const tipoId = await resolveTipoProcedimentoIdByCodigo(BLOQUEIO_TIPO_CODIGO);
      if (!tipoId) {
        toastError('Tipo "bloqueio" não encontrado. Verifique se o backend está atualizado.');
        return false;
      }
      const hi = String(bloqueioForm.horaInicio || '').slice(0, 5);
      const horaFim = bloqueioForm.diaInteiro
        ? String(bloqueioForm.horaFim || '').slice(0, 5)
        : addMinutesToTime(hi, Number(bloqueioForm.duracaoMin) || 60);
      const body = buildAgendaBloqueioCreateBody({
        dataAgendamento: bloqueioForm.data,
        horaInicio: hi,
        horaFim,
        profissionalRoleUserId: prof,
        tipoProcedimentoId: tipoId,
        observacao: String(bloqueioForm.motivo || '').trim(),
      });
      await agendasApi.create(body);
      const nextMonthDate = new Date(
        Number(bloqueioForm.data.slice(0, 4)),
        Number(bloqueioForm.data.slice(5, 7)) - 1,
        1
      );
      skipNextAutoLoadRef.current = true;
      setSelectedDay(bloqueioForm.data);
      setMonthDate(nextMonthDate);
      await loadMonth(nextMonthDate);
      await refreshWeekGrid();
      closeBloqueioModal();
      setError('');
      toastSuccess('Horário bloqueado');
      return true;
    } catch (e) {
      const msg = formatAgendamentoApiError(e, { context: 'bloqueio' });
      toastError(msg || 'Erro ao bloquear horário');
      setError(msg);
      return false;
    } finally {
      setSubmittingBloqueio(false);
    }
  }, [
    bloqueioForm,
    closeBloqueioModal,
    isNivel1,
    loadMonth,
    refreshWeekGrid,
    roleUserIdAgenda,
    toastError,
    toastSuccess,
    validateBloqueioForm,
  ]);

  const handleRemoverBloqueio = useCallback(
    async (appointment) => {
      if (isNivel1) return false;
      const agendaId = appointment?.agendaId || appointment?.id;
      if (!agendaId) return false;
      if (submittingRemoverBloqueioId) return false;

      setSubmittingRemoverBloqueioId(String(agendaId));
      try {
        const motivoId = await resolveMotivoCancelamentoIdByCodigo(CANCEL_MOTIVO_OUTRO_CODIGO);
        if (!motivoId) {
          toastError('Motivo de cancelamento "outro" não encontrado. Verifique o backend.');
          return false;
        }
        return handleCancelar(
          agendaId,
          {
            motivoCancelamentoId: motivoId,
            motivoCancelamentoTexto: BLOQUEIO_REMOVER_MOTIVO_TEXTO,
          },
          { successToast: 'Bloqueio removido' }
        );
      } catch (e) {
        toastError(e?.body?.message || formatAgendamentoApiError(e) || 'Erro ao remover bloqueio');
        return false;
      } finally {
        setSubmittingRemoverBloqueioId('');
      }
    },
    [handleCancelar, isNivel1, submittingRemoverBloqueioId, toastError]
  );

  const handleAtualizarStatus = useCallback(
    async (agendaId, codigo, opts = {}) => {
      if (isNivel1) return false;
      if (!agendaId || !codigo) return false;

      let appointmentsSnapshot = null;
      let weekGridSnapshot = null;

      if (codigo === 'confirmado') {
        setAppointments((prev) => {
          appointmentsSnapshot = prev;
          return prev.map((row) =>
            String(row.agendaId) === String(agendaId) ? { ...row, status: 'confirmado' } : row,
          );
        });
        setWeekGridAppointments((prev) => {
          weekGridSnapshot = prev;
          return prev.map((row) =>
            String(row.agendaId) === String(agendaId) ? { ...row, status: 'confirmado' } : row,
          );
        });
      }

      try {
        await agendasApi.atualizarStatus(agendaId, codigo);
        if (opts.successToast !== false) {
          toastSuccess(
            opts.successToast ||
              (codigo === 'confirmado' ? 'Agendamento confirmado' : `Status atualizado: ${codigo}`),
          );
        }
        if (!opts.skipDashboardRefresh) {
          await loadMonth();
          await refreshWeekGrid();
        }
        setError('');
        return true;
      } catch (e) {
        if (codigo === 'confirmado') {
          if (appointmentsSnapshot) setAppointments(appointmentsSnapshot);
          if (weekGridSnapshot) setWeekGridAppointments(weekGridSnapshot);
        }
        const msg = formatAgendamentoApiError(e);
        toastError(e?.body?.message || msg || 'Erro ao atualizar status');
        setError(msg);
        return false;
      }
    },
    [isNivel1, loadMonth, refreshWeekGrid, toastSuccess, toastError],
  );

  const handleReagendar = useCallback(
    async (agendaId, payload, opts = {}) => {
      if (isNivel1) return false;
      if (!agendaId || !payload) return false;
      setSubmittingReagendar(true);
      try {
        const resultado = await executarComBypassDisp(
          () => agendasApi.reagendar(agendaId, payload),
          () => agendasApi.reagendar(agendaId, payload, { forcar: true }),
          abrirConfirmacaoForaDisp
        );
        if (resultado === null) return false;
        if (opts.successToast !== false) {
          toastSuccess(opts.successToast || 'Agendamento reagendado');
        }
        if (!opts.skipDashboardRefresh) {
          await loadMonth();
          await refreshWeekGrid();
        }
        setError('');
        return true;
      } catch (e) {
        const msg = formatAgendamentoApiError(e);
        toastError(msg || 'Erro ao reagendar');
        return false;
      } finally {
        setSubmittingReagendar(false);
      }
    },
    [isNivel1, loadMonth, refreshWeekGrid, toastSuccess, toastError, abrirConfirmacaoForaDisp]
  );

  const handleEnviarWhatsApp = useCallback(
    async (agendaId, tipoEnvio = 'confirmacao_24h') => {
      if (!agendaId) return false;
      try {
        const res = await confirmacaoApi.gerar({ agendaId, tipoEnvio });
        if (res?.urlWhatsApp) {
          abrirWhatsApp(res.urlWhatsApp);
          toastSuccess('Link WhatsApp aberto');
          return true;
        }
        toastError('Resposta sem link do WhatsApp');
        return false;
      } catch (e) {
        toastError(e?.body?.message || formatAgendamentoApiError(e) || 'Erro ao gerar link WhatsApp');
        return false;
      }
    },
    [toastSuccess, toastError]
  );

  const syncWeekFromSelection = useCallback(() => {
    setWeekStartIso(startOfWeekSundayIso(selectedDay));
  }, [selectedDay]);

  const goWeekPrev = useCallback(() => {
    setWeekStartIso((prev) => addDaysIso(prev, -7));
  }, []);

  const goWeekNext = useCallback(() => {
    setWeekStartIso((prev) => addDaysIso(prev, 7));
  }, []);

  const monthLabel = useMemo(() => {
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(monthDate);
    return capitalize(label);
  }, [monthDate]);

  const filteredAppointments = useMemo(
    () => filterAppointmentsByStatusFilters(appointments, statusFilters),
    [appointments, statusFilters],
  );

  const filteredWeekGridAppointments = useMemo(
    () => filterAppointmentsByStatusFilters(weekGridAppointments, statusFilters),
    [weekGridAppointments, statusFilters],
  );

  const statusFilterCounts = useMemo(
    () => countAppointmentsByStatusBucket(filterKpiCountableAppointments(appointments)),
    [appointments],
  );

  const allStatusFiltersActive = statusFilters.size === ALL_STATUS_FILTERS.size;

  const toggleStatusFilter = useCallback((key) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllStatusFilters = useCallback(() => {
    setStatusFilters((prev) => {
      if (prev.size === ALL_STATUS_FILTERS.size) return new Set();
      return new Set(ALL_STATUS_FILTERS);
    });
  }, []);

  const selectedDayAppointments = useMemo(
    () => filteredAppointments.filter((item) => toDateKey(item.data) === toDateKey(selectedDay)),
    [filteredAppointments, selectedDay],
  );

  const appointmentsByDate = useMemo(() => groupByDate(filteredAppointments), [filteredAppointments]);

  const appointmentsByDateRaw = useMemo(() => groupByDate(appointments), [appointments]);

  const monthVisibleCount = useMemo(() => {
    const { start, end } = monthRangeIso(monthDate);
    return filterKpiCountableAppointments(filteredAppointments).filter((row) => {
      const d = toDateKey(row.data);
      return d >= start && d <= end;
    }).length;
  }, [filteredAppointments, monthDate]);

  const stats = useMemo(() => {
    const kpiRows = filterKpiCountableAppointments(appointments);
    return {
      totalMes: kpiRows.length,
      confirmados: kpiRows.filter((item) => item.status === 'confirmado').length,
      pendentes: kpiRows.filter((item) => item.status === 'pendente').length,
      hoje: hojeCount,
    };
  }, [appointments, hojeCount]);

  const groupedAppointments = useMemo(() => {
    const grouped = groupByDate(filteredAppointments);
    return Object.keys(grouped)
      .sort()
      .map((date) => ({ date, items: grouped[date] }));
  }, [filteredAppointments]);

  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);

  const setRoleUserIdAgendaPublic = useCallback((id) => {
    setRoleUserIdAgenda(String(id ?? '').trim());
    setFormErrors((prev) => ({ ...prev, profissional: undefined }));
    setBloqueioFormErrors((prev) => ({ ...prev, profissional: undefined }));
  }, []);

  const applyProfissionalPreselect = useCallback(() => {
    const sessionRole = String(roleUserId || '').trim();
    if (isRoleAgendaPreselect(roleNome) && sessionRole) {
      setRoleUserIdAgenda(sessionRole);
    } else {
      setRoleUserIdAgenda('');
    }
  }, [roleUserId, roleNome]);

  const updateForm = useCallback(
    (field, value) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'pacienteId') {
          const patient = patientOptions.find((p) => p.id === value);
          if (patient) {
            next.pacienteNome = patient.nome;
            next.telefone = patient.telefone;
          }
        }
        return next;
      });
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [patientOptions]
  );

  const openCreateModal = useCallback(
    (date = selectedDay) => {
      if (isNivel1) return;
      setEditingAppointment(null);
      setPatientSelectLocked(false);
      setForm(defaultForm(date, patientOptions, null));
      setFormErrors({});
      applyProfissionalPreselect();
      setModalMode('create');
    },
    [isNivel1, patientOptions, selectedDay, applyProfissionalPreselect]
  );

  const openCreateModalAtSlot = useCallback(
    (iso, horaHm) => {
      if (isNivel1) return;
      const date = toDateKey(iso) || iso;
      const hi = String(horaHm || '').trim().slice(0, 5);
      setEditingAppointment(null);
      setPatientSelectLocked(false);
      setSelectedDay(date);
      const base = defaultForm(date, patientOptions, null);
      setForm({
        ...base,
        horaInicio: hi || base.horaInicio,
      });
      setFormErrors({});
      applyProfissionalPreselect();
      setModalMode('create');
    },
    [isNivel1, patientOptions, applyProfissionalPreselect]
  );

  /** Abrir "Novo agendamento" a partir do perfil do paciente (data inicial = hoje). */
  const openCreateModalForPatient = useCallback(
    (patient) => {
      if (isNivel1) return;
      if (!patient?.id) return;
      setEditingAppointment(null);
      const date = todayIso;
      const base = defaultForm(date, patientOptions, null);
      setForm({
        ...base,
        pacienteId: String(patient.id),
        pacienteNome: patient.nome || '',
        telefone: patient.telefone || '',
        procedimentoNome: '',
        catalogoProcedimentoSaudeIds: [],
      });
      setPatientSelectLocked(true);
      setFormErrors({});
      applyProfissionalPreselect();
      setModalMode('create');
    },
    [isNivel1, patientOptions, todayIso, applyProfissionalPreselect]
  );

  const openEditModal = useCallback(
    (appointment) => {
      if (isNivel1) return;
      setEditingAppointment(appointment);
      const base = defaultForm(appointment?.data || selectedDay, patientOptions, null);
      const currentIds = Array.isArray(appointment?.catalogoProcedimentoSaudeIds)
        ? appointment.catalogoProcedimentoSaudeIds.map((id) => String(id))
        : appointment?.catalogoProcedimentoSaudeId
          ? [String(appointment.catalogoProcedimentoSaudeId)]
          : [];
      setForm({
        ...base,
        pacienteId: appointment?.pacienteId || base.pacienteId,
        pacienteNome: appointment?.pacienteNome || base.pacienteNome,
        telefone: appointment?.telefone || base.telefone,
        procedimentoNome: appointment?.procedimentoNome || base.procedimentoNome,
        catalogoProcedimentoSaudeIds: currentIds,
        data: appointment?.data || base.data,
        horaInicio: appointment?.horaInicio || base.horaInicio,
        duracaoMin: snapDuracaoToPill(appointment?.duracaoMin ?? base.duracaoMin),
        observacao: appointment?.observacao || appointment?.rawAgendamento?.observacao || base.observacao,
      });
      setFormErrors({});
      setPatientSelectLocked(false);
      setRoleUserIdAgenda(
        String(
          appointment?.profissionalRoleUserId ?? appointment?.roleUserId ?? roleUserId ?? ''
        ).trim()
      );
      setModalMode('edit');
    },
    [isNivel1, patientOptions, selectedDay, roleUserId]
  );

  const openReagendarModal = useCallback(
    (appointment, grupoAgendamentos) => {
      if (isNivel1) return;
      const grupo = Array.isArray(grupoAgendamentos) && grupoAgendamentos.length > 0
        ? grupoAgendamentos
        : [appointment];
      const base = defaultForm(appointment?.data || selectedDay, patientOptions, null);
      const catIds = grupo.map((a) => String(a.catalogoProcedimentoSaudeId || '').trim()).filter(Boolean);
      setEditingAppointment(appointment);
      setForm({
        ...base,
        pacienteId: appointment?.pacienteId || base.pacienteId,
        pacienteNome: appointment?.pacienteNome || base.pacienteNome,
        telefone: appointment?.telefone || base.telefone,
        catalogoProcedimentoSaudeIds: catIds,
        data: '',        // usuário escolhe nova data no calendário
        horaInicio: '',  // usuário escolhe novo slot
        duracaoMin: snapDuracaoToPill(appointment?.duracaoMin ?? base.duracaoMin),
        observacao: appointment?.observacao || appointment?.rawAgendamento?.observacao || base.observacao,
      });
      setFormErrors({});
      setPatientSelectLocked(true);
      setRoleUserIdAgenda(
        String(appointment?.profissionalRoleUserId ?? appointment?.roleUserId ?? roleUserId ?? '').trim()
      );
      setGrupoReagendarMap(
        Object.fromEntries(grupo.map((a) => [String(a.catalogoProcedimentoSaudeId), a.agendaId]))
      );
      setGrupoReagendarDuracoes(
        Object.fromEntries(
          grupo
            .filter((a) => a.duracaoMin != null)
            .map((a) => [String(a.catalogoProcedimentoSaudeId), a.duracaoMin])
        )
      );
      setModalMode('reagendar');
    },
    [isNivel1, patientOptions, selectedDay, roleUserId]
  );

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingAppointment(null);
    setPatientSelectLocked(false);
    setPacienteContext(null);
    setPacienteContextLoading(false);
    setFormErrors({});
    setGrupoReagendarMap({});
    setGrupoReagendarDuracoes({});
    equipeFetchedRef.current = false;
    dispMonthCacheRef.current = {};
    setDispMonthDtos([]);
    setDispCalendarioDia('');
    setDispMonthError('');
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors = {};
    if (!form.pacienteId && !String(form.pacienteNome || '').trim()) nextErrors.pacienteId = 'Selecione um paciente.';
    const procIds = (Array.isArray(form.catalogoProcedimentoSaudeIds) ? form.catalogoProcedimentoSaudeIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (modalMode === 'edit') {
      if (procIds.length !== 1) nextErrors.catalogoProcedimentoSaudeIds = 'Selecione exatamente um procedimento.';
    } else if (procIds.length === 0) {
      nextErrors.catalogoProcedimentoSaudeIds = 'Selecione ao menos um procedimento.';
    }
    if (!form.data) nextErrors.data = 'Selecione um dia no calendário.';
    else if (form.data < todayIso) {
      nextErrors.data = 'Data inválida — não é possível agendar para o passado.';
    }
    if (!form.horaInicio) nextErrors.horaInicio = 'Selecione um horário na lista.';
    const d = Number(form.duracaoMin);
    if (!DURACOES_PILL.includes(d)) {
      nextErrors.duracaoMin = 'Selecione a duração.';
    }
    if (!String(roleUserIdAgenda || '').trim()) {
      nextErrors.profissional = 'Selecione um profissional.';
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form, todayIso, modalMode, roleUserIdAgenda]);

  const saveAppointment = useCallback(async ({ duracoesPorProc, onConflictResult } = {}) => {
    if (isNivel1) return false;
    if (!validateForm()) return false;
    const agendaRole = String(roleUserIdAgenda || '').trim();
    if (!agendaRole) {
      setFormErrors((prev) => ({
        ...prev,
        profissional: 'Selecione um profissional.',
      }));
      setError('Selecione um profissional.');
      return false;
    }

    const patient = patientOptions.find((p) => p.id === form.pacienteId);
    const procIds = (Array.isArray(form.catalogoProcedimentoSaudeIds) ? form.catalogoProcedimentoSaudeIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean);

    try {
      for (let i = 0; i < procIds.length; i++) {
        const id = procIds[i];
        if (id.startsWith('new:')) {
          const nome = id.substring(4);
          const novoProcedimento = await catalogosApi.criar({ nomeProcedimento: nome });
          const novoId = String(novoProcedimento.catalogoProcedimentoId || novoProcedimento.id || '').trim();
          procIds[i] = novoId;
        }
      }
    } catch (err) {
      console.error('Erro ao cadastrar procedimento no catálogo:', err);
      setError('Erro ao cadastrar novo procedimento no catálogo.');
      return false;
    }

    try {
      if (modalMode === 'edit' && editingAppointment?.agendaId) {
        const rawSlot = editingAppointment.rawSlot || {};
        const catId = procIds[0];
        if (!catId) {
          setError('Selecione o procedimento.');
          return false;
        }
        const baseBody = buildAgendaUpdateBody(editingAppointment.rawSlot, form, agendaRole);
        const body = {
          ...baseBody,
          pacienteId: String(form.pacienteId || patient?.id || '').trim(),
          catalogoProcedimentoSaudeId: catId,
          observacao: String(form.observacao || rawSlot.observacao || '').trim() || undefined,
        };
        const resultadoUpdate = await executarComBypassDisp(
          () => agendasApi.update(editingAppointment.agendaId, body),
          () => agendasApi.update(editingAppointment.agendaId, body, { forcar: true }),
          abrirConfirmacaoForaDisp
        );
        if (resultadoUpdate === null) return false;
      } else {
        let startHh = String(form.horaInicio || '09:00').slice(0, 5);
        const resultados = [];

        for (let i = 0; i < procIds.length; i += 1) {
          const catalogoProcedimentoSaudeId = procIds[i];
          const dMin =
            duracoesPorProc?.find((d) => String(d.id) === catalogoProcedimentoSaudeId)?.duracaoSelecionada
            ?? (Number(form.duracaoMin) || 45);

          const createBody = buildAgendaCreateBody({
            dataAgendamento: form.data,
            horaInicio: startHh,
            duracaoMin: dMin,
            profissionalRoleUserId: agendaRole,
            observacao: String(form.observacao || '').trim(),
            pacienteId: String(form.pacienteId || patient?.id || '').trim(),
            catalogoProcedimentoSaudeId,
            // Resolve pelo ID do procedimento — robusto a reordenação/remoção de procs no modal.
            ...(modalMode === 'reagendar' && grupoReagendarMap[catalogoProcedimentoSaudeId]
              ? { agendaIdOrigem: grupoReagendarMap[catalogoProcedimentoSaudeId] }
              : {}),
          });

          try {
            const created = await executarComBypassDisp(
              () => agendasApi.create(createBody),
              () => agendasApi.create(createBody, { forcar: true }),
              abrirConfirmacaoForaDisp
            );
            if (created === null) {
              resultados.push({ id: catalogoProcedimentoSaudeId, status: 'cancelado' });
              continue;
            }
            if (created?.id == null) throw new Error('Resposta da API sem id da agenda.');
            resultados.push({ id: catalogoProcedimentoSaudeId, status: 'ok' });
            startHh = addMinutesToTime(startHh, dMin);
          } catch (err) {
            if (isAgendaSlotOverlapError(err)) {
              resultados.push({ id: catalogoProcedimentoSaudeId, status: 'conflito', mensagem: formatAgendamentoApiError(err) });
              continue;
            }
            throw err;
          }
        }

        const algumFalhou = resultados.some((r) => r.status !== 'ok');
        if (algumFalhou) {
          onConflictResult?.(resultados);
          return false;
        }
      }

      const nextMonthDate = new Date(Number(form.data.slice(0, 4)), Number(form.data.slice(5, 7)) - 1, 1);
      const savedRole = String(roleUserIdAgenda || '').trim();
      if (savedRole) {
        delete dispMonthCacheRef.current[dispCacheKey(savedRole, nextMonthDate)];
      }
      skipNextAutoLoadRef.current = true;
      setSelectedDay(form.data);
      setMonthDate(nextMonthDate);
      await loadMonth(nextMonthDate);
      await refreshWeekGrid();
      closeModal();
      setError('');
      toastSuccess(modalMode === 'reagendar' ? 'Agendamento reagendado.' : 'Agendamento salvo.');
      return true;
    } catch (e) {
      setError(formatAgendamentoApiError(e));
      return false;
    }
  }, [
    abrirConfirmacaoForaDisp,
    closeModal,
    editingAppointment,
    form,
    grupoReagendarMap,
    isNivel1,
    loadMonth,
    modalMode,
    patientOptions,
    refreshWeekGrid,
    roleUserIdAgenda,
    dispCacheKey,
    toastSuccess,
    validateForm,
  ]);

  const updateStatus = useCallback(
    (appointment, status) => {
      if (!appointment?.agendaId || !status) return Promise.resolve(false);
      return handleAtualizarStatus(appointment.agendaId, status);
    },
    [handleAtualizarStatus],
  );

  const selectDay = useCallback((date, openSheet = true) => {
    setSelectedDay(date);
    setDaySheetOpen(openSheet);
  }, []);

  const openDaySheet = useCallback(() => setDaySheetOpen(true), []);
  const closeDaySheet = useCallback(() => setDaySheetOpen(false), []);

  const moveSelectedDay = useCallback((days) => {
    const [year, month, day] = selectedDay.split('-').map(Number);
    const next = new Date(year, month - 1, day + days);
    const iso = toLocalDateIso(next);
    setSelectedDay(iso);
    setMonthDate(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [selectedDay]);

  const goPrevMonth = useCallback(() => {
    setMonthDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      setSelectedDay(toLocalDateIso(next));
      return next;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setMonthDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      setSelectedDay(toLocalDateIso(next));
      return next;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(toLocalDateIso(now));
  }, []);

  return {
    isNivel1,
    appointments,
    appointmentsByDate,
    appointmentsByDateRaw,
    monthVisibleCount,
    monthDate,
    todayIso,
    calendarCells,
    currentYm,
    daySheetOpen,
    openDaySheet,
    closeDaySheet,
    disponibilidades,
    editingAppointment,
    foraDispModal,
    abrirConfirmacaoForaDisp,
    error,
    form,
    formErrors,
    goNextMonth,
    goPrevMonth,
    goToToday,
    goWeekNext,
    goWeekPrev,
    groupedAppointments,
    handleAtualizarStatus,
    handleMarcarNaoCompareceu,
    bloqueioCalendarioHeatmap,
    bloqueioForm,
    bloqueioFormErrors,
    bloqueioModalOpen,
    closeBloqueioModal,
    handleCancelar,
    handleRemoverBloqueio,
    handleEnviarWhatsApp,
    handleReagendar,
    horarioConflita,
    horarioConflitoCom,
    isHorarioOcupado,
    selectPaciente,
    clearPacienteSelection,
    pacienteContext,
    pacienteContextLoading,
    loading,
    modalMode,
    monthLabel,
    moveSelectedDay,
    openBloqueioModal,
    openCreateModal,
    openCreateModalAtSlot,
    openCreateModalForPatient,
    openEditModal,
    openReagendarModal,
    grupoReagendarDuracoes,
    closeModal,
    patientSelectLocked,
    patientOptions,
    procedimentoOptions,
    dispCalendarioDia,
    dispDaySlots,
    dispHeatmap,
    dispCalendarioHeatmap,
    dispMonthError,
    dispMonthLoading,
    retryDispMonth,
    retryBloqueioDispMonth,
    goDispNextMonth,
    goDispPrevMonth,
    selectBloqueioDia,
    handleProximoHorarioLivre,
    refreshDashboard,
    selectDispCalendarioDia,
    selectDispSlot,
    saveAppointment,
    saveBloqueio,
    selectDay,
    submittingBloqueio,
    submittingRemoverBloqueioId,
    updateBloqueioForm,
    selectedDay,
    selectedDayAppointments,
    setDaySheetOpen,
    setViewMode,
    slotsOcupados,
    slotsOcupadosLoading,
    roleUserIdAgenda,
    setRoleUserIdAgenda: setRoleUserIdAgendaPublic,
    ensureEquipeLoaded,
    equipeList,
    equipeLoading,
    equipeError,
    loadKpiDrilldownRows,
    stats,
    submittingReagendar,
    syncWeekFromSelection,
    statusLabels: STATUS_LABELS,
    updateForm,
    updateStatus,
    viewMode,
    weekDayIsos,
    weekGridAppointments,
    filteredWeekGridAppointments,
    weekRangeLabel,
    weekStartIso,
    statusFilters,
    toggleStatusFilter,
    toggleAllStatusFilters,
    statusFilterCounts,
    allStatusFiltersActive,
  };
}
