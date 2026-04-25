/**
 * @typedef {{ x: number, y: number }} CanvasPoint2D
 * Espaço de "conteúdo": o mesmo de ctx.translate(offset) + ctx.scale(s) antes de desenhar.
 */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 10;
export const ZOOM_DEFAULT = 1;

/**
 * Converte posição de cliente (viewport) para coordenadas de conteúdo do canvas 2D.
 * Alinhado a: ctx.translate(offsetX,offsetY), ctx.scale(scale,scale).
 * @param {number} clientX
 * @param {number} clientY
 * @param {DOMRect} rect
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} scale
 * @returns {CanvasPoint2D}
 */
export function toCanvasCoords(clientX, clientY, rect, offsetX, offsetY, scale) {
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: (localX - offsetX) / scale,
    y: (localY - offsetY) / scale,
  };
}

/**
 * @param {MouseEvent|PointerEvent|TouchEvent|{ nativeEvent?: unknown }|{ clientX?: number, clientY?: number }} event
 * @param {HTMLCanvasElement} canvasEl
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} scale
 * @returns {CanvasPoint2D | null}
 */
export function toCanvasCoordsFromEvent(event, canvasEl, offsetX, offsetY, scale) {
  const touchE = 'nativeEvent' in event && event.nativeEvent ? event.nativeEvent : event;
  const te = /** @type {MouseEvent|PointerEvent|TouchEvent|{ clientX?: number, clientY?: number }} */ (
    touchE
  );
  const touch = 'touches' in te && te.touches?.[0] ? te.touches[0] : 'changedTouches' in te && te.changedTouches?.[0] ? te.changedTouches[0] : te;
  const clientX = touch && 'clientX' in touch ? touch.clientX : te.clientX;
  const clientY = touch && 'clientY' in touch ? touch.clientY : te.clientY;
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;
  const rect = canvasEl.getBoundingClientRect();
  return toCanvasCoords(clientX, clientY, rect, offsetX, offsetY, scale);
}

/**
 * Conteúdo → coordenada local (px no bitmap do canvas, antes de CSS scaling extra).
 * @param {number} x
 * @param {number} y
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} scale
 * @returns {CanvasPoint2D}
 */
export function contentToLocalScreen(x, y, offsetX, offsetY, scale) {
  return { x: x * scale + offsetX, y: y * scale + offsetY };
}

/**
 * @param {number} s
 * @returns {number}
 */
export function clampCanvasZoom(s) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s));
}
