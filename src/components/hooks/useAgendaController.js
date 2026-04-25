import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { useToast } from '../../contexts/useToast.js';
import { agendasApi, pacientesApi, catalogosApi, agendamentosApi } from '../../services/api';
import { mapAgendaDtoToAppointment, addMinutesToTime } from '../../utils/agendaMapping';
import { formatAgendamentoApiError } from '../../utils/agendaErrors';
import { mapBackendPatient } from '../../utils/patientMapping';
import { formatPhoneForApi } from '../../utils/phoneUtils';

const normalizeCpf = (v) => String(v || '').replace(/\D/g, '');

export function useAgendaController({ patients, setPatients, maskCPF, authEnabled = false }) {
  const toast = useToast();
  const { roleUserId } = useOrg();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [appointments, setAppointments] = useState([]);
  const [agendasLoading, setAgendasLoading] = useState(false);
  const [agendasError, setAgendasError] = useState('');
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(new Date().getMonth());

  const [catalogosList, setCatalogosList] = useState([]);

  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [agendaModePatient, setAgendaModePatient] = useState('novo');
  const [agendaDate, setAgendaDate] = useState(todayIso);
  const [agendaTime, setAgendaTime] = useState('09:00');
  const [agendaHoraFim, setAgendaHoraFim] = useState('09:45');
  const [agendaProcedure, setAgendaProcedure] = useState('');
  const [agendaCatalogoId, setAgendaCatalogoId] = useState('');

  const [agendaPatientSearch, setAgendaPatientSearch] = useState('');
  const [agendaSelectedPatientCpf, setAgendaSelectedPatientCpf] = useState('');
  const [agendaModalError, setAgendaModalError] = useState('');
  const [agendaSaving, setAgendaSaving] = useState(false);

  const [agendaNewPatientNome, setAgendaNewPatientNome] = useState('');
  const [agendaNewPatientCpf, setAgendaNewPatientCpf] = useState('');
  const [agendaNewPatientTelefoneCountry, setAgendaNewPatientTelefoneCountry] = useState('BR');
  const [agendaNewPatientTelefoneNumero, setAgendaNewPatientTelefoneNumero] = useState('');
  const [agendaNewPatientTelefoneTouched, setAgendaNewPatientTelefoneTouched] = useState(false);

  const [compromissoModalOpen, setCompromissoModalOpen] = useState(false);
  const [slotParaCompromisso, setSlotParaCompromisso] = useState(null);
  const [compromissoPatientSearch, setCompromissoPatientSearch] = useState('');
  const [compromissoSelectedPatientCpf, setCompromissoSelectedPatientCpf] = useState('');
  const [compromissoCatalogoId, setCompromissoCatalogoId] = useState('');
  const [compromissoObservacao, setCompromissoObservacao] = useState('');
  const [compromissoModalError, setCompromissoModalError] = useState('');
  const [compromissoSaving, setCompromissoSaving] = useState(false);

  const pad2 = useCallback((n) => String(n).padStart(2, '0'), []);
  const buildDateStr = useCallback(
    (year, monthIndex, day) => `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`,
    [pad2]
  );

  const monthStartWeekday = useMemo(
    () => new Date(calendarYear, calendarMonthIndex, 1).getDay(),
    [calendarYear, calendarMonthIndex]
  );
  const monthDaysCount = useMemo(
    () => new Date(calendarYear, calendarMonthIndex + 1, 0).getDate(),
    [calendarYear, calendarMonthIndex]
  );

  const monthRange = useMemo(() => {
    const start = buildDateStr(calendarYear, calendarMonthIndex, 1);
    const end = buildDateStr(calendarYear, calendarMonthIndex, monthDaysCount);
    return { start, end };
  }, [calendarYear, calendarMonthIndex, monthDaysCount, buildDateStr]);

  const fetchMonthAgendas = useCallback(async () => {
    if (!authEnabled) {
      setAppointments([]);
      setAgendasError('');
      setAgendasLoading(false);
      return;
    }
    setAgendasLoading(true);
    setAgendasError('');
    try {
      const raw = await agendasApi.byRange(monthRange.start, monthRange.end);
      const list = Array.isArray(raw) ? raw : [];
      const mapped = list.map(mapAgendaDtoToAppointment).filter(Boolean);
      const withCompromissos = await Promise.all(
        mapped.map(async (slot) => {
          try {
            const items = await agendamentosApi.listByAgenda(slot.id);
            const arr = Array.isArray(items) ? items : [];
            return { ...slot, compromissos: arr };
          } catch {
            return { ...slot, compromissos: [] };
          }
        })
      );
      setAppointments(withCompromissos);
    } catch (e) {
      if (e.status === 401) {
        console.warn('[agenda] Sessão ausente ou expirada; agenda não carregada.');
      } else {
        console.warn('[agenda] Falha ao carregar agenda:', e.message);
      }
      setAgendasError(e.message || 'Falha ao carregar agenda');
      setAppointments([]);
    } finally {
      setAgendasLoading(false);
    }
  }, [monthRange.start, monthRange.end, authEnabled]);

  useEffect(() => {
    if (!authEnabled) {
      setAppointments([]);
      setAgendasError('');
      setAgendasLoading(false);
      return;
    }
    fetchMonthAgendas();
  }, [authEnabled, fetchMonthAgendas]);

  const loadModalCatalogs = useCallback(() => {
    catalogosApi
      .list()
      .then((data) => {
        if (Array.isArray(data)) setCatalogosList(data.filter((c) => c.ativo !== false));
      })
      .catch(() => setCatalogosList([]));
  }, []);

  const calendarCells = useMemo(
    () =>
      Array.from({ length: 42 }).map((_, idx) => {
        const dayNum = idx - monthStartWeekday + 1;
        if (dayNum < 1 || dayNum > monthDaysCount) return { dayNum: null, dateStr: null };
        return { dayNum, dateStr: buildDateStr(calendarYear, calendarMonthIndex, dayNum) };
      }),
    [monthStartWeekday, monthDaysCount, calendarYear, calendarMonthIndex, buildDateStr]
  );

  const appointmentsForSelectedDay = useMemo(
    () => appointments.filter((a) => a.date === selectedDay),
    [appointments, selectedDay]
  );

  const currentYm = useMemo(
    () => `${calendarYear}-${pad2(calendarMonthIndex + 1)}`,
    [calendarYear, calendarMonthIndex, pad2]
  );

  const monthAppointments = useMemo(
    () => appointments.filter((a) => (a?.date ? a.date.slice(0, 7) : '') === currentYm),
    [appointments, currentYm]
  );

  const monthPatientCpfs = useMemo(() => {
    const ids = new Set();
    monthAppointments.forEach((slot) => {
      (slot.compromissos || []).forEach((c) => {
        if (c.pacienteId) ids.add(c.pacienteId);
      });
    });
    return ids;
  }, [monthAppointments]);

  const monthConfirmedPatientCpfs = useMemo(() => new Set(), []);
  const monthPendingPatientCpfs = useMemo(() => new Set(), []);

  const todayIsoMemo = todayIso;
  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.date === todayIsoMemo),
    [appointments, todayIsoMemo]
  );

  const agendaStats = useMemo(() => {
    const monthSlots = monthAppointments.filter((a) => a.tipo !== 'bloqueio');
    const compromissosMes = monthAppointments.reduce((n, s) => n + (s.compromissos?.length || 0), 0);
    const compromissosHoje = todayAppointments.reduce((n, s) => n + (s.compromissos?.length || 0), 0);
    return {
      monthTotal: monthSlots.length,
      monthConfirmed: monthAppointments.filter((a) => a.status === 'confirmado').length,
      monthPending: monthAppointments.filter((a) => a.status === 'pendente' && a.tipo !== 'bloqueio').length,
      todayTotal: todayAppointments.filter((a) => a.tipo !== 'bloqueio').length,
      compromissosMes,
      compromissosHoje,
    };
  }, [monthAppointments, todayAppointments]);

  const todayPatientCpfs = useMemo(() => {
    const ids = new Set();
    todayAppointments.forEach((slot) => {
      (slot.compromissos || []).forEach((c) => {
        if (c.pacienteId) ids.add(c.pacienteId);
      });
    });
    return ids;
  }, [todayAppointments]);

  const monthLabel = useMemo(() => {
    const labels = [
      'Janeiro',
      'Fevereiro',
      'Marco',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return `${labels[calendarMonthIndex]} ${calendarYear}`;
  }, [calendarMonthIndex, calendarYear]);

  const openAgendaModal = () => {
    setAgendaModalError('');
    setAgendaModalOpen(true);
    setAgendaModePatient('existente');
    setAgendaDate(selectedDay);
    setAgendaTime('09:00');
    setAgendaHoraFim(addMinutesToTime('09:00', 45));
    setAgendaProcedure('');
    setAgendaCatalogoId('');
    setAgendaPatientSearch('');
    setAgendaSelectedPatientCpf('');
    setAgendaNewPatientNome('');
    setAgendaNewPatientCpf('');
    setAgendaNewPatientTelefoneCountry('BR');
    setAgendaNewPatientTelefoneNumero('');
    setAgendaNewPatientTelefoneTouched(false);
    loadModalCatalogs();
  };

  const closeAgendaModal = () => {
    setAgendaModalOpen(false);
    setAgendaModalError('');
  };

  const confirmAgendaAppointment = async () => {
    setAgendaModalError('');

    if (!agendaDate || !agendaTime) {
      setAgendaModalError('Preencha data e horário.');
      return;
    }
    const contextRole = String(roleUserId || '').trim();
    if (!contextRole) {
      setAgendaModalError('Sessão sem vínculo de profissional (role). Faça login novamente ou complete o perfil na clínica.');
      return;
    }

    if (agendaModePatient === 'novo') {
      const nome = agendaNewPatientNome.trim();
      const cpfD = normalizeCpf(agendaNewPatientCpf);
      const telInput = formatPhoneForApi(agendaNewPatientTelefoneCountry, agendaNewPatientTelefoneNumero);
      if (nome && String(agendaNewPatientCpf || '').trim() && telInput && cpfD.length !== 11) {
        toast.error('O CPF deve conter 11 dígitos.');
        return;
      }
    }

    const nomeCat =
      agendaCatalogoId &&
      catalogosList.find(
        (c) => String(c.id) === String(agendaCatalogoId) || String(c.catalogoProcedimentoId) === String(agendaCatalogoId)
      )?.nomeProcedimento;
    const observacao = (agendaProcedure.trim() || nomeCat || 'Atendimento').slice(0, 500);

    setAgendaSaving(true);

    try {
      if (agendaModePatient === 'novo') {
        const nome = agendaNewPatientNome.trim();
        const cpfInput = agendaNewPatientCpf.trim();
        const telInput = formatPhoneForApi(agendaNewPatientTelefoneCountry, agendaNewPatientTelefoneNumero);
        if (nome && cpfInput && telInput) {
          const cpfDigits = normalizeCpf(cpfInput);
          const dto = await pacientesApi.create({
            nomeCompleto: nome,
            cpf: cpfDigits || null,
            telefone: telInput || null,
            email: cpfDigits ? `paciente.${cpfDigits}@cadastro.procedi` : 'paciente@cadastro.procedi',
          });
          const patient = mapBackendPatient(dto);
          setPatients((prev) => {
            const cpfKey = (patient.cpf || '').trim();
            const idx = prev.findIndex((p) => (p.cpf || '').trim() === cpfKey);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...patient };
              return copy;
            }
            return [...prev, patient];
          });
        }
      }

      const horaFim = agendaHoraFim || addMinutesToTime(agendaTime, 45);
      await agendasApi.create({
        dataAgendamento: agendaDate,
        horaInicio: agendaTime.length === 5 ? `${agendaTime}:00` : agendaTime,
        horaFim: horaFim.length === 5 ? `${horaFim}:00` : horaFim,
        roleUserId: contextRole,
        tipo: 'atendimento',
        observacao,
      });

      await fetchMonthAgendas();
      setSelectedDay(agendaDate);
      setCalendarYear(Number(agendaDate.slice(0, 4)));
      setCalendarMonthIndex(Number(agendaDate.slice(5, 7)) - 1);
      closeAgendaModal();
      toast.success('Horário criado na agenda.');
    } catch (e) {
      setAgendaModalError(formatAgendamentoApiError(e));
    } finally {
      setAgendaSaving(false);
    }
  };

  const openMarcarCompromisso = (slot) => {
    if (!slot?.id || slot.tipo === 'bloqueio' || slot.status === 'cancelado') return;
    setSlotParaCompromisso(slot);
    setCompromissoModalError('');
    setCompromissoPatientSearch('');
    setCompromissoSelectedPatientCpf('');
    setCompromissoCatalogoId('');
    setCompromissoObservacao('');
    setCompromissoModalOpen(true);
    loadModalCatalogs();
  };

  const closeCompromissoModal = () => {
    setCompromissoModalOpen(false);
    setSlotParaCompromisso(null);
    setCompromissoModalError('');
  };

  /** Modal MarcarCompromissoModal → agendamentosApi.create → api.js request (credentials + X-Org-Id). URL: /api/v1/agendamentos na mesma origem do Vite (ex. http://localhost:5173/api/...). */
  const confirmMarcarCompromisso = async () => {
    if (!slotParaCompromisso?.id) return;
    setCompromissoModalError('');
    const p = patients.find((x) => String(x.cpf || '').trim() === String(compromissoSelectedPatientCpf || '').trim());
    if (!p?.id) {
      setCompromissoModalError('Selecione um paciente com cadastro no servidor (UUID).');
      return;
    }
    if (!compromissoCatalogoId) {
      setCompromissoModalError('Selecione o procedimento no catálogo.');
      return;
    }
    setCompromissoSaving(true);
    try {
      await agendamentosApi.create({
        agendaId: slotParaCompromisso.id,
        pacienteId: p.id,
        catalogoProcedimentoSaudeId: compromissoCatalogoId,
        observacao: compromissoObservacao?.trim() || undefined,
      });
      await fetchMonthAgendas();
      closeCompromissoModal();
      toast.success('Compromisso marcado com sucesso.');
    } catch (e) {
      console.warn('[agendamentos] POST /api/v1/agendamentos falhou:', e.status, e.message);
      setCompromissoModalError(formatAgendamentoApiError(e));
    } finally {
      setCompromissoSaving(false);
    }
  };

  const removeCompromisso = async (compromissoRowId) => {
    if (!compromissoRowId) return;
    try {
      await agendamentosApi.remove(compromissoRowId);
      await fetchMonthAgendas();
      toast.info('Compromisso removido.');
    } catch (e) {
      toast.error(formatAgendamentoApiError(e));
    }
  };

  const cancelAppointment = async (appointmentId) => {
    if (!appointmentId) return;
    try {
      await agendasApi.cancelar(appointmentId);
      await fetchMonthAgendas();
      toast.info('Horário cancelado.');
    } catch (e) {
      toast.error(e.message || 'Não foi possível cancelar o horário.');
    }
  };

  const goPrevCalendarMonth = () => {
    if (calendarMonthIndex === 0) {
      setCalendarMonthIndex(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonthIndex((m) => m - 1);
    }
  };

  const goNextCalendarMonth = () => {
    if (calendarMonthIndex === 11) {
      setCalendarMonthIndex(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonthIndex((m) => m + 1);
    }
  };

  const agendaModalProps = {
    isOpen: agendaModalOpen,
    onClose: closeAgendaModal,
    agendaModalError,
    agendaModePatient,
    setAgendaModePatient,
    agendaNewPatientNome,
    setAgendaNewPatientNome,
    agendaNewPatientCpf,
    setAgendaNewPatientCpf,
    agendaNewPatientTelefoneCountry,
    setAgendaNewPatientTelefoneCountry,
    agendaNewPatientTelefoneNumero,
    setAgendaNewPatientTelefoneNumero,
    agendaNewPatientTelefoneTouched,
    setAgendaNewPatientTelefoneTouched,
    maskCPF,
    agendaPatientSearch,
    setAgendaPatientSearch,
    patients,
    agendaSelectedPatientCpf,
    setAgendaSelectedPatientCpf,
    agendaDate,
    setAgendaDate,
    agendaTime,
    setAgendaTime,
    agendaHoraFim,
    setAgendaHoraFim,
    agendaProcedure,
    setAgendaProcedure,
    agendaCatalogoId,
    setAgendaCatalogoId,
    catalogosList,
    onConfirm: confirmAgendaAppointment,
    agendaSaving,
    onAgendaTimeChange: (t) => {
      setAgendaTime(t);
      setAgendaHoraFim(addMinutesToTime(t, 45));
    },
  };

  const compromissoModalProps = {
    isOpen: compromissoModalOpen,
    onClose: closeCompromissoModal,
    horarioResumo: slotParaCompromisso
      ? `${slotParaCompromisso.date} · ${slotParaCompromisso.time} · ${slotParaCompromisso.profissionalNome || 'Profissional'}`
      : '',
    error: compromissoModalError,
    saving: compromissoSaving,
    patients,
    patientSearch: compromissoPatientSearch,
    setPatientSearch: setCompromissoPatientSearch,
    selectedPatientCpf: compromissoSelectedPatientCpf,
    setSelectedPatientCpf: setCompromissoSelectedPatientCpf,
    catalogosList,
    catalogoProcedimentoSaudeId: compromissoCatalogoId,
    setCatalogoProcedimentoSaudeId: setCompromissoCatalogoId,
    observacao: compromissoObservacao,
    setObservacao: setCompromissoObservacao,
    onConfirm: confirmMarcarCompromisso,
  };

  return {
    appointments,
    agendasLoading,
    agendasError,
    refreshAgendas: fetchMonthAgendas,
    selectedDay,
    setSelectedDay,
    calendarCells,
    appointmentsForSelectedDay,
    monthPatientCpfs,
    monthConfirmedPatientCpfs,
    monthPendingPatientCpfs,
    agendaStats,
    todayPatientCpfs,
    monthLabel,
    openAgendaModal,
    goPrevCalendarMonth,
    goNextCalendarMonth,
    cancelAppointment,
    removeCompromisso,
    openMarcarCompromisso,
    agendaModalProps,
    compromissoModalProps,
  };
}
