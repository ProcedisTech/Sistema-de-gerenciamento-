import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { usePacienteGaleriaArquivoBlobUrl } from '../../../hooks/usePacienteGaleriaArquivoBlobUrl.js';
import { ProtectedPatientMedia } from '../../ui/ProtectedPatientMedia.jsx';
import { getObjectContainMetrics } from '../../../utils/mapeamentoCoords.js';
import { MapaMarcacoesOverlay } from '../../journey/mapeamento/MapaMarcacoesOverlay.jsx';
import { marcacoesApiToOverlayPontos } from '../../journey/mapeamento/mapaMarcacoesOverlayUtils.js';

const METRIC_KEYS = ['cw', 'ch', 'drawW', 'drawH', 'offsetX', 'offsetY'];
const METRIC_TOLERANCE = 0.5;

function metricsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return METRIC_KEYS.every((k) => Math.abs(Number(a[k]) - Number(b[k])) <= METRIC_TOLERANCE);
}

/**
 * Miniatura da galeria com foto limpa (object-contain) + overlay de marcações do mapa.
 * density=thumb oculta doses; density=full para lightbox/zoom.
 */
export function GaleriaMapaThumb({
  url,
  mapaOverlay = null,
  alt = '',
  className = '',
  density = 'thumb',
  imgClassName = 'h-full w-full object-contain',
}) {
  const { src, loading, error } = usePacienteGaleriaArquivoBlobUrl(url, true);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [layoutMetrics, setLayoutMetrics] = useState(null);

  const syncMetrics = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img?.naturalWidth) return;
    const full = getObjectContainMetrics(container, img);
    if (!full) return;
    const next = {
      cw: full.cw,
      ch: full.ch,
      drawW: full.drawW,
      drawH: full.drawH,
      offsetX: full.offsetX,
      offsetY: full.offsetY,
    };
    setLayoutMetrics((prev) => (metricsEqual(prev, next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    syncMetrics();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncMetrics());
    ro.observe(el);
    return () => ro.disconnect();
  }, [src, syncMetrics]);

  const pontos = marcacoesApiToOverlayPontos(mapaOverlay?.marcacoes);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-[#e2e8f0] text-[#94a3b8] ${className}`}>
        <ImageIcon className="h-8 w-8" strokeWidth={2} aria-hidden />
      </div>
    );
  }
  if (loading || !src) {
    return (
      <div className={`flex items-center justify-center bg-[#e6f7f5] ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-[#00a88e]" aria-label="Carregando imagem" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-[#0f172a]/5 ${className}`}>
      <ProtectedPatientMedia
        ref={imgRef}
        src={src}
        alt={alt}
        className="absolute inset-0 z-0 h-full w-full"
        imgClassName={imgClassName}
        onLoad={syncMetrics}
      />
      {pontos.length > 0 ? (
        <MapaMarcacoesOverlay
          pontos={pontos}
          layoutMetrics={layoutMetrics}
          density={density}
          mostrarValores={density === 'full'}
          interactive={false}
        />
      ) : null}
    </div>
  );
}
