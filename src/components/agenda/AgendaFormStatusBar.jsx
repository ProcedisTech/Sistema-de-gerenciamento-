import React, { useMemo } from 'react';

const LABELS = {
  paciente: 'paciente',
  procedimento: 'procedimento',
  profissional: 'profissional',
  data: 'dia no calendário',
  hora: 'horário no calendário',
};

function hasPaciente(form) {
  return Boolean(String(form?.pacienteId || '').trim() || String(form?.pacienteNome || '').trim());
}

function hasProcedimento(form) {
  const ids = Array.isArray(form?.catalogoProcedimentoSaudeIds) ? form.catalogoProcedimentoSaudeIds : [];
  return ids.map((id) => String(id).trim()).filter(Boolean).length > 0;
}

export function AgendaFormStatusBar({
  form,
  roleUserIdAgenda,
  horarioConflita,
  slotsOcupadosLoading,
  horarioConflitoCom,
}) {
  const missing = useMemo(() => {
    const list = [];
    if (!hasPaciente(form)) list.push(LABELS.paciente);
    if (!hasProcedimento(form)) list.push(LABELS.procedimento);
    if (!String(roleUserIdAgenda || '').trim()) list.push(LABELS.profissional);
    if (!form?.data) list.push(LABELS.data);
    if (!form?.horaInicio) list.push(LABELS.hora);
    return list;
  }, [form, roleUserIdAgenda]);

  const complete = missing.length === 0;

  let text = '';

  if (!complete) {
    text = `Faltam: ${missing.join(', ')}`;
  } else if (slotsOcupadosLoading) {
    text = 'Validando...';
  } else if (horarioConflita) {
    const hh = horarioConflitoCom || String(form?.horaInicio || '').slice(0, 5);
    text = `⚠ Conflito com ${hh}`;
  } else {
    text = '✓ Horário livre';
  }

  return <p className="text-xs text-gray-500">{text}</p>;
}
