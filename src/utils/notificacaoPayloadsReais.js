// Payload que o back realmente grava em cada tipo (conferido nos testes do back por tipo). Só fixture de teste.
const AGENDA = {
  pacienteNome: 'Maria', dataAgendamento: '2026-10-25', horaInicio: '09:00', procedimentoNome: 'Botox',
};

export const PAYLOAD_REAL = {
  AGENDA_NOVO: { agendaId: 'ag-1', ...AGENDA },
  AGENDA_CANCELADO: { agendaId: 'ag-1', data: '2026-10-25', motivo: 'paciente_desistiu', ...AGENDA },
  AGENDA_REAGENDADO: {
    agendaIdAntigo: 'ag-0', agendaIdNovo: 'ag-1',
    dataAntiga: '2026-10-25', horarioAntigo: '09:00', dataNova: '2026-10-26', horarioNovo: '10:00',
    pacienteNome: 'Maria', dataAgendamento: '2026-10-26', horaInicio: '10:00', procedimentoNome: 'Botox',
  },
  CONFIRMACAO_CONFIRMOU: { confirmacaoId: 'c-1', agendaId: 'ag-1', resposta: 'confirmado', ...AGENDA },
  CONFIRMACAO_RECUSOU: { confirmacaoId: 'c-1', agendaId: 'ag-1', resposta: 'recusado', ...AGENDA },
  CONFIRMACAO_SEM_RESPOSTA: { confirmacaoId: 'c-1', agendaId: 'ag-1', ...AGENDA },
  ANAMNESE_RESPONDIDA: { pacienteNome: 'Maria' },
  ANAMNESE_VENCIDA: { agendaId: 'ag-1', ...AGENDA },
  TERMO_ASSINADO: { termoNome: 'Termo de Botox', pacienteNome: 'Maria' },
  TERMO_LINK_EXPIRADO: { termoNome: 'Termo de Botox', pacienteNome: 'Maria' },
  CONSULTA_ENCERRADA: { pacienteNome: 'Maria', profissionalNome: 'Dra. Ana' },
  EQUIPE_NOVO_MEMBRO: { membroNome: 'João', membroPerfil: 'Recepção' },
  RETORNO_LEMBRETE_VENCIDO: {}, // o back ainda não emite este tipo
};
