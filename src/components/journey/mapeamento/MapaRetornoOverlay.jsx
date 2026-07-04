import React, { useEffect, useState } from 'react';
import { mapasApi } from '../../../services/api.js';
import { percentToContainerPositionFromMetrics } from '../../../utils/mapeamentoCoords.js';
import { markerSizePx, MARKER_HIT_AREA_PX } from '../../../constants/mapeamentoMarcador.js';

export function MapaRetornoOverlay({ mapaComparacao, layoutMetrics }) {
  const [mapaCompleto, setMapaCompleto] = useState(null);

  useEffect(() => {
    if (!mapaComparacao?.id) return;
    
    // Supondo que a API buscarPorProcedimento aceite buscar qualquer mapa por id ou procedimentoFeitoId.
    // O backend tem buscarPorProcedimento(id). No Spring eu criei GET /api/v1/mapas?procedimentoFeitoId=... 
    // Vamos assumir que a gente tenha os dados completos se a gente já tiver o procedimentoFeitoId. 
    // Wait, o MapaHistoricoItemDTO devolve só o mapaId, mas não temos o endpoint GET /mapas/{id}.
    // Vou adicionar GET /api/v1/mapas/{id} rapidamente no MapaController / MapaService se precisar, ou buscar pelo procedimentoFeitoId.
    // Para simplificar, vou assumir que há um GET /api/v1/mapas/{mapaId}
    
    // Por enquanto, como o plano não exigiu um GET /{id}, se não houver marcacoes no mapaComparacao, eu chamo a api.
    let cancelled = false;
    if (!mapaComparacao.marcacoes) {
      mapasApi.buscarPorId(mapaComparacao.mapaId || mapaComparacao.id)
        .then(res => {
          if (!cancelled) setMapaCompleto(res);
        })
        .catch(err => console.error("Falha ao buscar mapa completo", err));
    } else {
      setTimeout(() => {
        if (!cancelled) setMapaCompleto(mapaComparacao);
      }, 0);
    }
    
    return () => { cancelled = true; };
  }, [mapaComparacao]);

  if (!mapaCompleto || !mapaCompleto.marcacoes) return null;

  const marcacoes = mapaCompleto.marcacoes || [];

  return (
    <div className="absolute inset-0 h-full w-full pointer-events-none z-[15]">
      <svg className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
        {marcacoes.filter(m => m.tipoGeometria === 'traco' && m.vertices?.length > 0).map(m => {
          const resolvePos = (x, y) => {
            const pos = percentToContainerPositionFromMetrics(x, y, layoutMetrics);
            return pos ? { x: pos.left, y: pos.top } : { x, y };
          };
          const points = m.vertices.map(v => resolvePos(v.posX, v.posY));
          return (
            <polyline
              key={m.id}
              points={points.map(pt => `${pt.x}%,${pt.y}%`).join(' ')}
              fill="none"
              stroke="#94a3b8" // Cinza (Overlay)
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 4"
            />
          );
        })}
      </svg>
      {marcacoes.filter(m => m.tipoGeometria === 'ponto' && m.vertices?.length > 0).map((m) => {
        const v = m.vertices[0];
        const containerPos = percentToContainerPositionFromMetrics(v.posX, v.posY, layoutMetrics) || { left: v.posX, top: v.posY };
        const sizePx = markerSizePx(m.tamanho || 1.0);
        return (
          <div
            key={m.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 opacity-60"
            style={{
              left: `${containerPos.left}%`,
              top: `${containerPos.top}%`,
            }}
          >
            <div className="relative" style={{ width: sizePx, height: sizePx }}>
              <span
                className="block rounded-full border-2 shadow-sm border-white"
                style={{
                  width: sizePx,
                  height: sizePx,
                  backgroundColor: '#94a3b8',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
