import { describe, expect, it } from 'vitest';
import { resolveAgendaCreateModalPatch } from './agendaCreateModalOpts.js';
import {
  TIPO_ATENDIMENTO_CONSULTA,
  TIPO_ATENDIMENTO_PROCEDIMENTO,
  TIPO_ATENDIMENTO_RETORNO,
} from './agendaTipoProcedimento.js';

describe('resolveAgendaCreateModalPatch', () => {
  it('semDataInicial deixa data vazia (não hoje)', () => {
    const patch = resolveAgendaCreateModalPatch(
      { tipoAtendimento: TIPO_ATENDIMENTO_CONSULTA, semDataInicial: true },
      { catIds: ['cat-1'], baseData: '2026-08-19' },
    );
    expect(patch.data).toBe('');
    expect(patch.tipoAtendimento).toBe(TIPO_ATENDIMENTO_CONSULTA);
    expect(patch.tipoAtendimentoLocked).toBe(true);
    expect(patch.catalogoProcedimentoSaudeIds).toEqual([]);
    expect(patch.agendamentoTipoRetorno).toBe(false);
  });

  it('modoRetorno não vira CONSULTA', () => {
    const patch = resolveAgendaCreateModalPatch(
      { modoRetorno: true },
      { catIds: [], baseData: '2026-08-19' },
    );
    expect(patch.tipoAtendimento).toBe(TIPO_ATENDIMENTO_RETORNO);
    expect(patch.data).toBe('2026-08-19');
  });

  it('default continua procedimento com data do base', () => {
    const patch = resolveAgendaCreateModalPatch({}, { catIds: ['a'], baseData: '2026-01-01' });
    expect(patch.tipoAtendimento).toBe(TIPO_ATENDIMENTO_PROCEDIMENTO);
    expect(patch.data).toBe('2026-01-01');
    expect(patch.catalogoProcedimentoSaudeIds).toEqual(['a']);
  });
});
