export const TIPO_LABEL_MAP = {
  texto: 'Texto',
  escolha_unica: 'Escolha Única',
  multipla_escolha: 'Múltipla Escolha',
  booleano: 'Sim/Não',
  numero: 'Número',
  sim_nao_naosei: 'Sim / Não / Não sei',
  catalogo_alergia: 'Catálogo — alergia',
  catalogo_principio_ativo: 'Catálogo — princípio ativo',
  catalogo_medicamento: 'Catálogo — medicamento',
  catalogo_antecedente: 'Catálogo — antecedente',
};

export function tipoLabel(tipo) {
  return TIPO_LABEL_MAP[tipo] || tipo;
}

export const TIPOS_CATALOGO = [
  'catalogo_alergia',
  'catalogo_principio_ativo',
  'catalogo_medicamento',
  'catalogo_antecedente',
];

export function isTipoCatalogo(tipo) {
  return TIPOS_CATALOGO.includes(tipo);
}

/** Canal `{ tipo }` do Map público / XOR da linha. */
export function canalCatalogoPublico(tipoResposta) {
  if (tipoResposta === 'catalogo_alergia') return 'alergia';
  if (tipoResposta === 'catalogo_principio_ativo') return 'principio_ativo';
  if (tipoResposta === 'catalogo_medicamento') return 'medicamento';
  if (tipoResposta === 'catalogo_antecedente') return 'antecedente';
  return null;
}
