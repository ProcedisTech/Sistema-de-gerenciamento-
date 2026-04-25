import { useCallback, useEffect, useMemo, useState } from 'react';
import { equipeApi } from '../../services/api';
import { agendaMockOptions, agendaMockRepository, toDateKey } from './agendaMockRepository';

const STATUS_LABELS = {
  confirmado: 'confirmado',
  pendente: 'pendente',
  cancelado: 'cancelado',
};

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

function normalizeEquipeMember(row) {
  if (!row || typeof row !== 'object') return null;
  const id =
    row.roleUserId ||
    row.role_user_id ||
    row.id ||
    row.usuarioId ||
    row.usuario_id ||
    '';
  const nome =
    String(row.nomeCompleto || row.nome_completo || row.nome || row.nomeUsuario || row.username || '')
      .trim() || 'Profissional';
  if (!id && !nome) return null;
  return { id: String(id || nome), nome };
}

function defaultForm(selectedDay, patientOptions, profissionalOptions) {
  const firstPatient = patientOptions[0] || {};
  const firstProf = profissionalOptions[0] || {};
  const procedimentos = agendaMockOptions.procedimentos || [];
  return {
    pacienteId: firstPatient.id || '',
    pacienteNome: firstPatient.nome || '',
    telefone: firstPatient.telefone || '',
    procedimentoNome: procedimentos[0] || '',
    data: selectedDay || toLocalDateIso(),
    horaInicio: '09:00',
    duracaoMin: 60,
    profissionalNome: firstProf.nome || '',
    status: 'confirmado',
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

export function useAgendaPage({ patients = [] } = {}) {
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
  const [profissionalOptions, setProfissionalOptions] = useState([]);
  const [form, setForm] = useState(() => defaultForm(todayIso, [], []));
  const [formErrors, setFormErrors] = useState({});
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [hojeCount, setHojeCount] = useState(0);
  const [weekStartIso, setWeekStartIso] = useState(() => startOfWeekSundayIso(toLocalDateIso()));
  const [weekGridAppointments, setWeekGridAppointments] = useState([]);

  const patientOptions = useMemo(
    () => (Array.isArray(patients) ? patients : []).map(normalizePatientOption),
    [patients]
  );

  useEffect(() => {
    let cancelled = false;
    equipeApi
      .list()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const mapped = list
          .filter((p) => p.ativo !== false)
          .map(normalizeEquipeMember)
          .filter(Boolean);
        setProfissionalOptions(mapped);
      })
      .catch(() => {
        if (!cancelled) setProfissionalOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentYm = useMemo(() => monthKey(monthDate), [monthDate]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await agendaMockRepository.listByMonth(currentYm);
      setAppointments(rows);
    } catch (e) {
      setError(e?.message || 'Não foi possível carregar a agenda.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [currentYm]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    let cancelled = false;
    const key = toLocalDateIso();
    agendaMockRepository.listByDate(key).then((rows) => {
      if (!cancelled) setHojeCount(rows.length);
    });
    return () => {
      cancelled = true;
    };
  }, [appointments, currentYm]);

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
    if (viewMode !== 'semana') return;
    let cancelled = false;
    agendaMockRepository.listInDateRange(weekStartIso, weekEndIso).then((rows) => {
      if (!cancelled) setWeekGridAppointments(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [viewMode, weekStartIso, weekEndIso, appointments]);

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

  const stats = useMemo(
    () => ({
      totalMes: appointments.length,
      confirmados: appointments.filter((item) => item.status === 'confirmado').length,
      pendentes: appointments.filter((item) => item.status === 'pendente').length,
      hoje: hojeCount,
    }),
    [appointments, hojeCount]
  );

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
      setForm(defaultForm(date, patientOptions, profissionalOptions));
      setFormErrors({});
      setModalMode('create');
    },
    [patientOptions, profissionalOptions, selectedDay]
  );

  const openEditModal = useCallback(
    (appointment) => {
      setEditingAppointment(appointment);
      setForm({ ...defaultForm(appointment?.data || selectedDay, patientOptions, profissionalOptions), ...appointment });
      setFormErrors({});
      setModalMode('edit');
    },
    [patientOptions, profissionalOptions, selectedDay]
  );

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingAppointment(null);
    setFormErrors({});
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors = {};
    if (!form.pacienteId && !String(form.pacienteNome || '').trim()) nextErrors.pacienteId = 'Selecione um paciente.';
    if (!String(form.procedimentoNome || '').trim()) nextErrors.procedimentoNome = 'Selecione o procedimento.';
    if (!form.data) nextErrors.data = 'Informe a data.';
    if (!form.horaInicio) nextErrors.horaInicio = 'Informe o horário.';
    if (!Number(form.duracaoMin)) nextErrors.duracaoMin = 'Informe a duração.';
    if (!String(form.profissionalNome || '').trim()) nextErrors.profissionalNome = 'Selecione o profissional.';
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  const saveAppointment = useCallback(async () => {
    if (!validateForm()) return false;
    const patient = patientOptions.find((p) => p.id === form.pacienteId);
    const payload = {
      ...form,
      pacienteId: form.pacienteId || patient?.id || '',
      pacienteNome: form.pacienteNome || patient?.nome || 'Paciente',
      telefone: form.telefone || patient?.telefone || '',
      duracaoMin: Number(form.duracaoMin) || 45,
    };

    if (modalMode === 'edit' && editingAppointment?.id) {
      await agendaMockRepository.update(editingAppointment.id, payload);
    } else {
      await agendaMockRepository.create(payload);
    }
    const nextMonthDate = new Date(Number(payload.data.slice(0, 4)), Number(payload.data.slice(5, 7)) - 1, 1);
    setSelectedDay(payload.data);
    setMonthDate(nextMonthDate);
    setAppointments(await agendaMockRepository.listByMonth(monthKey(nextMonthDate)));
    closeModal();
    return true;
  }, [closeModal, editingAppointment, form, modalMode, patientOptions, validateForm]);

  const deleteAppointment = useCallback(async () => {
    if (!editingAppointment?.id) return false;
    await agendaMockRepository.remove(editingAppointment.id);
    await loadMonth();
    closeModal();
    return true;
  }, [closeModal, editingAppointment, loadMonth]);

  const updateStatus = useCallback(
    async (appointment, status) => {
      if (!appointment?.id) return;
      await agendaMockRepository.update(appointment.id, { ...appointment, status });
      await loadMonth();
    },
    [loadMonth]
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
    deleteAppointment,
    error,
    form,
    formErrors,
    goNextMonth,
    goPrevMonth,
    goWeekNext,
    goWeekPrev,
    groupedAppointments,
    loading,
    modalMode,
    monthLabel,
    moveSelectedDay,
    openCreateModal,
    openEditModal,
    closeModal,
    patientOptions,
    procedimentoOptions: agendaMockOptions.procedimentos,
    profissionalOptions,
    saveAppointment,
    selectDay,
    selectedDay,
    selectedDayAppointments,
    setDaySheetOpen,
    setViewMode,
    stats,
    syncWeekFromSelection,
    statusLabels: STATUS_LABELS,
    statusOptions: agendaMockOptions.status,
    updateForm,
    updateStatus,
    viewMode,
    weekDayIsos,
    weekGridAppointments,
    weekRangeLabel,
    weekStartIso,
  };
}
