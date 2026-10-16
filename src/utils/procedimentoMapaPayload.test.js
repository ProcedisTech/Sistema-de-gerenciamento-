/**
 * Contrato de conteúdo para hidratação não-destrutiva do mapa de aplicação.
 * hydrateFromApi no hook só aplica estado quando hasMapaHydrateContent é true.
 */
import { describe, expect, it } from 'vitest';
import { hasMapaHydrateContent, mapLocalPontoToApi } from './procedimentoMapaPayload.js';

describe('mapLocalPontoToApi', () => {
  it('preserva cor e corHex do ponto local', () => {
    const ponto = {
      localId: 'p-1',
      posX: 12.5,
      posY: 34.2,
      procedimentoIndex: 1,
      quantidade: 2,
      tamanho: 1,
      observacoes: 'obs',
      cor: '#64748b',
      corHex: '#64748b',
    };
    const mapped = mapLocalPontoToApi(ponto);
    expect(mapped.cor).toBe('#64748b');
    expect(mapped.corHex).toBe('#64748b');
    expect(mapped.posX).toBe(12.5);
  });
});

describe('hasMapaHydrateContent', () => {
  it('null / undefined / não-objeto → false', () => {
    expect(hasMapaHydrateContent(null)).toBe(false);
    expect(hasMapaHydrateContent(undefined)).toBe(false);
    expect(hasMapaHydrateContent('x')).toBe(false);
  });

  it('objeto vazio ou marcacoes/pontos vazios → false', () => {
    expect(hasMapaHydrateContent({})).toBe(false);
    expect(hasMapaHydrateContent({ marcacoes: [] })).toBe(false);
    expect(hasMapaHydrateContent({ pontos: [] })).toBe(false);
    expect(hasMapaHydrateContent({ fotoGaleriaIdPorVista: {} })).toBe(false);
  });

  it('marcacoes com itens → true', () => {
    expect(
      hasMapaHydrateContent({
        marcacoes: [{ anguloFotoCodigo: 'frontal', quantidade: 1 }],
      }),
    ).toBe(true);
  });

  it('pontos com itens → true', () => {
    expect(
      hasMapaHydrateContent({
        pontos: [{ vista: 'frontal', quantidade: 1 }],
      }),
    ).toBe(true);
  });

  it('fotoGaleriaIdPorVista com chaves → true', () => {
    expect(
      hasMapaHydrateContent({
        fotoGaleriaIdPorVista: { frontal: 'uuid-foto' },
      }),
    ).toBe(true);
  });

  it('fotoGaleriaIdPorAngulo com chaves → true', () => {
    expect(
      hasMapaHydrateContent({
        fotoGaleriaIdPorAngulo: { perfil: 'uuid-foto' },
      }),
    ).toBe(true);
  });
});
