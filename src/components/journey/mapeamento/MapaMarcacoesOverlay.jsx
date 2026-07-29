import React from 'react';
import { percentToContainerPositionFromMetrics } from '../../../utils/mapeamentoCoords.js';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import {
  formatQuantidadeEtiqueta,
  markerSizePx,
  normalizeTamanho,
} from '../../../constants/mapeamentoMarcador.js';

const DENSITY = {
  full: { scale: 1, stroke: 4, strokeSelected: 6, showDoses: true },
  thumb: { scale: 0.4, stroke: 2, strokeSelected: 2, showDoses: false },
};

/**
 * Overlay de marcações salvas (traços SVG + pontos DOM).
 * Usado pelo canvas do mapa e pelas miniaturas da galeria — um único caminho visual.
 *
 * @param {'full'|'thumb'} density
 * @param {Array} pontos — lista plana com tipoGeometria, vertices/posX/posY, quantidade, tamanho, catalogoId, localId
 */
export function MapaMarcacoesOverlay({
  pontos = [],
  layoutMetrics,
  density = 'full',
  mostrarValores = true,
  unidadeMedida = 'u',
  interactive = false,
  selectedLocalId = null,
  onMarkerPointerDown,
}) {
  const cfg = DENSITY[density] || DENSITY.full;
  const showDoses = cfg.showDoses && mostrarValores;
  const list = Array.isArray(pontos) ? pontos : [];

  const resolveContainerPos = (posX, posY) => {
    const pos = percentToContainerPositionFromMetrics(posX, posY, layoutMetrics);
    if (pos) return pos;
    return { left: posX, top: posY };
  };

  const resolvePos = (x, y) => {
    const pos = percentToContainerPositionFromMetrics(x, y, layoutMetrics);
    return pos ? { x: pos.left, y: pos.top } : { x, y };
  };

  return (
    <>
      <svg
        className="absolute inset-0 z-[10] h-full w-full"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {list
          .filter((p) => p.tipoGeometria === 'traco' && p.vertices?.length > 0)
          .map((p) => {
            const cor = corParaProcedimento(p.catalogoId);
            const selected = selectedLocalId != null && selectedLocalId === p.localId;
            const points = p.vertices.map((v) =>
              resolvePos(v.posX ?? v.x, v.posY ?? v.y),
            );
            return points.map((pt, i) => {
              if (i === 0) return null;
              const prev = points[i - 1];
              return (
                <line
                  key={`${p.localId || p.id}-segment-${i}`}
                  x1={`${prev.x}%`}
                  y1={`${prev.y}%`}
                  x2={`${pt.x}%`}
                  y2={`${pt.y}%`}
                  stroke={cor}
                  strokeWidth={String(selected ? cfg.strokeSelected : cfg.stroke)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={
                    interactive
                      ? { pointerEvents: 'stroke', cursor: 'pointer' }
                      : undefined
                  }
                  onPointerDown={
                    interactive && onMarkerPointerDown
                      ? (ev) => onMarkerPointerDown(ev, p)
                      : undefined
                  }
                />
              );
            });
          })}
      </svg>

      {list.map((p) => {
        const cor = corParaProcedimento(p.catalogoId);
        const selected = selectedLocalId != null && selectedLocalId === p.localId;

        let containerPos;
        if (p.tipoGeometria === 'traco' && p.vertices?.length > 0) {
          const lastV = p.vertices[p.vertices.length - 1];
          containerPos = resolveContainerPos(lastV.posX ?? lastV.x, lastV.posY ?? lastV.y);
        } else if (p.vertices?.length > 0 && (p.posX == null || p.posY == null)) {
          const v0 = p.vertices[0];
          containerPos = resolveContainerPos(v0.posX ?? v0.x, v0.posY ?? v0.y);
        } else {
          containerPos = resolveContainerPos(p.posX, p.posY);
        }

        if (!containerPos || containerPos.left == null || containerPos.top == null) return null;

        const tamanho = normalizeTamanho(p.tamanho);
        const sizePx = Math.max(4, Math.round(markerSizePx(tamanho) * cfg.scale));
        const key = p.localId || p.id;

        return (
          <div
            key={key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${
              selected ? 'z-[30]' : 'z-[10]'
            }`}
            style={{
              left: `${containerPos.left}%`,
              top: `${containerPos.top}%`,
            }}
          >
            <div className="relative" style={{ width: sizePx, height: sizePx }}>
              {showDoses ? (
                <span
                  className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[14px] font-medium leading-none text-white shadow-sm"
                  style={{ backgroundColor: cor }}
                  aria-hidden
                >
                  {formatQuantidadeEtiqueta(p.quantidade, unidadeMedida)}
                </span>
              ) : null}

              {interactive ? (
                <button
                  type="button"
                  title={`${p.nomeProcedimento || ''} — ${p.quantidade ?? ''}`.trim()}
                  className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0"
                  style={{
                    width: Math.max(20, sizePx + 8),
                    height: Math.max(20, sizePx + 8),
                  }}
                  onPointerDown={(ev) => onMarkerPointerDown?.(ev, p)}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <span
                    className={`block rounded-full border-2 shadow-md transition-transform ${
                      selected
                        ? 'scale-110 border-yellow-300 ring-2 ring-yellow-300/50'
                        : 'border-white'
                    }`}
                    style={{
                      width: sizePx,
                      height: sizePx,
                      backgroundColor: cor,
                    }}
                  />
                </button>
              ) : (
                <span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                  style={{
                    width: sizePx,
                    height: sizePx,
                    backgroundColor: cor,
                  }}
                  aria-hidden
                />
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
