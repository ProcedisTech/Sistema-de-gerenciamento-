import {
  getGrupoDaVista,
  getGrupoLabel,
  getVistaLabel,
  getVistasPorGrupo,
  VISTAS_MAPEAMENTO,
} from './vistasMapeamento.js';

/** Subset MVP — rosto + detalhe (step 4 mapa de aplicação). */
export const VISTAS_MAPA_APLICACAO_CODIGOS = [
  'frontal',
  'perfil_dir',
  'perfil_esq',
  'obliqua_dir',
  'obliqua_esq',
  'superior',
  'inferior',
  'detalhe',
  'labios',
  'periorbital',
  'nariz',
];

const CODIGO_SET = new Set(VISTAS_MAPA_APLICACAO_CODIGOS);

export const VISTAS_MAPA_APLICACAO = VISTAS_MAPEAMENTO.filter((v) => CODIGO_SET.has(v.codigo));

export const VISTA_MAPA_APLICACAO_PADRAO = 'frontal';

export {
  getGrupoDaVista,
  getGrupoLabel,
  getVistaLabel,
  getVistasPorGrupo,
};

export function isVistaMapaAplicacao(codigo) {
  return CODIGO_SET.has(String(codigo || '').trim());
}
