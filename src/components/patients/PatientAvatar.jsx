import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { shouldAttachApiAuthToFetchUrl } from '../../config/apiEnv.js';
import { usePatientProfilePhotoSrc } from '../../hooks/usePatientProfilePhotoSrc.js';

export function PatientAvatar({
  patient,
  getPatientInitials,
  className = '',
  initialsClassName = 'text-[12px] font-bold',
  spinnerClassName = 'w-5 h-5',
  /** Uma tentativa de renovar URL (ex.: presigned R2 expirado): ex. `pacientesApi.get` + merge no estado. */
  onProfilePhotoImageError,
}) {
  const { src, loading } = usePatientProfilePhotoSrc(patient);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const showImage = Boolean(src && !imageFailed);
  const imgCrossOrigin =
    src &&
    !src.startsWith('data:') &&
    !src.startsWith('blob:') &&
    shouldAttachApiAuthToFetchUrl(src)
      ? 'use-credentials'
      : undefined;

  return (
    <div className={className}>
      {loading && !src ? (
        <Loader2
          className={`${spinnerClassName} animate-spin text-[#00a88e]`}
          strokeWidth={2.5}
          aria-label="Carregando foto"
        />
      ) : showImage ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          crossOrigin={imgCrossOrigin}
          onError={() => {
            setImageFailed(true);
            onProfilePhotoImageError?.();
          }}
        />
      ) : (
        <span className={`w-full h-full flex items-center justify-center bg-[#00a88e] ${initialsClassName}`}>
          {getPatientInitials(patient?.nome)}
        </span>
      )}
    </div>
  );
}
