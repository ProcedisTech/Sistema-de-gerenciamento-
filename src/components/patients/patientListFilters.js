/** Filtro rápido client-side da lista (ex.: menores de idade). */
export function applyPatientQuickFilter(items, filter) {
  if (filter === 'menor') return items.filter((p) => p.menorDeIdade === true);
  return items;
}

export const PATIENT_FILTER_SECTIONS = [
  { id: 'plano', label: 'Plano' },
  { id: 'status', label: 'Status clínico' },
  { id: 'segmento', label: 'Segmento' },
];

/**
 * @typedef {Object} PatientFilterContext
 * @property {boolean} isSearching
 * @property {string} patientListSortBy
 * @property {string} statusPlanoFilter
 * @property {(v: string | ((prev: string) => string)) => void} [setStatusPlanoFilter]
 * @property {boolean} anamneseDesatualizadaFilter
 * @property {(v: boolean | ((prev: boolean) => boolean)) => void} [setAnamneseDesatualizadaFilter]
 * @property {boolean} semRetornoFilter
 * @property {(v: boolean | ((prev: boolean) => boolean)) => void} [setSemRetornoFilter]
 * @property {boolean} semAgendamentoFuturoFilter
 * @property {(v: boolean | ((prev: boolean) => boolean)) => void} [setSemAgendamentoFuturoFilter]
 * @property {boolean} ehNovoFilter
 * @property {(v: boolean | ((prev: boolean) => boolean)) => void} [setEhNovoFilter]
 * @property {boolean} ehAniversarianteFilter
 * @property {(v: boolean | ((prev: boolean) => boolean)) => void} [setEhAniversarianteFilter]
 * @property {string} quickFilter
 * @property {(v: string | ((prev: string) => string)) => void} [setQuickFilter]
 */

function isBirthdaySort(ctx) {
  return ctx.patientListSortBy === 'birthday-asc';
}

export const PATIENT_FILTER_DEFINITIONS = [
  {
    id: 'sem_plano',
    label: 'Sem plano',
    section: 'plano',
    scope: 'server',
    kpiCardId: null,
    isActive: (ctx) => ctx.statusPlanoFilter === 'sem_plano',
    activate: (ctx) => ctx.setStatusPlanoFilter?.('sem_plano'),
    deactivate: (ctx) => ctx.setStatusPlanoFilter?.(''),
    disabled: (ctx) => ctx.isSearching || !ctx.setStatusPlanoFilter,
  },
  {
    id: 'plano_ativo',
    label: 'Com plano ativo',
    section: 'plano',
    scope: 'server',
    kpiCardId: 'planos',
    isActive: (ctx) => ctx.statusPlanoFilter === 'plano_ativo',
    activate: (ctx) => ctx.setStatusPlanoFilter?.('plano_ativo'),
    deactivate: (ctx) => ctx.setStatusPlanoFilter?.(''),
    disabled: (ctx) => ctx.isSearching || !ctx.setStatusPlanoFilter,
  },
  {
    id: 'anamnese_vencida',
    label: 'Anamnese vencida',
    section: 'status',
    scope: 'server',
    kpiCardId: null,
    isActive: (ctx) => Boolean(ctx.anamneseDesatualizadaFilter),
    activate: (ctx) => ctx.setAnamneseDesatualizadaFilter?.(true),
    deactivate: (ctx) => ctx.setAnamneseDesatualizadaFilter?.(false),
    disabled: (ctx) => ctx.isSearching || !ctx.setAnamneseDesatualizadaFilter,
  },
  {
    id: 'sem_agendamento_futuro',
    label: 'Sem agendamento futuro',
    section: 'status',
    scope: 'server',
    kpiCardId: 'risco',
    isActive: (ctx) => Boolean(ctx.semAgendamentoFuturoFilter),
    activate: (ctx) => ctx.setSemAgendamentoFuturoFilter?.(true),
    deactivate: (ctx) => ctx.setSemAgendamentoFuturoFilter?.(false),
    disabled: (ctx) =>
      ctx.isSearching || isBirthdaySort(ctx) || !ctx.setSemAgendamentoFuturoFilter,
    disabledTitle: (ctx) =>
      isBirthdaySort(ctx) ? 'Indisponível com ordenação por aniversário' : undefined,
  },
  {
    id: 'menor_idade',
    label: 'Menor de idade',
    section: 'status',
    scope: 'client',
    kpiCardId: null,
    isActive: (ctx) => ctx.quickFilter === 'menor',
    activate: (ctx) => ctx.setQuickFilter?.('menor'),
    deactivate: (ctx) => ctx.setQuickFilter?.('todos'),
    disabled: (ctx) => !ctx.setQuickFilter,
  },
  {
    id: 'novos',
    label: 'Novos',
    section: 'segmento',
    scope: 'server',
    kpiCardId: 'novos',
    isActive: (ctx) => Boolean(ctx.ehNovoFilter),
    activate: (ctx) => ctx.setEhNovoFilter?.(true),
    deactivate: (ctx) => ctx.setEhNovoFilter?.(false),
    disabled: (ctx) => ctx.isSearching || !ctx.setEhNovoFilter,
  },
  {
    id: 'aniversariantes_mes',
    label: 'Aniversariantes (mês)',
    section: 'segmento',
    scope: 'server',
    kpiCardId: 'aniversariantes',
    isActive: (ctx) => Boolean(ctx.ehAniversarianteFilter),
    activate: (ctx) => ctx.setEhAniversarianteFilter?.(true),
    deactivate: (ctx) => ctx.setEhAniversarianteFilter?.(false),
    disabled: (ctx) => ctx.isSearching || !ctx.setEhAniversarianteFilter,
  },
];

