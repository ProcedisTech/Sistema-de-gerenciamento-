import { useCallback, useEffect, useRef, useState } from 'react';
import { pacientesGaleriaApi } from '../services/api.js';

/**
 * GET /api/v1/pacientes/{id}/galeria/{fotoId}/arquivo exige X-Org-Id (como a foto de perfil).
 * `url` deve ser o path ou URL já resolvido (ex.: /api/v1/.../arquivo?v=… ou absoluta com VITE_API_BASE_URL).
 * URLs presigned AWS/R2 (https + query com X-Amz-Signature) normalmente vão direto no <img src>, sem fetch/blob.
 * `forceBlob=true` suprime esse atalho e sempre faz fetch→blob — necessário para canvas (crossOrigin='anonymous')
 * onde o cache HTTP sem CORS causaria falha de taint.
 * `fallbackArquivoUrl`: path/URL do endpoint /arquivo; em onError do <img> (presign expirado) faz UMA retentativa.
 */
export function usePacienteGaleriaArquivoBlobUrl(url, enabled, forceBlob = false, fallbackArquivoUrl = null) {
  const [blobSrc, setBlobSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef(null);
  const retriedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    retriedRef.current = false;
  }, [url, fallbackArquivoUrl]);

  useEffect(() => {
    const revoke = () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };

    cancelledRef.current = false;

    if (!enabled || !url || typeof url !== 'string') {
      revoke();
      setBlobSrc(null);
      setLoading(false);
      setError(false);
      return undefined;
    }

    const trimmed = url.trim();
    const isPresigned =
      typeof url === 'string' && trimmed.startsWith('https://') && trimmed.includes('X-Amz-Signature');

    if (isPresigned && !forceBlob) {
      revoke();
      setBlobSrc(trimmed);
      setLoading(false);
      setError(false);
      return () => {
        cancelledRef.current = true;
        revoke();
      };
    }

    setLoading(true);
    setError(false);
    pacientesGaleriaApi
      .fetchArquivoBlob(trimmed)
      .then((blob) => {
        if (cancelledRef.current) return;
        revoke();
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setBlobSrc(objectUrl);
      })
      .catch(() => {
        if (cancelledRef.current) return;
        revoke();
        setBlobSrc(null);
        setError(true);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });

    return () => {
      cancelledRef.current = true;
      revoke();
    };
  }, [enabled, url, forceBlob]);

  const onImgError = useCallback(() => {
    const fallback =
      typeof fallbackArquivoUrl === 'string' ? fallbackArquivoUrl.trim() : '';
    if (retriedRef.current || !fallback) {
      setError(true);
      return;
    }
    retriedRef.current = true;
    setLoading(true);
    setError(false);
    pacientesGaleriaApi
      .fetchArquivoBlob(fallback)
      .then((blob) => {
        if (cancelledRef.current) return;
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setBlobSrc(objectUrl);
      })
      .catch(() => {
        if (cancelledRef.current) return;
        setBlobSrc(null);
        setError(true);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
  }, [fallbackArquivoUrl]);

  return { src: blobSrc, loading, error, onImgError };
}

/** Path relativo do GET autenticado /arquivo (fallback quando presign falha). */
export function buildGaleriaArquivoFallbackPath(pacienteId, fotoId) {
  const pid = pacienteId != null ? String(pacienteId).trim() : '';
  const fid = fotoId != null ? String(fotoId).trim() : '';
  if (!pid || !fid) return null;
  return `/api/v1/pacientes/${pid}/galeria/${fid}/arquivo`;
}
