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
import { formatAgendamentoApiError } from '../../utils/agendaErrors';
import { monthRangeIso, toDateKey } from '../../utils/agendaDateUtils';
import { fetchKpiDrilldownRows } from '../../utils/agendaKpiDrilldown';
import {
  buildAgendaCreateBody,
  buildAgendaUpdateBody,
  fetchDashboardAppointmentsForRange,
  normalizeApiList,
} from '../../utils/agendaDashboardMapping';
import { buildDaySlotList, buildMonthHeatmap } from '../../utils/agendaDisponibilidadeBuilder.js';
import {
  findFirstConflictHhmm,
  findNextFreeSlotAcrossDays,
  occupiedIntervalsFromAgendaDtos,
  proposalOverlapsOccupied,
} from '../../utils/agendaAvailability';
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
      return roleUserId ? { roleUserId, nome: String(nome).trim() || 'Profissional' } : null;
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
  /** Create modal aberto pelo perfil: paciente não pode ser trocado. */
  const [patientSelectLocked, setPatientSelectLocked] = useState(false);
  const [pacienteContext, setPacienteContext] = useState(null);
  const [pacienteContextLoading, setPacienteContextLoading] = useState(false);
  /** Profissional do modal (create = sessão; edit = do agendamento). */
  const [roleUserIdAgenda, setRoleUserIdAgenda] = useState('');
  const [equipeList, setEquipeList] = useState([]);
  const [equipeLoading, setEquipeLoading] = useState(false);
  const [equipeError, setEquipeError] = useState('');
  const equipeFetchedRef = useRef(false);
  const dispMonthCacheRef = useRef({});
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
        monthLoadedAppointments: appointments,
        currentYm,
      });
    },
    [authEnabled, todayIso, monthDate, appointments, currentYm],
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

  const loadMonth = useCallback(async () => {
    if (!authEnabled) {
      setAppointments([]);
      setHojeCount(0);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { start, end } = monthRangeIso(monthDate);
      const rows = await fetchDashboardAppointmentsForRange(start, end);
      setAppointments(rows);

      const hoje = toLocalDateIso();
      try {
        const rawSlots = await agendasApi.byRange(hoje, hoje);
        setHojeCount(normalizeApiList(rawSlots).length);
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
      selectedIso: dispCalendarioDia,
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
  ]);

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
        toastSuccess(opts.successToast || 'Agendamento cancelado');
        await loadMonth();
        await refreshWeekGrid();
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
    async (agendaId) => {
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
          { successToast: 'Paciente marcado como não compareceu' },
        );
      } catch (e) {
        toastError(e?.body?.message || formatAgendamentoApiError(e) || 'Erro ao marcar não compareceu');
        return false;
      }
    },
    [isNivel1, handleCancelar, toastError],
  );

  const handleAtualizarStatus = useCallback(
    async (agendaId, codigo) => {
      if (isNivel1) return false;
      if (!agendaId || !codigo) return false;
      try {
        if (codigo === 'confirmado') {
          setAppointments((prev) =>
            prev.map((row) => (String(row.agendaId) === String(agendaId) ? { ...row, status: 'confirmado' } : row))
          );
          setWeekGridAppointments((prev) =>
            prev.map((row) => (String(row.agendaId) === String(agendaId) ? { ...row, status: 'confirmado' } : row))
          );
          return true;
        }
        await agendasApi.atualizarStatus(agendaId, codigo);
        toastSuccess(`Status atualizado: ${codigo}`);
        await loadMonth();
        await refreshWeekGrid();
        setError('');
        return true;
      } catch (e) {
        const msg = formatAgendamentoApiError(e);
        toastError(e?.body?.message || msg || 'Erro ao atualizar status');
        setError(msg);
        return false;
      }
    },
    [isNivel1, loadMonth, refreshWeekGrid, toastSuccess, toastError]
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
        toastSuccess(opts.successToast || 'Agendamento reagendado');
        await loadMonth();
        await refreshWeekGrid();
        setError('');
        return true;
      } catch (e) {
        const msg = formatAgendamentoApiError(e);
        toastError(e?.body?.message || msg || 'Erro ao reagendar');
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

  const selectedDayAppointments = useMemo(
    () => appointments.filter((item) => toDateKey(item.data) === toDateKey(selectedDay)),
    [appointments, selectedDay]
  );

  const appointmentsByDate = useMemo(() => groupByDate(appointments), [appointments]);

  const stats = useMemo(() => {
    return {
      totalMes: appointments.length,
      confirmados: appointments.filter((item) => item.status === 'confirmado').length,
      pendentes: appointments.filter((item) => item.status === 'pendente').length,
      hoje: hojeCount,
    };
  }, [appointments, hojeCount]);

  const groupedAppointments = useMemo(() => {
    const grouped = groupByDate(appointments);
    return Object.keys(grouped)
      .sort()
      .map((date) => ({ date, items: grouped[date] }));
  }, [appointments]);

  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);

  const setRoleUserIdAgendaPublic = useCallback((id) => {
    setRoleUserIdAgenda(String(id ?? '').trim());
    setFormErrors((prev) => ({ ...prev, profissional: undefined }));
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

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingAppointment(null);
    setPatientSelectLocked(false);
    setPacienteContext(null);
    setPacienteContextLoading(false);
    setFormErrors({});
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

  const saveAppointment = useCallback(async () => {
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
        const dMin = Number(form.duracaoMin) || 45;
        let startHh = String(form.horaInicio || '09:00').slice(0, 5);
        for (let i = 0; i < procIds.length; i += 1) {
          const catalogoProcedimentoSaudeId = procIds[i];
          const createBody = buildAgendaCreateBody({
            dataAgendamento: form.data,
            horaInicio: startHh,
            duracaoMin: dMin,
            profissionalRoleUserId: agendaRole,
            observacao: String(form.observacao || '').trim(),
            pacienteId: String(form.pacienteId || patient?.id || '').trim(),
            catalogoProcedimentoSaudeId,
          });
          const created = await executarComBypassDisp(
            () => agendasApi.create(createBody),
            () => agendasApi.create(createBody, { forcar: true }),
            abrirConfirmacaoForaDisp
          );
          if (created === null) return false;
          if (created?.id == null) throw new Error('Resposta da API sem id da agenda.');
          startHh = addMinutesToTime(startHh, dMin);
        }
      }

      const nextMonthDate = new Date(Number(form.data.slice(0, 4)), Number(form.data.slice(5, 7)) - 1, 1);
      const savedRole = String(roleUserIdAgenda || '').trim();
      if (savedRole) {
        delete dispMonthCacheRef.current[dispCacheKey(savedRole, nextMonthDate)];
      }
      setSelectedDay(form.data);
      setMonthDate(nextMonthDate);
      await loadMonth();
      await refreshWeekGrid();
      closeModal();
      setError('');
      toastSuccess('Agendamento salvo.');
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
    async (appointment, status) => {
      if (!appointment?.agendaId) return;
      if (status === 'confirmado') {
        setAppointments((prev) =>
          prev.map((row) => (row.id === appointment.id ? { ...row, status: 'confirmado' } : row))
        );
        setWeekGridAppointments((prev) =>
          prev.map((row) => (row.id === appointment.id ? { ...row, status: 'confirmado' } : row))
        );
      }
    },
    []
  );

  const selectDay = useCallback((date, openSheet = true) => {
    setSelectedDay(date);
    setDaySheetOpen(openSheet);
  }, []);

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

  return {
    isNivel1,
    appointments,
    appointmentsByDate,
    monthDate,
    todayIso,
    calendarCells,
    currentYm,
    daySheetOpen,
    disponibilidades,
    editingAppointment,
    foraDispModal,
    error,
    form,
    formErrors,
    goNextMonth,
    goPrevMonth,
    goWeekNext,
    goWeekPrev,
    groupedAppointments,
    handleAtualizarStatus,
    handleMarcarNaoCompareceu,
    handleCancelar,
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
    openCreateModal,
    openCreateModalAtSlot,
    openCreateModalForPatient,
    openEditModal,
    closeModal,
    patientSelectLocked,
    patientOptions,
    procedimentoOptions,
    dispCalendarioDia,
    dispDaySlots,
    dispHeatmap,
    dispMonthError,
    dispMonthLoading,
    goDispNextMonth,
    goDispPrevMonth,
    handleProximoHorarioLivre,
    refreshDashboard,
    selectDispCalendarioDia,
    selectDispSlot,
    saveAppointment,
    selectDay,
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
    weekRangeLabel,
    weekStartIso,
  };
}
