export const CONSULTA_MODULE_LABELS = {
  hub: 'Consulta',
  anamnese: 'Anamnese',
  avaliacao: 'Avaliação',
  planejamento: 'Planejamento',
  termos: 'Termos',
  procedimento: 'Procedimento',
  retorno: 'Retorno',
};

export const CONSULTA_MODULE_LABELS_RETORNO = {
  ...CONSULTA_MODULE_LABELS,
  hub: 'Retorno em andamento',
};

export function getEncerrarConsultaMessage(module, pacienteNome) {
  if (!module || module === 'hub') {
    return pacienteNome
      ? `Deseja encerrar a consulta de ${pacienteNome}?`
      : 'Deseja encerrar a consulta?';
  }
  const label = CONSULTA_MODULE_LABELS[module] ?? 'este módulo';
  if (pacienteNome) {
    return `Deseja encerrar a consulta de ${pacienteNome} sem terminar ${label}?`;
  }
  return `Deseja encerrar a consulta sem terminar ${label}?`;
}
