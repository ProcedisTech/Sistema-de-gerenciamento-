import { useState } from 'react';

export const useAppointmentState = () => {
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

  return {
    appointments,
    setAppointments,
    selectedDay,
    setSelectedDay,
    calendarYear,
    setCalendarYear,
    calendarMonthIndex,
    setCalendarMonthIndex,
    agendaModalOpen,
    setAgendaModalOpen,
    agendaModePatient,
    setAgendaModePatient,
    agendaDate,
    setAgendaDate,
    agendaTime,
    setAgendaTime,
    agendaProcedure,
    setAgendaProcedure,
    agendaPatientSearch,
    setAgendaPatientSearch,
    agendaSelectedPatientCpf,
    setAgendaSelectedPatientCpf,
    agendaModalError,
    setAgendaModalError,
    agendaNewPatientNome,
    setAgendaNewPatientNome,
    agendaNewPatientCpf,
    setAgendaNewPatientCpf,
    agendaNewPatientTelefone,
    setAgendaNewPatientTelefone,
  };
};

