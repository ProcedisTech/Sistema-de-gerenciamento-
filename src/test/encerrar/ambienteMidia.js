/**
 * Mídia determinística para gravar os roteiros com mapa, assinatura e anotação (Etapa 0).
 * O jsdom não tem layout, não decodifica imagem e não desenha em canvas: aqui ficam as imagens fixas
 * (PNG/JPEG 4×4 válidos, que o backend real consegue converter) e os substitutos de layout e canvas.
 */
import { vi } from 'vitest';

export const PNG_A_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAARSURBVBhXY2BoaPiPgkkXAAAmeB/xMDgJowAAAABJRU5ErkJggg==';
export const PNG_B_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAASSURBVBhXY/hfH/AfGTOQLgAA9acs0UsBIwoAAAAASUVORK5CYII=';
export const JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD80qKKK/qs8Q//2Q==';

/** Assinatura "desenhada": o canvas do jsdom não exporta imagem, então `toDataURL` devolve esta. */
export const ASSINATURA_DATA_URL = `data:image/png;base64,${PNG_A_BASE64}`;

function bytesDe(base64) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function arquivoPng(nome, base64 = PNG_A_BASE64) {
  return new File([bytesDe(base64)], nome, { type: 'image/png' });
}

export function blobJpeg() {
  return new Blob([bytesDe(JPEG_BASE64)], { type: 'image/jpeg' });
}

/** Área de 800×600 em (0,0) para todo elemento e imagem 800×600 já carregada: os cliques do mapa viram %. */
export const AREA = { largura: 800, altura: 600 };

const restauradores = [];

function trocarPropriedade(alvo, nome, descritor) {
  const original = Object.getOwnPropertyDescriptor(alvo, nome);
  Object.defineProperty(alvo, nome, { configurable: true, ...descritor });
  restauradores.push(() => {
    if (original) Object.defineProperty(alvo, nome, original);
    else delete alvo[nome];
  });
}

class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function contextoCanvasFalso() {
  const nada = () => {};
  return {
    setTransform: nada,
    clearRect: nada,
    beginPath: nada,
    moveTo: nada,
    lineTo: nada,
    stroke: nada,
    drawImage: nada,
    fillRect: nada,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    strokeStyle: '#000',
  };
}

export function prepararMidia() {
  const rect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: AREA.largura,
    height: AREA.altura,
    right: AREA.largura,
    bottom: AREA.altura,
    toJSON: () => ({}),
  };
  trocarPropriedade(Element.prototype, 'getBoundingClientRect', { value: () => rect, writable: true });
  trocarPropriedade(HTMLImageElement.prototype, 'naturalWidth', { get: () => AREA.largura });
  trocarPropriedade(HTMLImageElement.prototype, 'naturalHeight', { get: () => AREA.altura });
  trocarPropriedade(HTMLImageElement.prototype, 'complete', { get: () => true });
  trocarPropriedade(HTMLCanvasElement.prototype, 'getContext', { value: () => contextoCanvasFalso(), writable: true });
  trocarPropriedade(HTMLCanvasElement.prototype, 'toDataURL', { value: () => ASSINATURA_DATA_URL, writable: true });
  // Sem exportação de canvas, convertToWebP cai no próprio fallback e envia a imagem original (imageUtils.js:35-37).
  trocarPropriedade(HTMLCanvasElement.prototype, 'toBlob', { value: (cb) => cb(null), writable: true });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 4, height: 4, close: () => {} }));
  vi.stubGlobal('ResizeObserver', ResizeObserverFalso);
}

export function limparMidia() {
  while (restauradores.length) restauradores.pop()();
}
