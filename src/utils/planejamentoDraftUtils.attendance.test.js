import { describe, expect, it } from 'vitest';
import { itemIdByCatalogoFromAttendanceOptions } from './planejamentoDraftUtils.js';

describe('itemIdByCatalogoFromAttendanceOptions', () => {
  it('monta o mapa a partir do slot e do lote, sem adivinhar índice', () => {
    expect(
      itemIdByCatalogoFromAttendanceOptions({
        catalogoProcedimentoSaudeId: 'cat-a',
        planejamentoItemId: 'item-a',
        lote: [
          { catalogoProcedimentoSaudeId: 'cat-a', planejamentoItemId: 'item-a' },
          { catalogoProcedimentoSaudeId: 'cat-b', planejamentoItemId: 'item-b' },
        ],
      })
    ).toEqual({
      'cat-a': 'item-a',
      'cat-b': 'item-b',
    });
  });

  it('ignora entradas sem catálogo ou sem item', () => {
    expect(
      itemIdByCatalogoFromAttendanceOptions({
        catalogoProcedimentoSaudeId: 'cat-a',
        lote: [{ planejamentoItemId: 'item-x' }],
      })
    ).toEqual({});
  });
});
