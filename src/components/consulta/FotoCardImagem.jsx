import React from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { usePacienteGaleriaArquivoBlobUrl } from '../../hooks/usePacienteGaleriaArquivoBlobUrl.js';

/** `blob:`/`data:` já estão na memória da aba; o resto (http/https ou /api) passa pelo fetch autenticado. */
function ehFonteLocal(src) {
  return typeof src === 'string' && (src.startsWith('blob:') || src.startsWith('data:'));
}

/**
 * F5: imagem de UM card de foto. Foto local (blob:/data:) vai direto no <img>. Foto do servidor passa pelo fetch
 * autenticado (usePacienteGaleriaArquivoBlobUrl, forceBlob): nunca uma URL /api/ crua em <img src> (sem X-Org-Id
 * o servidor responde 401 e o card fica quebrado depois do aviso GALERIA, que troca a url).
 * A URL remota é `urlArquivoReserva(photo)` (path /arquivo com `?v=` da versão que a foto conhece) ou `photo.url`.
 * Um componente por foto: o hook fica no topo, sem laço.
 */
export function FotoCardImagem({
  photo,
  urlArquivoReserva = null,
  alt = '',
  className = 'h-full w-full object-cover',
  loading = undefined,
}) {
  const url = typeof photo?.url === 'string' ? photo.url : '';
  const local = ehFonteLocal(url);
  let remota = '';
  if (!local) {
    const reserva = typeof urlArquivoReserva === 'function' && photo ? urlArquivoReserva(photo) : null;
    remota = (typeof reserva === 'string' && reserva.trim()) || url.trim();
  }
  const { src, loading: carregando, error } = usePacienteGaleriaArquivoBlobUrl(remota, Boolean(remota), true);

  if (local) {
    return <img src={url} alt={alt} className={className} loading={loading} />;
  }
  if (error || !remota) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#e2e8f0] text-[#94a3b8]">
        <ImageIcon className="h-8 w-8" strokeWidth={2} aria-label="Imagem indisponível" />
      </div>
    );
  }
  if (carregando || !src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#e6f7f5]">
        <Loader2 className="h-6 w-6 animate-spin text-[#00a88e]" aria-label="Carregando imagem" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading={loading} />;
}
