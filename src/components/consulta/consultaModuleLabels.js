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
      ? `O que deseja fazer com o atendimento de ${pacienteNome}?`
      : 'O que deseja fazer com o atendimento atual?';
  }
  const label = CONSULTA_MODULE_LABELS[module] ?? 'este módulo';
  if (pacienteNome) {
    return `O que deseja fazer com o atendimento de ${pacienteNome} (saindo de ${label})?`;
  }
  return `O que deseja fazer com o atendimento (saindo de ${label})?`;
}
