import { describe, it, expect } from 'vitest';
import { corParaProcedimento, MAPEAMENTO_PALETA_CORES } from './mapeamentoPaletaCores.js';
import fixtures from './paleta-hash-fixtures.json';

describe('mapeamentoPaletaCores - Paridade de Hash', () => {
  it('atribui exatamente as cores das fixtures compartilhadas', () => {
    for (const item of fixtures) {
      const cor = corParaProcedimento(item.uuid);
      expect(cor).toBe(item.corHex);
      const idx = MAPEAMENTO_PALETA_CORES.indexOf(cor);
      expect(idx).toBe(item.indice);
    }
  });

  it('retorna cor válida da paleta para string vazia ou nula', () => {
    expect(MAPEAMENTO_PALETA_CORES).toContain(corParaProcedimento(null));
    expect(MAPEAMENTO_PALETA_CORES).toContain(corParaProcedimento(''));
  });
});
