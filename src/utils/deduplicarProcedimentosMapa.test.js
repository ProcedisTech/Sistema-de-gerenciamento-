import { describe, it, expect } from 'vitest';
import {
  chaveReactProcedimento,
  deduplicarProcedimentosPorCatalogo,
  extrairCatalogoIdProcedimento,
} from './deduplicarProcedimentosMapa.js';

describe('deduplicarProcedimentosMapa', () => {
  it('extrai catalogoId normalizado em ordem de precedência', () => {
    expect(extrairCatalogoIdProcedimento(null)).toBeNull();
    expect(extrairCatalogoIdProcedimento({ catalogoProcedimentoSaudeId: '  cat-1  ' })).toBe('cat-1');
    expect(extrairCatalogoIdProcedimento({ nomeProcedimentoCatalogoId: 'cat-2' })).toBe('cat-2');
    expect(extrairCatalogoIdProcedimento({ catalogoId: 'cat-3' })).toBe('cat-3');
  });

  it('unifica duplicados 1:1 pelo mesmo catalogoProcedimentoSaudeId priorizando itemId do servidor e mesclando metadados', () => {
    const catBiopsia = 'ae05fd5a-3362-46ff-9c0f-2846190ccb87';
    const catBotox = '11111111-1111-4111-8111-111111111111';

    const lista = [
      {
        _uid: 'local-1',
        catalogoProcedimentoSaudeId: catBiopsia,
        nomeProcedimento: 'Biópsia',
        planejamentoItemId: 'plan-item-99',
        corHex: '#d946ef',
      },
      {
        itemId: 'srv-1',
        agendaId: 'ag-1',
        catalogoId: catBiopsia,
        nome: 'Procedimento',
      },
      {
        itemId: 'srv-2',
        catalogoProcedimentoSaudeId: catBotox,
        nomeProcedimento: 'Toxina Botulínica',
      },
    ];

    const res = deduplicarProcedimentosPorCatalogo(lista);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      itemId: 'srv-1',
      agendaId: 'ag-1',
      planejamentoItemId: 'plan-item-99',
      corHex: '#d946ef',
      nome: 'Biópsia',
      nomeProcedimento: 'Biópsia',
      index: 0,
      reactKey: catBiopsia,
    });
    expect(res[1]).toMatchObject({
      itemId: 'srv-2',
      index: 1,
      reactKey: catBotox,
    });
  });

  it('garante reactKey e índices sequenciais únicos mesmo para linhas legadas sem catalogoId', () => {
    const lista = [
      { nomeProcedimento: 'Sem catálogo A', itemId: 'i-a' },
      { nomeProcedimento: 'Sem catálogo B', _uid: 'u-b' },
      { nomeProcedimento: 'Sem catálogo C' },
      { nomeProcedimento: 'Sem catálogo D' },
    ];

    const res = deduplicarProcedimentosPorCatalogo(lista);
    expect(res).toHaveLength(4);
    expect(res.map((p) => p.index)).toEqual([0, 1, 2, 3]);
    const keys = res.map((p, idx) => chaveReactProcedimento(p, idx));
    expect(new Set(keys).size).toBe(4);
  });
});

