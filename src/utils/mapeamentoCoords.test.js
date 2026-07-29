/**
 * Regressão: object-contain metrics e % → posição no container (overlay do mapa).
 */
import { describe, expect, it } from 'vitest';
import {
  getObjectContainMetrics,
  percentToContainerPositionFromMetrics,
} from './mapeamentoCoords.js';

function fakeContainer(w, h, left = 0, top = 0) {
  return {
    getBoundingClientRect: () => ({
      width: w,
      height: h,
      left,
      top,
      right: left + w,
      bottom: top + h,
    }),
  };
}

function fakeImg(nw, nh) {
  return { naturalWidth: nw, naturalHeight: nh, width: nw, height: nh };
}

function approx(actual, expected, tol = 0.01) {
  expect(Math.abs(Number(actual) - expected)).toBeLessThanOrEqual(tol);
}

describe('getObjectContainMetrics + percentToContainerPositionFromMetrics', () => {
  it('a) container quadrado + imagem retrato → letterbox lateral; 50,50 no centro', () => {
    const metrics = getObjectContainMetrics(fakeContainer(100, 100), fakeImg(50, 100));
    expect(metrics).not.toBeNull();
    approx(metrics.drawW, 50);
    approx(metrics.drawH, 100);
    approx(metrics.offsetX, 25);
    approx(metrics.offsetY, 0);

    const pos = percentToContainerPositionFromMetrics(50, 50, metrics);
    approx(pos.left, 50);
    approx(pos.top, 50);
  });

  it('b) container quadrado + imagem paisagem → letterbox cima/baixo; 50,50 no centro', () => {
    const metrics = getObjectContainMetrics(fakeContainer(100, 100), fakeImg(100, 50));
    expect(metrics).not.toBeNull();
    approx(metrics.drawW, 100);
    approx(metrics.drawH, 50);
    approx(metrics.offsetX, 0);
    approx(metrics.offsetY, 25);

    const pos = percentToContainerPositionFromMetrics(50, 50, metrics);
    approx(pos.left, 50);
    approx(pos.top, 50);
  });

  it('c) mesma proporção → sem letterbox; preenche o container', () => {
    const metrics = getObjectContainMetrics(fakeContainer(80, 80), fakeImg(80, 80));
    expect(metrics).not.toBeNull();
    approx(metrics.drawW, 80);
    approx(metrics.drawH, 80);
    approx(metrics.offsetX, 0);
    approx(metrics.offsetY, 0);

    const pos = percentToContainerPositionFromMetrics(50, 50, metrics);
    approx(pos.left, 50);
    approx(pos.top, 50);
  });

  it('d) extremos 0,0 e 100,100 caem nas bordas da área da imagem (não do container)', () => {
    const metrics = getObjectContainMetrics(fakeContainer(100, 100), fakeImg(50, 100));
    expect(metrics).not.toBeNull();

    const tl = percentToContainerPositionFromMetrics(0, 0, metrics);
    approx(tl.left, 25);
    approx(tl.top, 0);

    const br = percentToContainerPositionFromMetrics(100, 100, metrics);
    approx(br.left, 75);
    approx(br.top, 100);
  });

  it('e) miniatura ~80px mantém proporção (retrato escalado)', () => {
    const metrics = getObjectContainMetrics(fakeContainer(80, 80), fakeImg(40, 80));
    expect(metrics).not.toBeNull();
    approx(metrics.drawW, 40);
    approx(metrics.drawH, 80);
    approx(metrics.offsetX, 20);
    approx(metrics.offsetY, 0);

    // Centro da imagem = centro do container (igual ao caso a, escalado)
    const centro = percentToContainerPositionFromMetrics(50, 50, metrics);
    approx(centro.left, 50);
    approx(centro.top, 50);

    // Borda esquerda da área da imagem: offsetX=20px → 25% do container 80px
    const tl = percentToContainerPositionFromMetrics(0, 0, metrics);
    approx(tl.left, 25);
    approx(tl.top, 0);
  });
});
