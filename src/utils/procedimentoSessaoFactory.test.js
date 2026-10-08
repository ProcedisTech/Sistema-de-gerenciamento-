import { describe, it, expect } from 'vitest';
import { criarItemProcedimentoSessao, criarLoteProcedimentosSessao } from './procedimentoSessaoFactory';

describe('procedimentoSessaoFactory', () => {
  const CAT_BIOPSIA_ID = 'ae05fd5a-3362-46ff-9c0f-2846190ccb87';
  const CAT_DRENAGEM_ID = '34c86deb-f026-426c-8eef-20a8674f514a';

  it('criarItemProcedimentoSessao gera item com cor resolvida e impede que extraProps com corHex undefined apague a cor', () => {
    const item = criarItemProcedimentoSessao({
      catalogoId: CAT_BIOPSIA_ID,
      nome: 'Biópsia de Pele',
      extraProps: {
        customCampo: 123,
        corHex: undefined
      }
    });

    expect(item.catalogoId).toBe(CAT_BIOPSIA_ID);
    expect(item.nome).toBe('Biópsia de Pele');
    expect(item.corHex).toBe('#d946ef');
    expect(item.customCampo).toBe(123);
    expect(item.id).toBeNull();
    expect(item._uid).toBeTruthy();
  });

  it('criarLoteProcedimentosSessao resolve lote preservando dados e evitando colisão de cores', () => {
    const rawItems = [
      {
        id: 'proc-1-existente',
        catalogoProcedimentoSaudeId: CAT_BIOPSIA_ID,
        nome: 'Biópsia',
        procedimentoFeitoId: 'pf-100',
        agendaId: 'agenda-200'
      },
      {
        id: 'proc-2-existente',
        catalogoId: CAT_DRENAGEM_ID,
        nome: 'Drenagem',
        procedimentoFeitoId: 'pf-101'
      }
    ];

    const lote = criarLoteProcedimentosSessao(rawItems);

    expect(lote).toHaveLength(2);

    expect(lote[0].id).toBe('proc-1-existente');
    expect(lote[0].catalogoId).toBe(CAT_BIOPSIA_ID);
    expect(lote[0].catalogoProcedimentoSaudeId).toBe(CAT_BIOPSIA_ID);
    expect(lote[0].procedimentoFeitoId).toBe('pf-100');
    expect(lote[0].agendaId).toBe('agenda-200');
    expect(lote[0].corHex).toBe('#d946ef');

    expect(lote[1].id).toBe('proc-2-existente');
    expect(lote[1].catalogoId).toBe(CAT_DRENAGEM_ID);
    expect(lote[1].procedimentoFeitoId).toBe('pf-101');
    expect(lote[1].corHex).toBe('#64748b');
  });
});
