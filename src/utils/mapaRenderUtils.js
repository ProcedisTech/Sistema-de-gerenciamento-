import { corParaProcedimento } from '../constants/mapeamentoPaletaCores.js';
import { normalizeTamanho, markerSizePx } from '../constants/mapeamentoMarcador.js';

/**
 * Carrega o bitmap da imagem e renderiza os pontos/traços por cima em um canvas offscreen,
 * retornando um Blob no formato image/jpeg.
 */
export async function renderMapPhotoWithPoints(imageBlobOrUrl, pontos = [], unidadeMedida = 'un') {
  if (!imageBlobOrUrl) return null;

  let imgElement;
  try {
    imgElement = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      if (imageBlobOrUrl instanceof Blob) {
        img.src = URL.createObjectURL(imageBlobOrUrl);
      } else {
        img.src = imageBlobOrUrl;
      }
    });
  } catch (e) {
    console.warn('[renderMapPhotoWithPoints] Erro ao carregar imagem:', e);
    return imageBlobOrUrl instanceof Blob ? imageBlobOrUrl : null;
  }

  const w = imgElement.naturalWidth || imgElement.width || 800;
  const h = imgElement.naturalHeight || imgElement.height || 800;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 1. Desenha foto de fundo
  ctx.drawImage(imgElement, 0, 0, w, h);

  if (imageBlobOrUrl instanceof Blob && imgElement.src.startsWith('blob:')) {
    URL.revokeObjectURL(imgElement.src);
  }

  if (!Array.isArray(pontos) || pontos.length === 0) {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
  }

  // 2. Desenha traços/linhas
  for (const p of pontos) {
    if (p.tipoGeometria === 'traco' && Array.isArray(p.vertices) && p.vertices.length > 0) {
      const cor = corParaProcedimento(p.catalogoId || p.catalogoProcedimentoSaudeId);
      ctx.beginPath();
      ctx.strokeStyle = cor;
      ctx.lineWidth = Math.max(4, Math.round(w * 0.006));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      p.vertices.forEach((v, i) => {
        const vx = ((v.posX ?? v.x ?? 0) / 100) * w;
        const vy = ((v.posY ?? v.y ?? 0) / 100) * h;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      });
      ctx.stroke();
    }
  }

  // 3. Desenha marcadores de pontos
  for (const p of pontos) {
    let posX = p.posX;
    let posY = p.posY;
    if (p.tipoGeometria === 'traco' && Array.isArray(p.vertices) && p.vertices.length > 0) {
      const lastV = p.vertices[p.vertices.length - 1];
      posX = lastV.posX ?? lastV.x;
      posY = lastV.posY ?? lastV.y;
    }

    if (posX == null || posY == null) continue;

    const cx = (Number(posX) / 100) * w;
    const cy = (Number(posY) / 100) * h;
    const cor = corParaProcedimento(p.catalogoId || p.catalogoProcedimentoSaudeId);
    const tamanhoNorm = normalizeTamanho(p.tamanho || 1.0);
    const radius = Math.max(8, Math.round((markerSizePx(tamanhoNorm) / 2) * (w / 600)));

    // Borda branca
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Círculo colorido
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = cor;
    ctx.fill();

    // Dose
    if (p.quantidade) {
      const fontPx = Math.max(12, Math.round(radius * 1.1));
      ctx.font = `bold ${fontPx}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = cor;
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${p.quantidade}${unidadeMedida || ''}`, cx, cy - radius - 4);
      ctx.shadowBlur = 0;
    }
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
}
