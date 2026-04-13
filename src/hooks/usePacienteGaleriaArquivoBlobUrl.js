import { useEffect, useMemo, useRef, useState } from 'react';
import { shouldAttachApiAuthToFetchUrl } from '../config/apiEnv.js';
import { pacientesGaleriaApi } from '../services/api.js';

/**
 * Resolve URL exibível para arquivo de galeria.
 * - Path / URL na própria API: fetch + blob (jwt/org), como antes.
 * - URL HTTPS em outro host (presigned R2): uso direto em `<img src>` — sem headers que invalidem a assinatura.
 */
export function usePacienteGaleriaArquivoBlobUrl(url, enabled) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  const isDirectPresigned = useMemo(
    () =>
      Boolean(
        enabled &&
          trimmed &&
          /^https?:\/\//i.test(trimmed) &&
          !shouldAttachApiAuthToFetchUrl(trimmed),
      ),
    [enabled, trimmed],
  );

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

    if (!enabled || !trimmed) {
      revoke();
      setBlobSrc(null);
      setLoading(false);
      setError(false);
      return undefined;
    }

    if (isDirectPresigned) {
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
      .fetchArquivoBlob(trimmed)
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
  }, [enabled, trimmed, isDirectPresigned]);

  if (isDirectPresigned) {
    return { src: trimmed, loading: false, error: false, isDirect: true };
  }

  const loadingVisible = Boolean(loading && !blobSrc);
  return { src: blobSrc, loading: loadingVisible, error, isDirect: false };
}
