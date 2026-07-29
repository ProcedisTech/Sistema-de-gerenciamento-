/**

 * Métricas da imagem renderizada com object-contain dentro de um container.

 */

export function getObjectContainMetrics(containerEl, imgEl) {

  if (!containerEl || !imgEl) return null;



  const containerRect = containerEl.getBoundingClientRect();

  const nw = imgEl.naturalWidth || imgEl.width || 0;

  const nh = imgEl.naturalHeight || imgEl.height || 0;

  if (!nw || !nh || !containerRect.width || !containerRect.height) return null;



  const cw = containerRect.width;

  const ch = containerRect.height;

  const scale = Math.min(cw / nw, ch / nh);

  const drawW = nw * scale;

  const drawH = nh * scale;

  const offsetX = (cw - drawW) / 2;

  const offsetY = (ch - drawH) / 2;



  return { cw, ch, drawW, drawH, offsetX, offsetY, containerRect };

}



/**

 * Converte click (client coords) em posição percentual 0–100 sobre a imagem

 * renderizada com object-contain (letterbox).

 */

export function clickToPercent(clientX, clientY, containerEl, imgEl) {

  const m = getObjectContainMetrics(containerEl, imgEl);

  if (!m) return null;



  const { drawW, drawH, offsetX, offsetY, containerRect } = m;

  const localX = clientX - containerRect.left - offsetX;

  const localY = clientY - containerRect.top - offsetY;



  if (localX < 0 || localY < 0 || localX > drawW || localY > drawH) {

    return null;

  }



  const posX = clampRound((localX / drawW) * 100, 0, 100);

  const posY = clampRound((localY / drawH) * 100, 0, 100);

  return { posX, posY };

}



/**

 * Converte posição 0–100 sobre a imagem (mesmo espaço de clickToPercent)

 * em left/top % relativos ao container — para CSS dos marcadores.

 */

export function percentToContainerPositionFromMetrics(posX, posY, metrics) {

  if (!metrics) return null;



  const { cw, ch, drawW, drawH, offsetX, offsetY } = metrics;

  const left = ((offsetX + (Number(posX) / 100) * drawW) / cw) * 100;

  const top = ((offsetY + (Number(posY) / 100) * drawH) / ch) * 100;

  return {

    left: clampRound(left, 0, 100),

    top: clampRound(top, 0, 100),

  };

}



export function percentToContainerPosition(posX, posY, containerEl, imgEl) {

  return percentToContainerPositionFromMetrics(

    posX,

    posY,

    getObjectContainMetrics(containerEl, imgEl),

  );

}



export function resolveCanvasNativeMaxWidthPx(naturalWidth, fillViewport = false) {
  if (fillViewport) return null;
  const nw = Number(naturalWidth);
  if (!Number.isFinite(nw) || nw <= 0) return null;
  return nw;
}

function clampRound(value, min, max) {

  const n = Math.min(max, Math.max(min, Number(value)));

  return Math.round(n * 1000) / 1000;

}


