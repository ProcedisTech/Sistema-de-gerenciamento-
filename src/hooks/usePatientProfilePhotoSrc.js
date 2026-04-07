import { useEffect, useRef, useState } from 'react';
import { pacientesApi } from '../services/api.js';
import { getStoredProfilePhotoDataUrl, profilePhotoStorageKey } from '../utils/patientProfilePhoto.js';

/**
 * Resolve a URL exibível da foto de perfil.
 * O GET /api/v1/pacientes/{id}/foto-perfil exige header X-Org-Id; <img src="..."> não envia —
 * o navegador falha (403/401) e mostra o texto do atributo alt. Aqui usamos fetch + blob.
 */
export function usePatientProfilePhotoSrc(patient) {
  const rawFoto = typeof patient?.fotoPerfilUrl === 'string' ? patient.fotoPerfilUrl.trim() : '';
  const id = patient?.id;
  const isDataUrl = rawFoto.startsWith('data:');
  const storageKey = profilePhotoStorageKey(patient);
  const storedFallback = !rawFoto && storageKey ? getStoredProfilePhotoDataUrl(storageKey) : null;

  const needsApiFetch = Boolean(id && rawFoto && !isDataUrl);

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

  const src = isDataUrl ? rawFoto : needsApiFetch ? blobSrc : storedFallback;
  const loadingVisible = Boolean(needsApiFetch && loading && !blobSrc);

  return { src, loading: loadingVisible };
}
