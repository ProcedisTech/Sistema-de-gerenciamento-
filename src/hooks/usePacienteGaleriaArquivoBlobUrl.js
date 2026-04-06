import { useEffect, useRef, useState } from 'react';
import { pacientesGaleriaApi } from '../services/api.js';

/**
 * GET /api/v1/pacientes/{id}/galeria/{fotoId}/arquivo exige X-Org-Id (como a foto de perfil).
 * `url` deve ser o path ou URL já resolvido (ex.: /api/v1/.../arquivo?v=… ou absoluta com VITE_API_BASE_URL).
 */
export function usePacienteGaleriaArquivoBlobUrl(url, enabled) {
  const [blobSrc, setBlobSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    const revoke = () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };

    if (!enabled || !url || typeof url !== 'string') {
      revoke();
      setBlobSrc(null);
      setLoading(false);
      setError(false);
      return undefined;
    }

    setLoading(true);
    setError(false);
    let cancelled = false;
    pacientesGaleriaApi
      .fetchArquivoBlob(url.trim())
      .then((blob) => {
        if (cancelled) return;
        revoke();
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setBlobSrc(objectUrl);
      })
      .catch(() => {
        if (cancelled) return;
        revoke();
        setBlobSrc(null);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      revoke();
    };
  }, [enabled, url]);

  return { src: blobSrc, loading, error };
}
