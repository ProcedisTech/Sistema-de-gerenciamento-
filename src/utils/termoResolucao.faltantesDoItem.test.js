/** F3: faltantes por item = resolução do catálogo do item menos os termos assinados na consulta. */
import { describe, expect, it } from 'vitest';
import { faltantesDoItem } from './termoResolucao.js';

const T1 = { termoId: 't-1', titulo: 'Termo 1' };
const T2 = { termoId: 't-2', titulo: 'Termo 2' };
const resolucao = { faltantes: [T1, T2], termosExigidos: [T1, T2] };

describe('faltantesDoItem', () => {
  it('faltante some quando o termo está ASSINADO nos termos da consulta', () => {
    const termos = [{ termoId: 't-1', statusAssinatura: 'ASSINADO' }];
    expect(faltantesDoItem(resolucao, termos)).toEqual([T2]);
  });

  it('termo da consulta ainda não assinado (nulo, RECUSADO) não tira o faltante', () => {
    const termos = [
      { termoId: 't-1', statusAssinatura: null },
      { termoId: 't-2', statusAssinatura: 'RECUSADO' },
    ];
    expect(faltantesDoItem(resolucao, termos)).toEqual([T1, T2]);
  });

  it('sem a resolução do item (rede falhou): não bloqueia', () => {
    expect(faltantesDoItem(null, [{ termoId: 't-1', statusAssinatura: 'ASSINADO' }])).toEqual([]);
    expect(faltantesDoItem(undefined, [])).toEqual([]);
    expect(faltantesDoItem({}, [])).toEqual([]);
  });

  it('sem termos da consulta ([] sem HUB_TERMOS_VER ou não-lista): vale a resolução do servidor (piso)', () => {
    expect(faltantesDoItem(resolucao, [])).toEqual([T1, T2]);
    expect(faltantesDoItem(resolucao, null)).toEqual([T1, T2]);
  });

  it('compara o termoId como texto e não altera a resolução original', () => {
    const r = { faltantes: [{ termoId: 7 }] };
    expect(faltantesDoItem(r, [{ termoId: '7', statusAssinatura: 'ASSINADO' }])).toEqual([]);
    expect(r.faltantes).toHaveLength(1);
  });
});
