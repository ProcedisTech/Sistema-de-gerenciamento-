import React from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { usePacienteGaleriaArquivoBlobUrl } from '../../hooks/usePacienteGaleriaArquivoBlobUrl.js';

/** Miniatura ou preview: imagem da galeria no servidor (fetch autenticado + blob). */
export function GaleriaArquivoImage({ url, alt = '', className = '', imgClassName = 'w-full h-full object-cover' }) {
  const { src, loading, error } = usePacienteGaleriaArquivoBlobUrl(url, true);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-[#e2e8f0] text-[#94a3b8] ${className}`}>
        <ImageIcon className="w-8 h-8" strokeWidth={2} aria-hidden />
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
  return <img src={src} alt={alt} className={imgClassName} />;
}

/** Imagem local (data:/blob:) ou jornada — sem header X-Org-Id. */
export function GaleriaLocalImage({ url, alt = '', imgClassName = 'w-full h-full object-cover' }) {
  if (!url) return null;
  return <img src={url} alt={alt} className={imgClassName} />;
}

/** Modal de preview: mesma autenticação que a miniatura. */
export function GaleriaArquivoLightbox({ url, alt = 'Preview da foto' }) {
  const { src, loading, error } = usePacienteGaleriaArquivoBlobUrl(url, true);
  if (error) {
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
    />
  );
}
