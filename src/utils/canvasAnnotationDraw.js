/**
 * @param {number} cw
 * @param {number} ch
 * @param {number} iw
 * @param {number} ih
 * @returns {{ drawW: number, drawH: number, dx: number, dy: number }}
 */
export function getLetterboxLayout(cw, ch, iw, ih) {
  if (!iw || !ih) return { drawW: 0, drawH: 0, dx: 0, dy: 0 };
  const s = Math.min(cw / iw, ch / ih);
  const drawW = iw * s;
  const drawH = ih * s;
  const dx = (cw - drawW) / 2;
  const dy = (ch - drawH) / 2;
  return { drawW, drawH, dx, dy };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} img
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} [imgW]
 * @param {number} [imgH]
 */
export function drawLetterboxedImage(ctx, img, viewW, viewH, imgW, imgH) {
  const iw = imgW ?? (img && 'naturalWidth' in img ? img.naturalWidth : 0);
  const ih = imgH ?? (img && 'naturalHeight' in img ? img.naturalHeight : 0);
  const { drawW, drawH, dx, dy } = getLetterboxLayout(viewW, viewH, iw, ih);
  if (drawW > 0 && drawH > 0) ctx.drawImage(img, dx, dy, drawW, drawH);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{
 *   tool: string,
 *   points: Array<{ x: number, y: number }>,
 *   color?: string,
 *   size?: number,
 *   width?: number
 * }>} paths
 * @param {{ showPointNumbers?: boolean, viewScale?: number }} opts
 *   `viewScale`: se definido, espessura e raios são convertidos de px de ecrã para o espaço de conteúdo pós-ctx.scale(viewScale).
 */
export function drawAnnotationPaths(ctx, paths, opts = {}) {
  const { showPointNumbers = false, viewScale: vs = 1 } = opts;
  const invS = vs > 0 ? 1 / vs : 1;
  let number = 1;
  for (const path of paths) {
    ctx.beginPath();
    const baseStroke = path.width != null ? path.width : 3;
    const strokeW = baseStroke * invS;
    ctx.strokeStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
    ctx.fillStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = path.tool === 'erase' ? 'destination-out' : 'source-over';
    if (path.tool === 'point' && path.points?.length > 0) {
      const pt = path.points[0];
      const baseRadius = path.size || 12;
      const radius = baseRadius * invS;
      ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      if (showPointNumbers) {
        ctx.globalCompositeOperation = 'source-over';
        const fontSize = Math.max(12 * invS, Math.min(baseRadius * 1.2, 20) * invS);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (baseRadius >= 12) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = 3 * invS;
          ctx.fillText(String(number), pt.x, pt.y + 1 * invS);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = path.color;
          ctx.shadowColor = 'rgba(255,255,255,0.9)';
          ctx.shadowBlur = 4 * invS;
          ctx.fillText(String(number), pt.x + radius + 10 * invS, pt.y - radius - 5 * invS);
          ctx.shadowBlur = 0;
        }
        number += 1;
      }
    } else if (path.points?.length > 0) {
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i += 1) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
