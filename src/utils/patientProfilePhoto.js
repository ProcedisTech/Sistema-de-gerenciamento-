/**
 * Foto de perfil: `fotoPerfilUrl` pode ser path na API (GET com X-Org-Id) ou URL presigned (R2) —
 * usePatientProfilePhotoSrc trata os dois casos.
 * Fallback: data URL em localStorage quando não há URL do servidor.
 */

const STORAGE_PREFIX = 'procedi_paciente_foto_';

export function profilePhotoStorageKey(patient) {
  if (!patient || typeof patient !== 'object') return null;
  if (patient.id) return `${STORAGE_PREFIX}id_${patient.id}`;
  const cpf = String(patient.cpf || '').replace(/\D/g, '');
  if (cpf) return `${STORAGE_PREFIX}cpf_${cpf}`;
  return null;
}

export function getStoredProfilePhotoDataUrl(key) {
  if (!key) return null;
  try {
    const v = localStorage.getItem(key);
    return v && v.startsWith('data:image/') ? v : null;
  } catch {
    return null;
  }
}

export function setStoredProfilePhotoDataUrl(key, dataUrl) {
  if (!key) return;
  try {
    if (dataUrl) localStorage.setItem(key, dataUrl);
    else localStorage.removeItem(key);
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      throw new Error('Espaço de armazenamento cheio. Tente uma imagem menor ou remova fotos antigas.');
    }
    throw e;
  }
}

/**
 * Atributo crossOrigin para <img src={url}> quando a imagem vem da API com cookie (CORS).
 * @see backend docs — front e API em origens diferentes.
 */
export function authenticatedImageCrossOrigin(url) {
  if (!url || typeof url !== 'string') return undefined;
  const t = url.trim();
  if (t.startsWith('data:') || t.startsWith('blob:')) return undefined;
  if (t.startsWith('http://') || t.startsWith('https://')) return 'use-credentials';
  return undefined;
}

/**
 * URL para exibir: prioriza `fotoPerfilUrl` do servidor (path da API ou presigned R2), depois backup local (data URL).
 * Não use `fotoUrl` direto na UI — o mapa do backend unifica em `fotoPerfilUrl`.
 */
export function getPatientProfilePhotoDisplayUrl(patient) {
  if (!patient) return null;
  const fromState = patient.fotoPerfilUrl;
  if (typeof fromState === 'string' && fromState.trim().length > 0) return fromState.trim();
  const key = profilePhotoStorageKey(patient);
  return getStoredProfilePhotoDataUrl(key);
}

/**
 * Redimensiona e comprime JPEG para caber no localStorage (~centenas de KB).
 * @param {File} file
 * @param {number} maxEdge px no maior lado
 * @param {number} quality 0..1
 */
export async function compressImageFileToJpegDataUrl(file, maxEdge = 480, quality = 0.86) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.');
  }

  const drawToCanvas = (source) => {
    let w = source.width;
    let h = source.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');
    ctx.drawImage(source, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  };

  try {
    const bitmap = await createImageBitmap(file);
    try {
      return drawToCanvas(bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          resolve(drawToCanvas(img));
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(objUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Não foi possível carregar a imagem.'));
      };
      img.src = objUrl;
    });
  }
}
