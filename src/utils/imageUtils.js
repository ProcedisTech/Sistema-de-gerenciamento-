/**
 * Converte imagem (File) para WebP via canvas (redimensiona pelo maior lado).
 * @param {File} file
 * @param {number} [quality=0.85]
 * @param {number} [maxSide=1920]
 * @returns {Promise<File>}
 */
export async function convertToWebP(file, quality = 0.85, maxSide = 1920) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width > height) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem neste navegador.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao converter para WebP'));
            return;
          }
          const baseName = typeof file.name === 'string' && file.name.trim() ? file.name : 'image';
          const nextName = baseName.replace(/\.[^.]+$/, '.webp');
          resolve(new File([blob], nextName, { type: 'image/webp' }));
        },
        'image/webp',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida'));
    };
    img.src = url;
  });
}
