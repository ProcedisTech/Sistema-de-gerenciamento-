const PRESETS_BY_UNIDADE = {
  ui: [0.5, 1, 1.5, 2],
  ml: [0.1, 0.5, 1, 2],
  mg: [0.5, 1, 2],
  un: [1, 2, 3],
};

const PASSO_BY_UNIDADE = {
  ui: 0.5,
  ml: 0.1,
  mg: 0.5,
  un: 1,
};

function normalizeUnidadeKey(unidadeMedida) {
  const u = String(unidadeMedida || 'un')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return u || 'un';
}

export function getPresetsForUnidade(unidadeMedida) {
  const key = normalizeUnidadeKey(unidadeMedida);
  return PRESETS_BY_UNIDADE[key] ?? PRESETS_BY_UNIDADE.un;
}

export function getPassoFallback(unidadeMedida, passoFromApi) {
  const fromApi = Number(passoFromApi);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
  const key = normalizeUnidadeKey(unidadeMedida);
  return PASSO_BY_UNIDADE[key] ?? 1;
}

export function normalizeUnidadeMedida(raw) {
  const s = String(raw ?? 'un').trim();
  return s || 'un';
}

/** Opções exibidas no seletor do mapa de aplicação. */
export const UNIDADES_MEDIDA_OPCOES = [
  { key: 'ui', label: 'UI' },
  { key: 'ml', label: 'ml' },
  { key: 'mg', label: 'mg' },
  { key: 'un', label: 'un' },
];

export function unidadeKeyMatches(unidadeMedida, key) {
  return normalizeUnidadeKey(unidadeMedida) === normalizeUnidadeKey(key);
}
