import { useEffect, useRef, useState } from 'react';
import { shouldAttachApiAuthToFetchUrl } from '../config/apiEnv.js';
import { pacientesApi } from '../services/api.js';

/**
 * Resolve a URL exibível da foto de perfil.
 * - Path ou URL na própria API: fetch + blob (jwt/org no GET).
 * - URL presigned em outro host (R2): <img src> direto — sem headers que invalidem a assinatura.
 * - fetchPhotoById: busca GET /foto-perfil só com id (ex.: listagem de agenda sem URL no DTO).
 */
export function usePatientProfilePhotoSrc(patient, { fetchPhotoById = false } = {}) {
  const rawFoto = typeof patient?.fotoPerfilUrl === 'string' ? patient.fotoPerfilUrl.trim() : '';
  const id = patient?.id;
  const isVolatilePreviewUrl = rawFoto.startsWith('data:') || rawFoto.startsWith('blob:');

  const isHttp = rawFoto.startsWith('http://') || rawFoto.startsWith('https://');
  const useDirectPresignedUrl = Boolean(isHttp && !shouldAttachApiAuthToFetchUrl(rawFoto));

  const needsApiFetch = Boolean(
    id &&
      !isVolatilePreviewUrl &&
      !useDirectPresignedUrl &&
      (rawFoto || fetchPhotoById),
  );

  const [blobSrc, setBlobSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    const revoke = () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };

    if (!needsApiFetch) {
      revoke();
      setBlobSrc(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let cancelled = false;
    pacientesApi
      .getFotoPerfilBlob(id, rawFoto)
      .then((blob) => {
        if (cancelled) return;
        revoke();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobSrc(url);
      })
      .catch(() => {
        if (cancelled) return;
        revoke();
        setBlobSrc(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      revoke();
    };
  }, [needsApiFetch, id, rawFoto]);

  const src = isVolatilePreviewUrl
    ? rawFoto
    : useDirectPresignedUrl
      ? rawFoto
      : needsApiFetch
        ? blobSrc
        : null;
  const loadingVisible = Boolean(needsApiFetch && loading && !blobSrc);

  return { src, loading: loadingVisible };
}
