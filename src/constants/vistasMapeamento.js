/** Vistas seed V69 (tb_angulo_foto) — query param `vista` na API de planejamento. */

export const VISTAS_MAPEAMENTO = [

  { codigo: 'frontal', label: 'Frontal', grupo: 'rosto' },

  { codigo: 'perfil_dir', label: 'Perfil direito', grupo: 'rosto' },

  { codigo: 'perfil_esq', label: 'Perfil esquerdo', grupo: 'rosto' },

  { codigo: 'obliqua_dir', label: 'Oblíqua direita 45°', grupo: 'rosto' },

  { codigo: 'obliqua_esq', label: 'Oblíqua esquerda 45°', grupo: 'rosto' },

  { codigo: 'superior', label: 'Vista superior', grupo: 'rosto' },

  { codigo: 'inferior', label: 'Inferior (submento)', grupo: 'rosto' },

  { codigo: 'reading_view', label: 'Cabeça inclinada (papada)', grupo: 'rosto' },

  { codigo: 'pescoco_frontal', label: 'Pescoço frontal', grupo: 'rosto' },

  { codigo: 'detalhe', label: 'Detalhe da área de aplicação', grupo: 'rosto' },

  { codigo: 'labios', label: 'Lábios', grupo: 'rosto' },

  { codigo: 'periorbital', label: 'Olhos (periorbital)', grupo: 'rosto' },

  { codigo: 'nariz', label: 'Nariz', grupo: 'rosto' },

  { codigo: 'couro_cabeludo', label: 'Couro cabeludo', grupo: 'rosto' },

  { codigo: 'corpo_frontal', label: 'Corpo frontal', grupo: 'corpo' },

  { codigo: 'corpo_posterior', label: 'Corpo posterior', grupo: 'corpo' },

  { codigo: 'corpo_lateral_dir', label: 'Corpo lateral direito', grupo: 'corpo' },

  { codigo: 'corpo_lateral_esq', label: 'Corpo lateral esquerdo', grupo: 'corpo' },

  { codigo: 'abdomen', label: 'Abdômen', grupo: 'corpo' },

  { codigo: 'maos', label: 'Mãos', grupo: 'corpo' },

];



export const VISTA_PADRAO = 'frontal';



const LABEL_BY_CODIGO = Object.fromEntries(VISTAS_MAPEAMENTO.map((v) => [v.codigo, v.label]));

const GRUPO_BY_CODIGO = Object.fromEntries(VISTAS_MAPEAMENTO.map((v) => [v.codigo, v.grupo]));



export function getVistaLabel(codigo) {

  return LABEL_BY_CODIGO[codigo] ?? codigo ?? '—';

}



export function getGrupoDaVista(codigo) {

  return GRUPO_BY_CODIGO[codigo] ?? null;

}



export function getVistasPorGrupo(grupo) {

  const g = String(grupo || '').trim();

  if (!g) return [];

  return VISTAS_MAPEAMENTO.filter((v) => v.grupo === g);

}



export function getGrupoLabel(grupo) {

  if (grupo === 'rosto') return 'Rosto';

  if (grupo === 'corpo') return 'Corpo';

  return grupo ?? '—';

}


