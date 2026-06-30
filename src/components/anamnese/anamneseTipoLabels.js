export const TIPO_LABEL_MAP = {
  texto: 'Texto',
  escolha_unica: 'Escolha Única',
  multipla_escolha: 'Múltipla Escolha',
  booleano: 'Sim/Não',
  numero: 'Número',
};

export function tipoLabel(tipo) {
  return TIPO_LABEL_MAP[tipo] || tipo;
}
