import { describe, it, expect } from 'vitest';
import { chaveFotoLegenda } from './chaveFotoLegenda.js';

describe('chaveFotoLegenda', () => {
  it('fotoId único: usa o fotoId, mesmo que a url mude', () => {
    const lista = [
      { url: 'blob:a?v=1', meta: { fotoId: 'f1' } },
      { url: 'blob:b', meta: { fotoId: 'f2' } },
    ];
    expect(chaveFotoLegenda(lista[0], lista, 0)).toBe('f1');
    expect(chaveFotoLegenda({ url: 'blob:a?v=2', meta: { fotoId: 'f1' } }, [lista[1], { url: 'blob:a?v=2', meta: { fotoId: 'f1' } }], 1)).toBe('f1');
  });

  it('fotoId duplicado: chave composta distinta por foto', () => {
    const lista = [
      { url: 'blob:a', meta: { fotoId: 'dup' } },
      { url: 'blob:b', meta: { fotoId: 'dup' } },
    ];
    const k0 = chaveFotoLegenda(lista[0], lista, 0);
    const k1 = chaveFotoLegenda(lista[1], lista, 1);
    expect(k0).toBe('dup|blob:a|0');
    expect(k1).toBe('dup|blob:b|1');
    expect(k0).not.toBe(k1);
  });

  it('sem fotoId: usa a url', () => {
    const lista = [{ url: 'blob:a' }, { url: 'blob:b', meta: { categoria: 'antes' } }];
    expect(chaveFotoLegenda(lista[0], lista, 0)).toBe('blob:a');
    expect(chaveFotoLegenda(lista[1], lista, 1)).toBe('blob:b');
  });

  it('sem fotoId e url duplicada: acrescenta o índice', () => {
    const lista = [{ url: 'blob:x' }, { url: 'blob:x' }];
    expect(chaveFotoLegenda(lista[0], lista, 0)).toBe('blob:x|0');
    expect(chaveFotoLegenda(lista[1], lista, 1)).toBe('blob:x|1');
  });
});
