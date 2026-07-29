/**
 * Contrato de conteúdo para hidratação não-destrutiva do mapa de aplicação.
 * hydrateFromApi no hook só aplica estado quando hasMapaHydrateContent é true.
 */
import { describe, expect, it } from 'vitest';
import { hasMapaHydrateContent } from './procedimentoMapaPayload.js';

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
