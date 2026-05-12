import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { useToast } from '../../contexts/useToast.js';
import {
  agendasApi,
  catalogosApi,
  confirmacaoApi,
  disponibilidadeApi,
} from '../../services/api';
import { abrirWhatsApp } from '../../utils/whatsapp.js';
import { formatAgendamentoApiError } from '../../utils/agendaErrors';
import { monthRangeIso, toDateKey } from '../../utils/agendaDateUtils';
import {
  buildAgendaCreateBody,
  buildAgendaUpdateBody,
  fetchDashboardAppointmentsForRange,
  normalizeApiList,
} from '../../utils/agendaDashboardMapping';
import {
  AGENDA_DAY_END_MIN,
  AGENDA_DAY_START_MIN,
  AGENDA_SLOT_STEP_MIN,
  findNextFreeSlotStart,
  occupiedIntervalsFromAgendaDtos,
  parseHhmmToMinutes,
  proposalOverlapsOccupied,
} from '../../utils/agendaAvailability';
import { useConfirmacaoForaDisp } from './ConfirmacaoForaDispModal';
import { executarComBypassDisp } from '../../services/agendasHelpers';
import { addMinutesToTime } from '../../utils/agendaMapping';

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

function defaultForm(selectedDay, patientOptions, firstProcedimentoOption) {
  const firstPatient = patientOptions[0] || {};
  const proc = firstProcedimentoOption || {};
  return {
    pacienteId: firstPatient.id || '',
    pacienteNome: firstPatient.nome || '',
    telefone: firstPatient.telefone || '',
    procedimentoNome: '',
    catalogoProcedimentoSaudeIds: proc.id ? [String(proc.id)] : [],
    data: selectedDay || toLocalDateIso(),
    horaInicio: '09:00',
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
  const { roleUserId } = useOrg();
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
  const [catalogRows, setCatalogRows] = useState([]);
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

  const { modal: foraDispModal, abrirConfirmacao: abrirConfirmacaoForaDisp } =
    useConfirmacaoForaDisp();

  const procedimentoOptions = useMemo(
    () =>
      (Array.isArray(catalogRows) ? catalogRows : [])
        .filter((c) => c && c.ativo !== false)
        .map((c) => ({
          id: String(c.id || c.catalogoProcedimentoSaudeId || ''),
          nome: c.nomeProcedimento || String(c.id || ''),
        }))
        .filter((o) => o.id),
    [catalogRows]
  );

  const patientOptions = useMemo(
    () => (Array.isArray(patients) ? patients : []).map(normalizePatientOption),
    [patients]
  );

  const fetchCatalogRows = useCallback(() => {
    if (!authEnabled) {
      setCatalogRows([]);
      return () => {};
    }
    let cancelled = false;
    catalogosApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setCatalogRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCatalogRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authEnabled]);

  useEffect(() => {
    return fetchCatalogRows();
  }, [fetchCatalogRows]);

  useEffect(() => {
    const handler = () => fetchCatalogRows();
    window.addEventListener('catalogo:changed', handler);
    return () => window.removeEventListener('catalogo:changed', handler);
  }, [fetchCatalogRows]);

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

  const currentYm = useMemo(() => monthKey(monthDate), [monthDate]);

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

  useEffect(() => {
    if (!authEnabled || !modalMode || !form.data) {
      setSlotsOcupados([]);
      setSlotsOcupadosLoading(false);
      return;
    }
    let cancelled = false;
    setSlotsOcupadosLoading(true);
    agendasApi
      .byRange(form.data, form.data)
      .then((raw) => {
        if (cancelled) return;
        let dtos = normalizeApiList(raw);
        const skipId = editingAppointment?.agendaId;
        if (skipId) {
          dtos = dtos.filter((d) => d && String(d.id) !== String(skipId));
        }
        const role = String(roleUserId || '').trim();
        const intervals = occupiedIntervalsFromAgendaDtos(dtos, {
          excludeCancelled: true,
          roleUserId: role || undefined,
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
  }, [authEnabled, modalMode, form.data, roleUserId, editingAppointment?.agendaId]);

  const horarioConflita = useMemo(
    () => (modalMode ? proposalOverlapsOccupied(form.horaInicio, form.duracaoMin, slotsOcupados) : false),
    [modalMode, form.horaInicio, form.duracaoMin, slotsOcupados]
  );

  const proximoHorarioLivre = useMemo(() => {
    if (!modalMode || !form.data) return null;
    const from = parseHhmmToMinutes(String(form.horaInicio || '').slice(0, 5));
    return findNextFreeSlotStart(
      from,
      form.duracaoMin,
      slotsOcupados,
      AGENDA_DAY_START_MIN,
      AGENDA_DAY_END_MIN,
      AGENDA_SLOT_STEP_MIN
    );
  }, [modalMode, form.data, form.horaInicio, form.duracaoMin, slotsOcupados]);

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
    async (agendaId, payload) => {
      if (!agendaId || !payload) return false;
      try {
        await agendasApi.cancelar(agendaId, payload);
        toastSuccess('Agendamento cancelado');
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
    [loadMonth, refreshWeekGrid, toastSuccess, toastError]
  );

  const handleAtualizarStatus = useCallback(
    async (agendaId, codigo) => {
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
    [loadMonth, refreshWeekGrid, toastSuccess, toastError]
  );

  const handleReagendar = useCallback(
    async (agendaId, payload) => {
      if (!agendaId || !payload) return false;
      setSubmittingReagendar(true);
      try {
        const resultado = await executarComBypassDisp(
          () => agendasApi.reagendar(agendaId, payload),
          () => agendasApi.reagendar(agendaId, payload, { forcar: true }),
          abrirConfirmacaoForaDisp
        );
        if (resultado === null) return false;
        toastSuccess('Agendamento reagendado');
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
    [loadMonth, refreshWeekGrid, toastSuccess, toastError, abrirConfirmacaoForaDisp]
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
      setEditingAppointment(null);
      setPatientSelectLocked(false);
      setForm(defaultForm(date, patientOptions, null));
      setFormErrors({});
      setModalMode('create');
    },
    [patientOptions, selectedDay]
  );

  /** Abrir "Novo agendamento" a partir do perfil do paciente (data inicial = hoje). */
  const openCreateModalForPatient = useCallback(
    (patient) => {
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
      setModalMode('create');
    },
    [patientOptions, todayIso]
  );

  const openEditModal = useCallback(
    (appointment) => {
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
        duracaoMin: snapAgendaDuracaoMin(appointment?.duracaoMin ?? base.duracaoMin),
        observacao: appointment?.observacao || appointment?.rawAgendamento?.observacao || base.observacao,
      });
      setFormErrors({});
      setPatientSelectLocked(false);
      setModalMode('edit');
    },
    [patientOptions, selectedDay]
  );

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingAppointment(null);
    setPatientSelectLocked(false);
    setFormErrors({});
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
    if (!form.data) nextErrors.data = 'Informe a data.';
    else if (form.data < todayIso) {
      nextErrors.data = 'Data inválida — não é possível agendar para o passado.';
    }
    if (!form.horaInicio) nextErrors.horaInicio = 'Informe o horário.';
    const d = Number(form.duracaoMin);
    if (!Number.isFinite(d) || d < DUR_MIN || d > DUR_MAX || (d - DUR_MIN) % DUR_STEP !== 0) {
      nextErrors.duracaoMin = 'Duração entre 15 e 150 min, múltiplos de 5.';
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form, todayIso, modalMode]);

  const saveAppointment = useCallback(async () => {
    if (!validateForm()) return false;
    const contextRole = String(roleUserId || '').trim();
    if (!contextRole) {
      setFormErrors((prev) => ({
        ...prev,
        _global: 'Sessão sem vínculo de profissional (role). Faça login novamente ou complete o perfil na clínica.',
      }));
      setError('Sessão sem vínculo de profissional (role).');
      return false;
    }

    const patient = patientOptions.find((p) => p.id === form.pacienteId);
    const procIds = (Array.isArray(form.catalogoProcedimentoSaudeIds) ? form.catalogoProcedimentoSaudeIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    try {
      if (modalMode === 'edit' && editingAppointment?.agendaId) {
        const rawSlot = editingAppointment.rawSlot || {};
        const catId = procIds[0];
        if (!catId) {
          setError('Selecione o procedimento.');
          return false;
        }
        const baseBody = buildAgendaUpdateBody(editingAppointment.rawSlot, form, contextRole);
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
            roleUserId: contextRole,
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
    loadMonth,
    modalMode,
    patientOptions,
    refreshWeekGrid,
    roleUserId,
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
    appointments,
    appointmentsByDate,
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
    handleCancelar,
    handleEnviarWhatsApp,
    handleReagendar,
    horarioConflita,
    isHorarioOcupado,
    loading,
    modalMode,
    monthLabel,
    moveSelectedDay,
    openCreateModal,
    openCreateModalForPatient,
    openEditModal,
    closeModal,
    patientSelectLocked,
    patientOptions,
    procedimentoOptions,
    proximoHorarioLivre,
    refreshDashboard,
    saveAppointment,
    selectDay,
    selectedDay,
    selectedDayAppointments,
    setDaySheetOpen,
    setViewMode,
    slotsOcupados,
    slotsOcupadosLoading,
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
