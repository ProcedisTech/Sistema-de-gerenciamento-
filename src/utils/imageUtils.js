/**
 * Redimensiona (largura máxima) e exporta WebP quando o browser suporta; senão JPEG.
 * @param {Blob|File} fileOrBlob
 * @param {number} [quality=0.85]
 * @param {number} [maxWidth=1920]
 * @returns {Promise<File>}
 */
export async function convertToWebP(fileOrBlob, quality = 0.85, maxWidth = 1920) {
  const bmp = await createImageBitmap(fileOrBlob);
  try {
    const scale = bmp.width > maxWidth ? maxWidth / bmp.width : 1;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob], 'foto.jpg', { type: 'image/jpeg' });
      return fallback;
    }
    ctx.drawImage(bmp, 0, 0, w, h);

    const tryWebp = () =>
      new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', quality);
      });

    let blob = await tryWebp();
    if (!blob || blob.size === 0) {
      blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
      });
    }
    if (!blob) {
      const fallback = fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob], 'foto.jpg', { type: 'image/jpeg' });
      return fallback;
    }
    const isWebp = blob.type === 'image/webp';
    const name = isWebp ? 'foto-procedimento.webp' : 'foto-procedimento.jpg';
    return new File([blob], name, { type: blob.type || 'image/jpeg' });
  } finally {
    try {
      bmp.close();
    } catch {
      /* ignore */
    }
  }
}
