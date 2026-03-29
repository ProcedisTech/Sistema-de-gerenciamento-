import { useCallback, useMemo, useState } from 'react';

const normalizeCpf = (v) => String(v || '').replace(/\D/g, '');
const normalizeTelefone = (v) => String(v || '').replace(/\D/g, '');

export function useAgendaController({ patients, setPatients, maskCPF, maskTelefone }) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [appointments, setAppointments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(new Date().getMonth());

  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [agendaModePatient, setAgendaModePatient] = useState('novo');
  const [agendaDate, setAgendaDate] = useState(todayIso);
  const [agendaTime, setAgendaTime] = useState('09:00');
  const [agendaProcedure, setAgendaProcedure] = useState('');

  const [agendaPatientSearch, setAgendaPatientSearch] = useState('');
  const [agendaSelectedPatientCpf, setAgendaSelectedPatientCpf] = useState('');
  const [agendaModalError, setAgendaModalError] = useState('');

  const [agendaNewPatientNome, setAgendaNewPatientNome] = useState('');
  const [agendaNewPatientCpf, setAgendaNewPatientCpf] = useState('');
  const [agendaNewPatientTelefone, setAgendaNewPatientTelefone] = useState('');

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

  const monthPatientCpfs = useMemo(
    () =>
      new Set(
        monthAppointments
          .map((a) => normalizeCpf(a?.patient?.cpf))
          .filter(Boolean)
      ),
    [monthAppointments]
  );

  const monthConfirmedPatientCpfs = useMemo(
    () =>
      new Set(
        monthAppointments
          .filter((a) => (a?.status || 'pendente') === 'confirmado')
          .map((a) => normalizeCpf(a?.patient?.cpf))
          .filter(Boolean)
      ),
    [monthAppointments]
  );

  const monthPendingPatientCpfs = useMemo(
    () =>
      new Set(
        monthAppointments
          .filter((a) => (a?.status || 'pendente') === 'pendente')
          .map((a) => normalizeCpf(a?.patient?.cpf))
          .filter(Boolean)
      ),
    [monthAppointments]
  );

  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.date === todayIso),
    [appointments, todayIso]
  );

  const todayPatientCpfs = useMemo(
    () =>
      new Set(
        todayAppointments
          .map((a) => normalizeCpf(a?.patient?.cpf))
          .filter(Boolean)
      ),
    [todayAppointments]
  );

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
    setAgendaModePatient('novo');
    setAgendaDate(selectedDay);
    setAgendaTime('09:00');
    setAgendaProcedure('');
    setAgendaPatientSearch('');
    setAgendaSelectedPatientCpf('');
    setAgendaNewPatientNome('');
    setAgendaNewPatientCpf('');
    setAgendaNewPatientTelefone('');
  };

  const closeAgendaModal = () => {
    setAgendaModalOpen(false);
    setAgendaModalError('');
  };

  const confirmAgendaAppointment = () => {
    setAgendaModalError('');

    if (!agendaDate || !agendaTime || !agendaProcedure.trim()) {
      setAgendaModalError('Preencha data, horario e procedimento.');
      return;
    }

    const createPatientIfNeeded = () => {
      if (agendaModePatient === 'existente') {
        const existing = patients.find(
          (p) => (p.cpf || '').trim() === (agendaSelectedPatientCpf || '').trim()
        );
        if (!existing) return null;
        return existing;
      }

      const nome = agendaNewPatientNome.trim();
      const cpfInput = agendaNewPatientCpf.trim();
      const telInput = agendaNewPatientTelefone.trim();
      if (!nome || !cpfInput || !telInput) return null;

      const normalized = {
        cpf: normalizeCpf(cpfInput),
        telefone: normalizeTelefone(telInput),
      };

      const found =
        patients.find((p) => normalizeCpf(p.cpf) === normalized.cpf) ||
        patients.find((p) => normalizeTelefone(p.telefone) === normalized.telefone);

      if (found) {
        return {
          ...found,
          nome,
          cpf: cpfInput,
          telefone: telInput,
        };
      }

      return {
        id: `patient_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        nome,
        dataNascimento: '',
        idade: '',
        sexo: '',
        estadoCivil: '',
        profissao: '',
        alergias: '',
        cpf: cpfInput,
        rg: '',
        telefone: telInput,
        email: '',
      };
    };

    const patient = createPatientIfNeeded();
    if (!patient) {
      setAgendaModalError('Selecione/Preencha o paciente para agendar.');
      return;
    }

    if (agendaModePatient === 'novo') {
      setPatients((prev) => {
        const cpfKey = (patient.cpf || '').trim();
        if (!cpfKey) return prev;
        const idx = prev.findIndex((p) => (p.cpf || '').trim() === cpfKey);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...patient };
          return copy;
        }
        return [...prev, patient];
      });
    }

    const newAppointment = {
      id: `appt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      date: agendaDate,
      time: agendaTime,
      procedure: agendaProcedure.trim(),
      status: 'pendente',
      patient: {
        nome: patient.nome || '',
        cpf: patient.cpf || '',
        telefone: patient.telefone || '',
      },
    };

    setAppointments((prev) => [...prev, newAppointment]);
    setSelectedDay(agendaDate);
    setCalendarYear(Number(agendaDate.slice(0, 4)));
    setCalendarMonthIndex(Number(agendaDate.slice(5, 7)) - 1);
    closeAgendaModal();
  };

  const toggleAppointmentStatus = (appointmentId, nextStatus) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: nextStatus } : a))
    );
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
    agendaNewPatientTelefone,
    setAgendaNewPatientTelefone,
    maskCPF,
    maskTelefone,
    agendaPatientSearch,
    setAgendaPatientSearch,
    patients,
    agendaSelectedPatientCpf,
    setAgendaSelectedPatientCpf,
    agendaDate,
    setAgendaDate,
    agendaTime,
    setAgendaTime,
    agendaProcedure,
    setAgendaProcedure,
    onConfirm: confirmAgendaAppointment,
  };

  return {
    appointments,
    selectedDay,
    setSelectedDay,
    calendarCells,
    appointmentsForSelectedDay,
    monthPatientCpfs,
    monthConfirmedPatientCpfs,
    monthPendingPatientCpfs,
    todayPatientCpfs,
    monthLabel,
    openAgendaModal,
    goPrevCalendarMonth,
    goNextCalendarMonth,
    toggleAppointmentStatus,
    agendaModalProps,
  };
}