const KPI_TO_FILTER_ID = {
  risco: 'sem_agendamento_futuro',
  planos: 'plano_ativo',
  novos: 'novos',
  aniversariantes: 'aniversariantes_mes',
};

export function getFilterDefinitionById(id) {
  return PATIENT_FILTER_DEFINITIONS.find((d) => d.id === id);
}

export function getFiltersForSection(sectionId) {
  return PATIENT_FILTER_DEFINITIONS.filter((d) => d.section === sectionId);
}

export function countActivePatientFilters(ctx) {
  return PATIENT_FILTER_DEFINITIONS.filter((d) => d.isActive(ctx)).length;
}

export function getActivePatientFilters(ctx) {
  return PATIENT_FILTER_DEFINITIONS.filter((d) => d.isActive(ctx));
}

export function clearAllPatientFilters(ctx) {
  ctx.setStatusPlanoFilter?.('');
  ctx.setAnamneseDesatualizadaFilter?.(false);
  ctx.setSemAgendamentoFuturoFilter?.(false);
  ctx.setEhNovoFilter?.(false);
  ctx.setEhAniversarianteFilter?.(false);
  ctx.setQuickFilter?.('todos');
}

/**
 * Resolve qual card de KPI deveria ficar em destaque LOGO APÓS ativar/desativar `toggledDef`,
 * sem depender do state React já ter sido re-renderizado — `def.activate/deactivate(ctx)` só
 * agenda a atualização (assíncrona), então ler `ctx` de novo no mesmo tick ainda reflete o valor
 * ANTIGO. Em vez de reler `ctx`, aplica a mudança sobre a lista de filtros ativos atual.
 * @returns {null | 'risco' | 'planos' | 'novos' | 'aniversariantes'}
 */
export function resolveActiveKpiCardAfterToggle(ctx, toggledDef, willBeActive) {
  const others = getActivePatientFilters(ctx).filter((d) => d.id !== toggledDef.id);
  const next = willBeActive ? [...others, toggledDef] : others;
  if (next.length === 1 && next[0].kpiCardId) return next[0].kpiCardId;
  return null;
}

/**
 * @returns {null | 'risco' | 'planos' | 'novos' | 'aniversariantes'}
 */
export function resolveActiveKpiCardFromFilters(ctx) {
  const active = getActivePatientFilters(ctx);
  if (active.length === 0) return null;
  if (active.length === 1 && active[0].kpiCardId) return active[0].kpiCardId;
  return null;
}

export function activateFilterByKpiCardId(ctx, cardId) {
  clearAllPatientFilters(ctx);
  if (cardId === 'ativos') return;
  const filterId = KPI_TO_FILTER_ID[cardId];
  if (!filterId) return;
  const def = getFilterDefinitionById(filterId);
  def?.activate(ctx);
}

export function deactivateFilterByKpiCardId(ctx, cardId) {
  const filterId = KPI_TO_FILTER_ID[cardId];
  if (!filterId) return;
  const def = getFilterDefinitionById(filterId);
  def?.deactivate(ctx);
}

/** Compat: monta ctx a partir do shape legado de filterChipProps. */
export function buildPatientFilterContext(props) {
  return {
    isSearching: Boolean(props.isSearching),
    patientListSortBy:
      props.patientListSortBy ?? (props.isBirthdaySort ? 'birthday-asc' : 'nome-asc'),
    statusPlanoFilter: props.statusPlanoFilter ?? '',
    setStatusPlanoFilter: props.setStatusPlanoFilter,
    anamneseDesatualizadaFilter: props.anamneseDesatualizadaFilter ?? false,
    setAnamneseDesatualizadaFilter: props.setAnamneseDesatualizadaFilter,
    semRetornoFilter: props.semRetornoFilter ?? false,
    setSemRetornoFilter: props.setSemRetornoFilter,
    semAgendamentoFuturoFilter: props.semAgendamentoFuturoFilter ?? false,
    setSemAgendamentoFuturoFilter: props.setSemAgendamentoFuturoFilter,
    ehNovoFilter: props.ehNovoFilter ?? false,
    setEhNovoFilter: props.setEhNovoFilter,
    ehAniversarianteFilter: props.ehAniversarianteFilter ?? false,
    setEhAniversarianteFilter: props.setEhAniversarianteFilter,
    quickFilter: props.quickFilter ?? 'todos',
    setQuickFilter: props.setQuickFilter,
  };
}
