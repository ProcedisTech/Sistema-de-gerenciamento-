/**
 * Regressão: resolução do card de KPI ativo a partir dos filtros, e limpeza de todos os filtros.
 * Cobre especificamente o filtro `sem_agendamento_futuro` (card "Sem agendamento futuro").
 */
import { describe, expect, it, vi } from 'vitest';
import {
  resolveActiveKpiCardFromFilters,
  resolveActiveKpiCardAfterToggle,
  clearAllPatientFilters,
  getFilterDefinitionById,
} from './patientListFilters.js';

function baseCtx(overrides = {}) {
  return {
    isSearching: false,
    patientListSortBy: 'nome-asc',
    statusPlanoFilter: '',
    setStatusPlanoFilter: vi.fn(),
    anamneseDesatualizadaFilter: false,
    setAnamneseDesatualizadaFilter: vi.fn(),
    semAgendamentoFuturoFilter: false,
    setSemAgendamentoFuturoFilter: vi.fn(),
    ehNovoFilter: false,
    setEhNovoFilter: vi.fn(),
    ehAniversarianteFilter: false,
    setEhAniversarianteFilter: vi.fn(),
    quickFilter: 'todos',
    setQuickFilter: vi.fn(),
    ...overrides,
  };
}

describe('resolveActiveKpiCardFromFilters', () => {
  it('retorna null quando nenhum filtro está ativo', () => {
    expect(resolveActiveKpiCardFromFilters(baseCtx())).toBeNull();
  });

  it('retorna "risco" quando só semAgendamentoFuturoFilter está ativo', () => {
    const ctx = baseCtx({ semAgendamentoFuturoFilter: true });
    expect(resolveActiveKpiCardFromFilters(ctx)).toBe('risco');
  });

  it('retorna "planos" quando só statusPlanoFilter="plano_ativo" está ativo', () => {
    const ctx = baseCtx({ statusPlanoFilter: 'plano_ativo' });
    expect(resolveActiveKpiCardFromFilters(ctx)).toBe('planos');
  });

  it('retorna null quando semAgendamentoFuturoFilter e statusPlanoFilter="plano_ativo" estão ativos juntos (combinação, sem card único em destaque)', () => {
    const ctx = baseCtx({ semAgendamentoFuturoFilter: true, statusPlanoFilter: 'plano_ativo' });
    expect(resolveActiveKpiCardFromFilters(ctx)).toBeNull();
  });

  it('retorna null quando o filtro ativo não tem kpiCardId (ex.: sem_plano)', () => {
    const ctx = baseCtx({ statusPlanoFilter: 'sem_plano' });
    expect(resolveActiveKpiCardFromFilters(ctx)).toBeNull();
  });
});

describe('resolveActiveKpiCardAfterToggle', () => {
  /**
   * Regressão: desativar um filtro pelo chip/checkbox chama `def.deactivate(ctx)` (agenda um
   * setState assíncrono) e então resolve o card ativo NO MESMO tick. Reler `ctx` nesse ponto
   * ainda reflete o valor antigo — essa função evita isso computando a partir da lista de
   * filtros ativos atual, sem depender do ctx já ter sido atualizado.
   */
  it('retorna null ao desativar o único filtro ativo, mesmo que ctx ainda não reflita a mudança', () => {
    const semAgendamentoFuturoDef = getFilterDefinitionById('sem_agendamento_futuro');
    // ctx "desatualizado": ainda diz semAgendamentoFuturoFilter=true, como aconteceria logo
    // após chamar setSemAgendamentoFuturoFilter(false) mas antes do próximo render.
    const ctxDesatualizado = baseCtx({ semAgendamentoFuturoFilter: true });

    const resultado = resolveActiveKpiCardAfterToggle(ctxDesatualizado, semAgendamentoFuturoDef, false);

    expect(resultado).toBeNull();
  });

  it('retorna "risco" ao ativar o filtro semAgendamentoFuturo a partir de ctx vazio', () => {
    const semAgendamentoFuturoDef = getFilterDefinitionById('sem_agendamento_futuro');
    const ctx = baseCtx();

    const resultado = resolveActiveKpiCardAfterToggle(ctx, semAgendamentoFuturoDef, true);

    expect(resultado).toBe('risco');
  });

  it('retorna null ao ativar um segundo filtro quando já há um ativo (combinação)', () => {
    const novosDef = getFilterDefinitionById('novos');
    const ctxComPlanoAtivo = baseCtx({ statusPlanoFilter: 'plano_ativo' });

    const resultado = resolveActiveKpiCardAfterToggle(ctxComPlanoAtivo, novosDef, true);

    expect(resultado).toBeNull();
  });
});

describe('clearAllPatientFilters', () => {
  it('reseta todos os setters, incluindo setSemAgendamentoFuturoFilter(false)', () => {
    const ctx = baseCtx({ semAgendamentoFuturoFilter: true, statusPlanoFilter: 'plano_ativo' });

    clearAllPatientFilters(ctx);

    expect(ctx.setStatusPlanoFilter).toHaveBeenCalledWith('');
    expect(ctx.setAnamneseDesatualizadaFilter).toHaveBeenCalledWith(false);
    expect(ctx.setSemAgendamentoFuturoFilter).toHaveBeenCalledWith(false);
    expect(ctx.setEhNovoFilter).toHaveBeenCalledWith(false);
    expect(ctx.setEhAniversarianteFilter).toHaveBeenCalledWith(false);
    expect(ctx.setQuickFilter).toHaveBeenCalledWith('todos');
  });
});
