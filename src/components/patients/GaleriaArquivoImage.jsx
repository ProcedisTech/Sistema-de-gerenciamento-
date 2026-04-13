import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { usePacienteGaleriaArquivoBlobUrl } from '../../hooks/usePacienteGaleriaArquivoBlobUrl.js';

const PLACEHOLDER_AVATAR = '/placeholder-avatar.svg';

/** Miniatura ou preview: imagem da galeria no servidor (fetch autenticado + blob ou URL presigned direta). */
export function GaleriaArquivoImage({ url, alt = '', className = '', imgClassName = 'w-full h-full object-cover' }) {
  const { src, loading, error, isDirect } = usePacienteGaleriaArquivoBlobUrl(url, true);
  const [directBroken, setDirectBroken] = useState(false);

  useEffect(() => {
    setDirectBroken(false);
  }, [url]);

  if (error || (isDirect && directBroken)) {
    return (
      <div className={`flex items-center justify-center bg-[#e2e8f0] text-[#94a3b8] ${className}`}>
        <img src={PLACEHOLDER_AVATAR} alt="" className="w-10 h-10 opacity-80" />
      </div>
    );
  }
  if (loading || !src) {
    return (
      <div className={`flex items-center justify-center bg-[#e6f7f5] ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" aria-label="Carregando imagem" />
      </div>
    );
  }

  if (isDirect) {
    return (
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        onError={(e) => {
          e.currentTarget.onerror = null;
          setDirectBroken(true);
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={imgClassName}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = PLACEHOLDER_AVATAR;
      }}
    />
  );
}

/** Imagem local (data:/blob:) ou jornada — sem header X-Org-Id. */
export function GaleriaLocalImage({ url, alt = '', imgClassName = 'w-full h-full object-cover' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url) return null;
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-[#e2e8f0] ${imgClassName}`}>
        <img src={PLACEHOLDER_AVATAR} alt="" className="w-10 h-10 opacity-80" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={imgClassName}
      onError={(e) => {
        e.currentTarget.onerror = null;
        setFailed(true);
      }}
    />
  );
}

/** Modal de preview: mesma resolução que a miniatura (API blob ou presigned direto). */
export function GaleriaArquivoLightbox({ url, alt = 'Preview da foto' }) {
  const { src, loading, error, isDirect } = usePacienteGaleriaArquivoBlobUrl(url, true);
  const [directBroken, setDirectBroken] = useState(false);

  useEffect(() => {
    setDirectBroken(false);
  }, [url]);

  if (error || (isDirect && directBroken)) {
    return <p className="text-center text-white text-[14px] font-medium px-4">Não foi possível carregar a imagem.</p>;
  }
  if (loading || !src) {
    return <Loader2 className="w-10 h-10 text-white animate-spin" aria-label="Carregando" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="max-w-[90vw] max-h-[85vh] rounded-xl border-[3px] border-white/30 object-contain"
      onError={(e) => {
        if (isDirect) {
          setDirectBroken(true);
          return;
        }
        e.currentTarget.onerror = null;
        e.currentTarget.src = PLACEHOLDER_AVATAR;
      }}
    />
  );
}
